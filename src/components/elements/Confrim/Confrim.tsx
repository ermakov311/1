'use client'

import React from 'react';
import style from './Confrim.module.scss';
import { apiGet, apiPost } from '@api';

interface ConfrimProps {
  name: string;
  group: string;
  onClose: () => void;
  onSend?: () => void;
  assignmentId?: number;
}

const Confrim = ({ name, group, onClose, onSend, assignmentId }: ConfrimProps) => {
  const handleSend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const me = await apiGet<{ success: boolean; user?: { id: number } }>('/api/auth/me');
      if (!me?.success || !me?.user?.id) {
        throw new Error('Не удалось получить пользователя');
      }
      if (!assignmentId) {
        throw new Error('assignmentId отсутствует');
      }
      const data = await apiPost<{ success: boolean; error?: string }>(
        `/api/teachers/${me.user.id}/groups/${encodeURIComponent(group)}/assignments`,
        { assignment_id: assignmentId }
      );
      if (!data.success) throw new Error(data?.error || 'Не удалось отправить задание');
    } catch (error) {
      alert('Не удалось отправить задание группе');
    } finally {
      onClose();
      onSend?.();
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };
  return (
    <div className={style.overlay} onClick={onClose}>
      <div className={style.confrim} onClick={(e) => e.stopPropagation()}>
      <p>
        Вы уверены, что хотите отправить {name} группе {group}
      </p>
      <div className={style.confrimButtons}>
        <button onClick={handleSend}>Отправить</button>
        <button onClick={handleClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

export default Confrim;
