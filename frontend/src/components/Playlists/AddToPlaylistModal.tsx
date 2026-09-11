import React from 'react';
import { FolderPlus, Check, Plus, X } from 'lucide-react';
import { Track } from '../../types';
import {
  getSavedPlaylists,
  addTrackToPlaylist,
} from '../../services/playlistStorage';
import { useBackNavigation } from '../../services/backNavigation';

interface AddToPlaylistModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateNew: () => void;
  onTrackAdded: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  track,
  isOpen,
  onClose,
  onCreateNew,
  onTrackAdded,
}) => {
  useBackNavigation('add_to_playlist_modal', isOpen, onClose, 62);

  if (!isOpen || !track) return null;

  const playlists = getSavedPlaylists();

  const handleSelect = (playlistId: string) => {
    addTrackToPlaylist(playlistId, track);
    onTrackAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-sm bg-[#181c26] border border-white/10 rounded-3xl p-6 shadow-2xl text-white select-none animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-3">
          <div>
            <h3 className="text-base font-bold">Добавить в плейлист</h3>
            <p className="text-xs text-gray-400 truncate max-w-[240px]">
              «{track.title}» • {track.artist}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white bg-white/5 active:scale-90 transition-transform"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 mb-4">
          {playlists.map((rec) => {
            const alreadyIn = rec.tracks.some((t) => t.id === track.id);
            return (
              <div
                key={rec.playlist.id}
                onClick={() => handleSelect(rec.playlist.id)}
                className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                  alreadyIn
                    ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300'
                    : 'bg-white/5 hover:bg-white/10 text-gray-200'
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-sm font-semibold truncate">{rec.playlist.title}</p>
                  <p className="text-[11px] text-gray-400">{rec.playlist.track_count} треков</p>
                </div>
                {alreadyIn ? (
                  <Check size={18} className="text-blue-400 flex-shrink-0" />
                ) : (
                  <Plus size={18} className="text-gray-400 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => {
            onClose();
            onCreateNew();
          }}
          className="w-full py-2.5 rounded-xl border border-dashed border-white/20 hover:border-blue-500 text-gray-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <FolderPlus size={16} className="text-blue-400" />
          <span>+ Создать новый плейлист</span>
        </button>
      </div>
    </div>
  );
};
