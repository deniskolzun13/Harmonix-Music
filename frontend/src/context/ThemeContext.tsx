import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'dark' | 'glass';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  accentColor: string;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('harmonix_theme');
    if (saved === 'dark' || saved === 'glass') {
      return saved;
    }
    return 'dark';
  });

  const [accentColor, setAccentColor] = useState<string>('#3b82f6');

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('harmonix_theme', newTheme);
  };

  // Установка класса темы на root элемент
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-glass', 'theme-y2k', 'theme-artwork');
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  // Установка акцентного цвета для темы
  useEffect(() => {
    if (theme === 'glass') {
      setAccentColor('#00f0ff'); // Неоновый циан
    } else {
      setAccentColor('#3b82f6'); // Классический синий
    }
  }, [theme]);

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
