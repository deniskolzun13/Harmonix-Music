import React, { useState, useEffect } from 'react';
import { QrCode, Smartphone, Check, Copy } from 'lucide-react';
import { NetworkInfo } from '../../types';
import { getNetworkInfo } from '../../api';

export const ConnectPhoneModal: React.FC = () => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getNetworkInfo().then(setNetworkInfo).catch(console.error);
  }, []);

  const copyUrl = () => {
    if (!networkInfo) return;
    navigator.clipboard.writeText(networkInfo.mobile_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-28 text-white select-none">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Smartphone size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Подключить телефон</h1>
          <p className="text-xs text-gray-400">Быстрый запуск на Android или iPhone</p>
        </div>
      </div>

      {/* Карточка с QR-кодом */}
      <div className="bg-[#151821] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center mb-6">
        <div className="bg-white p-3.5 rounded-2xl shadow-xl mb-4">
          {networkInfo ? (
            <img
              src={networkInfo.qr_code}
              alt="QR Code for Mobile"
              className="w-48 h-48 rounded-lg object-contain"
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-gray-100 text-gray-400">
              <QrCode size={48} className="animate-pulse text-gray-400" />
            </div>
          )}
        </div>

        <p className="text-sm font-semibold text-white mb-2">Наведите камеру смартфона</p>
        <p className="text-xs text-gray-400 max-w-xs mb-4">
          Телефон и компьютер должны находиться в одной сети Wi-Fi.
        </p>

        {/* Ссылка с кнопкой копирования */}
        {networkInfo && (
          <div className="flex items-center gap-2 bg-[#0d0f15] border border-white/10 rounded-xl px-3 py-2 w-full max-w-xs mb-4">
            <span className="text-xs font-mono text-blue-400 truncate flex-1 text-left">
              {networkInfo.mobile_url}
            </span>
            <button
              onClick={copyUrl}
              className="text-gray-400 hover:text-white p-1 transition-colors"
              title="Копировать адрес"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
          </div>
        )}

        {/* Кнопка прямой загрузки APK */}
        <a
          href="/api/download/apk"
          download="Harmonix_Player.apk"
          className="w-full max-w-xs py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <span>📥</span>
          <span>Скачать APK на Android (4.2 MB)</span>
        </a>
      </div>

      {/* Пошаговая инструкция */}
      <div className="bg-[#151821] border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Способы установки на телефон:
        </h3>

        <div className="border-b border-white/5 pb-3">
          <p className="text-xs font-semibold text-emerald-400 mb-1">Способ 1: Установка APK (Android)</p>
          <p className="text-xs text-gray-300 leading-relaxed">
            Нажмите кнопку «Скачать APK», откройте загруженный файл и подтвердите установку. Приложение появится в меню Android.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-blue-400 mb-1">Способ 2: PWA приложение (iPhone и Android)</p>
          <p className="text-xs text-gray-300 leading-relaxed">
            Отсканируйте QR-код и нажмите «На экран "Домой"» в браузере (Safari / Chrome).
          </p>
        </div>
      </div>
    </div>
  );
};

