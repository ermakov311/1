'use client'

import React, { useState } from 'react';
import style from './TestData.module.scss';
import { apiPost } from '@api';

const TestData = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const createTestData = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const data = await apiPost<{ success: boolean; error?: string }>('/api/test-data/seed', {});
      if (data.success) {
        setMessage('Тестовые данные успешно созданы!');
      } else {
        setMessage(`Ошибка: ${data.error}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setMessage(`Ошибка сети: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={style.testData}>
      <h1>Создание тестовых данных</h1>
      <p>Эта страница создает тестовые данные для проверки работы системы.</p>
      
      <button 
        onClick={createTestData} 
        disabled={loading}
        className={style.button}
      >
        {loading ? 'Создание...' : 'Создать тестовые данные'}
      </button>
      
      {message && (
        <div className={style.message}>
          {message}
        </div>
      )}
    </div>
  );
};

export default TestData;
