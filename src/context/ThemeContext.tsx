import React, { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

const CheatAlert = registerPlugin<any>('CheatAlert');

const syncNativeTheme = (currentTheme: 'light' | 'dark') => {
  const themeColor = currentTheme === 'dark' ? '#0f172a' : '#ffffff';

  // 1. Update HTML meta theme-color
  try {
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', themeColor);
  } catch (_) {}

  // 2. Synchronize Android native status bar & notch cutout background
  if (Capacitor.isNativePlatform()) {
    try {
      CheatAlert.setStatusBarTheme({ theme: currentTheme, color: themeColor });
    } catch (_) {}
  }
};

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  actualTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'light' }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = window.document.documentElement;

    // Remove previous theme classes
    root.classList.remove('light', 'dark');

    let newActualTheme: 'light' | 'dark';

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      newActualTheme = systemTheme;
      root.classList.add(systemTheme);
    } else {
      newActualTheme = theme;
      root.classList.add(theme);
    }

    setActualTheme(newActualTheme);
    syncNativeTheme(newActualTheme);

    // Store in localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      
      const newTheme = e.matches ? 'dark' : 'light';
      root.classList.add(newTheme);
      setActualTheme(newTheme);
      syncNativeTheme(newTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(actualTheme === 'light' ? 'dark' : 'light');
  };

  const value: ThemeContextType = {
    theme,
    actualTheme,
    setTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
