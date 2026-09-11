import React, { useEffect, useRef, useState } from 'react';
import { equalizer } from '../../services/audioEqualizer';
import { Waves, BarChart2 } from 'lucide-react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isPlaying, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<'bars' | 'wave'>('bars');
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    let idlePhase = 0;

    // Буферы для спектра и волны
    const freqData = new Uint8Array(64);
    const waveData = new Uint8Array(128);

    const render = () => {
      if (!isRunning) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (width === 0 || height === 0) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const analyser = equalizer.getAnalyser();

      if (mode === 'bars') {
        // --- РЕЖИМ 1: Спектральные столбики (Bars) ---
        const barValues: number[] = [];

        if (isPlaying && analyser) {
          equalizer.getByteFrequencyData(freqData);
          const binCount = 28;
          for (let i = 0; i < binCount; i++) {
            barValues.push(freqData[i] || 0);
          }
        } else {
          idlePhase += 0.04;
          const binCount = 28;
          for (let i = 0; i < binCount; i++) {
            const idleVal = Math.sin(idlePhase + (i / binCount) * Math.PI * 2) * 12 + 16;
            barValues.push(Math.max(4, idleVal));
          }
        }

        const barCount = barValues.length;
        const totalGap = (barCount - 1) * 3;
        const barWidth = Math.max(3, (width - totalGap) / barCount);
        const maxBarHeight = height * 0.82;

        for (let i = 0; i < barCount; i++) {
          const val = barValues[i] / 255;
          const barH = Math.max(4, val * maxBarHeight);
          const x = i * (barWidth + 3);
          const y = height - barH - 8;

          const grad = ctx.createLinearGradient(0, height, 0, y);
          grad.addColorStop(0, '#06b6d4');
          grad.addColorStop(0.5, '#3b82f6');
          grad.addColorStop(1, '#a855f7');

          ctx.fillStyle = grad;
          ctx.shadowColor = 'rgba(59, 130, 246, 0.45)';
          ctx.shadowBlur = 8;

          const radius = Math.min(barWidth / 2, 4);
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, barWidth, barH, [radius, radius, 1, 1]);
          } else {
            ctx.rect(x, y, barWidth, barH);
          }
          ctx.fill();

          // Отражение снизу
          ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
          ctx.shadowBlur = 0;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, height - 6, barWidth, Math.min(6, barH * 0.25), [1, 1, radius, radius]);
          } else {
            ctx.rect(x, height - 6, barWidth, Math.min(6, barH * 0.25));
          }
          ctx.fill();
        }
      } else {
        // --- РЕЖИМ 2: Осциллограмма / Волна (Waveform) ---
        const points: number[] = [];

        if (isPlaying && analyser) {
          equalizer.getByteTimeDomainData(waveData);
          for (let i = 0; i < waveData.length; i++) {
            points.push((waveData[i] - 128) / 128);
          }
        } else {
          idlePhase += 0.05;
          for (let i = 0; i < 100; i++) {
            const p = (i / 100) * Math.PI * 4;
            points.push(Math.sin(idlePhase + p) * 0.12);
          }
        }

        const centerY = height / 2;
        const sliceWidth = width / (points.length - 1);

        const areaGrad = ctx.createLinearGradient(0, 0, 0, height);
        areaGrad.addColorStop(0, 'rgba(168, 85, 247, 0.25)');
        areaGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.15)');
        areaGrad.addColorStop(1, 'rgba(6, 182, 212, 0.02)');

        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for (let i = 0; i < points.length; i++) {
          const x = i * sliceWidth;
          const y = centerY + points[i] * (height * 0.42);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = areaGrad;
        ctx.fill();

        const lineGrad = ctx.createLinearGradient(0, 0, width, 0);
        lineGrad.addColorStop(0, '#06b6d4');
        lineGrad.addColorStop(0.5, '#3b82f6');
        lineGrad.addColorStop(1, '#c084fc');

        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          const x = i * sliceWidth;
          const y = centerY + points[i] * (height * 0.42);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 12;
        ctx.stroke();
      }

      ctx.restore();

      if (isRunning) {
        animFrameIdRef.current = requestAnimationFrame(render);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isPlaying, mode]);

  const toggleMode = () => {
    setMode((prev) => (prev === 'bars' ? 'wave' : 'bars'));
  };

  return (
    <div
      onClick={toggleMode}
      className={`relative w-full h-full flex flex-col items-center justify-center cursor-pointer select-none group ${className}`}
      title="Нажмите, чтобы сменить стиль визуализации (Спектр / Волна)"
    >
      <canvas ref={canvasRef} className="w-full h-full block rounded-3xl" />

      {/* Бейдж переключения режима */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-medium text-gray-300 shadow-lg group-hover:border-blue-500/50 transition-all">
        {mode === 'bars' ? <BarChart2 size={12} className="text-cyan-400" /> : <Waves size={12} className="text-purple-400" />}
        <span>{mode === 'bars' ? 'Спектр' : 'Волна'}</span>
      </div>
    </div>
  );
};
