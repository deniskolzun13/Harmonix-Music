import React from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { splitArtistNames } from '../../services/playlistStorage';

interface ArtistLinksProps {
  artist: string;
  title?: string;
  className?: string;
  linkClassName?: string;
  separatorClassName?: string;
  onArtistClick?: (artistName: string) => void;
}

export const ArtistLinks: React.FC<ArtistLinksProps> = ({
  artist,
  title,
  className = '',
  linkClassName = 'hover:text-blue-400 active:text-blue-300 transition-colors cursor-pointer',
  separatorClassName = 'text-gray-500',
  onArtistClick,
}) => {
  const { openArtist } = usePlayer();

  if (!artist || !artist.trim()) {
    return <span className={className}>Неизвестный исполнитель</span>;
  }

  // Извлекаем имена исполнителей
  const artists = splitArtistNames(artist);

  // Если в названии трека есть (feat. ...), также добавляем их как артистов
  if (title) {
    const titleMatch = title.match(
      /[\(\[\{]\s*(?:feat\.?|ft\.?|featuring|with|vs\.?|при\s+уч\.?|уч\.?)\s+([^\)\]\}]+)[\)\]\}]/i
    );
    if (titleMatch && titleMatch[1]) {
      const featArtists = splitArtistNames(titleMatch[1]);
      for (const fa of featArtists) {
        if (!artists.some((a: string) => a.toLowerCase() === fa.toLowerCase())) {
          artists.push(fa);
        }
      }
    }
  }

  const handleClick = (e: React.MouseEvent, artistName: string) => {
    e.stopPropagation();
    if (onArtistClick) {
      onArtistClick(artistName);
    } else {
      openArtist(artistName);
    }
  };

  if (artists.length === 0) {
    return <span className={className}>{artist}</span>;
  }

  return (
    <span className={className}>
      {artists.map((art: string, idx: number) => (
        <React.Fragment key={`${art}-${idx}`}>
          <span
            onClick={(e) => handleClick(e, art)}
            className={linkClassName}
            title={`Перейти к исполнителю ${art}`}
          >
            {art}
          </span>
          {idx < artists.length - 1 && (
            <span className={separatorClassName}>, </span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
};
