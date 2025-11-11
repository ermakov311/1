import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// GET instance with merged effective fields from base assignment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Токен не найден' }, { status: 401 });
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const { id } = await params;
    const instanceId = parseInt(id);
    if (isNaN(instanceId)) return NextResponse.json({ error: 'Неверный ID экземпляра' }, { status: 400 });

    const instRes = await db.query(
      'SELECT * FROM assignment_instances WHERE id = $1',
      [instanceId]
    );
    if (instRes.rows.length === 0) return NextResponse.json({ error: 'Экземпляр не найден' }, { status: 404 });
    const instance = instRes.rows[0];

    const baseId = instance.base_assignment_id;
    const baseRes = await db.query('SELECT * FROM assignments WHERE id = $1', [baseId]);
    if (baseRes.rows.length === 0) return NextResponse.json({ error: 'Базовое задание не найдено' }, { status: 404 });
    const base = baseRes.rows[0];

    const code_effective = instance.code_override ?? base.code ?? '';
    const schema_effective = instance.schema_override ?? base.schema_json ?? null;
    const expected_logs_effective = base.expected_logs ?? [];

    return NextResponse.json({
      success: true,
      instance: {
        id: instance.id,
        base_assignment_id: baseId,
        user_id: instance.user_id,
        group_id: instance.group_id,
        code_override: instance.code_override,
        schema_override: instance.schema_override,
      },
      base: { id: base.id, title: base.title },
      code_effective,
      schema_effective,
      expected_logs_effective,
    });
  } catch (error) {
    console.error('Ошибка при получении экземпляра задания:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

// PUT: update overrides (student work)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Токен не найден' }, { status: 401 });
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const { id } = await params;
    const instanceId = parseInt(id);
    if (isNaN(instanceId)) return NextResponse.json({ error: 'Неверный ID экземпляра' }, { status: 400 });

    const body = await request.json();
    const code_override = body?.code_override ?? null;
    const schema_override = body?.schema_override ?? null;

    const res = await db.query(
      `UPDATE assignment_instances SET
         code_override = COALESCE($1, code_override),
         schema_override = COALESCE($2, schema_override)
       WHERE id = $3 RETURNING *`,
      [code_override, schema_override ? JSON.stringify(schema_override) : null, instanceId]
    );

    return NextResponse.json({ success: true, instance: res.rows[0] });
  } catch (error) {
    console.error('Ошибка при обновлении экземпляра задания:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
























