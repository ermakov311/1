import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить все задания
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

    // Получаем параметры запроса
    const { searchParams } = new URL(request.url);
    const createdBy = searchParams.get('created_by');
    const groupId = searchParams.get('group_id');

    let query = `
      SELECT a.*, u.fio_name as created_by_name, g.name as group_name
      FROM assignments a
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN groups g ON u.group_id = g.id
    `;
    const params: any[] = [];
    let paramCount = 0;

    const conditions = [];
    
    if (createdBy) {
      paramCount++;
      conditions.push(`a.created_by = $${paramCount}`);
      params.push(parseInt(createdBy));
    }

    if (groupId) {
      paramCount++;
      conditions.push(`u.group_id = $${paramCount}`);
      params.push(parseInt(groupId));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY a.created_at DESC';

    const assignments = await db.query(query, params);
    
    return NextResponse.json({
      success: true,
      assignments: assignments.rows,
    });
  } catch (error) {
    console.error('Ошибка при получении заданий:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Создать новое задание
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
    
    // Проверяем, что пользователь имеет права на создание заданий
    if (decoded.role_id !== 1 && decoded.role_id !== 2) { // role_id = 1 админ, role_id = 2 учитель
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const title = body?.title;
    const deadline = body?.deadline;
    const description = body?.description ?? null;
    const show_schema = typeof body?.show_schema === 'boolean' ? body.show_schema : true;
    const code = body?.code ?? null;
    const schema_json = body?.schema_json ?? null;
    const expected_logs = body?.expected_logs ?? null;
    const assignment_uid = typeof body?.assignment_id === 'string' ? body.assignment_id : null;

    if (!title) {
      return NextResponse.json(
        { error: 'Название задания обязательно' },
        { status: 400 }
      );
    }

    const result = await db.query(
      `INSERT INTO assignments (title, created_by, deadline, description, show_schema, code, schema_json, expected_logs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        title,
        decoded.id,
        deadline ? new Date(deadline) : null,
        description,
        show_schema,
        code,
        schema_json ? JSON.stringify(schema_json) : null,
        expected_logs ? JSON.stringify(expected_logs) : null,
      ]
    );

    return NextResponse.json({
      success: true,
      assignment: result.rows[0],
    });
  } catch (error: any) {
    console.error('Ошибка при создании задания:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
