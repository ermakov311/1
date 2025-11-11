'use client';

import React, { useState } from 'react';
import style from './Task.module.scss';

interface TaskProps {
  name: string;
  ready: boolean;
  deadline?: string | null;
  createdBy?: string;
  completedAt?: string | null;
  onClick?: () => void;
}

const Task = ({
  name,
  ready,
  deadline,
  createdBy,
  completedAt,
  onClick,
}: TaskProps) => {
  const [activeSpan, setActiveSpan] = useState(ready);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={style.task}
      onClick={handleClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className={style.taskInfo}>
        <p className={style.taskName}>{name}</p>
        {/* {createdBy && (
          <p className={style.taskCreator}>Создано: {createdBy}</p>
        )} */}
        {/* {deadline && (
          <p className={style.taskDeadline}>
            Срок: {formatDate(deadline)}
          </p>
        )} */}
      </div>
      <div className={style.icon}>
        {completedAt && (
          <p className={style.taskCompleted}>
            Выполнено: {formatDate(completedAt)}
          </p>
        )}
        <span>
          {activeSpan ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clipPath="url(#clip0_102_862)">
                <path
                  d="M19.4639 2.6652C18.7485 1.94982 17.5894 1.94982 16.874 2.6652L5.98132 13.5578L3.08497 11.0698C2.37936 10.3642 1.23545 10.3642 0.529211 11.0698C-0.176404 11.7755 -0.176404 12.92 0.529211 13.6256L4.85637 17.3423C5.56198 18.048 6.70589 18.048 7.41213 17.3423C7.48295 17.2715 7.54216 17.1928 7.59893 17.114C7.60928 17.1043 7.62089 17.0975 7.63128 17.0878L19.464 5.25449C20.1787 4.53973 20.1787 3.37997 19.4639 2.6652Z"
                  fill="#04f44c"
                  fillOpacity="1"
                />
              </g>
              <defs>
                <clipPath id="clip0_102_862">
                  <rect width="20" height="20" fill="white" />
                </clipPath>
              </defs>
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clipPath="url(#clip0_102_842)">
                <path
                  d="M12.9896 9.99965L19.3806 3.60869C20.2063 2.78297 20.2063 1.44502 19.3806 0.619295C18.5549 -0.206432 17.2169 -0.206432 16.3912 0.619295L10.0003 7.01097L3.6093 0.620014C2.78358 -0.205713 1.44563 -0.205713 0.619905 0.620014C-0.205821 1.44574 -0.205821 2.78368 0.619905 3.60941L7.01086 10.0004L0.619905 16.3913C-0.205821 17.217 -0.205821 18.555 0.619905 19.3807C1.44563 20.2064 2.78358 20.2064 3.6093 19.3807L10.0003 12.9898L16.3912 19.3807C17.2169 20.2064 18.5549 20.2064 19.3806 19.3807C20.2063 18.555 20.2063 17.217 19.3806 16.3913L12.9896 9.99965Z"
                  fill="#cb1313"
                  fillOpacity="1"
                />
              </g>
              <defs>
                <clipPath id="clip0_102_842">
                  <rect width="20" height="20" fill="white" />
                </clipPath>
              </defs>
            </svg>
          )}
        </span>
      </div>
    </div>
  );
};

export default Task;
