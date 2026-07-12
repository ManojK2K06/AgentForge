'use client'

import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

// Singleton socket connection to the live logs mini-service (port 3004).
//
// Connection strategy:
// - When the page is served through the Caddy gateway (production/sandbox),
//   the browser origin is the gateway URL. We connect using a relative path
//   with ?XTransformPort=3004 so Caddy forwards to the logs-service.
// - When the page is accessed directly on localhost:3000 (dev/agent-browser),
//   we connect directly to localhost:3004 since Caddy isn't in the path.

let socket: Socket | null = null

export interface LiveEvent {
  type: string
  data: Record<string, unknown>
}

function getSocketUrl(): string {
  if (typeof window === 'undefined') return ''
  const origin = window.location.origin
  // If we're on localhost directly (dev mode, agent-browser), connect to
  // the logs-service directly. Caddy runs on a different port and isn't
  // accessible from the browser in this case.
  if (origin.includes('localhost:3000') || origin.includes('127.0.0.1:3000')) {
    return 'http://localhost:3004'
  }
  // Production/sandbox: use same origin, Caddy handles XTransformPort
  return origin
}

function getSocketOptions(): Record<string, unknown> {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  if (origin.includes('localhost:3000') || origin.includes('127.0.0.1:3000')) {
    // Direct connection to logs-service
    return {
      path: '/',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      timeout: 5000,
    }
  }
  // Through Caddy: use XTransformPort query param
  return {
    path: '/',
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    timeout: 5000,
    // Socket.IO will append ?EIO=4&transport=... to the path.
    // We need XTransformPort in the query so Caddy routes correctly.
    query: { XTransformPort: '3004' },
  }
}

export function getLogsSocket(): Socket | null {
  if (typeof window === 'undefined') return null
  if (socket) return socket
  try {
    socket = io(getSocketUrl(), getSocketOptions())
  } catch {
    return null
  }
  return socket
}

export function useLogsSocket(onEvent: (e: LiveEvent) => void) {
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    const s = getLogsSocket()
    if (!s) return
    const onConn = () => setConnected(true)
    const onDisc = () => setConnected(false)
    s.on('connect', onConn)
    s.on('disconnect', onDisc)
    s.on('event', onEvent)
    return () => {
      s.off('connect', onConn)
      s.off('disconnect', onDisc)
      s.off('event', onEvent)
    }
  }, [onEvent])
  return connected
}
