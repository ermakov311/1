import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  try {
    const { fio_name, password } = await request.json();

    if (!fio_name || !password) {
      return NextResponse.json(
        { error: 'Имя и пароль обязательны' },
        { status: 400 }
      );
    }

    // Поиск пользователя по ФИО
    const result = await pool.query(
      'SELECT id, password_hash, fio_name, role_id, group_id FROM users WHERE fio_name = $1',
      [fio_name]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    const passwordHash: string | null = user.password_hash;

    let isValidPassword = false;
    if (passwordHash) {
      try {
        isValidPassword = await bcrypt.compare(password, passwordHash);
      } catch (compareError) {
        console.error('Ошибка сравнения пароля:', compareError);
      }
    }

    // Fallback для старых записей без хеша
    if (!isValidPassword && !passwordHash) {
      isValidPassword = password === `password${user.id}`;
    }

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Неверный пароль' },
        { status: 401 }
      );
    }

    // Создание JWT токена
    const token = jwt.sign(
      {
        id: user.id,
        fio_name: user.fio_name,
        role_id: user.role_id,
        group_id: user.group_id,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Установка токена в cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fio_name: user.fio_name,
        role_id: user.role_id,
        group_id: user.group_id,
      },
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 часа
    });

    
    return response;
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}