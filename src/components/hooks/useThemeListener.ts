'use client'

import { useEffect, useState } from 'react';

export const useThemeListener = () => {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    setTheme(savedTheme);

    const handleThemeChange = (event: CustomEvent) => {
      setTheme(event.detail);
    };

    window.addEventListener('themechange', handleThemeChange as EventListener);
    
    return () => {
      window.removeEventListener('themechange', handleThemeChange as EventListener);
    };
  }, []);

  return theme;
};