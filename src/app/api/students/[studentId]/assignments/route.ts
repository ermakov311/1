import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить задания студента
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
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
    const { studentId: studentIdParam } = await params;
    const studentId = parseInt(studentIdParam);

    if (isNaN(studentId)) {
      return NextResponse.json(
        { error: 'Неверный ID студента' },
        { status: 400 }
      );
    }

    // Проверяем права доступа - студент может видеть только свои задания, учитель - задания своих студентов
    if (decoded.role_id === 3 && decoded.id !== studentId) {
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    if (decoded.role_id === 2) {
      // Проверяем, что студент принадлежит этому учителю
      const teacherStudentCheck = await db.query(
        'SELECT teacher_id, student_id FROM teacher_student WHERE teacher_id = $1 AND student_id = $2',
        [decoded.id, studentId]
      );

      if (teacherStudentCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Недостаточно прав для просмотра заданий этого студента' },
          { status: 403 }
        );
      }
    }

    // Получаем задания студента
    const assignments = await db.query(`
      SELECT sa.*, 
             a.title as assignment_title,
             a.deadline as assignment_deadline,
             a.created_at as assignment_created_at,
             u.fio_name as created_by_name
      FROM student_assignment sa
      LEFT JOIN assignments a ON sa.assignment_id = a.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE sa.student_id = $1
      ORDER BY sa.updated_at DESC
    `, [studentId]);

    

    return NextResponse.json({
      success: true,
      assignments: assignments.rows,
    });
  } catch (error) {
    console.error('Ошибка при получении заданий студента:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
