'use client';

import React, { useMemo, useState } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost } from '@api';

type Role = {
  id: number;
  name: string;
};

type Group = {
  id: number;
  name: string;
  description?: string | null;
};

type UserRow = {
  id: number;
  fio_name: string;
  role_id: number;
  group_id?: number | null;
  created_at?: string;
  role_name?: string | null;
  group_name?: string | null;
};

type UsersResponse = { success: boolean; users: UserRow[] };
type RolesResponse = { success: boolean; roles: Role[] };
type GroupsResponse = { success: boolean; groups: Group[] };
type SimpleOk = { success: true; message?: string };

const AdminPage = () => {
  const { user, loading, isAuthenticated } = useAuth();
  const isAdmin = useMemo(() => !!user && user.role_id === 1, [user]);
  const qc = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Admin: link group to teacher
  const [teacherForGroupId, setTeacherForGroupId] = useState<number | ''>('');
  const [groupForTeacherId, setGroupForTeacherId] = useState<number | ''>('');

  // Form state
  const [fioName, setFioName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number | ''>('');
  const [groupId, setGroupId] = useState<number | ''>('');

  const [newRoleName, setNewRoleName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGet<UsersResponse>('/api/users'),
    enabled: isAuthenticated && isAdmin,
    staleTime: 60_000,
  });

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiGet<RolesResponse>('/api/roles'),
    enabled: isAuthenticated && isAdmin,
    staleTime: 60_000,
  });

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiGet<GroupsResponse>('/api/groups'),
    enabled: isAuthenticated && isAdmin,
    staleTime: 60_000,
  });

  const users = usersData?.users ?? [];
  const roles = rolesData?.roles ?? [];
  const groups = groupsData?.groups ?? [];

  const createUser = useMutation({
    mutationFn: (payload: { fio_name: string; password: string; role_id: number; group_id: number | null }) =>
      apiPost<SimpleOk>('/api/users', payload),
    onSuccess: () => {
      setSuccess('Пользователь создан');
      setError(null);
      setFioName('');
      setPassword('');
      setRoleId('');
      setGroupId('');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message || 'Не удалось создать пользователя';
      setError(msg);
      setSuccess(null);
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => apiDelete<SimpleOk>(`/api/users/${id}`),
    onSuccess: () => {
      setSuccess('Пользователь удалён');
      setError(null);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message || 'Не удалось удалить пользователя';
      setError(msg);
      setSuccess(null);
    },
  });

  const createRole = useMutation({
    mutationFn: (payload: { name: string }) => apiPost<SimpleOk>('/api/roles', payload),
    onSuccess: () => {
      setSuccess('Роль создана');
      setError(null);
      setNewRoleName('');
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message || 'Не удалось создать роль';
      setError(msg);
      setSuccess(null);
    },
  });

  const createGroup = useMutation({
    mutationFn: (payload: { name: string; description: string | null }) => apiPost<SimpleOk>('/api/groups', payload),
    onSuccess: () => {
      setSuccess('Группа создана');
      setError(null);
      setNewGroupName('');
      setNewGroupDescription('');
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message || 'Не удалось создать группу';
      setError(msg);
      setSuccess(null);
    },
  });

  const linkGroupToTeacher = useMutation({
    mutationFn: (payload: { teacherId: number; group_id: number }) =>
      apiPost<SimpleOk>(`/api/teachers/${payload.teacherId}/groups`, { group_id: payload.group_id }),
    onSuccess: (res) => {
      setSuccess(res.message || 'Группа привязана к преподавателю');
      setError(null);
      setTeacherForGroupId('');
      setGroupForTeacherId('');
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message || 'Не удалось привязать группу';
      setError(msg);
      setSuccess(null);
    },
  });

  const busy = usersLoading || rolesLoading || groupsLoading || createUser.isPending || deleteUser.isPending || createRole.isPending || createGroup.isPending || linkGroupToTeacher.isPending;

  const handleDeleteUser = (userId: number) => {
    if (!confirm('Удалить пользователя? Действие необратимо.')) return;
    deleteUser.mutate(userId);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!fioName || !password || !roleId) {
      setError('ФИО, пароль и роль обязательны');
      return;
    }
    createUser.mutate({
      fio_name: fioName,
      password,
      role_id: Number(roleId),
      group_id: groupId ? Number(groupId) : null,
    });
  };

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!newRoleName.trim()) {
      setError('Введите название роли');
      return;
    }
    createRole.mutate({ name: newRoleName.trim() });
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!newGroupName.trim()) {
      setError('Введите название группы');
      return;
    }
    createGroup.mutate({
      name: newGroupName.trim(),
      description: newGroupDescription.trim() || null,
    });
  };

  const handleLinkGroupToTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!teacherForGroupId || !groupForTeacherId) {
      setError('Выберите преподавателя и группу');
      return;
    }
    linkGroupToTeacher.mutate({ teacherId: Number(teacherForGroupId), group_id: Number(groupForTeacherId) });
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <div style={{ padding: 24 }}>Необходимо войти в систему</div>;
  }

  if (!isAdmin) {
    return <div style={{ padding: 24 }}>Доступ запрещён. Страница только для администраторов.</div>;
  }

  return (
    <div style={{ padding: 24, display: 'grid', gap: 24 }}>
      <h1>Админ-панель</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {success && <div style={{ color: 'green' }}>{success}</div>}

      <section style={{ border: '1px solid var(--border-color, #333)', padding: 16, borderRadius: 8, display: 'grid', gap: 12 }}>
        <h2>Создать пользователя</h2>
        <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
          <input
            type="text"
            placeholder="ФИО"
            value={fioName}
            onChange={(e) => setFioName(e.target.value)}
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select value={roleId} onChange={(e) => setRoleId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Выберите роль</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} (id {role.id})
              </option>
            ))}
          </select>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Без группы</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={busy}>Создать пользователя</button>
        </form>
      </section>

      <section style={{ border: '1px solid var(--border-color, #333)', padding: 16, borderRadius: 8, display: 'grid', gap: 12 }}>
        <h2>Пользователи</h2>
        <button type="button" onClick={fetchUsers} disabled={busy} style={{ width: 'fit-content' }}>Обновить</button>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #555', padding: 8 }}>ID</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #555', padding: 8 }}>ФИО</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #555', padding: 8 }}>Роль</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #555', padding: 8 }}>Группа</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #555', padding: 8 }}>Создан</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #555', padding: 8 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #333' }}>{row.id}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #333' }}>{row.fio_name}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #333' }}>{row.role_name || row.role_id}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #333' }}>{row.group_name || row.group_id || '—'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #333' }}>
                    {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #333' }}>
                    {row.role_id === 3 ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(row.id)}
                        disabled={busy}
                        style={{ color: 'white', background: '#c0392b', border: 'none', padding: '6px 10px', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Удалить
                      </button>
                    ) : (
                      <span style={{ color: '#888' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ border: '1px solid var(--border-color, #333)', padding: 16, borderRadius: 8, display: 'grid', gap: 12 }}>
        <h2>Привязать группу к преподавателю</h2>
        <form onSubmit={handleLinkGroupToTeacher} style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
          <select
            value={teacherForGroupId}
            onChange={(e) => setTeacherForGroupId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Выберите преподавателя</option>
            {users
              .filter((u) => u.role_id === 2) // преподаватели
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fio_name} (id {u.id})
                </option>
              ))}
          </select>
          <select
            value={groupForTeacherId}
            onChange={(e) => setGroupForTeacherId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Выберите группу</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={busy}>Привязать</button>
        </form>
      </section>

      <section style={{ border: '1px solid var(--border-color, #333)', padding: 16, borderRadius: 8, display: 'grid', gap: 12 }}>
        <h2>Роли</h2>
        <form onSubmit={handleCreateRole} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Название роли"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
          />
          <button type="submit" disabled={busy}>Добавить</button>
          <button type="button" onClick={fetchRoles} disabled={busy}>Обновить</button>
        </form>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {roles.map((role) => (
            <li key={role.id}>{role.name} (id {role.id})</li>
          ))}
        </ul>
      </section>

      <section style={{ border: '1px solid var(--border-color, #333)', padding: 16, borderRadius: 8, display: 'grid', gap: 12 }}>
        <h2>Группы</h2>
        <form onSubmit={handleCreateGroup} style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
          <input
            type="text"
            placeholder="Название группы"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Описание (необязательно)"
            value={newGroupDescription}
            onChange={(e) => setNewGroupDescription(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy}>Создать</button>
            <button type="button" onClick={fetchGroups} disabled={busy}>Обновить</button>
          </div>
        </form>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {groups.map((group) => (
            <li key={group.id}>
              {group.name}
              {group.description ? ` — ${group.description}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AdminPage;






















