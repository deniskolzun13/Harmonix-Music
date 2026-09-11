import React, { useState, useEffect } from 'react';
import {
  Settings,
  Palette,
  HardDrive,
  Trash2,
  Server,
  Save,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Clipboard,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { getServerUrl, setServerUrl } from '../../api';
import { getCacheStats, clearCache } from '../../services/cacheManager';
import {
  requestYandexDeviceCode,
  pollYandexDeviceToken,
  YandexDeviceCodeResponse,
} from '../../services/standaloneImporter';

export const AccountsModal: React.FC = () => {
  const { theme, setTheme } = useTheme();

  // --- 1. Яндекс Музыка ---
  const [yandexToken, setYandexToken] = useState(() => localStorage.getItem('harmonix_yandex_token') || '');
  const [tokenInput, setTokenInput] = useState('');
  const [isVerifyingYm, setIsVerifyingYm] = useState(false);
  const [ymAccountInfo, setYmAccountInfo] = useState<{ login?: string; name?: string } | null>(null);

  // Device Code авторизация Yandex
  const [deviceAuth, setDeviceAuth] = useState<YandexDeviceCodeResponse | null>(null);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // --- 2. VK Музыка ---
  const [vkToken, setVkToken] = useState(() => localStorage.getItem('harmonix_vk_token') || '');
  const [vkInput, setVkInput] = useState('');
  const [isVerifyingVk, setIsVerifyingVk] = useState(false);
  const [vkAccountInfo, setVkAccountInfo] = useState<{ id?: number; name?: string } | null>(null);

  // --- 3. Spotify ---
  const [spotifyToken, setSpotifyToken] = useState(() => localStorage.getItem('harmonix_spotify_token') || '');
  const [spotifyInput, setSpotifyInput] = useState('');
  const [isVerifyingSpotify, setIsVerifyingSpotify] = useState(false);
  const [spotifyAccountInfo, setSpotifyAccountInfo] = useState<{ id?: string; name?: string } | null>(null);

  // Общие настройки
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [cacheStats, setCacheStats] = useState<{ count: number; formattedSize: string }>({
    count: 0,
    formattedSize: '0 МБ',
  });

  const loadCacheInfo = async () => {
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (e) {
      console.error(e);
    }
  };

  // Проверка Яндекс токена
  const checkYandexToken = async (tok: string) => {
    if (!tok.trim()) return;
    setIsVerifyingYm(true);
    try {
      const resp = await fetch('https://api.music.yandex.net/account/status', {
        headers: {
          'User-Agent': 'Yandex-Music-API',
          'Authorization': `OAuth ${tok.trim()}`,
        },
      });
      if (resp.ok) {
        const data = await resp.json();
        const acc = data.result?.account;
        if (acc && (acc.uid || acc.login)) {
          setYmAccountInfo({
            login: acc.login,
            name: acc.fullName || acc.displayName || acc.login,
          });
        }
      }
    } catch (e) {
      console.warn('Yandex status check:', e);
    } finally {
      setIsVerifyingYm(false);
    }
  };

  // Проверка VK токена
  const checkVkToken = async (tok: string) => {
    if (!tok.trim()) return;
    setIsVerifyingVk(true);
    try {
      // Проверяем прямо или через бэкенд
      const resp = await fetch(`https://api.vk.com/method/users.get?v=5.131&access_token=${encodeURIComponent(tok.trim())}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.response && data.response.length > 0) {
          const user = data.response[0];
          setVkAccountInfo({
            id: user.id,
            name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || `id${user.id}`,
          });
          return;
        }
      }
    } catch (e) {
      console.warn('Direct VK status check failed, trying backend:', e);
    }

    // Запасная проверка через бэкенд
    try {
      const sUrl = getServerUrl();
      if (sUrl) {
        const res = await fetch(`${sUrl}/api/auth/status`);
        if (res.ok) {
          const st = await res.json();
          if (st.vk && st.vk_username) {
            setVkAccountInfo({ name: st.vk_username });
          }
        }
      }
    } catch {
      // Игнорируем оффлайн бэкенда
    } finally {
      setIsVerifyingVk(false);
    }
  };

  // Проверка Spotify токена
  const checkSpotifyToken = async (tok: string) => {
    if (!tok.trim()) return;
    setIsVerifyingSpotify(true);
    try {
      const resp = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${tok.trim()}`,
        },
      });
      if (resp.ok) {
        const data = await resp.json();
        setSpotifyAccountInfo({
          id: data.id,
          name: data.display_name || data.id,
        });
      }
    } catch (e) {
      console.warn('Spotify check failed:', e);
    } finally {
      setIsVerifyingSpotify(false);
    }
  };

  useEffect(() => {
    setServerUrlInput(getServerUrl());
    loadCacheInfo();

    const savedYm = localStorage.getItem('harmonix_yandex_token');
    if (savedYm) checkYandexToken(savedYm);

    const savedVk = localStorage.getItem('harmonix_vk_token');
    if (savedVk) checkVkToken(savedVk);

    const savedSp = localStorage.getItem('harmonix_spotify_token');
    if (savedSp) checkSpotifyToken(savedSp);
  }, []);

  // --- Яндекс Handlers ---
  const handleStartDeviceAuth = async () => {
    setIsRequestingCode(true);
    try {
      const data = await requestYandexDeviceCode();
      setDeviceAuth(data);
      setIsPolling(true);
    } catch (err: any) {
      alert('Не удалось получить код: ' + (err.message || err));
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleCopyUserCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard copy error:', err);
    }
  };

  useEffect(() => {
    if (!isPolling || !deviceAuth) return;

    const intervalMs = Math.max(3, deviceAuth.interval || 4) * 1000;
    const timer = setInterval(async () => {
      try {
        const token = await pollYandexDeviceToken(deviceAuth.device_code);
        if (token) {
          localStorage.setItem('harmonix_yandex_token', token);
          setYandexToken(token);
          setDeviceAuth(null);
          setIsPolling(false);
          setSuccessMsg('🎉 Яндекс Музыка успешно подключена!');
          setTimeout(() => setSuccessMsg(''), 5000);

          const sUrl = getServerUrl();
          if (sUrl) {
            fetch(`${sUrl}/api/auth/save`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ yandex_token: token }),
            }).catch(() => {});
          }

          checkYandexToken(token);
        }
      } catch (err: any) {
        console.warn('Polling check error:', err);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPolling, deviceAuth]);

  const handleSaveYandexToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let val = tokenInput.trim();
    if (!val) return;

    const match = val.match(/access_token=([^&]+)/);
    if (match) val = match[1];

    localStorage.setItem('harmonix_yandex_token', val);
    setYandexToken(val);
    setTokenInput('');
    setSuccessMsg('Токен Яндекс Музыки сохранен!');
    setTimeout(() => setSuccessMsg(''), 4000);

    const sUrl = getServerUrl();
    if (sUrl) {
      fetch(`${sUrl}/api/auth/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yandex_token: val }),
      }).catch(() => {});
    }

    checkYandexToken(val);
  };

  const handleDeleteYandexToken = () => {
    if (!confirm('Удалить токен Яндекс Музыки?')) return;
    localStorage.removeItem('harmonix_yandex_token');
    setYandexToken('');
    setYmAccountInfo(null);
    setSuccessMsg('Яндекс Музыка отключена.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- VK Handlers ---
  const handleOpenVkOAuth = () => {
    const vkOAuthUrl =
      'https://oauth.vk.com/authorize?client_id=2685278&scope=audio,offline&redirect_uri=https://oauth.vk.com/blank.html&display=page&response_type=token';
    window.open(vkOAuthUrl, '_blank');
  };

  const handleSaveVkToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let val = vkInput.trim();
    if (!val) return;

    const match = val.match(/access_token=([^&]+)/);
    if (match) val = match[1];

    localStorage.setItem('harmonix_vk_token', val);
    setVkToken(val);
    setVkInput('');
    setSuccessMsg('🎉 VK Музыка успешно подключена!');
    setTimeout(() => setSuccessMsg(''), 4000);

    const sUrl = getServerUrl();
    if (sUrl) {
      fetch(`${sUrl}/api/auth/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vk_token: val }),
      }).catch(() => {});
    }

    checkVkToken(val);
  };

  const handleDeleteVkToken = () => {
    if (!confirm('Отключить аккаунт VK Музыки?')) return;
    localStorage.removeItem('harmonix_vk_token');
    setVkToken('');
    setVkAccountInfo(null);
    setSuccessMsg('VK Музыка отключена.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- Spotify Handlers ---
  const handleOpenSpotifyOAuth = () => {
    window.open('https://developer.spotify.com/dashboard', '_blank');
  };

  const handleSaveSpotifyToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let val = spotifyInput.trim();
    if (!val) return;

    const match = val.match(/access_token=([^&]+)/);
    if (match) val = match[1];

    localStorage.setItem('harmonix_spotify_token', val);
    setSpotifyToken(val);
    setSpotifyInput('');
    setSuccessMsg('🎉 Spotify успешно подключен!');
    setTimeout(() => setSuccessMsg(''), 4000);

    const sUrl = getServerUrl();
    if (sUrl) {
      fetch(`${sUrl}/api/auth/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotify_token: val }),
      }).catch(() => {});
    }

    checkSpotifyToken(val);
  };

  const handleDeleteSpotifyToken = () => {
    if (!confirm('Отключить Spotify?')) return;
    localStorage.removeItem('harmonix_spotify_token');
    setSpotifyToken('');
    setSpotifyAccountInfo(null);
    setSuccessMsg('Spotify отключен.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Общие хэндлеры
  const handleSaveServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (serverUrlInput.trim()) {
      setServerUrl(serverUrlInput.trim());
      setSuccessMsg('Адрес сервера успешно сохранен!');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Удалить все скачанные треки и обложки с телефона?')) return;
    try {
      await clearCache();
      await loadCacheInfo();
      setSuccessMsg('Оффлайн-память очищена!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  };

  const themes: { id: AppTheme; title: string; desc: string; iconBg: string }[] = [
    {
      id: 'dark',
      title: 'Темная (OLED)',
      desc: 'Обсидиановый черный, экономия батареи OLED-экранов',
      iconBg: 'bg-zinc-900 border-zinc-700 text-zinc-300',
    },
    {
      id: 'glass',
      title: 'Глассморфизм',
      desc: 'Жидкое матовое стекло, неоновые акценты и свечение',
      iconBg: 'bg-cyan-500/20 border-cyan-400 text-cyan-300',
    },
    {
      id: 'y2k',
      title: 'Ретро Y2K (2000-е)',
      desc: 'Вайб Winamp, неоновый лайм, пиксельная сетка',
      iconBg: 'bg-lime-500/20 border-lime-400 text-lime-300',
    },
    {
      id: 'artwork',
      title: 'Динамическая обложка',
      desc: 'Фон адаптируется и размывается под текущий трек',
      iconBg: 'bg-purple-500/20 border-purple-400 text-purple-300',
    },
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-safe-top pb-44 text-white select-none">
      {/* Шапка */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Settings size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Настройки</h1>
          <p className="text-xs text-gray-400">Аккаунты музыки, темы и память</p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs p-3 rounded-2xl mb-4 text-center font-medium animate-fadeIn flex items-center justify-center gap-2">
          <CheckCircle2 size={15} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* ========================================================
            1. ЯНДЕКС МУЗЫКА
           ======================================================== */}
        <div className="theme-card bg-[#151821] border border-white/10 rounded-3xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-xs border border-red-500/30">
                Я
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Яндекс Музыка</h2>
                <p className="text-[10px] text-gray-400">Полные треки (320 kbps) и закрытые плейлисты</p>
              </div>
            </div>

            {yandexToken ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                Подключен
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">
                Демо 30 сек
              </span>
            )}
          </div>

          {yandexToken ? (
            <div className="bg-[#0d0f15] rounded-2xl p-3 border border-emerald-500/30 mb-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300">Аккаунт подключен</span>
                </div>
                <button
                  onClick={handleDeleteYandexToken}
                  className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Отключить
                </button>
              </div>
              {ymAccountInfo?.login && (
                <p className="text-[11px] text-gray-300">
                  Пользователь: <span className="font-mono text-white font-bold">{ymAccountInfo.login}</span>
                  {ymAccountInfo.name && ymAccountInfo.name !== ymAccountInfo.login ? ` (${ymAccountInfo.name})` : ''}
                </p>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-gray-500 font-mono truncate max-w-[200px]">
                  {yandexToken.slice(0, 10)}••••••••••••••••
                </span>
                <button
                  onClick={() => checkYandexToken(yandexToken)}
                  disabled={isVerifyingYm}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                >
                  <RefreshCw size={11} className={isVerifyingYm ? 'animate-spin' : ''} />
                  <span>Проверить</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {deviceAuth ? (
                <div className="bg-gradient-to-b from-red-600/20 via-zinc-900 to-[#0d0f15] border-2 border-red-500/50 rounded-2xl p-4 text-center space-y-3 shadow-xl animate-fadeIn">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-red-400">
                    <Sparkles size={15} />
                    <span>Подтверждение входа в Яндекс</span>
                  </div>

                  <p className="text-xs text-gray-300">
                    1. Одноразовый код (нажмите для копирования):
                  </p>

                  <button
                    type="button"
                    onClick={() => handleCopyUserCode(deviceAuth.user_code)}
                    className="w-full py-3 px-4 bg-black/70 hover:bg-black/90 border-2 border-red-500/60 hover:border-red-400 rounded-2xl font-mono text-2xl font-black text-white tracking-widest active:scale-95 transition-all shadow-inner flex items-center justify-center gap-3"
                  >
                    <span>{deviceAuth.user_code.toUpperCase()}</span>
                    {codeCopied ? <Check size={20} className="text-emerald-400" /> : <Copy size={20} className="text-red-400" />}
                  </button>
                  {codeCopied && (
                    <p className="text-[11px] text-emerald-400 font-semibold animate-fadeIn">
                      Код скопирован в буфер!
                    </p>
                  )}

                  <p className="text-xs text-gray-300">
                    2. Откройте ya.ru/device и подтвердите:
                  </p>

                  <button
                    type="button"
                    onClick={() => window.open(deviceAuth.verification_url || 'https://ya.ru/device', '_blank')}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 active:scale-98 transition-all"
                  >
                    <ExternalLink size={15} />
                    <span>Открыть ya.ru/device в браузере</span>
                  </button>

                  <div className="flex items-center justify-center gap-2 text-xs text-amber-300/90 pt-1">
                    <Loader2 size={14} className="animate-spin text-red-400" />
                    <span>Ожидаем подтверждения...</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDeviceAuth(null);
                      setIsPolling(false);
                    }}
                    className="text-xs text-gray-400 hover:text-white underline pt-1"
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartDeviceAuth}
                  disabled={isRequestingCode}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 hover:opacity-95 active:scale-98 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all"
                >
                  {isRequestingCode ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  <span>Войти через код на ya.ru/device (1 клик)</span>
                </button>
              )}

              {/* Ручной ввод токена Яндекс */}
              <form onSubmit={handleSaveYandexToken} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Или вставьте токен Яндекс y0_..."
                  className="flex-1 bg-[#0d0f15] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={!tokenInput.trim()}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-red-600/20"
                >
                  <Save size={13} />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ========================================================
            2. VK МУЗЫКА
           ======================================================== */}
        <div className="theme-card bg-[#151821] border border-white/10 rounded-3xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/30">
                VK
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">VK Музыка</h2>
                <p className="text-[10px] text-gray-400">Импорт и синхронизация музыки ВКонтакте</p>
              </div>
            </div>

            {vkToken ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                Подключен
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700/50 text-gray-400 border border-white/10 font-semibold">
                Не подключен
              </span>
            )}
          </div>

          {vkToken ? (
            <div className="bg-[#0d0f15] rounded-2xl p-3 border border-emerald-500/30 mb-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300">VK подключен</span>
                </div>
                <button
                  onClick={handleDeleteVkToken}
                  className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Отключить
                </button>
              </div>
              {vkAccountInfo?.name && (
                <p className="text-[11px] text-gray-300">
                  Профиль: <span className="font-mono text-white font-bold">{vkAccountInfo.name}</span>
                </p>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-gray-500 font-mono truncate max-w-[200px]">
                  {vkToken.slice(0, 12)}••••••••••••••••
                </span>
                <button
                  onClick={() => checkVkToken(vkToken)}
                  disabled={isVerifyingVk}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                >
                  <RefreshCw size={11} className={isVerifyingVk ? 'animate-spin' : ''} />
                  <span>Проверить</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleOpenVkOAuth}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 hover:opacity-95 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
              >
                <ExternalLink size={16} />
                <span>1. Авторизоваться ВКонтакте (Kate Mobile)</span>
              </button>

              {/* Пошаговая подсказка о белой странице blank.html */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 text-[11px] text-blue-200 space-y-1.5">
                <p className="font-bold text-blue-300 flex items-center gap-1.5">
                  <span>💡 Что делать после нажатия кнопки:</span>
                </p>
                <p className="leading-snug">
                  1. В браузере откроется белая страница <code className="bg-blue-900/40 px-1 rounded text-blue-300">blank.html</code> с предупреждением — <b>это не ошибка, авторизация прошла успешно!</b>
                </p>
                <p className="leading-snug">
                  2. <b>Скопируйте адрес страницы целиком из адресной строки браузера</b> (в ней находится ваш токен <code className="bg-blue-900/40 px-1 rounded text-blue-300">#access_token=...</code>).
                </p>
                <p className="leading-snug">
                  3. Вставьте скопированную ссылку в поле ниже и нажмите кнопку сохранения (дискетка).
                </p>
              </div>

              <form onSubmit={handleSaveVkToken} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={vkInput}
                    onChange={(e) => setVkInput(e.target.value)}
                    placeholder="Вставьте адрес страницы или access_token"
                    className="w-full bg-[#0d0f15] border border-white/10 rounded-xl py-2 pl-3 pr-8 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  {!vkInput && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const txt = await navigator.clipboard.readText();
                          if (txt) setVkInput(txt.trim());
                        } catch {}
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                    >
                      <Clipboard size={13} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!vkInput.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex-shrink-0"
                >
                  <Save size={13} />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ========================================================
            3. SPOTIFY
           ======================================================== */}
        <div className="theme-card bg-[#151821] border border-white/10 rounded-3xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30">
                SP
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Spotify</h2>
                <p className="text-[10px] text-gray-400">Импорт треков и плейлистов Spotify</p>
              </div>
            </div>

            {spotifyToken ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                Подключен
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700/50 text-gray-400 border border-white/10 font-semibold">
                Не подключен
              </span>
            )}
          </div>

          {spotifyToken ? (
            <div className="bg-[#0d0f15] rounded-2xl p-3 border border-emerald-500/30 mb-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300">Spotify подключен</span>
                </div>
                <button
                  onClick={handleDeleteSpotifyToken}
                  className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Отключить
                </button>
              </div>
              {spotifyAccountInfo?.name && (
                <p className="text-[11px] text-gray-300">
                  Аккаунт: <span className="font-mono text-white font-bold">{spotifyAccountInfo.name}</span>
                </p>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-gray-500 font-mono truncate max-w-[200px]">
                  {spotifyToken.slice(0, 10)}••••••••••••••••
                </span>
                <button
                  onClick={() => checkSpotifyToken(spotifyToken)}
                  disabled={isVerifyingSpotify}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                >
                  <RefreshCw size={11} className={isVerifyingSpotify ? 'animate-spin' : ''} />
                  <span>Проверить</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Подсказка о работе Spotify без токена */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-[11px] text-emerald-200 space-y-1.5">
                <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <span>✨ Spotify работает без авторизации!</span>
                </p>
                <p className="leading-snug">
                  Вы можете просто вставлять любые ссылки на плейлисты, альбомы или треки Spotify на главном экране через <b>«+ Ссылка»</b> или кнопку <b>«+ Трек»</b> — треки загружаются напрямую без ввода токенов!
                </p>
              </div>

              <div className="pt-1">
                <p className="text-[11px] text-gray-400 mb-2">
                  Для доступа к приватным плейлистам вставьте токен из Spotify Dashboard:
                </p>
                <button
                  type="button"
                  onClick={handleOpenSpotifyOAuth}
                  className="w-full py-2.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-98 text-white font-medium text-xs flex items-center justify-center gap-2 border border-white/10 transition-all mb-2"
                >
                  <ExternalLink size={15} />
                  <span>Открыть Spotify Developer Dashboard</span>
                </button>
              </div>

              <form onSubmit={handleSaveSpotifyToken} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={spotifyInput}
                    onChange={(e) => setSpotifyInput(e.target.value)}
                    placeholder="Вставьте токен Spotify (OAuth Token)"
                    className="w-full bg-[#0d0f15] border border-white/10 rounded-xl py-2 pl-3 pr-8 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  {!spotifyInput && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const txt = await navigator.clipboard.readText();
                          if (txt) setSpotifyInput(txt.trim());
                        } catch {}
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                    >
                      <Clipboard size={13} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!spotifyInput.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex-shrink-0"
                >
                  <Save size={13} />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ========================================================
            4. ТЕМЫ ОФОРМЛЕНИЯ
           ======================================================== */}
        <div className="theme-card bg-[#151821] border border-white/10 rounded-3xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <Palette size={18} className="text-purple-400" />
            <h2 className="text-sm font-bold text-white">Тема оформления</h2>
          </div>

          <div className="space-y-2">
            {themes.map((t) => {
              const isSelected = theme === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`p-3 rounded-2xl cursor-pointer transition-all border flex items-center justify-between ${
                    isSelected
                      ? 'bg-purple-600/20 border-purple-500/60 shadow-lg'
                      : 'bg-white/5 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center border text-xs font-bold ${t.iconBg}`}
                    >
                      <Sparkles size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{t.title}</p>
                      <p className="text-[10px] text-gray-400">{t.desc}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={12} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================
            5. ОФФЛАЙН-ПАМЯТЬ ТЕЛЕФОНА
           ======================================================== */}
        <div className="theme-card bg-[#151821] border border-white/10 rounded-3xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={18} className="text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Оффлайн-память телефона</h2>
          </div>

          <div className="bg-[#0d0f15] rounded-2xl p-3 mb-3 border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-300">
                {cacheStats.count} треков сохранено
              </p>
              <p className="text-[11px] text-gray-400">
                Занято: <span className="font-mono text-white">{cacheStats.formattedSize}</span>
              </p>
            </div>
            {cacheStats.count > 0 && (
              <button
                onClick={handleClearCache}
                className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 size={13} />
                <span>Очистить</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Вся музыка, добавленная по ссылкам, может быть сохранена на устройство для прослушивания без подключения к сети.
          </p>
        </div>

        {/* ========================================================
            6. СЕРВЕР СИНХРОНИЗАЦИИ
           ======================================================== */}
        <div className="theme-card bg-[#151821] border border-white/10 rounded-3xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <Server size={18} className="text-blue-400" />
            <h2 className="text-sm font-bold text-white">Сервер синхронизации</h2>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            IP адрес компьютера в Wi-Fi сети для дополнительной синхронизации (необязательно).
          </p>
          <form onSubmit={handleSaveServer} className="flex gap-2">
            <input
              type="text"
              placeholder="http://192.168.0.11:8000"
              value={serverUrlInput}
              onChange={(e) => setServerUrlInput(e.target.value)}
              className="flex-1 bg-[#0d0f15] border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5"
            >
              <Save size={14} />
              <span>Сохранить</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
