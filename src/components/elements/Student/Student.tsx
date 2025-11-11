'use client'

import React, { useState, useEffect } from 'react';
import style from './Student.module.scss';
import Task from '../Task/Task';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@api';

interface Assignment {
  id: number;
  assignment_title: string;
  is_completed: boolean;
  completed_at: string | null;
  assignment_deadline: string | null;
  created_by_name: string;
}

interface StudentProps {
  name: string;
  studentId?: number;
  assignmentsCount?: number;
  completedAssignments?: number;
}

const Student = ({ name, studentId, assignmentsCount = 0, completedAssignments = 0 }: StudentProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [animationClass, setAnimationClass] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['student-assignments', { studentId }],
    queryFn: () => apiGet<{ success: boolean; assignments: Assignment[] }>(`/api/students/${studentId}/assignments`),
    enabled: isOpen && !!studentId,
    staleTime: 60_000,
  });
  const assignments = data?.assignments ?? [];

  // Загружаем задания студента при открытии
  useEffect(() => {
  }, [isOpen, studentId, assignments.length]);

  const toggleDropDown = () => {
    if (isAnimating) return;

    if (isOpen) {
      setIsAnimating(true);
      setAnimationClass(style.closing);
    } else {
      setIsVisible(true);
      setIsOpen(true);
      setIsAnimating(true);
      setAnimationClass('');
    }
  };

  const handleAnimationEnd = () => {
    if (animationClass === style.closing) {
      setIsVisible(false);
      setIsOpen(false);
    }
    setAnimationClass('');
    setIsAnimating(false);
  };
  return (
    <div className={style.student}>
      <button onClick={toggleDropDown}>
        <div className={style.studentInfo}>
          <span className={style.studentName} style={{ marginRight: '5px' }}>{name}</span>
          {assignmentsCount > 0 && (
            <span className={style.assignmentsInfo}>
              ({completedAssignments}/{assignmentsCount})
            </span>
          )}
        </div>
        <span>
          <svg
            width="22"
            height="22"
            viewBox="0 0 30 30"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`${style.icon} ${
              isOpen && !animationClass ? style.rotated : ''
            }`}
          >
            <g clipPath="url(#clip0_200_60)">
              <path
                d="M5.625 17.625L15 8.25L24.375 17.625L21.75 20.25L15 13.5L8.25 20.25L5.625 17.625Z"
                fill="white"
              />
              <path
                d="M28.125 15C28.125 22.3125 22.3125 28.125 15 28.125C7.6875 28.125 1.875 22.3125 1.875 15C1.875 7.6875 7.6875 1.875 15 1.875C22.3125 1.875 28.125 7.6875 28.125 15ZM30 15C30 6.75 23.25 0 15 0C6.75 0 0 6.75 0 15C0 23.25 6.75 30 15 30C23.25 30 30 23.25 30 15Z"
                fill="white"
              />
            </g>
            <defs>
              <clipPath id="clip0_200_60">
                <rect width="30" height="30" fill="white" />
              </clipPath>
            </defs>
          </svg>
        </span>
      </button>

      {isVisible && (
        <div className={style.list}>
          <ul className={animationClass} onAnimationEnd={handleAnimationEnd}>
            {isLoading ? (
              <li className={style.loading}>Загрузка заданий...</li>
            ) : assignments.length === 0 ? (
              <li className={style.noAssignments}>Нет назначенных заданий</li>
            ) : (
              assignments.map((assignment) => (
                <li key={assignment.id}>
                  <Task 
                    name={assignment.assignment_title} 
                    ready={assignment.is_completed}
                    // deadline={assignment.assignment_deadline}
                    createdBy={assignment.created_by_name}
                    completedAt={assignment.completed_at}
                  />
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Student;
