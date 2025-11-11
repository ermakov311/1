import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить группы учителя с его учениками
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
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
    const { teacherId: teacherIdParam } = await params;
    const teacherId = parseInt(teacherIdParam);

    if (isNaN(teacherId)) {
      return NextResponse.json(
        { error: 'Неверный ID учителя' },
        { status: 400 }
      );
    }

    // Проверяем права доступа - только сам учитель или админ могут получить его группы
    if (decoded.role_id !== 1 && decoded.id !== teacherId) {
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    // Получаем группы, в которых есть ученики этого учителя
    const groups = await db.query(`
      SELECT DISTINCT g.id, g.name, 
             COUNT(DISTINCT ts.student_id) as students_count
      FROM groups g
      INNER JOIN users u ON g.id = u.group_id
      INNER JOIN teacher_student ts ON u.id = ts.student_id
      WHERE ts.teacher_id = $1
      GROUP BY g.id, g.name
      ORDER BY g.name
    `, [teacherId]);

    return NextResponse.json({
      success: true,
      groups: groups.rows,
    });
  } catch (error) {
    console.error('Ошибка при получении групп учителя:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
// Привязать группу к преподавателю (создать связи учитель-студент для всех студентов группы)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
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
    // Только админ может массово привязывать группы к преподавателю
    if (decoded.role_id !== 1) {
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { teacherId: teacherIdParam } = await params;
    const teacherId = parseInt(teacherIdParam);
    const { group_id } = await request.json();

    if (isNaN(teacherId)) {
      return NextResponse.json(
        { error: 'Неверный ID учителя' },
        { status: 400 }
      );
    }
    if (!group_id) {
      return NextResponse.json(
        { error: 'ID группы обязателен' },
        { status: 400 }
      );
    }

    // Проверяем, что учитель существует и имеет корректную роль
    const teacherCheck = await db.query('SELECT id FROM users WHERE id = $1 AND role_id = 2', [teacherId]);
    if (teacherCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Преподаватель не найден' },
        { status: 404 }
      );
    }

    // Проверяем, что группа существует
    const groupCheck = await db.query('SELECT id FROM groups WHERE id = $1', [group_id]);
    if (groupCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Группа не найдена' },
        { status: 404 }
      );
    }

    // Получаем всех студентов группы
    const studentsRes = await db.query(
      'SELECT id FROM users WHERE group_id = $1 AND role_id = 3',
      [group_id]
    );
    const studentIds: number[] = studentsRes.rows.map((r: any) => r.id);

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        linkedCount: 0,
        message: 'В группе нет студентов для привязки',
      });
    }

    // Получаем уже существующие связи, чтобы не дублировать
    const existingRes = await db.query(
      'SELECT student_id FROM teacher_student WHERE teacher_id = $1 AND student_id = ANY($2::int[])',
      [teacherId, studentIds]
    );
    const existingStudentIds = new Set(existingRes.rows.map((r: any) => r.student_id));

    const toInsert = studentIds.filter((id) => !existingStudentIds.has(id));

    let insertedCount = 0;
    if (toInsert.length > 0) {
      // Вставка батчем
      const values = toInsert.map((_, i) => `($1, $${i + 2})`).join(', ');
      const paramsBatch = [teacherId, ...toInsert];
      await db.query(
        `INSERT INTO teacher_student (teacher_id, student_id) VALUES ${values}`,
        paramsBatch as any
      );
      insertedCount = toInsert.length;
    }

    return NextResponse.json({
      success: true,
      linkedCount: insertedCount,
      message: `Привязано студентов: ${insertedCount}`,
    });
  } catch (error: any) {
    console.error('Ошибка при привязке группы к преподавателю:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

