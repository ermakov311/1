'use client'

import React, { useState } from 'react';
import style from './TaskTeacher.module.scss';
import Portal from '../../UI/Portal/Portal';
import Confrim from '../Confrim/Confrim';
import { usePathname } from 'next/navigation';

interface TaskTeacherProps {
  name: string;
  date: string;
  isDelete: boolean;
  assignmentId?: number;
  onTaskSent?: () => void;
  onOpenEditor?: (assignmentId: number) => void;
  onDelete?: (assignmentId: number) => void;
}

const TaskTeacher = ({ name, date, isDelete, assignmentId, onTaskSent, onOpenEditor, onDelete }: TaskTeacherProps) => {
  const [isConfrim, setIsConfrim] = useState<boolean>(false);
  const pathname = usePathname();

  const handleOpenConfrim = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfrim(true);
  };

  const handleCloseConfrim = () => {
    setIsConfrim(false);
  };

  const handleTaskSent = () => {
    handleCloseConfrim();
    onTaskSent?.(); 
  };

  const handleClick = () => {
    if (isDelete) {
      // Открываем редактор при клике на задание в режиме просмотра
      if (assignmentId && onOpenEditor) {
        onOpenEditor(assignmentId);
      }
    } else {
      // Открываем модальное окно отправки задания
      setIsConfrim(true);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (assignmentId && onDelete) {
      onDelete(assignmentId);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={style.blockTask}
    >
      <h2>{name}</h2>

      <div className={style.blockTaskRight}>
        <p>соз.:{date}</p>
        {isDelete && (
          <svg
            onClick={handleDeleteClick}
            style={{ cursor: 'pointer' }}
            width="30"
            height="30"
            viewBox="0 0 30 30"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11.4844 10.7344H12.8906V21.9844H11.4844V10.7344Z"
              fill="white"
            />
            <path
              d="M14.2969 10.7344H15.7031V21.9844H14.2969V10.7344Z"
              fill="white"
            />
            <path
              d="M17.1094 10.7344H18.5156V21.9844H17.1094V10.7344Z"
              fill="white"
            />
            <path
              d="M5.85938 6.51562H24.1406V7.92188H5.85938V6.51562Z"
              fill="white"
            />
            <path
              d="M18.4687 7.21875H17.1562V5.8125C17.1562 5.39062 16.8281 5.0625 16.4062 5.0625H13.5937C13.1719 5.0625 12.8437 5.39062 12.8437 5.8125V7.21875H11.5312V5.8125C11.5312 4.6875 12.4687 3.75 13.5937 3.75H16.4062C17.5312 3.75 18.4687 4.6875 18.4687 5.8125V7.21875Z"
              fill="white"
            />
            <path
              d="M19.2188 26.2031H10.7812C9.65625 26.2031 8.67188 25.2656 8.57813 24.1406L7.26562 7.26562L8.67188 7.17188L9.98438 24.0469C10.0313 24.4687 10.4062 24.7969 10.7812 24.7969H19.2188C19.6406 24.7969 20.0156 24.4219 20.0156 24.0469L21.3281 7.17188L22.7344 7.26562L21.4219 24.1406C21.3281 25.3125 20.3438 26.2031 19.2188 26.2031Z"
              fill="white"
            />
          </svg>
        )}
      </div>
      {isConfrim && (
        <Portal>
          <Confrim
            name={name}
            group={decodeURIComponent(pathname).split('/')[2]}
            onClose={handleCloseConfrim}
            onSend={handleTaskSent}
            assignmentId={assignmentId}
          />
        </Portal>
      )}
    </div>
  );
};

export default TaskTeacher;
