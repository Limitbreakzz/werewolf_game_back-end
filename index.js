import express from 'express';
import http from 'http';
import os from 'os';
import { Server } from 'socket.io';
import { GameEngine } from './gameEngine.js';

const app = express();
const server = http.createServer(app);

const rawOrigin = (process.env.CLIENT_ORIGIN || '*').trim();
const corsOrigin =
  rawOrigin === '*'
    ? '*'
    : rawOrigin
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

app.get('/', (_, res) => {
  res.json({ ok: true, service: 'werewolf-online-backend', health: '/health' });
});

app.get('/health', (_, res) => {
  res.json({ ok: true, service: 'werewolf-online-backend' });
});

const engine = new GameEngine(io);

io.on('connection', (socket) => {
  const getCtx = () => engine.socketToPlayer.get(socket.id);

  socket.on('create_room', (payload, cb) => {
    const res = engine.createRoom(socket, payload || {});
    if (cb) cb(res);
  });

  socket.on('join_room', (payload, cb) => {
    const res = engine.joinRoom(socket, payload || {});
    if (cb) cb(res);
  });

  socket.on('rejoin_room', (payload, cb) => {
    const res = engine.rejoinRoom(socket, payload || {});
    if (cb) cb(res);
  });

  socket.on('add_bot', (_, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.addBot(ctx.roomCode, ctx.playerId));
  });

  socket.on('remove_bot', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.removeBot(ctx.roomCode, ctx.playerId, payload?.botId || null));
  });

  socket.on('kick_player', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.kickPlayer(ctx.roomCode, ctx.playerId, payload?.targetId));
  });

  socket.on('update_settings', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.updateSettings(ctx.roomCode, ctx.playerId, payload || {}));
  });

  socket.on('toggle_ready', (_, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.toggleReady(ctx.roomCode, ctx.playerId));
  });

  socket.on('mod_control', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.handleModControl(ctx.roomCode, ctx.playerId, payload || {}));
  });

  socket.on('start_game', (_, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.startGame(ctx.roomCode, ctx.playerId));
  });

  socket.on('night_action', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.handleNightAction(ctx.roomCode, ctx.playerId, payload || {}));
  });

  socket.on('day_ready', (_, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.handleDayReady(ctx.roomCode, ctx.playerId));
  });

  socket.on('day_vote', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.handleDayVote(ctx.roomCode, ctx.playerId, payload?.targetId));
  });

  socket.on('hunter_shoot', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.handleHunterShoot(ctx.roomCode, ctx.playerId, payload?.targetId));
  });

  socket.on('send_chat', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.handleChat(ctx.roomCode, ctx.playerId, payload?.channel || 'village', payload?.text));
  });

  socket.on('play_again', (_, cb) => {
    const ctx = getCtx();
    if (!ctx) return cb?.({ ok: false });
    cb?.(engine.playAgain(ctx.roomCode, ctx.playerId));
  });

  socket.on('leave_room', (_, cb) => {
    engine.leaveRoom(socket);
    cb?.({ ok: true });
  });

  socket.on('disconnect', () => {
    engine.handleDisconnect(socket);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Werewolf Online server running:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        console.log(`  Network: http://${addr.address}:${PORT}`);
      }
    }
  }
});
