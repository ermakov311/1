'use client'

import React, { useState } from 'react';
import style from './Login.module.scss';
import { useAuth } from '@hooks/useAuth';

const Login = () => {
  const [fio_name, setFioName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(fio_name, password);
    
    if (!result.success) {
      setError(result.error || 'Ошибка авторизации');
      setLoading(false);
    }
    // При успешном входе страница перезагрузится автоматически
  };

  return (
    <div className={style.login}>
      <div className={style.login__form}>
        <h1>Авторизация</h1>
        <form onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="ФИО (например: Иван Петров)"
            value={fio_name}
            onChange={(e) => setFioName(e.target.value)}
            required
          />
          <input 
            type="password" 
            placeholder="Пароль (например: password1)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <span className={style.error}>{error}</span>}
          <button type="submit" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
