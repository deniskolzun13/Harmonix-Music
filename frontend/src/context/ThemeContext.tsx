import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePlayer } from './PlayerContext';

export type AppTheme = 'dark' | 'y2k' | 'glass' | 'artwork';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  accentColor: string;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('harmonix_theme');
    if (saved === 'dark' || saved === 'y2k' || saved === 'glass' || saved === 'artwork') {
      return saved;
    }
    return 'dark';
  });

  const [accentColor, setAccentColor] = useState<string>('#3b82f6');
  const { currentTrack } = usePlayer();

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('harmonix_theme', newTheme);
  };

  // Установка класса темы на root элемент
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-y2k', 'theme-glass', 'theme-artwork');
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  // Извлечение доминантного цвета для Artwork-Driven темы
  useEffect(() => {
    if (theme === 'artwork' && currentTrack?.cover_url) {
      // Плавная смена динамического цвета под обложку
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = currentTrack.cover_url;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 10;
          canvas.height = 10;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 10, 10);
            const data = ctx.getImageData(0, 0, 10, 10).data;
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < data.length; i += 4) {
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
            }
            const count = data.length / 4;
            r = Math.floor(r / count);
            g = Math.floor(g / count);
            b = Math.floor(b / count);
            // Делаем цвет более насыщенным для интерфейса
            setAccentColor(`rgb(${r}, ${g}, ${b})`);
          }
        } catch {
          setAccentColor('#8b5cf6');
        }
      };
      img.onerror = () => {
        setAccentColor('#8b5cf6');
      };
    } else if (theme === 'y2k') {
      setAccentColor('#39ff14'); // Кислотный лайм
    } else if (theme === 'glass') {
      setAccentColor('#00f0ff'); // Неоновый циан
    } else {
      setAccentColor('#3b82f6'); // Классический синий
    }
  }, [theme, currentTrack]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
