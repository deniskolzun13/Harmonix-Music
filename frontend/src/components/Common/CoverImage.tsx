import React, { useState, useEffect } from 'react';
import { Disc, Music } from 'lucide-react';

interface CoverImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  iconSize?: number;
  fallbackType?: 'disc' | 'music';
  isPlaying?: boolean;
}

export const CoverImage: React.FC<CoverImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  iconSize = 24,
  fallbackType = 'disc',
  isPlaying = false,
}) => {
  const [hasError, setHasError] = useState(false);

  // Сброс ошибки при смене ссылки
  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900/80 text-gray-400 select-none">
        {fallbackType === 'disc' ? (
          <Disc size={iconSize} className={isPlaying ? 'animate-spin' : ''} />
        ) : (
          <Music size={iconSize} />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
