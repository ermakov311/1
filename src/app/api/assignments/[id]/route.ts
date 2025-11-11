import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Получить задание по ID
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
    const idStr = String(id);
    const assignmentId = parseInt(idStr);

    if (isNaN(assignmentId)) {
      return NextResponse.json(
        { error: 'Неверный ID задания' },
        { status: 400 }
      );
    }

    // 1) Пытаемся найти как обычное задание по ID
    let result = await db.query(`
      SELECT a.*, u.fio_name as created_by_name, g.name as group_name
      FROM assignments a
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN groups g ON u.group_id = g.id
      WHERE a.id = $1
    `, [assignmentId]);

    // Если не нашли по обычному ID, переходим к другим стратегиям поиска

    // 2) Если не нашли — пробуем как экземпляр (assignment_instances)
    //    а) По составному ID (composite_id = число вида baseId+userId+groupId)
    //    б) По id экземпляра (auto-increment), чтобы поддержать старые ссылки типа 36
    if (result.rows.length === 0) {
      try {
        // Попытка: composite_id
        let inst = await db.query(
          'SELECT * FROM assignment_instances WHERE composite_id = $1',
          [assignmentId]
        );
        if (inst.rows.length === 0) {
          // Попытка: id экземпляра
          inst = await db.query(
            'SELECT * FROM assignment_instances WHERE id = $1',
            [assignmentId]
          );
        }

        if (inst.rows.length > 0) {
          const instance = inst.rows[0];
          const baseId = instance.base_assignment_id;
          result = await db.query(`
            SELECT a.*, u.fio_name as created_by_name, g.name as group_name
            FROM assignments a
            LEFT JOIN users u ON a.created_by = u.id
            LEFT JOIN groups g ON u.group_id = g.id
            WHERE a.id = $1
          `, [baseId]);

          if (result.rows.length === 0) {
            return NextResponse.json(
              { error: 'Базовое задание не найдено' },
              { status: 404 }
            );
          }

          // Встраиваем effective-поля
          const base = result.rows[0] as any;
          const code_effective = instance.code_override ?? base.code ?? '';
          const schema_effective = instance.schema_override ?? base.schema_json ?? null;
          const expected_logs_effective = base.expected_logs ?? [];

          return NextResponse.json({
            success: true,
            assignment: {
              ...base,
              // Отдаем effective для удобства клиентов
              code: code_effective,
              schema_json: schema_effective,
              expected_logs: expected_logs_effective,
              // Доп. мета-данные
              _instance: {
                id: instance.id,
                composite_id: instance.composite_id ?? null,
                base_assignment_id: base.id,
                user_id: instance.user_id,
                group_id: instance.group_id,
              },
            },
          });
        }
      } catch {}

      // 3) Композитный ID вида baseId + userId + groupId (конкатенация),
      //    вычисляем baseId по токену пользователя, если суффиксы совпадают
      try {
        const userId = decoded?.id;
        const groupId = decoded?.group_id;
        if (userId && groupId) {
          const suffix = `${userId}${groupId}`;
          if (idStr.endsWith(suffix)) {
            const basePart = idStr.slice(0, idStr.length - suffix.length);
            const baseId = parseInt(basePart);
            if (!isNaN(baseId)) {
              const baseRes = await db.query(`
                SELECT a.*, u.fio_name as created_by_name, g.name as group_name
                FROM assignments a
                LEFT JOIN users u ON a.created_by = u.id
                LEFT JOIN groups g ON u.group_id = g.id
                WHERE a.id = $1
              `, [baseId]);

              if (baseRes.rows.length > 0) {
                const base = baseRes.rows[0] as any;

                // Пытаемся создать (или получить) запись экземпляра с таким composite_id
                try {
                  const upsert = await db.query(
                    `INSERT INTO assignment_instances (base_assignment_id, user_id, group_id, composite_id)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (composite_id) DO UPDATE SET composite_id = EXCLUDED.composite_id
                     RETURNING *`,
                    [base.id, userId, groupId, parseInt(idStr)]
                  );
                  const instance = upsert.rows[0];

                  return NextResponse.json({
                    success: true,
                    assignment: {
                      ...base,
                      code: base.code ?? '',
                      schema_json: base.schema_json ?? null,
                      expected_logs: base.expected_logs ?? [],
                      _instance: {
                        id: instance.id,
                        composite_id: instance.composite_id ?? parseInt(idStr),
                        base_assignment_id: base.id,
                        user_id: userId,
                        group_id: groupId,
                      },
                    },
                  });
                } catch {
                  // Если таблицы нет или upsert не удался — просто вернем базу
                  return NextResponse.json({
                    success: true,
                    assignment: base,
                  });
                }
              }
            }
          }
        }
      } catch {}

      // Если ничего не нашли по всем стратегиям — 404
      return NextResponse.json(
        { error: 'Задание не найдено' },
        { status: 404 }
      );
    }

    let row = result.rows[0] as any;

    // If this is a distributed/copy record without its own code/schema_json,
    // try to resolve base assignment from common foreign keys
    try {
      const baseId = row.parent_id || row.base_id || row.original_id;
      const needsCode = !row.code || row.code === '';
      const needsSchema = !row.schema_json || row.schema_json === '';
      if ((needsCode || needsSchema) && baseId) {
        const baseRes = await db.query('SELECT id, code, schema_json, expected_logs FROM assignments WHERE id = $1', [baseId]);
        if (baseRes.rows.length > 0) {
          const base = baseRes.rows[0];
          if (needsCode && base.code) row.code = base.code;
          if (needsSchema && base.schema_json) row.schema_json = base.schema_json;
          if (!row.expected_logs && base.expected_logs) row.expected_logs = base.expected_logs;
        }
      }
    } catch {}

    return NextResponse.json({
      success: true,
      assignment: row,
    });
  } catch (error) {
    console.error('Ошибка при получении задания:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Обновить задание
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
    
    if (decoded.role_id !== 1 && decoded.role_id !== 2) { // role_id = 1 админ, role_id = 2 учитель
      return NextResponse.json(
        { error: 'Недостаточно прав' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const assignmentId = parseInt(id);
    const body = await request.json();
    const title = body?.title ?? null;
    const deadline = body?.deadline ?? null;
    const description = body?.description ?? null;
    const show_schema = typeof body?.show_schema === 'boolean' ? body.show_schema : null;
    const code = body?.code ?? null;
    const schema_json = body?.schema_json ?? null;
    const expected_logs = body?.expected_logs ?? null;
    const assignment_uid = typeof body?.assignment_id === 'string' ? body.assignment_id : null;

    if (isNaN(assignmentId)) {
      return NextResponse.json(
        { error: 'Неверный ID задания' },
        { status: 400 }
      );
    }

    // title is optional for updates

    // Проверяем, что пользователь является создателем задания
    const assignmentCheck = await db.query(
      'SELECT created_by FROM assignments WHERE id = $1',
      [assignmentId]
    );

    if (assignmentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Задание не найдено' },
        { status: 404 }
      );
    }

    if (assignmentCheck.rows[0].created_by !== decoded.id) {
      return NextResponse.json(
        { error: 'Недостаточно прав для редактирования этого задания' },
        { status: 403 }
      );
    }

    const result = await db.query(
      `UPDATE assignments SET
         title = COALESCE($1, title),
         deadline = COALESCE($2, deadline),
         description = COALESCE($3, description),
         show_schema = COALESCE($4, show_schema),
         code = COALESCE($5, code),
         schema_json = COALESCE($6, schema_json),
         expected_logs = COALESCE($7, expected_logs)
       WHERE id = $8 RETURNING *`,
      [
        title,
        deadline ? new Date(deadline) : null,
        description,
        show_schema,
        code,
        schema_json ? JSON.stringify(schema_json) : null,
        expected_logs ? JSON.stringify(expected_logs) : null,
        assignmentId,
      ]
    );

    return NextResponse.json({
      success: true,
      assignment: result.rows[0],
    });
  } catch (error) {
    console.error('Ошибка при обновлении задания:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// Удалить задание
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
    const assignmentId = parseInt(id);

    if (isNaN(assignmentId)) {
      return NextResponse.json(
        { error: 'Неверный ID задания' },
        { status: 400 }
      );
    }

    // Проверяем, что пользователь является создателем задания
    const assignmentCheck = await db.query(
      'SELECT created_by FROM assignments WHERE id = $1',
      [assignmentId]
    );

    if (assignmentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Задание не найдено' },
        { status: 404 }
      );
    }

    if (assignmentCheck.rows[0].created_by !== decoded.id) {
      return NextResponse.json(
        { error: 'Недостаточно прав для удаления этого задания' },
        { status: 403 }
      );
    }

    const result = await db.query('DELETE FROM assignments WHERE id = $1 RETURNING *', [assignmentId]);

    return NextResponse.json({
      success: true,
      message: 'Задание успешно удалено',
    });
  } catch (error) {
    console.error('Ошибка при удалении задания:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
