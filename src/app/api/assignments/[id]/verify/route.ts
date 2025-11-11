import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import db from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 401 })
    }
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const studentId = decoded?.id
    if (!studentId) {
      return NextResponse.json({ error: 'Нет пользователя' }, { status: 401 })
    }

    const { id } = await params
    const assignmentId = parseInt(id)
    if (isNaN(assignmentId)) {
      return NextResponse.json({ error: 'Неверный ID задания' }, { status: 400 })
    }

    const body = await request.json()
    const submittedLogs = body?.logs ?? []

    const normalizeEvents = (arr: any[]) => {
      const logs = Array.isArray(arr) ? arr : []
      const startIdx = logs.findIndex((e: any) => e && e.type === 'event' && e.name === 'loop' && e.phase === 'start')
      const endIdx = startIdx >= 0 ? logs.findIndex((e: any, i: number) => i > startIdx && e && e.type === 'event' && e.name === 'loop' && e.phase === 'end') : -1
      const slice = (startIdx >= 0 && endIdx > startIdx) ? logs.slice(startIdx + 1, endIdx) : logs
      return slice
        .map((e: any) => {
          if (!e) return null
          if (e.t) return e
          if (e.type === 'event') {
            if (e.name === 'led') return { t: 'led', id: e.id, on: !!e.on, b: Math.round(((e.brightness ?? 0) as number) * 100) / 100 }
            if (e.name === 'digitalWrite') return { t: 'dw', pin: e.pin, v: e.value ? 1 : 0 }
            if (e.name === 'delay') return { t: 'del', ms: Number(e.ms) || 0 }
            if (e.name === 'button') return { t: 'btn', id: e.id, p: !!e.pressed }
          }
          return null
        })
        .filter(Boolean)
    }

    // Smart comparison: compare events by meaning, not strict order
    // This allows students to solve tasks without loops but with the same result
    const compareEventsByMeaning = (expected: any[], submitted: any[]) => {
      if (expected.length === 0) return true
      if (submitted.length === 0) return false

      // Group events by type and parameters
      const groupEvents = (events: any[]) => {
        const groups: { [key: string]: number } = {}
        events.forEach((e: any) => {
          if (!e) return
          let key = ''
          if (e.t === 'led') {
            key = `led:${e.id}:${e.on ? 'on' : 'off'}:${e.b || 0}`
          } else if (e.t === 'dw') {
            key = `dw:${e.pin}:${e.v}`
          } else if (e.t === 'del') {
            // For delays, we sum them up (allow multiple small delays instead of one big)
            key = `del:total`
          } else if (e.t === 'btn') {
            key = `btn:${e.id}:${e.p ? 'pressed' : 'released'}`
          }
          if (key) {
            groups[key] = (groups[key] || 0) + 1
          }
        })
        return groups
      }

      const expectedGroups = groupEvents(expected)
      const submittedGroups = groupEvents(submitted)

      // Special handling for delays: sum them up
      const expectedDelayTotal = expected
        .filter((e: any) => e?.t === 'del')
        .reduce((sum: number, e: any) => sum + (e.ms || 0), 0)
      const submittedDelayTotal = submitted
        .filter((e: any) => e?.t === 'del')
        .reduce((sum: number, e: any) => sum + (e.ms || 0), 0)

      // Check all expected events are present with EXACT count (not just minimum)
      for (const key in expectedGroups) {
        if (key.startsWith('del:total')) {
          // For delays, check total time (allow 10ms tolerance)
          const tolerance = 10
          if (Math.abs(expectedDelayTotal - submittedDelayTotal) > tolerance) {
            return false
          }
        } else {
          const expectedCount = expectedGroups[key]
          const submittedCount = submittedGroups[key] || 0
          // Require EXACT match - not less, not more
          if (submittedCount !== expectedCount) {
            return false
          }
        }
      }

      // Also check that submitted doesn't have extra events that weren't expected
      for (const key in submittedGroups) {
        if (!key.startsWith('del:total') && !expectedGroups[key]) {
          // Extra event type that wasn't expected
          return false
        }
      }

      return true
    }

    const aRes = await db.query('SELECT expected_logs FROM assignments WHERE id = $1', [assignmentId])
    if (aRes.rows.length === 0) {
      return NextResponse.json({ error: 'Задание не найдено' }, { status: 404 })
    }
    const expectedRaw = aRes.rows[0]?.expected_logs || []
    const exp = normalizeEvents(expectedRaw)
    const got = normalizeEvents(submittedLogs)
    
    // Use smart comparison instead of strict order comparison
    const isEqual = compareEventsByMeaning(exp, got)

    try {
      await db.query(
        `INSERT INTO assignment_results (assignment_id, student_id, is_correct, logs)
         VALUES ($1, $2, $3, $4)`,
        [assignmentId, studentId, isEqual, JSON.stringify(submittedLogs)]
      )
    } catch (e) {
      console.warn('[verify] cannot write result, table missing?', e)
    }

    return NextResponse.json({ success: true, ok: isEqual, message: isEqual ? 'Верно' : 'Неверно' })
  } catch (error) {
    console.error('Ошибка при проверке задания:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
























