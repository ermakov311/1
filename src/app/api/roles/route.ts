import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить все роли
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

    const roles = await db.query('SELECT * FROM roles ORDER BY name');
    
    return NextResponse.json({
      success: true,
      roles: roles.rows,
    });
  } catch (error) {
    console.error('Ошибка при получении ролей:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Создать новую роль
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
    
    // Проверяем, что пользователь имеет права на создание ролей
    if (decoded.role_id !== 1) { // role_id = 1 админ
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { name } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Название роли обязательно' },
        { status: 400 }
      );
    }

    const result = await db.query(
      'INSERT INTO roles (name) VALUES ($1) RETURNING *',
      [name]
    );

    return NextResponse.json({
      success: true,
      role: result.rows[0],
    });
  } catch (error: any) {
    console.error('Ошибка при создании роли:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { error: 'Роль с таким названием уже существует' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
