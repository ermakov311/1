'use client';

import React from 'react';
import style from './StudentTasks.module.scss';
import Task from '../Task/Task';
import { useAuth } from '@hooks/useAuth';
import { useStudentAssignments } from '@hooks/useTasks';

interface StudentAssignment {
  id: number;
  student_id: number;
  assignment_id: number;
  is_completed: boolean;
  assignment_title: string;
  assignment_deadline: string;
  created_by_name: string;
  completed_at: string | null;
}

const StudentTasks = () => {
  const { user } = useAuth();
  const isStudent = user?.role_id === 3;
  const { data: assignments = [], isLoading } = useStudentAssignments(isStudent ? user?.id : undefined);

  

  const handleOpenEditor = (assignment: StudentAssignment) => {
    // Используем базовый ID в URL для упрощения ссылок
    // compositeId будет автоматически создан в редакторе для изоляции кода студентов
    const baseId = assignment.assignment_id || assignment.id;

    // Переходим в редактор кода с базовым assignmentId
    window.location.href = `/editor/code/task.ino?assignmentId=${baseId}`;
  };

  const handleTaskClick = (assignment: StudentAssignment) => {
    handleOpenEditor(assignment);
  };

  return (
    <div className={style.studentTasks}>
      <div className={style.header}>
        <h1>Мои задания</h1>
      </div>
      <div className={style.tasksContainer}>
        {isLoading ? (
          <div className={style.loading}>Загрузка заданий...</div>
        ) : assignments.length === 0 ? (
          <div className={style.noAssignments}>
            У вас нет назначенных заданий
          </div>
        ) : (
          <div className={style.tasks}>
            {assignments.map((assignment) => (
              <div key={assignment.id} className={style.tasksStyle}>
                <Task
                  name={assignment.assignment_title}
                  ready={assignment.is_completed}
                  deadline={assignment.assignment_deadline}
                  createdBy={assignment.created_by_name}
                  completedAt={assignment.completed_at}
                  onClick={() => handleTaskClick(assignment)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentTasks;
