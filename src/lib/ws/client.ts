'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SIM_URL || 'http://localhost:4000', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })
    socket.on('connect_error', () => {})
    socket.on('reconnect_attempt', () => {})
  }
  return socket
}

export const SimulatorAPI = {
  joinSession: (sessionId: string) => {
    const s = getSocket()
    s.emit('joinSession', { sessionId })
  },
  compile: (code: string, cb: (r: { success: boolean; errors: string[] }) => void) => {
    const s = getSocket()
    s.emit('compileCode', { code })
    const handler = (r: unknown) => {
      clearTimeout(t)
      if (r && typeof r === 'object' && 'success' in (r as Record<string, unknown>) && 'errors' in (r as Record<string, unknown>)) {
        const rr = r as { success?: boolean; errors?: string[] }
        cb({ success: !!rr.success, errors: Array.isArray(rr.errors) ? rr.errors : [] })
      } else {
        cb({ success: false, errors: ['Unknown result'] })
      }
      s.off('compilationResult', handler)
    }
    s.on('compilationResult', handler)
    const t = setTimeout(() => {
      s.off('compilationResult', handler)
      cb({ success: false, errors: ['Timeout waiting for compilation result'] })
    }, 10000)
  },
  upload: (code: string, sessionId?: string) => getSocket().emit('uploadCode', { code, sessionId }),
  start: (project?: unknown, sessionId?: string) => getSocket().emit('startSimulation', { project, sessionId }),
  stop: (sessionId?: string) => getSocket().emit('stopSimulation', { sessionId }),
  onCircuitUpdate: (fn: (u: Record<string, unknown>) => void) => getSocket().on('circuitUpdate', fn as (arg: unknown) => void),
  onLog: (fn: (m: Record<string, unknown>) => void) => getSocket().on('simulationOutput', fn as (arg: unknown) => void),
  onUploadAck: (fn: (m: Record<string, unknown>) => void) => getSocket().on('uploadAck', fn as (arg: unknown) => void),
  onSimulationStarted: (fn: () => void) => getSocket().on('simulationStarted', fn),
  onSimulationFinished: (fn: () => void) => getSocket().on('simulationFinished', fn),
  updateComponent: (id: string, properties: Record<string, unknown>, sessionId?: string) => getSocket().emit('updateComponent', { id, properties, sessionId }),
}


