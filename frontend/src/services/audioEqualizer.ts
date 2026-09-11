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
  };
}

function saveState(state: EqualizerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

class EqualizerManager {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private bassBoostNode: BiquadFilterNode | null = null;
  private isConnected = false;

  private state: EqualizerState = loadSavedState();

  public getState(): EqualizerState {
    return { ...this.state };
  }

  public init(audio: HTMLAudioElement) {
    if (this.isConnected) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.audioCtx = new AudioCtxClass();
      this.sourceNode = this.audioCtx.createMediaElementSource(audio);

      // 1. Создаем Bass Boost фильтр (низкие частоты 80 Гц)
      this.bassBoostNode = this.audioCtx.createBiquadFilter();
      this.bassBoostNode.type = 'lowshelf';
      this.bassBoostNode.frequency.value = 80;
      this.bassBoostNode.gain.value = this.state.enabled ? this.state.bassBoost : 0;

      // 2. Создаем 5 полос эквалайзера
      this.filterNodes = EQUALIZER_BANDS.map((band, idx) => {
        const node = this.audioCtx!.createBiquadFilter();
        node.type = band.type;
        node.frequency.value = band.frequency;
        node.gain.value = this.state.enabled ? this.state.gains[idx] || 0 : 0;
        return node;
      });

      // 3. Соединяем цепочку: Source -> BassBoost -> Filter[0] -> Filter[1]... -> Destination
      let lastNode: AudioNode = this.sourceNode;
      lastNode.connect(this.bassBoostNode);
      lastNode = this.bassBoostNode;

      for (const filter of this.filterNodes) {
        lastNode.connect(filter);
        lastNode = filter;
      }

      lastNode.connect(this.audioCtx.destination);
      this.isConnected = true;

      // Возобновление AudioContext при воспроизведении
      const resumeContext = () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
      };
      audio.addEventListener('play', resumeContext);
    } catch (e) {
      console.warn('Инициализация Web Audio API эквалайзера пропущена (нативное воспроизведение):', e);
    }
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
}

export const equalizer = new EqualizerManager();
