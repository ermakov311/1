import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Создать тестовые данные
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Токен не найден' },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Только админ может создавать тестовые данные
    if (decoded.role_id !== 1) {
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    // Создаем тестовые роли
    const roles = await db.query(`
      INSERT INTO roles (name) VALUES 
      ('Администратор'),
      ('Преподаватель'),
      ('Студент')
      ON CONFLICT (name) DO NOTHING
      RETURNING id, name
    `);

    // Создаем тестовые группы
    const groups = await db.query(`
      INSERT INTO groups (name) VALUES 
      ('АИБ-3-047'),
      ('АИБ-3-046'),
      ('АИБ-3-045')
      ON CONFLICT (name) DO NOTHING
      RETURNING id, name
    `);

    // Хешируем пароли
    const passwordHash = await bcrypt.hash('password123', 10);

    // Создаем тестовых пользователей
    const users = await db.query(`
      INSERT INTO users (fio_name, password_hash, role_id, group_id) VALUES 
      ('Иванов И.И.', $1, 2, 1),
      ('Петров П.П.', $1, 3, 1),
      ('Сидоров С.С.', $1, 3, 1),
      ('Козлов К.К.', $1, 3, 2),
      ('Морозов М.М.', $1, 3, 2)
      ON CONFLICT DO NOTHING
      RETURNING id, fio_name, role_id, group_id
    `, [passwordHash]);

    // Создаем связи учитель-студент
    const teacherStudent = await db.query(`
      INSERT INTO teacher_student (teacher_id, student_id) VALUES 
      (1, 2),
      (1, 3),
      (1, 4),
      (1, 5)
      ON CONFLICT DO NOTHING
      RETURNING teacher_id, student_id
    `);

    // Создаем тестовые задания
    const assignments = await db.query(`
      INSERT INTO assignments (title, created_by, deadline) VALUES 
      ('Задание №1 - Мигание светодиода', 1, NOW() + INTERVAL '7 days'),
      ('Задание №2 - Управление сервоприводом', 1, NOW() + INTERVAL '14 days'),
      ('Задание №3 - Работа с датчиками', 1, NOW() + INTERVAL '21 days')
      ON CONFLICT DO NOTHING
      RETURNING id, title, created_by
    `);

    // Создаем назначения заданий студентам
    const studentAssignments = await db.query(`
      INSERT INTO student_assignment (student_id, assignment_id, is_completed) VALUES 
      (2, 1, false),
      (2, 2, true),
      (3, 1, true),
      (3, 2, false),
      (4, 1, false),
      (4, 3, false),
      (5, 2, true),
      (5, 3, true)
      ON CONFLICT DO NOTHING
      RETURNING student_id, assignment_id, is_completed
    `);

    return NextResponse.json({
      success: true,
      message: 'Тестовые данные созданы',
      data: {
        roles: roles.rows,
        groups: groups.rows,
        users: users.rows,
        teacherStudent: teacherStudent.rows,
        assignments: assignments.rows,
        studentAssignments: studentAssignments.rows
      }
    });
  } catch (error) {
    console.error('Ошибка при создании тестовых данных:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
