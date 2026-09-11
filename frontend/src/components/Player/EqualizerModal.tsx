import React, { useState } from 'react';
import { Sliders, Zap, X, RotateCcw } from 'lucide-react';
import {
  equalizer,
  EQUALIZER_BANDS,
  EQUALIZER_PRESETS,
} from '../../services/audioEqualizer';
import { useBackNavigation } from '../../services/backNavigation';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EqualizerModal: React.FC<EqualizerModalProps> = ({ isOpen, onClose }) => {
  const [eqState, setEqState] = useState(equalizer.getState());

  useBackNavigation('equalizer_modal', isOpen, onClose, 70);

  if (!isOpen) return null;

  const handleToggle = () => {
    const next = !eqState.enabled;
    equalizer.setEnabled(next);
    setEqState(equalizer.getState());
  };

  const handleSelectPreset = (presetId: string) => {
    equalizer.setPreset(presetId);
    setEqState(equalizer.getState());
  };

  const handleGainChange = (bandIndex: number, val: number) => {
    equalizer.setGain(bandIndex, val);
    setEqState(equalizer.getState());
  };

  const handleBassBoostChange = (val: number) => {
    equalizer.setBassBoost(val);
    setEqState(equalizer.getState());
  };

  const handleReset = () => {
    equalizer.setPreset('flat');
    setEqState(equalizer.getState());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full sm:max-w-md bg-[#161a23] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slideUp text-white select-none max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400">
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold">Эквалайзер</h3>
              <p className="text-[11px] text-gray-400">5 полос + Усиление баса</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                eqState.enabled
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {eqState.enabled ? 'Включен' : 'Выключен'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Пресеты */}
        <div className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Пресеты</span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors"
            >
              <RotateCcw size={12} />
              <span>Сбросить</span>
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {EQUALIZER_PRESETS.map((p) => {
              const isActive = eqState.presetId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p.id)}
                  disabled={!eqState.enabled}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all disabled:opacity-40 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Усиление баса (Bass Boost) */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-amber-400">
              <Zap size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Bass Boost</span>
            </div>
            <span className="text-xs font-bold text-amber-400">+{eqState.bassBoost} dB</span>
          </div>
          <input
            type="range"
            min={0}
            max={12}
            step={1}
            disabled={!eqState.enabled}
            value={eqState.bassBoost}
            onChange={(e) => handleBassBoostChange(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-40"
          />
        </div>

        {/* 5 вертикальных ползунков полос частот */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 mb-3 px-1">
            <span>+12 dB</span>
            <span>0 dB</span>
            <span>-12 dB</span>
          </div>

          <div className="grid grid-cols-5 gap-2 h-44 items-center justify-items-center">
            {EQUALIZER_BANDS.map((band, idx) => {
              const currentGain = eqState.gains[idx] || 0;

              return (
                <div key={band.frequency} className="h-full flex flex-col items-center justify-between py-1">
                  <span className="text-[10px] font-bold text-blue-400 h-4">
                    {currentGain > 0 ? `+${currentGain}` : currentGain}
                  </span>

                  {/* Вертикальный ползунок через CSS rotation */}
                  <div className="relative w-7 h-28 flex items-center justify-center">
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      disabled={!eqState.enabled}
                      value={currentGain}
                      onChange={(e) => handleGainChange(idx, Number(e.target.value))}
                      className="w-28 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-40 -rotate-90 origin-center"
                    />
                  </div>

                  <span className="text-[10px] font-medium text-gray-400 truncate mt-1">
                    {band.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
