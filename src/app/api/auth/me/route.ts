import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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

    return NextResponse.json({
      success: true,
      user: {
        id: decoded.id,
        fio_name: decoded.fio_name,
        role_id: decoded.role_id,
        group_id: decoded.group_id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Недействительный токен' },
      { status: 401 }
    );
  }
}