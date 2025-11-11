import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить группу по ID
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
    const groupId = parseInt(id);

    if (isNaN(groupId)) {
      return NextResponse.json(
        { error: 'Неверный ID группы' },
        { status: 400 }
      );
    }

    const result = await db.query('SELECT * FROM groups WHERE id = $1', [groupId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      group: result.rows[0],
    });
  } catch (error) {
    console.error('Ошибка при получении группы:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Обновить группу
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
    
    if (decoded.role_id !== 1) {
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const groupId = parseInt(id);
    const { name } = await request.json();

    if (isNaN(groupId)) {
      return NextResponse.json(
        { error: 'Неверный ID группы' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Название группы обязательно' },
        { status: 400 }
      );
    }

    const result = await db.query(
      'UPDATE groups SET name = $1 WHERE id = $2 RETURNING *',
      [name, groupId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      group: result.rows[0],
    });
  } catch (error: any) {
    console.error('Ошибка при обновлении группы:', error);
    
    if (error.code === '23505') {
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

// Удалить группу
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
    
    if (decoded.role_id !== 1) {
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const groupId = parseInt(id);

    if (isNaN(groupId)) {
      return NextResponse.json(
        { error: 'Неверный ID группы' },
        { status: 400 }
      );
    }

    const result = await db.query('DELETE FROM groups WHERE id = $1 RETURNING *', [groupId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Группа успешно удалена',
    });
  } catch (error) {
    console.error('Ошибка при удалении группы:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
