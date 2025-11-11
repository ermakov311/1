import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить все группы
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Токен не найден' },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const groups = await db.query('SELECT * FROM groups ORDER BY name');
    
    return NextResponse.json({
      success: true,
      groups: groups.rows,
    });
  } catch (error) {
    console.error('Ошибка при получении групп:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Создать новую группу
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
    
    // Проверяем, что пользователь имеет права на создание групп
    // Разрешаем администратору (1) и преподавателю (2)
    if (decoded.role_id !== 1 && decoded.role_id !== 2) {
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { name } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Название группы обязательно' },
        { status: 400 }
      );
    }

    const result = await db.query(
      'INSERT INTO groups (name) VALUES ($1) RETURNING *',
      [name]
    );

    return NextResponse.json({
      success: true,
      group: result.rows[0],
    });
  } catch (error: any) {
    console.error('Ошибка при создании группы:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { error: 'Группа с таким названием уже существует' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
