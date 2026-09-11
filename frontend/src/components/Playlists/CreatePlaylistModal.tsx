import React, { useState } from 'react';
import { FolderPlus, X, Image as ImageIcon } from 'lucide-react';
import { createCustomPlaylist } from '../../services/playlistStorage';
import { useBackNavigation } from '../../services/backNavigation';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (playlistId: string) => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  useBackNavigation('create_playlist_modal', isOpen, onClose, 60);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const updated = createCustomPlaylist(title, description, coverUrl);
    const newId = updated[0]?.playlist.id;
    setTitle('');
    setDescription('');
    setCoverUrl('');
    onCreated(newId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-sm bg-[#181c26] border border-white/10 rounded-3xl p-6 shadow-2xl text-white select-none animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <FolderPlus size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold">Новый плейлист</h3>
              <p className="text-[11px] text-gray-400">Создание собственной подборки</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white bg-white/5 active:scale-90 transition-transform"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Название <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Например, Музыка в дорогу"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Описание (необязательно)
            </label>
            <input
              type="text"
              placeholder="Короткое описание подборки"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Ссылка на обложку (URL)
            </label>
            <div className="relative">
              <input
                type="url"
                placeholder="https://... или оставьте пустым"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
              <ImageIcon size={15} className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-xs transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all active:scale-95"
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
