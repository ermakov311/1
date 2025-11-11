'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@hooks/useAuth';
import { apiGet, apiPost } from '@api';

type Group = {
  id: number;
  name: string;
  description?: string | null;
};

const TeacherPage = () => {
  const { user, loading, isAuthenticated } = useAuth();
  const isTeacher = useMemo(() => !!user && user.role_id === 2, [user]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !isTeacher) return;
    refresh();
  }, [isAuthenticated, isTeacher]);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      await fetchGroups();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось загрузить группы';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const fetchGroups = async () => {
    const data = await apiGet<{ success: boolean; groups: Group[]; error?: string }>('/api/groups');
    if (!data.success) throw new Error(data.error || 'Не удалось загрузить группы');
    setGroups(Array.isArray(data.groups) ? data.groups : []);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (!newGroupName.trim()) {
        throw new Error('Введите название группы');
      }
      const data = await apiPost<{ success: boolean; group: Group; error?: string }, { name: string }>(
        '/api/groups',
        { name: newGroupName.trim() }
      );
      if (!data.success) throw new Error(data.error || 'Не удалось создать группу');
      setSuccess('Группа создана');
      setNewGroupName('');
      await fetchGroups();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось создать группу';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <div style={{ padding: 24 }}>Необходимо войти в систему</div>;
  }

  if (!isTeacher) {
    return <div style={{ padding: 24 }}>Доступ запрещён. Страница только для преподавателей.</div>;
  }

  return (
    <div style={{ padding: 24, display: 'grid', gap: 24 }}>
      <h1>Кабинет преподавателя</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {success && <div style={{ color: 'green' }}>{success}</div>}

      <section style={{ border: '1px solid var(--border-color, #333)', padding: 16, borderRadius: 8, display: 'grid', gap: 12 }}>
        <h2>Создать группу</h2>
        <form onSubmit={handleCreateGroup} style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
          <input
            type="text"
            placeholder="Название группы"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy}>Создать</button>
            <button type="button" onClick={fetchGroups} disabled={busy}>Обновить</button>
          </div>
        </form>
      </section>

      <section style={{ border: '1px solid var(--border-color, #333)', padding: 16, borderRadius: 8, display: 'grid', gap: 12 }}>
        <h2>Группы</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {groups.map((group) => (
            <li key={group.id}>{group.name}</li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default TeacherPage;


