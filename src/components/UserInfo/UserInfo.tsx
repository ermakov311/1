'use client'

import { useAuth } from '../../hooks/useAuth';
import style from './UserInfo.module.scss';

const UserInfo = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const getRoleName = (roleId: number) => {
    switch (roleId) {
      case 1: return 'Администратор';
      case 2: return 'Преподаватель';
      case 3: return 'Студент';
      default: return 'Неизвестно';
    }
  };

  return (
    <div className={style.userInfo}>
      <div className={style.userDetails}>
        <span className={style.name}>{user.fio_name}</span>
        <span className={style.role}>{getRoleName(user.role_id)}</span>
        {user.group_id && <span className={style.group}>Группа: {user.group_id}</span>}
      </div>
      <button onClick={logout} className={style.logoutBtn}>
        Выйти
      </button>
    </div>
  );
};

export default UserInfo;