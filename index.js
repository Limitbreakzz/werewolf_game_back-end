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

// Cached Thai TTS audio endpoint for browsers without a local th-TH system voice (e.g. Windows Chrome)
const ttsCache = new Map();
app.get('/api/tts', async (req, res) => {
  try {
    const text = String(req.query.text || '').trim().slice(0, 180);
    if (!text) return res.status(400).end();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (ttsCache.has(text)) {
      return res.send(ttsCache.get(text));
    }

    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=th&q=${encodeURIComponent(text)}`;
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!upstream.ok) return res.status(502).end();

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (ttsCache.size > 40) ttsCache.clear();
    ttsCache.set(text, buf);
    return res.send(buf);
  } catch {
    return res.status(500).end();
  }
});

const engine = new GameEngine(io);

function reply(cb, res) {
  if (typeof cb === 'function') cb(res);
}

io.on('connection', (socket) => {
  const getCtx = () => engine.socketToPlayer.get(socket.id);

  socket.on('create_room', (payload, cb) => {
    const res = engine.createRoom(socket, payload || {});
    reply(cb, res);
  });

  socket.on('join_room', (payload, cb) => {
    const res = engine.joinRoom(socket, payload || {});
    reply(cb, res);
  });

  socket.on('rejoin_room', (payload, cb) => {
    const res = engine.rejoinRoom(socket, payload || {});
    reply(cb, res);
  });

  socket.on('add_bot', (_, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.addBot(ctx.roomCode, ctx.playerId);
    reply(cb, res);
  });

  socket.on('remove_bot', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.removeBot(ctx.roomCode, ctx.playerId, payload?.botId || null);
    reply(cb, res);
  });

  socket.on('kick_player', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.kickPlayer(ctx.roomCode, ctx.playerId, payload?.targetId);
    reply(cb, res);
  });

  socket.on('update_settings', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.updateSettings(ctx.roomCode, ctx.playerId, payload || {});
    reply(cb, res);
  });

  socket.on('toggle_ready', (_, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.toggleReady(ctx.roomCode, ctx.playerId);
    reply(cb, res);
  });

  socket.on('mod_control', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.handleModControl(ctx.roomCode, ctx.playerId, payload || {});
    reply(cb, res);
  });

  socket.on('start_game', (_, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.startGame(ctx.roomCode, ctx.playerId);
    reply(cb, res);
  });

  socket.on('night_action', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.handleNightAction(ctx.roomCode, ctx.playerId, payload || {});
    reply(cb, res);
  });

  socket.on('day_ready', (_, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.handleDayReady(ctx.roomCode, ctx.playerId);
    reply(cb, res);
  });

  socket.on('day_vote', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.handleDayVote(ctx.roomCode, ctx.playerId, payload?.targetId);
    reply(cb, res);
  });

  socket.on('hunter_shoot', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.handleHunterShoot(ctx.roomCode, ctx.playerId, payload?.targetId);
    reply(cb, res);
  });

  socket.on('send_chat', (payload, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.handleChat(ctx.roomCode, ctx.playerId, payload?.channel || 'village', payload?.text);
    reply(cb, res);
  });

  socket.on('play_again', (_, cb) => {
    const ctx = getCtx();
    if (!ctx) return reply(cb, { ok: false });
    const res = engine.playAgain(ctx.roomCode, ctx.playerId);
    reply(cb, res);
  });

  socket.on('sync_room', (_, cb) => {
    const res = engine.syncPlayer(socket);
    reply(cb, res);
  });

  socket.on('leave_room', (_, cb) => {
    engine.leaveRoom(socket, { immediate: true });
    reply(cb, { ok: true });
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
