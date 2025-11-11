'use client'

import TasksList from '@/components/elements/TasksList/TasksList'
import StudentTasks from '@/components/elements/StudentTasks/StudentTasks'
import { useAuth } from '@hooks/useAuth'

export default function TasksPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Загрузка...</div>;
  }

  // Для студента показываем его задания
  if (user?.role_id === 3) {
    return <StudentTasks />;
  }

  // Для преподавателя и админа показываем список созданных заданий
  return <TasksList onClose={() => ''} isDelete={true} />;
}
