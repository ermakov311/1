import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить студентов учителя из конкретной группы
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teacherId: string; groupName: string }> }
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
    const { teacherId: teacherIdParam, groupName: groupNameParam } = await params;
    const teacherId = parseInt(teacherIdParam);
    const groupName = decodeURIComponent(groupNameParam);

    if (isNaN(teacherId)) {
      return NextResponse.json(
        { error: 'Неверный ID учителя' },
        { status: 400 }
      );
    }

    // Проверяем права доступа - только сам учитель или админ могут получить его студентов
    if (decoded.role_id !== 1 && decoded.id !== teacherId) {
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    // Получаем студентов учителя из конкретной группы
    const students = await db.query(`
      SELECT DISTINCT u.id, u.fio_name, u.created_at,
             COUNT(sa.id) as assignments_count,
             COUNT(CASE WHEN sa.is_completed = true THEN 1 END) as completed_assignments
      FROM users u
      INNER JOIN groups g ON u.group_id = g.id
      INNER JOIN teacher_student ts ON u.id = ts.student_id
      LEFT JOIN student_assignment sa ON u.id = sa.student_id
      WHERE ts.teacher_id = $1 AND g.name = $2 AND u.role_id = 3
      GROUP BY u.id, u.fio_name, u.created_at
      ORDER BY u.fio_name
    `, [teacherId, groupName]);

    return NextResponse.json({
      success: true,
      students: students.rows,
    });
  } catch (error) {
    console.error('Ошибка при получении студентов учителя из группы:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
