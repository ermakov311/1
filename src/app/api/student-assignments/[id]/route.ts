import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить назначение по ID
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
    const studentAssignmentId = parseInt(id);

    if (isNaN(studentAssignmentId)) {
      return NextResponse.json(
        { error: 'Неверный ID назначения' },
        { status: 400 }
      );
    }

    const result = await db.query(`
      SELECT sa.*, 
             u.fio_name as student_name,
             a.title as assignment_title,
             a.deadline as assignment_deadline,
             a.created_by as assignment_created_by
      FROM student_assignment sa
      LEFT JOIN users u ON sa.student_id = u.id
      LEFT JOIN assignments a ON sa.assignment_id = a.id
      WHERE sa.id = $1
    `, [studentAssignmentId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Назначение не найдено' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      studentAssignment: result.rows[0],
    });
  } catch (error) {
    console.error('Ошибка при получении назначения:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Обновить назначение
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
    const studentAssignmentId = parseInt(id);
    const { is_completed, completed_at } = await request.json();

    if (isNaN(studentAssignmentId)) {
      return NextResponse.json(
        { error: 'Неверный ID назначения' },
        { status: 400 }
      );
    }

    // Проверяем права доступа
    const assignmentCheck = await db.query(`
      SELECT sa.*, a.created_by 
      FROM student_assignment sa
      LEFT JOIN assignments a ON sa.assignment_id = a.id
      WHERE sa.id = $1
    `, [studentAssignmentId]);

    if (assignmentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Назначение не найдено' },
        { status: 404 }
      );
    }

    const assignment = assignmentCheck.rows[0];
    
    // Студент может обновлять только свои назначения, учитель - любые
    if (decoded.role_id === 3 && assignment.student_id !== decoded.id) { // role_id = 3 ученик
      return NextResponse.json(
        { error: 'Недостаточно прав для обновления этого назначения' },
        { status: 403 }
      );
    }

    if ((decoded.role_id === 1 || decoded.role_id === 2) && assignment.created_by !== decoded.id) { // role_id = 1 админ, role_id = 2 учитель
      return NextResponse.json(
        { error: 'Недостаточно прав для обновления этого назначения' },
        { status: 403 }
      );
    }

    const updateData = {
      is_completed: is_completed !== undefined ? is_completed : assignment.is_completed,
      completed_at: is_completed === true ? (completed_at ? new Date(completed_at) : new Date()) : null,
      updated_at: new Date()
    };

    const result = await db.query(
      'UPDATE student_assignment SET is_completed = $1, completed_at = $2, updated_at = $3 WHERE id = $4 RETURNING *',
      [updateData.is_completed, updateData.completed_at, updateData.updated_at, studentAssignmentId]
    );

    return NextResponse.json({
      success: true,
      studentAssignment: result.rows[0],
    });
  } catch (error) {
    console.error('Ошибка при обновлении назначения:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Удалить назначение
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
    
    if (decoded.role_id !== 1 && decoded.role_id !== 2) { // role_id = 1 админ, role_id = 2 учитель
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const studentAssignmentId = parseInt(id);

    if (isNaN(studentAssignmentId)) {
      return NextResponse.json(
        { error: 'Неверный ID назначения' },
        { status: 400 }
      );
    }

    const result = await db.query('DELETE FROM student_assignment WHERE id = $1 RETURNING *', [studentAssignmentId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Назначение не найдено' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Назначение успешно удалено',
    });
  } catch (error) {
    console.error('Ошибка при удалении назначения:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
