import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('role_id');
    const groupId = searchParams.get('group_id');

    let query = `
      SELECT u.id, u.fio_name, u.role_id, u.group_id, u.created_at,
             r.name as role_name,
             g.name as group_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN groups g ON u.group_id = g.id
    `;
    const params: any[] = [];
    let paramCount = 0;

    const conditions = [];
    
    if (roleId) {
      paramCount++;
      conditions.push(`u.role_id = $${paramCount}`);
      params.push(parseInt(roleId));
    }

    if (groupId) {
      paramCount++;
      conditions.push(`u.group_id = $${paramCount}`);
      params.push(parseInt(groupId));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY u.created_at DESC';

    const users = await db.query(query, params);
    
    return NextResponse.json({
      success: true,
      users: users.rows,
    });
  } catch (error) {
    console.error('Ошибка при получении пользователей:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

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

    if (decoded.role_id !== 1) { // role_id = 1 админ
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { fio_name, password, role_id, group_id } = await request.json();

    if (!fio_name || !password || !role_id) {
      return NextResponse.json(
        { error: 'ФИО, пароль и роль обязательны' },
        { status: 400 }
      );
    }

    const roleCheck = await db.query('SELECT id FROM roles WHERE id = $1', [role_id]);
    if (roleCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Роль не найдена' },
        { status: 404 }
      );
    }

    if (group_id) {
      const groupCheck = await db.query('SELECT id FROM groups WHERE id = $1', [group_id]);
      if (groupCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Группа не найдена' },
          { status: 404 }
        );
      }
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await db.query(
      'INSERT INTO users (fio_name, password_hash, role_id, group_id) VALUES ($1, $2, $3, $4) RETURNING id, fio_name, role_id, group_id, created_at',
      [fio_name, passwordHash, role_id, group_id]
    );

    return NextResponse.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error: any) {
    console.error('Ошибка при создании пользователя:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
