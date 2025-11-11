'use client'

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import style from './Group.module.scss';
import Student from '../Student/Student';
import Portal from '@/components/UI/Portal/Portal';
import TasksList from '@/components/elements/TasksList/TasksList';
import { useAuth } from '@hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@api';

interface StudentData {
  id: number;
  fio_name: string;
  assignments_count: number;
  completed_assignments: number;
}

const Group = () => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const qc = useQueryClient();
  const { user } = useAuth();
  const selectedGroup = useSelector(
    (state: RootState) => state.groups.selectedGroup
  );

  const teacherId = user?.role_id === 2 ? user?.id : undefined;
  const groupKey = selectedGroup || undefined;
  const { data, isLoading } = useQuery({
    queryKey: ['teacher-students', { teacherId, group: groupKey }],
    queryFn: () =>
      apiGet<{ success: boolean; students: StudentData[] }>(
        `/api/teachers/${teacherId}/groups/${encodeURIComponent(groupKey || '')}/students`
      ),
    enabled: !!teacherId && !!groupKey,
    staleTime: 60_000,
  });
  const students = data?.students ?? [];

  const refetchStudents = () => qc.invalidateQueries({ queryKey: ['teacher-students', { teacherId, group: groupKey }] });
  return (
    <div className={style.group}>
      {selectedGroup && (
        <div>
          <div className={style.header}>
            <h1>Группа {selectedGroup}</h1>

            <button onClick={() => setIsModalOpen(true)}>Отправить всем</button>
          </div>

          <div className={style.students}>
            {isLoading ? (
              <div className={style.loading}>Загрузка студентов...</div>
            ) : students.length === 0 ? (
              <div className={style.noStudents}>В этой группе нет ваших учеников</div>
            ) : (
              students.map((student) => (
                <Student 
                  key={student.id} 
                  name={student.fio_name}
                  studentId={student.id}
                  assignmentsCount={student.assignments_count}
                  completedAssignments={student.completed_assignments}
                />
              ))
            )}
          </div>
        </div>
      )}
      {isModalOpen && (
        <Portal>
          <TasksList 
            onClose={() => setIsModalOpen(false)} 
            isDelete={false}
            onSentToGroup={refetchStudents}
          />
        </Portal>
      )}
    </div>
  );
};

export default Group;
