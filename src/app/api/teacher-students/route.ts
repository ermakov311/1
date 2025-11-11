import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить все связи учитель-студент
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
    const teacherId = searchParams.get('teacher_id');
    const studentId = searchParams.get('student_id');

    let query = `
      SELECT ts.*, 
             t.fio_name as teacher_name,
             s.fio_name as student_name,
             g.name as student_group_name
      FROM teacher_student ts
      LEFT JOIN users t ON ts.teacher_id = t.id
      LEFT JOIN users s ON ts.student_id = s.id
      LEFT JOIN groups g ON s.group_id = g.id
    `;
    const params: any[] = [];
    let paramCount = 0;

    const conditions = [];
    
    if (teacherId) {
      paramCount++;
      conditions.push(`ts.teacher_id = $${paramCount}`);
      params.push(parseInt(teacherId));
    }

    if (studentId) {
      paramCount++;
      conditions.push(`ts.student_id = $${paramCount}`);
      params.push(parseInt(studentId));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY ts.assigned_at DESC';

    const teacherStudents = await db.query(query, params);
    
    return NextResponse.json({
      success: true,
      teacherStudents: teacherStudents.rows,
    });
  } catch (error) {
    console.error('Ошибка при получении связей учитель-студент:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Создать новую связь учитель-студент
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
    
    // Проверяем, что пользователь имеет права на создание связей
    if (decoded.role_id !== 1 && decoded.role_id !== 2) { // role_id = 1 админ, role_id = 2 учитель
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { teacher_id, student_id } = await request.json();

    if (!teacher_id || !student_id) {
      return NextResponse.json(
        { error: 'ID учителя и ID студента обязательны' },
        { status: 400 }
      );
    }

    // Проверяем, что учитель и студент существуют и имеют правильные роли
    const teacherCheck = await db.query('SELECT id FROM users WHERE id = $1 AND (role_id = 1 OR role_id = 2)', [teacher_id]); // role_id = 1 админ, role_id = 2 учитель
    const studentCheck = await db.query('SELECT id FROM users WHERE id = $1 AND role_id = 3', [student_id]); // role_id = 3 ученик

    if (teacherCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Учитель не найден' },
        { status: 404 }
      );
    }

    if (studentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Студент не найден' },
        { status: 404 }
      );
    }

    const result = await db.query(
      'INSERT INTO teacher_student (teacher_id, student_id) VALUES ($1, $2) RETURNING *',
      [teacher_id, student_id]
    );

    return NextResponse.json({
      success: true,
      teacherStudent: result.rows[0],
    });
  } catch (error: any) {
    console.error('Ошибка при создании связи учитель-студент:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { error: 'Связь между этим учителем и студентом уже существует' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
