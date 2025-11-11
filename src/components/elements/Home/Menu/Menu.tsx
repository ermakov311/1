'use client'

import style from './Menu.module.scss';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DropButton from '@/components/UI/DropButton/DropButton';
import ExitButton from '@/components/UI/ExitButton/ExitButton';
import { useAuth } from '@hooks/useAuth';

interface Group {
  id: number;
  name: string;
  students_count: number;
}

const Menu = () => {
  const { user } = useAuth();
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();


  useEffect(() => {
    if (!pathname.startsWith('/group/')) {
      setIsDropDownOpen(false);
    }
  }, [pathname]);

  // Загрузка групп перенесена в DropButton через itemsApi

  const handleNavLinkClick = () => {
    setIsDropDownOpen(false);
  };

  const getRoleName = (roleId: number) => {
    switch (roleId) {
      case 1: return 'Администратор';
      case 2: return 'Преподаватель';
      case 3: return 'Студент';
      default: return 'Пользователь';
    }
  };

  const isTeacher = user ?.role_id === 2;

  return (
    <div className={style.menu} ref={dropdownRef}>
      <div className={style.block}>
        <p>{user ? getRoleName(user.role_id) : 'Загрузка...'}</p>
        <h1>{user ? user.fio_name : 'Загрузка...'}</h1>

        {isTeacher && (
          <DropButton
            name={'Мои группы'}
            isOpen={isDropDownOpen}
            onToggle={setIsDropDownOpen}
            onClose={() => setIsDropDownOpen(false)}
            link='group'
            itemsApi={user ? `/api/teachers/${user.id}/groups` : undefined}
            itemHrefBase={'/group'}
          />
        )}
        

        <div
          className={`${style.buttonsContainer} ${
            isDropDownOpen ? style.dropOpen : ''
          }`}
        >
          <button 
            className={style.menuButton}
            onClick={handleNavLinkClick}
          >
            <Link href="/tasks">Мои задания</Link>
          </button>
          {/* Кнопка редактора только для преподавателя и админа */}
          {(user?.role_id === 2 || user?.role_id === 1) && (
            <button className={style.menuButton} onClick={handleNavLinkClick}>
              <Link href="/editor/scheme">Редактор</Link>
            </button>
          )}
        </div>
        <ExitButton />
      </div>
    </div>
  );
};

export default Menu;