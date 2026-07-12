// Real-time execution log broadcast service.
// Port 3004. Socket.IO with path "/" (required by Caddy gateway).
//
// The Next.js execution engine connects as a Socket.IO client and emits
// "broadcast" events. This service re-broadcasts them as "event" to all
// connected dashboard clients.
//
// This avoids the path conflict between Socket.IO (path "/") and HTTP endpoints.

import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3004

const httpServer = createServer()

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  console.log(`[logs-service] client connected: ${socket.id} (total: ${io.engine.clientsCount})`)

  // Send a welcome event to the new client
  socket.emit('event', {
    type: 'system',
    data: { message: 'Connected to AgentForge live execution stream', ts: Date.now() },
  })

  // When any client (including the Next.js server-side client) emits a
  // "broadcast" event, re-broadcast it to ALL clients as "event".
  socket.on('broadcast', (payload: unknown) => {
    io.emit('event', payload)
  })

  socket.on('disconnect', () => {
    console.log(`[logs-service] client disconnected: ${socket.id} (total: ${io.engine.clientsCount})`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[logs-service] listening on :${PORT}`)
})

process.on('SIGTERM', () => httpServer.close(() => process.exit(0)))
process.on('SIGINT', () => httpServer.close(() => process.exit(0)))
