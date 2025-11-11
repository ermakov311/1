import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить все назначения студентам
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
    const studentId = searchParams.get('student_id');
    const assignmentId = searchParams.get('assignment_id');
    const isCompleted = searchParams.get('is_completed');

    let query = `
      SELECT sa.*, 
             u.fio_name as student_name,
             a.title as assignment_title,
             a.deadline as assignment_deadline,
             a.created_by as assignment_created_by
      FROM student_assignment sa
      LEFT JOIN users u ON sa.student_id = u.id
      LEFT JOIN assignments a ON sa.assignment_id = a.id
    `;
    const params: any[] = [];
    let paramCount = 0;

    const conditions = [];
    
    if (studentId) {
      paramCount++;
      conditions.push(`sa.student_id = $${paramCount}`);
      params.push(parseInt(studentId));
    }

    if (assignmentId) {
      paramCount++;
      conditions.push(`sa.assignment_id = $${paramCount}`);
      params.push(parseInt(assignmentId));
    }

    if (isCompleted !== null) {
      paramCount++;
      conditions.push(`sa.is_completed = $${paramCount}`);
      params.push(isCompleted === 'true');
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY sa.updated_at DESC';

    const studentAssignments = await db.query(query, params);
    
    return NextResponse.json({
      success: true,
      studentAssignments: studentAssignments.rows,
    });
  } catch (error) {
    console.error('Ошибка при получении назначений студентам:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Создать новое назначение студенту
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
    
    // Проверяем, что пользователь имеет права на создание назначений
    if (decoded.role_id !== 1 && decoded.role_id !== 2) { // role_id = 1 админ, role_id = 2 учитель
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { student_id, assignment_id, is_completed = false } = await request.json();

    if (!student_id || !assignment_id) {
      return NextResponse.json(
        { error: 'ID студента и ID задания обязательны' },
        { status: 400 }
      );
    }

    // Проверяем, что студент и задание существуют
    const studentCheck = await db.query('SELECT id FROM users WHERE id = $1 AND role_id = 3', [student_id]); // role_id = 3 ученик
    const assignmentCheck = await db.query('SELECT id FROM assignments WHERE id = $1', [assignment_id]);

    if (studentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Студент не найден' },
        { status: 404 }
      );
    }

    if (assignmentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Задание не найдено' },
        { status: 404 }
      );
    }

    const result = await db.query(
      'INSERT INTO student_assignment (student_id, assignment_id, is_completed) VALUES ($1, $2, $3) RETURNING *',
      [student_id, assignment_id, is_completed]
    );

    return NextResponse.json({
      success: true,
      studentAssignment: result.rows[0],
    });
  } catch (error: any) {
    console.error('Ошибка при создании назначения студенту:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { error: 'Назначение для этого студента уже существует' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
