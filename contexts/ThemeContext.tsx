'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Detect if mobile
    const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
    
    // Force dark theme on mobile, otherwise check user's system preference
    if (isMobile) {
      setThemeState('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const savedTheme = localStorage.getItem('theme') as Theme;
      
      if (savedTheme) {
        setThemeState(savedTheme);
      } else {
        setThemeState(prefersDark ? 'dark' : 'light');
      }
    }
    
    setMounted(true);

    // Listen for system theme changes (only on desktop)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
      if (!isMobile && !localStorage.getItem('theme')) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (newTheme: Theme) => {
    // Detect if mobile and force dark theme
    const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 768 || 'ontouchstart' in window);
    
    if (isMobile) {
      // Force dark theme on mobile regardless of requested theme
      setThemeState('dark');
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      setThemeState(newTheme);
      localStorage.setItem('theme', newTheme);
      
      // Update document class for CSS
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(newTheme);
    }
  };

  const toggleTheme = () => {
    // Detect if mobile and prevent theme toggle
    const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 768 || 'ontouchstart' in window);
    
    if (!isMobile) {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  // Apply theme to document
  useEffect(() => {
    if (mounted) {
      // Force dark theme on mobile, otherwise use detected theme
      const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
      const finalTheme = isMobile ? 'dark' : theme;
      
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(finalTheme);
    }
  }, [theme, mounted]);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
