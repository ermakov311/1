import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить пользователя по ID
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
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Неверный ID пользователя' },
        { status: 400 }
      );
    }

    // Пользователь может получить только свою информацию, админ - любую
    if (decoded.role_id !== 1 && decoded.id !== userId) { // role_id = 1 админ
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const result = await db.query(`
      SELECT u.id, u.fio_name, u.role_id, u.group_id, u.created_at,
             r.name as role_name,
             g.name as group_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN groups g ON u.group_id = g.id
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Ошибка при получении пользователя:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Обновить пользователя
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
    const { id } = await params;
    const userId = parseInt(id);
    const { fio_name, password, role_id, group_id } = await request.json();

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Неверный ID пользователя' },
        { status: 400 }
      );
    }

    // Проверяем права доступа
    if (decoded.role_id !== 1 && decoded.id !== userId) {
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    // Студенты могут обновлять только свое ФИО и пароль
    if (decoded.role_id === 3 && decoded.id === userId) { // role_id = 3 ученик
      if (role_id !== undefined || group_id !== undefined) {
        return NextResponse.json(
          { error: 'Недостаточно прав для изменения роли или группы' },
          { status: 403 }
        );
      }
    }

    // Проверяем, что пользователь существует
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    // Проверяем, что роль существует (если указана)
    if (role_id) {
      const roleCheck = await db.query('SELECT id FROM roles WHERE id = $1', [role_id]);
      if (roleCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Роль не найдена' },
          { status: 404 }
        );
      }
    }

    // Проверяем, что группа существует (если указана)
    if (group_id) {
      const groupCheck = await db.query('SELECT id FROM groups WHERE id = $1', [group_id]);
      if (groupCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Группа не найдена' },
          { status: 404 }
        );
      }
    }

    // Подготавливаем данные для обновления
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    if (fio_name !== undefined) {
      paramCount++;
      updateFields.push(`fio_name = $${paramCount}`);
      updateValues.push(fio_name);
    }

    if (password !== undefined) {
      paramCount++;
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      updateFields.push(`password_hash = $${paramCount}`);
      updateValues.push(passwordHash);
    }

    if (role_id !== undefined && decoded.role_id === 1) { // role_id = 1 админ
      paramCount++;
      updateFields.push(`role_id = $${paramCount}`);
      updateValues.push(role_id);
    }

    if (group_id !== undefined && decoded.role_id === 1) { // role_id = 1 админ
      paramCount++;
      updateFields.push(`group_id = $${paramCount}`);
      updateValues.push(group_id);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'Нет данных для обновления' },
        { status: 400 }
      );
    }

    paramCount++;
    updateValues.push(userId);

    const result = await db.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING id, fio_name, role_id, group_id, created_at`,
      updateValues
    );

    return NextResponse.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Ошибка при обновлении пользователя:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Удалить пользователя
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
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Неверный ID пользователя' },
        { status: 400 }
      );
    }

    // Нельзя удалить самого себя
    if (decoded.id === userId) {
      return NextResponse.json(
        { error: 'Нельзя удалить самого себя' },
        { status: 400 }
      );
    }

    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING *', [userId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Пользователь успешно удален',
    });
  } catch (error) {
    console.error('Ошибка при удалении пользователя:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
