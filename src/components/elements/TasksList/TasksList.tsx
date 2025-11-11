'use client'

import React, { useState } from 'react';
import style from './TasksList.module.scss';
import TaskTeacher from '../TaskTeacher/TaskTeacher';
import DeleteConfirm from '../DeleteConfirm/DeleteConfirm';
import { useAuth } from '@hooks/useAuth';
import { useDeleteAssignment, useTeacherAssignments } from '@hooks/useTasks';

interface Assignment {
  id: number;
  title: string;
  created_by: number;
  created_by_name: string;
  deadline: string;
  created_at: string;
}

interface TaskListProps {
  isDelete: boolean;
  onClose: () => void;
  onSentToGroup?: () => void;
}

const TasksList = ({ isDelete, onClose, onSentToGroup }: TaskListProps) => {
  const { user } = useAuth();
  const teacherId = user?.role_id === 2 ? user?.id : undefined;
  const { data: assignments = [], isLoading } = useTeacherAssignments(teacherId);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const deleteAssignment = useDeleteAssignment(teacherId);

  const handleTaskSent = () => {
    onSentToGroup?.();
    onClose(); 
  };

  const handleOpenEditor = (assignmentId: number) => {
    // Переходим в редактор внутри выбранного задания
    window.location.href = `/editor/code/task.ino?assignmentId=${assignmentId}`;
  };

  const handleDeleteClick = (assignmentId: number) => {
    setDeleteConfirm(assignmentId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;

    deleteAssignment.mutate(deleteConfirm, {
      onSuccess: () => setDeleteConfirm(null),
      onError: () => alert('Не удалось удалить задание'),
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  return (
    <div className={style.tasks}>
      <div className={style.header}>
        <h1>Список заданий</h1>
        {!isDelete && <button onClick={onClose}>Назад</button>}
      </div>
      <div>
        {isLoading ? (
          <div className={style.loading}>Загрузка заданий...</div>
        ) : assignments.length === 0 ? (
          <div className={style.noAssignments}>Нет созданных заданий</div>
        ) : (
          assignments.map((assignment) => (
            <TaskTeacher
              key={assignment.id}
              name={assignment.title}
              date={formatDate(assignment.created_at)}
              isDelete={isDelete}
              assignmentId={assignment.id}
              onTaskSent={handleTaskSent}
              onOpenEditor={handleOpenEditor}
              onDelete={handleDeleteClick}
            />
          ))
        )}
      </div>
      {deleteConfirm && (
        <DeleteConfirm
          assignmentName={assignments.find(a => a.id === deleteConfirm)?.title || ''}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

export default TasksList;
