import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить роль по ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Токен не найден' },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const { id } = await params;
    const roleId = parseInt(id);

    if (isNaN(roleId)) {
      return NextResponse.json(
        { error: 'Неверный ID роли' },
        { status: 400 }
      );
    }

    const result = await db.query('SELECT * FROM roles WHERE id = $1', [roleId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Роль не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      role: result.rows[0],
    });
  } catch (error) {
    console.error('Ошибка при получении роли:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Обновить роль
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Токен не найден' },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.role_id !== 1) { // role_id = 1 админ
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const roleId = parseInt(id);
    const { name } = await request.json();

    if (isNaN(roleId)) {
      return NextResponse.json(
        { error: 'Неверный ID роли' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Название роли обязательно' },
        { status: 400 }
      );
    }

    const result = await db.query(
      'UPDATE roles SET name = $1 WHERE id = $2 RETURNING *',
      [name, roleId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Роль не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      role: result.rows[0],
    });
  } catch (error: any) {
    console.error('Ошибка при обновлении роли:', error);
    
    if (error.code === '23505') {
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

// Удалить роль
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Токен не найден' },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.role_id !== 1) { // role_id = 1 админ
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const roleId = parseInt(id);

    if (isNaN(roleId)) {
      return NextResponse.json(
        { error: 'Неверный ID роли' },
        { status: 400 }
      );
    }

    // Проверяем, используется ли роль
    const usersWithRole = await db.query('SELECT COUNT(*) FROM users WHERE role_id = $1', [roleId]);
    
    if (parseInt(usersWithRole.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'Нельзя удалить роль, которая используется пользователями' },
        { status: 409 }
      );
    }

    const result = await db.query('DELETE FROM roles WHERE id = $1 RETURNING *', [roleId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Роль не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Роль успешно удалена',
    });
  } catch (error) {
    console.error('Ошибка при удалении роли:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
