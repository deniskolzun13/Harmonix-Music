import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Shuffle,
  RotateCw,
  Radio,
  Users,
  Loader2,
  ChevronRight,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { Track, RelatedArtist, AuthStatus } from '../../types';
import {
  getYandexWaveTracks,
  getVkPersonalRecommendations,
  getSpotifyRelatedArtists,
  getAuthStatus,
} from '../../api';
import { usePlayer } from '../../context/PlayerContext';
import { CoverImage } from '../Common/CoverImage';

interface RecommendationsTabProps {
  onOpenSettings?: () => void;
}

function formatDuration(sec: number): string {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const RecommendationsTab: React.FC<RecommendationsTabProps> = ({ onOpenSettings }) => {
  const { currentTrack, isPlaying, playTrack, openArtist } = usePlayer();

  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

  // Состояния для «Моей волны» (Яндекс Музыка)
  const [isWaveLoading, setIsWaveLoading] = useState(false);
  const [waveError, setWaveError] = useState<string | null>(null);
  const [isWaveActive, setIsWaveActive] = useState(false);

  // Состояния для рекомендаций VK Музыки
  const [vkTracks, setVkTracks] = useState<Track[]>([]);
  const [isVkLoading, setIsVkLoading] = useState(false);
  const [vkError, setVkError] = useState<string | null>(null);

  // Состояния для похожих артистов (Spotify)
  const [spotifyArtistQuery, setSpotifyArtistQuery] = useState('');
  const [relatedArtists, setRelatedArtists] = useState<RelatedArtist[]>([]);
  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  // Загрузка статусов авторизации
  useEffect(() => {
    getAuthStatus().then(setAuthStatus).catch(() => {});
  }, []);

  // Первичная загрузка рекомендаций VK при монтировании (если авторизован)
  useEffect(() => {
    if (authStatus?.vk) {
      loadVkRecommendations();
    }
  }, [authStatus?.vk]);

  // Загрузка похожих артистов Spotify на основе текущего трека
  useEffect(() => {
    if (authStatus?.spotify) {
      const seed = currentTrack?.artist ? currentTrack.artist.split(',')[0].trim() : 'The Weeknd';
      setSpotifyArtistQuery(seed);
      loadSpotifyRelatedArtists(seed);
    }
  }, [authStatus?.spotify, currentTrack?.artist]);

  // Запуск / продолжение «Моей волны»
  const handleStartWave = async () => {
    setIsWaveLoading(true);
    setWaveError(null);
    try {
      const tracks = await getYandexWaveTracks(25);
      if (tracks.length > 0) {
        setIsWaveActive(true);
        playTrack(tracks[0], tracks);
      } else {
        setWaveError('Яндекс не вернул треки для волны. Проверьте авторизацию.');
      }
    } catch (err: any) {
      setWaveError(err.message || 'Ошибка запуска Моей волны');
    } finally {
      setIsWaveLoading(false);
    }
  };

  // Загрузка рекомендаций VK
  const loadVkRecommendations = async () => {
    setIsVkLoading(true);
    setVkError(null);
    try {
      const tracks = await getVkPersonalRecommendations(30);
      setVkTracks(tracks);
      if (tracks.length === 0) {
        setVkError('Рекомендации VK пока пусты. Добавьте больше треков в профиль.');
      }
    } catch (err: any) {
      setVkError(err.message || 'Ошибка получения рекомендаций VK');
    } finally {
      setIsVkLoading(false);
    }
  };

  // Воспроизведение рекомендаций VK
  const handlePlayAllVk = (shuffle: boolean = false) => {
    if (vkTracks.length === 0) return;
    const list = shuffle ? [...vkTracks].sort(() => Math.random() - 0.5) : [...vkTracks];
    playTrack(list[0], list);
  };

  // Загрузка похожих артистов Spotify
  const loadSpotifyRelatedArtists = async (artistName: string) => {
    if (!artistName.trim()) return;
    setIsSpotifyLoading(true);
    setSpotifyError(null);
    try {
      const artists = await getSpotifyRelatedArtists(artistName.trim(), 15);
      setRelatedArtists(artists);
      if (artists.length === 0) {
        setSpotifyError(`Похожих артистов для «${artistName}» не найдено`);
      }
    } catch (err: any) {
      setSpotifyError(err.message || 'Ошибка поиска похожих артистов в Spotify');
    } finally {
      setIsSpotifyLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-28 px-4 pt-2">
      {/* 1. БЛОК: ЯНДЕКС МУЗЫКА — «МОЯ ВОЛНА» */}
      <section className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-[#1c1917] via-[#201524] to-[#121625] border border-amber-500/20 shadow-2xl">
        <div className="absolute -top-16 -right-16 w-52 h-52 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                <Radio size={26} className={isPlaying && isWaveActive ? 'animate-pulse' : ''} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black tracking-tight text-white">Моя волна</h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Яндекс
                  </span>
                </div>
                <p className="text-xs text-gray-300 mt-0.5">Бесконечный персональный поток музыки</p>
              </div>
            </div>

            {authStatus?.yandex && (
              <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 size={13} />
                {authStatus.yandex_username || 'Подключено'}
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400 leading-relaxed mb-5">
            Нейросеть Яндекс Музыки постоянно анализирует ваши прослушивания, лайки и настроение, собирая треки в живую непрерывную волну.
          </p>

          {authStatus && !authStatus.yandex ? (
            <button
              onClick={onOpenSettings}
              className="w-full py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              Подключить Яндекс Музыку в Настройках
              <ChevronRight size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleStartWave}
                disabled={isWaveLoading}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/25 active:scale-98 transition-all"
              >
                {isWaveLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-black" />
                    <span>Настраиваем волну...</span>
                  </>
                ) : (
                  <>
                    <Play size={18} fill="currentColor" />
                    <span>{isWaveActive ? 'Перезапустить волну' : 'Включить Мою волну'}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleStartWave}
                disabled={isWaveLoading}
                className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white active:scale-95 transition-all"
                title="Обновить поток"
              >
                <RotateCw size={18} className={isWaveLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          )}

          {waveError && (
            <p className="text-xs text-rose-400 mt-3 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
              {waveError}
            </p>
          )}
        </div>
      </section>

      {/* 2. БЛОК: VK МУЗЫКА — «ПЕРСОНАЛЬНЫЕ РЕКОМЕНДАЦИИ» */}
      <section className="rounded-3xl p-5 bg-[#161a23] border border-white/10 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Рекомендации VK</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  VK
                </span>
              </div>
              <p className="text-[11px] text-gray-400">На основе ваших аудиозаписей и лайков</p>
            </div>
          </div>

          {authStatus?.vk && vkTracks.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePlayAllVk(false)}
                className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white active:scale-95 transition-all"
                title="Слушать по порядку"
              >
                <Play size={15} fill="currentColor" />
              </button>
              <button
                onClick={() => handlePlayAllVk(true)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white active:scale-95 transition-all"
                title="Перемешать"
              >
                <Shuffle size={15} />
              </button>
              <button
                onClick={loadVkRecommendations}
                disabled={isVkLoading}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white active:scale-95 transition-all"
                title="Обновить"
              >
                <RotateCw size={15} className={isVkLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
        </div>

        {authStatus && !authStatus.vk ? (
          <div className="py-6 text-center">
            <p className="text-xs text-gray-400 mb-3">
              Для персональных рекомендаций VK подключите аккаунт ВКонтакте
            </p>
            <button
              onClick={onOpenSettings}
              className="px-4 py-2.5 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-300 font-medium text-xs hover:bg-blue-600/50 transition-all"
            >
              Подключить VK в Настройках
            </button>
          </div>
        ) : isVkLoading && vkTracks.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-gray-400 gap-2">
            <Loader2 size={24} className="animate-spin text-blue-400" />
            <span className="text-xs">Загружаем персональный микс VK...</span>
          </div>
        ) : vkError ? (
          <div className="py-6 text-center">
            <p className="text-xs text-rose-400 mb-3">{vkError}</p>
            <button
              onClick={loadVkRecommendations}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white"
            >
              Попробовать снова
            </button>
          </div>
        ) : (
          <div className="space-y-1 mt-2">
            {vkTracks.slice(0, 10).map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => playTrack(track, vkTracks)}
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                      : 'hover:bg-white/5 active:bg-white/10 text-white'
                  }`}
                >
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-black/40 shrink-0">
                    <CoverImage src={track.cover_url} alt={track.title} className="w-full h-full object-cover" />
                    {isCurrent && isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-blue-400' : 'text-gray-100'}`}>
                      {track.title}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{track.artist}</p>
                  </div>

                  <span className="text-[11px] text-gray-500 shrink-0 font-mono">
                    {formatDuration(track.duration)}
                  </span>
                </div>
              );
            })}

            {vkTracks.length > 10 && (
              <button
                onClick={() => handlePlayAllVk(false)}
                className="w-full py-2.5 mt-2 rounded-xl bg-white/5 hover:bg-white/10 text-center text-xs font-medium text-blue-400 transition-all"
              >
                Показать и слушать все {vkTracks.length} треков
              </button>
            )}
          </div>
        )}
      </section>

      {/* 3. БЛОК: SPOTIFY — «ПОХОЖИЕ АРТИСТЫ» */}
      <section className="rounded-3xl p-5 bg-[#161a23] border border-white/10 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Похожие артисты</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Spotify
                </span>
              </div>
              <p className="text-[11px] text-gray-400">Находите новое звучание по любимым артистам</p>
            </div>
          </div>
        </div>

        {authStatus && !authStatus.spotify ? (
          <div className="py-6 text-center">
            <p className="text-xs text-gray-400 mb-3">
              Для поиска похожих исполнителей подключите Spotify в Настройках
            </p>
            <button
              onClick={onOpenSettings}
              className="px-4 py-2.5 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-medium text-xs hover:bg-emerald-600/50 transition-all"
            >
              Подключить Spotify в Настройках
            </button>
          </div>
        ) : (
          <div>
            {/* Поисковая строка исполнителя */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadSpotifyRelatedArtists(spotifyArtistQuery);
              }}
              className="flex items-center gap-2 mb-4 mt-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={spotifyArtistQuery}
                  onChange={(e) => setSpotifyArtistQuery(e.target.value)}
                  placeholder="Имя артиста (напр. Miyagi, Drake...)"
                  className="w-full py-2.5 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
                <Search size={15} className="absolute left-3 top-3 text-gray-400" />
              </div>
              <button
                type="submit"
                disabled={isSpotifyLoading}
                className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs active:scale-95 transition-all shrink-0"
              >
                {isSpotifyLoading ? <Loader2 size={15} className="animate-spin" /> : 'Найти'}
              </button>
            </form>

            {isSpotifyLoading ? (
              <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Loader2 size={24} className="animate-spin text-emerald-400" />
                <span className="text-xs">Ищем похожих исполнителей в Spotify...</span>
              </div>
            ) : spotifyError ? (
              <p className="text-xs text-center text-gray-400 py-4">{spotifyError}</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar overscroll-x-contain">
                {relatedArtists.map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => openArtist(artist.name)}
                    className="flex-shrink-0 w-28 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-center cursor-pointer group"
                  >
                    <div className="w-16 h-16 mx-auto rounded-full overflow-hidden mb-2.5 bg-black/40 border border-white/10 group-hover:border-emerald-500/50 transition-all shadow-md">
                      {artist.cover_url ? (
                        <img
                          src={artist.cover_url}
                          alt={artist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-emerald-400 bg-emerald-500/10">
                          <Users size={20} />
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                      {artist.name}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">
                      {artist.genres && artist.genres.length > 0 ? artist.genres[0] : 'Артист'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
