import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Link2,
  FileAudio,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Plus,
  Radio,
} from 'lucide-react';
import { Track } from '../../types';
import { importPlaylistByUrl } from '../../api';
import { addCustomTrack } from '../../services/playlistStorage';
import { saveTrackToCache } from '../../services/cacheManager';

interface AddTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultArtist?: string;
  onTrackAdded: (track: Track) => void;
}

type TabType = 'file' | 'link' | 'manual';

export const AddTrackModal: React.FC<AddTrackModalProps> = ({
  isOpen,
  onClose,
  defaultArtist,
  onTrackAdded,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('file');

  // Поля вкладки "Файл с устройства"
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const [fileArtist, setFileArtist] = useState('');
  const [fileDuration, setFileDuration] = useState(0);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Поля вкладки "По ссылке"
  const [linkUrl, setLinkUrl] = useState('');
  const [isImportingLink, setIsImportingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Поля вкладки "Вручную"
  const [manualTitle, setManualTitle] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [manualStreamUrl, setManualStreamUrl] = useState('');
  const [manualCoverUrl, setManualCoverUrl] = useState('');

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (defaultArtist) {
      setFileArtist(defaultArtist);
      setManualArtist(defaultArtist);
    }
  }, [defaultArtist, isOpen]);

  if (!isOpen) return null;

  // Парсинг имени файла: "Исполнитель - Название.mp3"
  const parseFileName = (fileName: string): { artist: string; title: string } => {
    const clean = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim();
    const parts = clean.split(' - ');
    if (parts.length >= 2) {
      return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
    }
    return { artist: defaultArtist || 'Неизвестный исполнитель', title: clean };
  };

  // Обработка выбора локального файла
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const parsed = parseFileName(file.name);
    setFileTitle(parsed.title);
    setFileArtist(defaultArtist || parsed.artist);
    setStatusMessage(null);

    // Измерение реальной длительности аудиофайла через HTML5 Audio
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio(objectUrl);
    audio.addEventListener('loadedmetadata', () => {
      setFileDuration(Math.round(audio.duration) || 180);
    });
    audio.addEventListener('error', () => {
      setFileDuration(180);
    });
  };

  // Сохранение локального файла
  const handleSaveLocalFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !fileTitle.trim()) return;

    setIsProcessingFile(true);
    setStatusMessage(null);

    try {
      const trackId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const streamBlobUrl = URL.createObjectURL(selectedFile);

      const track: Track = {
        id: trackId,
        title: fileTitle.trim(),
        artist: fileArtist.trim() || 'Неизвестный исполнитель',
        album: 'Загружено с устройства',
        duration: fileDuration || 180,
        platform: 'local',
        stream_url: streamBlobUrl,
        is_playable: true,
        original_uri: `local:${trackId}`,
      };

      // 1. Сохраняем трек в IndexedDB оффлайн-кэш для постоянного доступа
      try {
        await saveTrackToCache(track, 'Загруженная музыка');
      } catch (cacheErr) {
        console.warn('IndexedDB direct cache warning:', cacheErr);
      }

      // 2. Добавляем в сохраненные плейлисты
      addCustomTrack(track);

      // 3. Уведомляем родительский компонент
      onTrackAdded(track);

      setStatusMessage({
        type: 'success',
        text: `Трек "${track.title}" успешно сохранен на телефон и добавлен в библиотеку!`,
      });

      // Очистка формы
      setSelectedFile(null);
      setFileTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Ошибка сохранения аудиофайла',
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Сохранение трека по ссылке
  const handleSaveByLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim() || isImportingLink) return;

    setIsImportingLink(true);
    setLinkError(null);
    setStatusMessage(null);

    try {
      const trimmed = linkUrl.trim();

      // Если это прямая ссылка на MP3/аудиофайл
      if (trimmed.endsWith('.mp3') || trimmed.endsWith('.m4a') || trimmed.endsWith('.wav')) {
        const urlName = trimmed.split('/').pop() || 'Прямой аудиопоток';
        const parsed = parseFileName(decodeURIComponent(urlName));
        const trackId = `stream_${Date.now()}`;
        const track: Track = {
          id: trackId,
          title: parsed.title,
          artist: defaultArtist || parsed.artist,
          album: 'Интернет-поток',
          duration: 200,
          platform: 'local',
          stream_url: trimmed,
          is_playable: true,
        };

        addCustomTrack(track);
        onTrackAdded(track);
        setStatusMessage({ type: 'success', text: `Трек "${track.title}" добавлен!` });
        setTimeout(() => onClose(), 1000);
        return;
      }

      // Если это ссылка на сервис (Яндекс, VK, Spotify)
      const res = await importPlaylistByUrl(trimmed);
      if (res.tracks.length > 0) {
        // Если передан конкретный артист, привязываем
        const firstTrack = res.tracks[0];
        onTrackAdded(firstTrack);
        setStatusMessage({
          type: 'success',
          text: `Успешно импортировано треков: ${res.tracks.length}!`,
        });
        setTimeout(() => onClose(), 1000);
      } else {
        setLinkError('В плейлисте не найдено треков');
      }
    } catch (err: any) {
      setLinkError(err.message || 'Не удалось импортировать по ссылке');
    } finally {
      setIsImportingLink(false);
    }
  };

  // Сохранение трека вручную
  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualArtist.trim() || !manualStreamUrl.trim()) return;

    const trackId = `manual_${Date.now()}`;
    const track: Track = {
      id: trackId,
      title: manualTitle.trim(),
      artist: manualArtist.trim(),
      album: 'Пользовательский трек',
      duration: 180,
      cover_url: manualCoverUrl.trim() || undefined,
      platform: 'local',
      stream_url: manualStreamUrl.trim(),
      is_playable: true,
    };

    addCustomTrack(track);
    onTrackAdded(track);
    setStatusMessage({ type: 'success', text: `Трек "${track.title}" успешно создан!` });
    setTimeout(() => onClose(), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-safe-dialog pb-6 bg-black/75 backdrop-blur-md animate-fadeIn select-none">
      <div className="theme-card w-full max-w-md rounded-3xl p-5 border border-white/10 shadow-2xl space-y-4 max-h-[82vh] overflow-y-auto">
        {/* Заголовок */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Plus size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Добавить трек</h3>
              <p className="text-[11px] text-gray-400">
                {defaultArtist ? `Для исполнителя: ${defaultArtist}` : 'В вашу медиатеку на телефоне'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-gray-300 hover:text-white flex items-center justify-center transition-all"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Переключатель вкладок: Файл / По ссылке / Вручную */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'file'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileAudio size={14} />
            <span>Файл MP3</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'link'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Link2 size={14} />
            <span>По ссылке</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'manual'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Radio size={14} />
            <span>Вручную</span>
          </button>
        </div>

        {/* Статус-сообщение */}
        {statusMessage && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-red-500/15 text-red-300 border border-red-500/30'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={16} className="flex-shrink-0" />
            ) : (
              <AlertCircle size={16} className="flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* ВКЛАДКА 1: ЗАГРУЗКА ЛОКАЛЬНОГО ФАЙЛА С ТЕЛЕФОНА / ПК */}
        {activeTab === 'file' && (
          <form onSubmit={handleSaveLocalFile} className="space-y-3.5">
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*,.mp3,.m4a,.wav,.flac,.ogg"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Зона выбора файла */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                selectedFile
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-white/15 hover:border-blue-500/50 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 shadow-lg ${
                  selectedFile
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                {selectedFile ? <CheckCircle2 size={24} /> : <Upload size={24} />}
              </div>
              <p className="text-xs font-bold text-white">
                {selectedFile ? selectedFile.name : 'Нажмите для выбора аудиофайла'}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Поддерживаются MP3, M4A, WAV, FLAC со смартфона или ПК
              </p>
            </div>

            {selectedFile && (
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                    Название трека
                  </label>
                  <input
                    type="text"
                    value={fileTitle}
                    onChange={(e) => setFileTitle(e.target.value)}
                    required
                    placeholder="Название песни"
                    className="w-full theme-card rounded-xl px-3 py-2 text-xs text-white border border-white/10 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                    Исполнитель / Музыкант
                  </label>
                  <input
                    type="text"
                    value={fileArtist}
                    onChange={(e) => setFileArtist(e.target.value)}
                    required
                    placeholder="Имя артиста"
                    className="w-full theme-card rounded-xl px-3 py-2 text-xs text-white border border-white/10 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedFile || !fileTitle.trim() || isProcessingFile}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              {isProcessingFile ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Сохранение аудиофайла...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Добавить трек на телефон</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ВКЛАДКА 2: ПО ССЫЛКЕ */}
        {activeTab === 'link' && (
          <form onSubmit={handleSaveByLink} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                Ссылка на трек, плейлист или прямой аудиопоток
              </label>
              <div className="theme-card rounded-2xl p-2 flex items-center gap-2 border border-white/10 focus-within:border-blue-500">
                <Link2 size={16} className="text-gray-400 ml-1" />
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => {
                    setLinkUrl(e.target.value);
                    setLinkError(null);
                  }}
                  placeholder="https://music.yandex.ru/track/... или .mp3"
                  className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
                />
              </div>
            </div>

            {linkError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{linkError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!linkUrl.trim() || isImportingLink}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              {isImportingLink ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Импорт трека...</span>
                </>
              ) : (
                <>
                  <Link2 size={16} />
                  <span>Импортировать по ссылке</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ВКЛАДКА 3: ВРУЧНУЮ */}
        {activeTab === 'manual' && (
          <form onSubmit={handleSaveManual} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                Название трека *
              </label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                required
                placeholder="Например: Мой трек"
                className="w-full theme-card rounded-xl px-3 py-2 text-xs text-white border border-white/10 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                Исполнитель *
              </label>
              <input
                type="text"
                value={manualArtist}
                onChange={(e) => setManualArtist(e.target.value)}
                required
                placeholder="Имя артиста"
                className="w-full theme-card rounded-xl px-3 py-2 text-xs text-white border border-white/10 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                Ссылка на аудиофайл (Stream / MP3 URL) *
              </label>
              <input
                type="url"
                value={manualStreamUrl}
                onChange={(e) => setManualStreamUrl(e.target.value)}
                required
                placeholder="https://example.com/song.mp3"
                className="w-full theme-card rounded-xl px-3 py-2 text-xs text-white border border-white/10 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                Ссылка на обложку (опционально)
              </label>
              <input
                type="url"
                value={manualCoverUrl}
                onChange={(e) => setManualCoverUrl(e.target.value)}
                placeholder="https://example.com/cover.jpg"
                className="w-full theme-card rounded-xl px-3 py-2 text-xs text-white border border-white/10 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!manualTitle.trim() || !manualArtist.trim() || !manualStreamUrl.trim()}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              <Plus size={16} />
              <span>Создать трек</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
