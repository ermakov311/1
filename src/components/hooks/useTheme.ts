'use client'

import { useLayoutEffect, useState } from 'react';

export const useTheme = () => {
  const [theme, setTheme] = useState('light');

  useLayoutEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
    
    window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  }, [theme]);

  return { theme, setTheme };
};