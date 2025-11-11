import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'student_system',
  user: 'postgres', // замените на вашего пользователя
  password: 'Polyakov909', // замените на ваш пароль
});

export default pool;
