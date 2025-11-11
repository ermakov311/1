'use client'

import style from './ExitButton.module.scss';
import { useAuth } from '@hooks/useAuth';

interface ExitButtonProps {
  className?: string;
}

const ExitButton = ({ className }: ExitButtonProps) => {
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <button className={`${style.exitButton} ${className ?? ''}`} onClick={handleLogout}>
      Выйти из аккаунта
      <div className={style.icon}>
        <svg
          width="25"   
          height="25"
          viewBox="0 0 25 25"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g clipPath="url(#clip0_102_20)">
            <path
              d="M16.2368 12.4996L24.2254 4.51087C25.2576 3.47871 25.2576 1.80628 24.2254 0.774118C23.1933 -0.258039 21.5209 -0.258039 20.4887 0.774118L12.5 8.76371L4.51135 0.775017C3.4792 -0.257141 1.80676 -0.257141 0.774607 0.775017C-0.257551 1.80717 -0.257551 3.47961 0.774607 4.51176L8.7633 12.5005L0.774607 20.4892C-0.257551 21.5213 -0.257551 23.1937 0.774607 24.2259C1.80676 25.2581 3.4792 25.2581 4.51135 24.2259L12.5 16.2372L20.4887 24.2259C21.5209 25.2581 23.1933 25.2581 24.2254 24.2259C25.2576 23.1937 25.2576 21.5213 24.2254 20.4892L16.2368 12.4996Z"
              fill="white"
            />
          </g>
          <defs>
            <clipPath id="clip0_102_20">
              <rect width="25" height="25" fill="white" />
            </clipPath>
          </defs>
        </svg>
      </div>
    </button>
  );
};

export default ExitButton;
