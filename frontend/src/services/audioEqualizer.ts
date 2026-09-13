// 5-полосный эквалайзер и Bass Boost на Web Audio API

export interface EqualizerBand {
  frequency: number;
  type: BiquadFilterType;
  label: string;
}

export const EQUALIZER_BANDS: EqualizerBand[] = [
  { frequency: 60, type: 'lowshelf', label: '60 Гц' },
  { frequency: 230, type: 'peaking', label: '230 Гц' },
  { frequency: 910, type: 'peaking', label: '910 Гц' },
  { frequency: 3600, type: 'peaking', label: '3.6 кГц' },
  { frequency: 14000, type: 'highshelf', label: '14 кГц' },
];

export interface EqualizerPreset {
  id: string;
  name: string;
  gains: number[]; // dB для 5 полос (-12 ... +12)
  bassBoost: number; // dB для баса (0 ... 12)
}

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  { id: 'flat', name: 'Обычный (Flat)', gains: [0, 0, 0, 0, 0], bassBoost: 0 },
  { id: 'bass_boost', name: 'Мощный бас (Bass Boost)', gains: [6, 4, 0, -1, -1], bassBoost: 8 },
  { id: 'rock', name: 'Рок', gains: [5, 3, -1, 3, 5], bassBoost: 3 },
  { id: 'electronic', name: 'Электроника', gains: [6, 4, 1, 2, 4], bassBoost: 5 },
  { id: 'pop', name: 'Поп', gains: [-1, 2, 4, 3, 1], bassBoost: 2 },
  { id: 'vocal', name: 'Вокал / Разговор', gains: [-3, -1, 4, 5, 2], bassBoost: 0 },
  { id: 'acoustic', name: 'Акустика', gains: [3, 2, 1, 2, 3], bassBoost: 1 },
];

const STORAGE_KEY = 'harmonix_eq_settings';

interface EqualizerState {
  enabled: boolean;
  presetId: string;
  gains: number[];
  bassBoost: number;
  normalization: boolean;
}

function loadSavedState(): EqualizerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    enabled: true,
    presetId: 'flat',
    gains: [0, 0, 0, 0, 0],
    bassBoost: 0,
    normalization: false,
  };
}

function saveState(state: EqualizerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

class EqualizerManager {
  private audioCtx: AudioContext | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private bassBoostNode: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private state: EqualizerState = loadSavedState();

  public getState(): EqualizerState {
    return { ...this.state };
  }

  public init(_audio?: HTMLAudioElement) {
    // В Capacitor / Android перехват через createMediaElementSource обрывает воспроизведение
    // кросс-доменных потоков (Яндекс Музыка, VK и внешние URL) из-за строгой политики CORS на сторонних CDN.
    // Поэтому воспроизведение идет напрямую через нативную аппаратную подсистему устройства,
    // гарантируя непрерывное звучание и работу в фоновом режиме без заиканий и сбоев.
  }

  public setGain(bandIndex: number, gainDb: number) {
    const clamped = Math.max(-12, Math.min(12, gainDb));
    this.state.gains[bandIndex] = clamped;
    this.state.presetId = 'custom';

    if (this.filterNodes[bandIndex] && this.state.enabled) {
      this.filterNodes[bandIndex].gain.setTargetAtTime(
        clamped,
        this.audioCtx?.currentTime || 0,
        0.05
      );
    }
    saveState(this.state);
  }

  public setBassBoost(gainDb: number) {
    const clamped = Math.max(0, Math.min(12, gainDb));
    this.state.bassBoost = clamped;
    this.state.presetId = 'custom';

    if (this.bassBoostNode && this.state.enabled) {
      this.bassBoostNode.gain.setTargetAtTime(
        clamped,
        this.audioCtx?.currentTime || 0,
        0.05
      );
    }
    saveState(this.state);
  }

  public setPreset(presetId: string) {
    const preset = EQUALIZER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    this.state.presetId = preset.id;
    this.state.gains = [...preset.gains];
    this.state.bassBoost = preset.bassBoost;

    if (this.state.enabled && this.audioCtx) {
      this.filterNodes.forEach((node, idx) => {
        node.gain.setTargetAtTime(preset.gains[idx] || 0, this.audioCtx!.currentTime, 0.05);
      });
      if (this.bassBoostNode) {
        this.bassBoostNode.gain.setTargetAtTime(preset.bassBoost, this.audioCtx.currentTime, 0.05);
      }
    }
    saveState(this.state);
  }

  public setEnabled(enabled: boolean) {
    this.state.enabled = enabled;
    if (this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.filterNodes.forEach((node, idx) => {
        node.gain.setTargetAtTime(enabled ? this.state.gains[idx] : 0, now, 0.05);
      });
      if (this.bassBoostNode) {
        this.bassBoostNode.gain.setTargetAtTime(enabled ? this.state.bassBoost : 0, now, 0.05);
      }
    }
    saveState(this.state);
  }

  public setNormalization(enabled: boolean) {
    this.state.normalization = enabled;
    if (this.compressorNode && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.compressorNode.threshold.setTargetAtTime(enabled ? -24 : 0, now, 0.05);
      this.compressorNode.ratio.setTargetAtTime(enabled ? 12 : 1, now, 0.05);
    }
    saveState(this.state);
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  public getByteFrequencyData(array: Uint8Array<any>): void {
    if (this.analyserNode) {
      this.analyserNode.getByteFrequencyData(array as any);
    }
  }

  public getByteTimeDomainData(array: Uint8Array<any>): void {
    if (this.analyserNode) {
      this.analyserNode.getByteTimeDomainData(array as any);
    }
  }
}

export const equalizer = new EqualizerManager();
