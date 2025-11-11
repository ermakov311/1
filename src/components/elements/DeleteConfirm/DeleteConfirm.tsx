'use client'

import React from 'react';
import style from './DeleteConfirm.module.scss';
import Portal from '../../UI/Portal/Portal';

interface DeleteConfirmProps {
  assignmentName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirm = ({ assignmentName, onConfirm, onCancel }: DeleteConfirmProps) => {
  return (
    <Portal>
      <div className={style.overlay} onClick={onCancel}>
        <div className={style.modal} onClick={(e) => e.stopPropagation()}>
          <h2>Подтверждение удаления</h2>
          <p>Вы действительно хотите удалить задание &quot;{assignmentName}&quot;?</p>
          <div className={style.buttons}>
            <button className={style.confirmButton} onClick={onConfirm}>
              Удалить
            </button>
            <button className={style.cancelButton} onClick={onCancel}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default DeleteConfirm;

