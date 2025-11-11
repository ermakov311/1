import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить связь учитель-студент по ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teacherId: string; studentId: string }> }
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
    const { teacherId: teacherIdParam, studentId: studentIdParam } = await params;
    const teacherId = parseInt(teacherIdParam);
    const studentId = parseInt(studentIdParam);

    if (isNaN(teacherId) || isNaN(studentId)) {
      return NextResponse.json(
        { error: 'Неверные ID учителя или студента' },
        { status: 400 }
      );
    }

    const result = await db.query(`
      SELECT ts.*, 
             t.fio_name as teacher_name,
             s.fio_name as student_name,
             g.name as student_group_name
      FROM teacher_student ts
      LEFT JOIN users t ON ts.teacher_id = t.id
      LEFT JOIN users s ON ts.student_id = s.id
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE ts.teacher_id = $1 AND ts.student_id = $2
    `, [teacherId, studentId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Связь не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      teacherStudent: result.rows[0],
    });
  } catch (error) {
    console.error('Ошибка при получении связи учитель-студент:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Удалить связь учитель-студент
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teacherId: string; studentId: string }> }
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

    const { teacherId: teacherIdParam, studentId: studentIdParam } = await params;
    const teacherId = parseInt(teacherIdParam);
    const studentId = parseInt(studentIdParam);

    if (isNaN(teacherId) || isNaN(studentId)) {
      return NextResponse.json(
        { error: 'Неверные ID учителя или студента' },
        { status: 400 }
      );
    }

    const result = await db.query(
      'DELETE FROM teacher_student WHERE teacher_id = $1 AND student_id = $2 RETURNING *',
      [teacherId, studentId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Связь не найдена' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Связь учитель-студент успешно удалена',
    });
  } catch (error) {
    console.error('Ошибка при удалении связи учитель-студент:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
