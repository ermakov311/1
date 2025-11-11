'use client'

import style from './SwitchTheme.module.scss';
import { useThemeListener } from '../../hooks/useThemeListener';
const SwitchTheme = () => {
  const theme = useThemeListener();

  const handleLightThemeClick = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    try {
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('app-theme', next);
      window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
    } catch {}
  };
  return (
    <div className={style.switch}>
      <label>
        <input onChange={handleLightThemeClick} type="checkbox" checked={theme === 'light' ? false : true}/>
        <span></span>
      </label>
    </div>
  );
};

export default SwitchTheme;
