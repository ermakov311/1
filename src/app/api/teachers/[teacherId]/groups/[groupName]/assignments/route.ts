import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Назначить выбранное задание всем студентам группы учителя
export async function POST(
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

    // Доступ: админ (role_id=1) или сам учитель
    if (decoded.role_id !== 1 && decoded.id !== teacherId) {
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { assignment_id } = await request.json();

    if (!assignment_id || Number.isNaN(Number(assignment_id))) {
      return NextResponse.json(
        { error: 'Некорректный assignment_id' },
        { status: 400 }
      );
    }

    // Проверяем существование задания
    const assignmentCheck = await db.query('SELECT id FROM assignments WHERE id = $1', [assignment_id]);
    if (assignmentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Задание не найдено' },
        { status: 404 }
      );
    }

    // В одной операции назначаем всем студентам группы данного учителя, исключая уже назначенных
    const insertResult = await db.query(
      `
      WITH target_students AS (
        SELECT DISTINCT u.id AS student_id
        FROM users u
        INNER JOIN groups g ON u.group_id = g.id
        INNER JOIN teacher_student ts ON u.id = ts.student_id
        WHERE ts.teacher_id = $1 AND g.name = $2 AND u.role_id = 3
      ), inserted AS (
        INSERT INTO student_assignment (student_id, assignment_id, is_completed)
        SELECT ts.student_id, $3, false
        FROM target_students ts
        WHERE NOT EXISTS (
          SELECT 1 FROM student_assignment sa
          WHERE sa.student_id = ts.student_id AND sa.assignment_id = $3
        )
        RETURNING *
      )
      SELECT COUNT(*)::int AS created_count FROM inserted;
      `,
      [teacherId, groupName, Number(assignment_id)]
    );

    const createdCount = insertResult.rows[0]?.created_count ?? 0;

    return NextResponse.json({
      success: true,
      created: createdCount,
      message:
        createdCount > 0
          ? `Задание назначено ${createdCount} студентам группы "${groupName}"`
          : 'Все ученики группы уже имеют это задание',
    });
  } catch (error) {
    console.error('Ошибка при массовом назначении задания группе:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

 