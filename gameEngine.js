import crypto from 'crypto';
import { ROLES, isPackWolf, getDefaultRoleConfig, buildRoleDeck } from './roles.js';
import { BOT_PROFILES } from './botNames.js';
import {
  clearBotTimers,
  scheduleBotNightActions,
  scheduleBotDayChat,
  scheduleBotVotes,
  scheduleBotDefense,
  scheduleBotVerdict,
  scheduleBotHunterShot,
} from './aiManager.js';

const AVATAR_POOL = [
  'moon', 'crown', 'swords', 'shield', 'feather', 'compass', 'key', 'gem',
  'scroll', 'anchor', 'sparkles', 'bell', 'book', 'trees', 'hourglass', 'landmark',
];
const NIGHT_STEP_ORDER = [
  'cupid',
  'doppelganger',
  'hoodlum',
  'werewolf',
  'vampire',
  'cult_leader',
  'sorcerer',
  'seer',
  'mystic_seer',
  'aura_seer',
  'pi',
  'mentalist',
  'doctor',
  'priest',
  'witch',
  'revealer',
  'huntress',
  'spellcaster',
  'old_hag',
  'troublemaker',
];
const NIGHT1_ONLY_STEPS = new Set(['cupid', 'doppelganger', 'hoodlum']);

function sanitizeAvatar(raw, fallback = '') {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length <= 40000) {
    return trimmed;
  }
  if (AVATAR_POOL.includes(trimmed)) return trimmed;
  return fallback;
}

function generateRoomCode(existingRooms) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (existingRooms.has(code));
  return code;
}

export class GameEngine {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.socketToPlayer = new Map();
  }

  createRoom(socket, { playerName, avatar }) {
    const code = generateRoomCode(this.rooms);
    const playerId = crypto.randomUUID();
    const cleanName = (playerName || 'ผู้เล่น').trim().slice(0, 18) || 'ผู้เล่น';
    const player = {
      id: playerId,
      socketId: socket.id,
      seatNumber: 1,
      name: cleanName,
      avatar: sanitizeAvatar(avatar, ''),
      isHost: true,
      isModerator: false,
      isBot: false,
      ready: true,
      connected: true,
      alive: true,
      role: null,
      deathCause: null,
    };

    const room = {
      code,
      stateVersion: 0,
      hostId: playerId,
      phase: 'lobby', // lobby | role_reveal | night | dawn | day_discuss | day_vote | hunter_revenge | game_over
      nightStep: null, // 'werewolf' | 'seer' | 'doctor' | 'witch' | null
      phaseEndsAt: null,
      phaseTimer: null,
      botTimers: [],
      dayNumber: 0,
      players: [player],
      settings: {
        controlMode: 'no_mod', // 'no_mod' | 'narrator' | 'manual_mod'
        nightStepSeconds: 20,
        discussSeconds: 90,
        voteSeconds: 35,
        defenseSeconds: 30,
        verdictSeconds: 20,
        hunterSeconds: 20,
        autoRoles: true,
        roleConfig: getDefaultRoleConfig(6),
      },
      night: this._emptyNightState(),
      seerResults: {},
      sorcererResults: {},
      doctorLastProtected: {},
      witchState: {},
      wolfDoubleKillNextNight: false,
      lovers: [],
      doppelgangerTargets: {},
      hoodlumTargets: {},
      mysticResults: {},
      auraResults: {},
      piUsed: {},
      piResults: {},
      mentalistResults: {},
      priestUsed: {},
      priestShields: new Set(),
      huntressUsed: {},
      troublemakerUsed: {},
      alphaUsed: {},
      wolfDiedByVoteLastDay: false,
      wolvesSickNextNight: false,
      toughGuyBittenDay: {},
      princeRevealed: {},
      vampireBittenId: null,
      cultMembers: new Set(),
      silencedIds: new Set(),
      exiledIds: new Set(),
      remainingVotesToday: 1,
      ghostLetterUsedDay: {},
      winnerBonus: null,
      dayVotes: {},
      accusedId: null,
      verdictVotes: {}, // voterId -> 'execute' | 'spare'
      dayReadySet: new Set(),
      pendingHunterQueue: [],
      hunterNextPhase: null,
      lastDawnSummary: null,
      lastVoteSummary: null,
      winner: null,
      winnerPlayerName: null,
      chat: { village: [], wolf: [], ghost: [] },
      logs: [],
      aiMemory: { claimedSeerId: null, exposedWolfIds: [] },
    };

    this.rooms.set(code, room);
    this.socketToPlayer.set(socket.id, { roomCode: code, playerId });
    socket.join(code);
    this._addLog(room, `${cleanName} สร้างห้อง ${code}`);
    this.broadcastRoomState(room);
    return { ok: true, roomCode: code, playerId };
  }

  joinRoom(socket, { roomCode, playerName, avatar, savedPlayerId }) {
    const code = (roomCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ไม่พบห้องรหัสนี้ กรุณาตรวจสอบรหัสห้องอีกครั้ง' };

    const cleanName = (playerName || 'ผู้เล่น').trim().slice(0, 18) || 'ผู้เล่น';

    // Seamless rejoin if player already has a seat in this room (by savedPlayerId or disconnected matching name)
    if (savedPlayerId) {
      const existingById = room.players.find((p) => p.id === savedPlayerId && !p.isBot);
      if (existingById) {
        return this.rejoinRoom(socket, { roomCode: code, playerId: existingById.id });
      }
    }

    const disconnectedByName = room.players.find(
      (p) => !p.isBot && !p.connected && p.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (disconnectedByName) {
      return this.rejoinRoom(socket, { roomCode: code, playerId: disconnectedByName.id });
    }

    if (room.phase !== 'lobby') {
      return {
        ok: false,
        error: 'เกมในห้องนี้เริ่มไปแล้ว หากคุณหลุดออกจากเกมให้กรอกชื่อเดิมและรหัสห้องเดิมเพื่อกลับเข้าห้อง',
      };
    }
    if (room.players.length >= 16) {
      return { ok: false, error: 'ห้องเต็มแล้ว (สูงสุด 16 คน)' };
    }

    const duplicate = room.players.some((p) => p.name.toLowerCase() === cleanName.toLowerCase());
    const finalName = duplicate ? `${cleanName}#${Math.floor(Math.random() * 90 + 10)}` : cleanName;

    const playerId = crypto.randomUUID();
    const player = {
      id: playerId,
      socketId: socket.id,
      seatNumber: room.players.length + 1,
      name: finalName,
      avatar: sanitizeAvatar(avatar, ''),
      isHost: false,
      isModerator: false,
      isBot: false,
      ready: false,
      connected: true,
      alive: true,
      role: null,
      deathCause: null,
    };

    room.players.push(player);
    this._syncSeatNumbersAndRoles(room);

    this.socketToPlayer.set(socket.id, { roomCode: code, playerId });
    socket.join(code);
    this._addLog(room, `${finalName} เข้าร่วมห้อง`);
    this.broadcastRoomState(room);
    return { ok: true, roomCode: code, playerId };
  }

  rejoinRoom(socket, { roomCode, playerId }) {
    const code = (roomCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ห้องหมดอายุหรือถูกปิดไปแล้ว' };

    const player = room.players.find((p) => p.id === playerId && !p.isBot);
    if (!player) return { ok: false, error: 'ไม่พบข้อมูลผู้เล่นในห้องนี้' };

    if (player.socketId && player.socketId !== socket.id) {
      this.socketToPlayer.delete(player.socketId);
    }

    const wasDisconnected = !player.connected;
    player.socketId = socket.id;
    player.connected = true;
    this.socketToPlayer.set(socket.id, { roomCode: code, playerId: player.id });
    socket.join(code);
    if (wasDisconnected) {
      this._addLog(room, `${player.name} กลับเข้าสู่ห้องแล้ว`);
    }
    this.broadcastRoomState(room);
    return { ok: true, roomCode: code, playerId: player.id, rejoined: true };
  }

  toggleReady(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.phase !== 'lobby') return { ok: false };
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return { ok: false };
    player.ready = !player.ready;
    this.broadcastRoomState(room);
    return { ok: true };
  }

  addBot(roomCode, requesterId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.phase !== 'lobby' || room.hostId !== requesterId) {
      return { ok: false, error: 'เฉพาะหัวหน้าห้องเท่านั้นที่เพิ่มบอทได้' };
    }
    if (room.players.length >= 16) {
      return { ok: false, error: 'ผู้เล่นครบ 16 คนแล้ว' };
    }

    const usedNames = new Set(room.players.map((p) => p.name));
    const profile =
      BOT_PROFILES.find((b) => !usedNames.has(b.name)) || {
        name: `บอท#${room.players.length + 1}`,
        avatar: AVATAR_POOL[room.players.length % AVATAR_POOL.length],
      };

    room.players.push({
      id: `bot_${crypto.randomUUID().slice(0, 8)}`,
      socketId: null,
      seatNumber: room.players.length + 1,
      name: profile.name,
      avatar: profile.avatar,
      isHost: false,
      isModerator: false,
      isBot: true,
      ready: true,
      connected: true,
      alive: true,
      role: null,
      deathCause: null,
    });

    this._syncSeatNumbersAndRoles(room);
    this.broadcastRoomState(room);
    return { ok: true };
  }

  removeBot(roomCode, requesterId, targetBotId = null) {
    const room = this.rooms.get(roomCode);
    if (!room || room.phase !== 'lobby' || room.hostId !== requesterId) {
      return { ok: false, error: 'ไม่สามารถลบบอทได้' };
    }
    let idx = -1;
    if (targetBotId) {
      idx = room.players.findIndex((p) => p.id === targetBotId && p.isBot);
    } else {
      for (let i = room.players.length - 1; i >= 0; i--) {
        if (room.players[i].isBot) {
          idx = i;
          break;
        }
      }
    }
    if (idx === -1) return { ok: false, error: 'ไม่มีบอทในห้อง' };
    room.players.splice(idx, 1);
    this._syncSeatNumbersAndRoles(room);
    this.broadcastRoomState(room);
    return { ok: true };
  }

  kickPlayer(roomCode, requesterId, targetId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.phase !== 'lobby' || room.hostId !== requesterId || targetId === requesterId) {
      return { ok: false };
    }
    const idx = room.players.findIndex((p) => p.id === targetId);
    if (idx === -1) return { ok: false };
    const [removed] = room.players.splice(idx, 1);
    if (removed.socketId) {
      this.io.to(removed.socketId).emit('kicked', { message: 'คุณถูกนำออกจากห้องโดยหัวหน้าห้อง' });
      const sock = this.io.sockets.sockets.get(removed.socketId);
      if (sock) sock.leave(room.code);
      this.socketToPlayer.delete(removed.socketId);
    }
    this._syncSeatNumbersAndRoles(room);
    this.broadcastRoomState(room);
    return { ok: true };
  }

  updateSettings(roomCode, requesterId, partialSettings) {
    const room = this.rooms.get(roomCode);
    if (!room || room.phase !== 'lobby' || room.hostId !== requesterId) {
      return { ok: false };
    }
    if (['no_mod', 'narrator', 'manual_mod'].includes(partialSettings.controlMode)) {
      room.settings.controlMode = partialSettings.controlMode;
    }
    if (typeof partialSettings.autoRoles === 'boolean') {
      room.settings.autoRoles = partialSettings.autoRoles;
    }
    if (partialSettings.roleConfig && !room.settings.autoRoles) {
      room.settings.roleConfig = { ...room.settings.roleConfig, ...partialSettings.roleConfig };
    }
    if (partialSettings.discussSeconds) {
      room.settings.discussSeconds = Math.max(30, Math.min(300, Number(partialSettings.discussSeconds)));
    }
    if (partialSettings.nightStepSeconds) {
      room.settings.nightStepSeconds = Math.max(10, Math.min(60, Number(partialSettings.nightStepSeconds)));
    }
    this._syncSeatNumbersAndRoles(room);
    this.broadcastRoomState(room);
    return { ok: true };
  }

  startGame(roomCode, requesterId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.phase !== 'lobby' || room.hostId !== requesterId) {
      return { ok: false, error: 'เฉพาะหัวหน้าห้องเท่านั้นที่เริ่มเกมได้' };
    }

    const isManualMod = room.settings.controlMode === 'manual_mod';
    const activePlayers = room.players.filter((p) => !(isManualMod && p.id === room.hostId));
    if (activePlayers.length < 4) {
      return {
        ok: false,
        error: isManualMod
          ? 'โหมดกรรมการควบคุมต้องมีผู้เล่นอย่างน้อย 4 คน (ไม่นับกรรมการ)'
          : 'ต้องมีผู้เล่นอย่างน้อย 4 คน (สามารถกดเพิ่มบอท AI ได้)',
      };
    }

    const deck = buildRoleDeck(
      activePlayers.length,
      room.settings.autoRoles ? null : room.settings.roleConfig
    );

    const activeRoleCounts = {};
    for (const rId of deck) {
      activeRoleCounts[rId] = (activeRoleCounts[rId] || 0) + 1;
    }
    room.activeRoleCounts = activeRoleCounts;

    room.dayNumber = 0;
    room.nightStep = null;
    room.winner = null;
    room.winnerPlayerName = null;
    room.seerResults = {};
    room.sorcererResults = {};
    room.doctorLastProtected = {};
    room.witchState = {};
    room.wolfDoubleKillNextNight = false;
    room.lovers = [];
    room.doppelgangerTargets = {};
    room.hoodlumTargets = {};
    room.mysticResults = {};
    room.auraResults = {};
    room.piUsed = {};
    room.piResults = {};
    room.mentalistResults = {};
    room.priestUsed = {};
    room.priestShields = new Set();
    room.huntressUsed = {};
    room.troublemakerUsed = {};
    room.alphaUsed = {};
    room.wolfDiedByVoteLastDay = false;
    room.wolvesSickNextNight = false;
    room.toughGuyBittenDay = {};
    room.princeRevealed = {};
    room.vampireBittenId = null;
    room.cultMembers = new Set();
    room.silencedIds = new Set();
    room.exiledIds = new Set();
    room.remainingVotesToday = 1;
    room.ghostLetterUsedDay = {};
    room.winnerBonus = null;
    room.dayVotes = {};
    room.accusedId = null;
    room.verdictVotes = {};
    room.dayReadySet = new Set();
    room.pendingHunterQueue = [];
    room.hunterNextPhase = null;
    room.lastDawnSummary = null;
    room.lastVoteSummary = null;
    room.chat = { village: [], wolf: [], ghost: [] };
    room.logs = [];
    room.aiMemory = { claimedSeerId: null, exposedWolfIds: [] };

    let deckIdx = 0;
    room.players.forEach((p) => {
      if (isManualMod && p.id === room.hostId) {
        p.isModerator = true;
        p.role = null;
        p.alive = false;
        p.deathCause = null;
      } else {
        p.isModerator = false;
        p.role = deck[deckIdx++];
        p.alive = true;
        p.deathCause = null;
        if (p.role === 'seer') room.seerResults[p.id] = {};
        if (p.role === 'sorcerer') room.sorcererResults[p.id] = {};
        if (p.role === 'mystic_seer') room.mysticResults[p.id] = {};
        if (p.role === 'aura_seer') room.auraResults[p.id] = {};
        if (p.role === 'witch') room.witchState[p.id] = { hasHeal: true, hasPoison: true };
        if (p.role === 'cult_leader') room.cultMembers.add(p.id);
      }
    });

    this._addLog(room, `เกมเริ่มต้นแล้ว! มีผู้เล่นในเกม ${activePlayers.length} คน`);
    this._enterPhase(room, 'role_reveal', isManualMod ? null : 8);
    return { ok: true };
  }

  // Manual Moderator controls (or Host skip in day_discuss)
  handleModControl(roomCode, requesterId, { action, seconds }) {
    const room = this.rooms.get(roomCode);
    if (!room || room.hostId !== requesterId) return { ok: false };

    const isManualMod = room.settings.controlMode === 'manual_mod';

    if (action === 'extend_time' && room.phaseEndsAt) {
      const addSec = Math.max(10, Math.min(120, Number(seconds) || 30));
      const newRemaining = Math.max(1000, room.phaseEndsAt - Date.now()) + addSec * 1000;
      if (room.phaseTimer) clearTimeout(room.phaseTimer);
      room.phaseEndsAt = Date.now() + newRemaining;
      room.phaseTimer = setTimeout(() => this._onPhaseTimeout(room), newRemaining);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (action === 'start_vote_now' && room.phase === 'day_discuss') {
      this._enterPhase(room, 'day_vote', isManualMod ? null : room.settings.voteSeconds);
      return { ok: true };
    }

    if (action === 'end_defense_now' && room.phase === 'day_defense') {
      this._resolveVerdict(room);
      return { ok: true };
    }

    if (!isManualMod) return { ok: false };

    if (action === 'next_step') {
      if (room.phase === 'role_reveal') {
        this._startNight(room);
      } else if (room.phase === 'night') {
        this._advanceNightStep(room);
      } else if (room.phase === 'dawn') {
        if (room.pendingHunterQueue.length > 0) {
          room.hunterNextPhase = 'day_discuss';
          this._enterPhase(room, 'hunter_revenge', room.settings.hunterSeconds);
        } else {
          this._enterPhase(room, 'day_discuss', room.settings.discussSeconds);
        }
      } else if (room.phase === 'day_discuss') {
        this._enterPhase(room, 'day_vote', null);
      } else if (room.phase === 'day_vote') {
        this._resolveDayVote(room);
      } else if (room.phase === 'day_defense' || room.phase === 'day_verdict') {
        this._resolveVerdict(room);
      } else if (room.phase === 'hunter_revenge') {
        this._onPhaseTimeout(room);
      }
      return { ok: true };
    }

    if (action === 'skip_role' && room.phase === 'night') {
      this._advanceNightStep(room);
      return { ok: true };
    }

    return { ok: false };
  }

  playAgain(roomCode, requesterId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.hostId !== requesterId) return { ok: false };
    this._clearTimers(room);
    room.phase = 'lobby';
    room.nightStep = null;
    room.phaseEndsAt = null;
    room.dayNumber = 0;
    room.winner = null;
    room.players.forEach((p) => {
      p.isModerator = false;
      p.alive = true;
      p.role = null;
      p.deathCause = null;
      p.ready = p.isHost || p.isBot;
    });
    this._syncSeatNumbersAndRoles(room);
    this._addLog(room, 'กลับสู่ห้องล็อบบี้เพื่อเริ่มเกมใหม่');
    this.broadcastRoomState(room);
    return { ok: true };
  }

  leaveRoom(socket, { immediate = true } = {}) {
    const mapping = this.socketToPlayer.get(socket.id);
    if (!mapping) return;
    const { roomCode, playerId } = mapping;
    this.socketToPlayer.delete(socket.id);
    socket.leave(roomCode);

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const idx = room.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return;
    const player = room.players[idx];

    if (room.phase === 'lobby' && immediate) {
      room.players.splice(idx, 1);
      this._addLog(room, `${player.name} ออกจากห้อง`);
      this._reassignHostIfNeeded(room);
      this._syncSeatNumbersAndRoles(room);
      if (!room.players.some((p) => !p.isBot)) {
        this._destroyRoom(room);
        return;
      }
      this.broadcastRoomState(room);
    } else if (room.phase === 'lobby' && !immediate) {
      // Grace period (20s) for mobile network blips / tab switches in Lobby before removing player
      player.connected = false;
      player.socketId = null;
      this.broadcastRoomState(room);
      setTimeout(() => {
        const r = this.rooms.get(roomCode);
        if (!r || r.phase !== 'lobby') return;
        const pIdx = r.players.findIndex((pl) => pl.id === playerId);
        if (pIdx === -1 || r.players[pIdx].connected) return;
        r.players.splice(pIdx, 1);
        this._addLog(r, `${player.name} หลุดการเชื่อมต่อออกจากห้อง`);
        this._reassignHostIfNeeded(r);
        this._syncSeatNumbersAndRoles(r);
        if (!r.players.some((pl) => !pl.isBot)) {
          this._destroyRoom(r);
          return;
        }
        this.broadcastRoomState(r);
      }, 20000);
    } else {
      player.connected = false;
      player.socketId = null;
      this._addLog(room, `${player.name} ขาดการเชื่อมต่อ`);
      if (!room.players.some((p) => !p.isBot && p.connected)) {
        setTimeout(() => {
          const r = this.rooms.get(roomCode);
          if (r && !r.players.some((p) => !p.isBot && p.connected)) {
            this._destroyRoom(r);
          }
        }, 5 * 60 * 1000);
      }
      this.broadcastRoomState(room);
    }
  }

  handleDisconnect(socket) {
    this.leaveRoom(socket, { immediate: false });
  }

  syncPlayer(socket) {
    const mapping = this.socketToPlayer.get(socket.id);
    if (!mapping) return { ok: false };
    const room = this.rooms.get(mapping.roomCode);
    if (!room) return { ok: false };
    socket.emit('room_state', this.getPlayerView(room, mapping.playerId));
    return { ok: true };
  }

  handleNightAction(roomCode, playerId, action) {
    const room = this.rooms.get(roomCode);
    if (!room || room.phase !== 'night') return { ok: false };
    const player = room.players.find((p) => p.id === playerId);
    if (!player || !player.alive || player.isModerator) {
      return { ok: false, error: 'คุณไม่มีสิทธิ์ทำคำสั่งในคืนนี้' };
    }

    if (room.nightStep === 'werewolf' && action.type === 'wolf_vote' && isPackWolf(player.role)) {
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && !isPackWolf(p.role));
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      room.night.wolfVotes[player.id] = target.id;

      // If a human wolf picks a target, alive bot wolf teammates align with the human wolf so solo/mixed play stays smooth
      if (!player.isBot && !room.night.doubleKill) {
        const botWolves = this._getAliveByRole(room, 'werewolf').filter((w) => w.isBot);
        for (const bw of botWolves) {
          if (room.night.wolfVotes[bw.id] && room.night.wolfVotes[bw.id] !== target.id) {
            room.night.wolfVotes[bw.id] = target.id;
          }
        }
      }

      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'sorcerer' && action.type === 'sorcerer_inspect' && player.role === 'sorcerer') {
      if (room.night.sorcererInspected[player.id]) {
        return { ok: false, error: 'คืนนี้คุณตรวจสอบไปแล้ว' };
      }
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && p.id !== player.id);
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      const isSeer = target.role === 'seer';
      if (!room.sorcererResults[player.id]) room.sorcererResults[player.id] = {};
      room.sorcererResults[player.id][target.id] = isSeer;
      room.night.sorcererInspected[player.id] = { targetId: target.id, isSeer };
      this.broadcastRoomState(room);
      if (room.settings.controlMode !== 'manual_mod') {
        const allDone = this._getAliveByRole(room, 'sorcerer').every((s) => Boolean(room.night.sorcererInspected[s.id]));
        if (allDone && room.night.stepAdvancing !== 'sorcerer') {
          room.night.stepAdvancing = 'sorcerer';
          if (room.phaseTimer) clearTimeout(room.phaseTimer);
          room.phaseTimer = setTimeout(() => {
            if (room.phase === 'night' && room.nightStep === 'sorcerer') this._advanceNightStep(room);
          }, 2600);
        }
      }
      return { ok: true, sorcererResult: { targetId: target.id, targetName: target.name, isSeer } };
    }

    if (room.nightStep === 'seer' && action.type === 'seer_inspect' && player.role === 'seer') {
      if (room.night.seerInspected[player.id]) {
        return { ok: false, error: 'คืนนี้คุณตรวจสอบไปแล้ว' };
      }
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && p.id !== player.id);
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      // Official Ultimate Werewolf: Pack Wolves AND cursed Lycan appear as Werewolf; Minion/Sorcerer/Tanner appear as Village!
      const resultTeam = isPackWolf(target.role) || target.role === 'lycan' ? 'werewolf' : 'village';
      room.seerResults[player.id][target.id] = resultTeam;
      room.night.seerInspected[player.id] = { targetId: target.id, team: resultTeam };
      this.broadcastRoomState(room);
      if (room.settings.controlMode !== 'manual_mod') {
        const allSeersDone = this._getAliveByRole(room, 'seer').every((s) => Boolean(room.night.seerInspected[s.id]));
        if (allSeersDone && room.night.stepAdvancing !== 'seer') {
          room.night.stepAdvancing = 'seer';
          if (room.phaseTimer) clearTimeout(room.phaseTimer);
          room.phaseTimer = setTimeout(() => {
            if (room.phase === 'night' && room.nightStep === 'seer') this._advanceNightStep(room);
          }, 2800);
        }
      }
      return { ok: true, result: { targetId: target.id, targetName: target.name, team: resultTeam } };
    }

    if (room.nightStep === 'werewolf' && action.type === 'alpha_toggle' && player.role === 'alpha_wolf') {
      if (!room.wolfDiedByVoteLastDay || room.alphaUsed[player.id]) {
        return { ok: false, error: 'ยังไม่สามารถใช้พลังแปลงร่างของจ่าฝูงได้ในคืนนี้' };
      }
      room.night.alphaConvert = !room.night.alphaConvert;
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'cupid' && action.type === 'cupid_pair' && player.role === 'cupid') {
      if (room.night.cupidDone[player.id]) return { ok: false };
      const ids = Array.isArray(action.targetIds) ? [...new Set(action.targetIds)] : [];
      if (ids.length !== 2) return { ok: false, error: 'กรุณาเลือกผู้เล่น 2 คนเพื่อจับคู่รัก' };
      const valid = ids.every((tid) => room.players.some((p) => p.id === tid && p.alive && !p.isModerator));
      if (!valid) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      room.lovers = ids;
      room.night.cupidDone[player.id] = ids;
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'doppelganger' && action.type === 'doppelganger_pick' && player.role === 'doppelganger') {
      if (room.night.doppelgangerDone[player.id]) return { ok: false };
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && p.id !== player.id);
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      room.doppelgangerTargets[player.id] = target.id;
      room.night.doppelgangerDone[player.id] = target.id;
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'hoodlum' && action.type === 'hoodlum_pick' && player.role === 'hoodlum') {
      if (room.night.hoodlumDone[player.id]) return { ok: false };
      const ids = Array.isArray(action.targetIds) ? [...new Set(action.targetIds)] : [];
      if (ids.length !== 2) return { ok: false, error: 'กรุณาเลือกเป้าหมาย 2 คน' };
      const valid = ids.every((tid) => room.players.some((p) => p.id === tid && p.alive && !p.isModerator && p.id !== player.id));
      if (!valid) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      room.hoodlumTargets[player.id] = ids;
      room.night.hoodlumDone[player.id] = ids;
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'vampire' && action.type === 'vampire_bite' && player.role === 'vampire') {
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && p.id !== player.id && p.role !== 'vampire');
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      room.night.vampireTargets[player.id] = target.id;
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'cult_leader' && action.type === 'cult_recruit' && player.role === 'cult_leader') {
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && p.id !== player.id);
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      room.night.cultTargets[player.id] = target.id;
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'mystic_seer' && action.type === 'mystic_inspect' && player.role === 'mystic_seer') {
      if (room.night.mysticInspected[player.id]) return { ok: false, error: 'คืนนี้คุณตรวจสอบไปแล้ว' };
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && p.id !== player.id);
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      if (!room.mysticResults[player.id]) room.mysticResults[player.id] = {};
      room.mysticResults[player.id][target.id] = target.role;
      room.night.mysticInspected[player.id] = { targetId: target.id, role: target.role };
      this.broadcastRoomState(room);
      this._checkCurrentNightStepDone(room, 2600);
      const roleObj = ROLES[target.role];
      return { ok: true, customToast: `ผลตรวจสอบ ${target.name}: บทบาทคือ ${roleObj?.nameTh || target.role}` };
    }

    if (room.nightStep === 'aura_seer' && action.type === 'aura_inspect' && player.role === 'aura_seer') {
      if (room.night.auraInspected[player.id]) return { ok: false, error: 'คืนนี้คุณตรวจสอบไปแล้ว' };
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && p.id !== player.id);
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      const hasAura = target.role !== 'villager' && target.role !== 'werewolf';
      if (!room.auraResults[player.id]) room.auraResults[player.id] = {};
      room.auraResults[player.id][target.id] = hasAura;
      room.night.auraInspected[player.id] = { targetId: target.id, hasAura };
      this.broadcastRoomState(room);
      this._checkCurrentNightStepDone(room, 2600);
      return { ok: true, customToast: `ผลญาณทิพย์ ${target.name}: ${hasAura ? 'เป็นตัวละครพิเศษ!' : 'ไม่ใช่ตัวละครพิเศษ (ชาวบ้านหรือหมาป่าธรรมดา)'}` };
    }

    if (room.nightStep === 'pi' && action.type === 'pi_inspect' && player.role === 'pi') {
      if (room.night.piInspected[player.id] || room.piUsed[player.id]) return { ok: false };
      if (action.skip) {
        room.night.piInspected[player.id] = { skipped: true };
        this._checkCurrentNightStepDone(room);
        this.broadcastRoomState(room);
        return { ok: true };
      }
      const aliveSeats = room.players.filter((p) => p.alive && !p.isModerator).sort((a, b) => a.seatNumber - b.seatNumber);
      const idx = aliveSeats.findIndex((p) => p.id === action.targetId);
      if (idx === -1) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      const left = aliveSeats[(idx - 1 + aliveSeats.length) % aliveSeats.length];
      const right = aliveSeats[(idx + 1) % aliveSeats.length];
      const trio = [aliveSeats[idx], left, right];
      const hasWolf = trio.some((p) => isPackWolf(p.role) || p.role === 'lycan');
      room.piUsed[player.id] = true;
      room.piResults[player.id] = { targetId: aliveSeats[idx].id, targetName: aliveSeats[idx].name, hasWolf };
      room.night.piInspected[player.id] = room.piResults[player.id];
      this.broadcastRoomState(room);
      this._checkCurrentNightStepDone(room, 2800);
      return { ok: true, customToast: `ผลสืบ ${aliveSeats[idx].name} และซ้าย-ขวา: ${hasWolf ? 'มีมนุษย์หมาป่าปะปนอยู่!' : 'ไม่พบมนุษย์หมาป่าใน 3 คนนี้'}` };
    }

    if (room.nightStep === 'mentalist' && action.type === 'mentalist_inspect' && player.role === 'mentalist') {
      if (room.night.mentalistInspected[player.id]) return { ok: false, error: 'คืนนี้คุณตรวจสอบไปแล้ว' };
      const ids = Array.isArray(action.targetIds) ? [...new Set(action.targetIds)] : [];
      if (ids.length !== 2) return { ok: false, error: 'กรุณาเลือกผู้เล่น 2 คน' };
      const pA = room.players.find((p) => p.id === ids[0] && p.alive && !p.isModerator);
      const pB = room.players.find((p) => p.id === ids[1] && p.alive && !p.isModerator);
      if (!pA || !pB) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      const teamOf = (r) => (isPackWolf(r) || r === 'minion' || r === 'sorcerer' || r === 'hoodlum' ? 'werewolf' : ROLES[r]?.team || 'village');
      const sameTeam = teamOf(pA.role) === teamOf(pB.role);
      room.night.mentalistInspected[player.id] = { names: [pA.name, pB.name], sameTeam };
      room.mentalistResults[player.id] = room.night.mentalistInspected[player.id];
      this.broadcastRoomState(room);
      this._checkCurrentNightStepDone(room, 2800);
      return { ok: true, customToast: `นักสะกดจิต (${pA.name} & ${pB.name}): ${sameTeam ? 'อยู่ฝ่ายเดียวกัน!' : 'อยู่คนละฝ่าย!'}` };
    }

    if (room.nightStep === 'priest' && action.type === 'priest_bless' && player.role === 'priest') {
      if (room.night.priestDone[player.id] || room.priestUsed[player.id]) return { ok: false };
      if (action.skip) {
        room.night.priestDone[player.id] = 'skip';
        this._checkCurrentNightStepDone(room);
        this.broadcastRoomState(room);
        return { ok: true };
      }
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator);
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      room.priestUsed[player.id] = true;
      room.priestShields.add(target.id);
      room.night.priestDone[player.id] = target.id;
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true, customToast: `อวยพรคุ้มครอง ${target.name} เรียบร้อยแล้ว` };
    }

    if (room.nightStep === 'revealer' && action.type === 'revealer_action' && player.role === 'revealer') {
      if (room.night.revealerDone[player.id]) return { ok: false };
      if (action.skip) {
        room.night.revealerDone[player.id] = 'skip';
        this._checkCurrentNightStepDone(room);
        this.broadcastRoomState(room);
        return { ok: true };
      }
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && p.id !== player.id);
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      room.night.revealerDone[player.id] = target.id;
      if (isPackWolf(target.role)) {
        room.night.revealerKills.push({ victimId: target.id, cause: 'revealer' });
      } else {
        room.night.revealerKills.push({ victimId: player.id, cause: 'revealer_backfire' });
      }
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'huntress' && action.type === 'huntress_action' && player.role === 'huntress') {
      if (room.night.huntressDone[player.id] || room.huntressUsed[player.id]) return { ok: false };
      if (action.skip) {
        room.night.huntressDone[player.id] = 'skip';
        this._checkCurrentNightStepDone(room);
        this.broadcastRoomState(room);
        return { ok: true };
      }
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && p.id !== player.id);
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      room.huntressUsed[player.id] = true;
      room.night.huntressDone[player.id] = target.id;
      room.night.huntressKills.push(target.id);
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'spellcaster' && action.type === 'spellcaster_silence' && player.role === 'spellcaster') {
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && p.id !== player.id);
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      room.night.spellcasterTargets[player.id] = target.id;
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'old_hag' && action.type === 'old_hag_exile' && player.role === 'old_hag') {
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && p.id !== player.id);
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
      room.night.oldHagTargets[player.id] = target.id;
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'troublemaker' && action.type === 'troublemaker_action' && player.role === 'troublemaker') {
      if (room.night.troublemakerDone[player.id] || room.troublemakerUsed[player.id]) return { ok: false };
      if (action.activate) {
        room.troublemakerUsed[player.id] = true;
        room.night.troublemakerTriggered = true;
        room.night.troublemakerDone[player.id] = 'activated';
      } else {
        room.night.troublemakerDone[player.id] = 'skip';
      }
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'doctor' && action.type === 'doctor_protect' && player.role === 'doctor') {
      const target = room.players.find((p) => p.id === action.targetId && p.alive && !p.isModerator && p.id !== player.id);
      if (!target) return { ok: false, error: 'บอดี้การ์ดไม่สามารถเลือกปกป้องตัวเองได้' };
      if (room.doctorLastProtected[player.id] === target.id) {
        return { ok: false, error: 'ห้ามปกป้องคนเดิม 2 คืนติดต่อกัน' };
      }
      room.night.doctorChoices[player.id] = target.id;
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    if (room.nightStep === 'witch' && action.type === 'witch_action' && player.role === 'witch') {
      if (room.night.witchDone[player.id]) return { ok: false };
      const state = room.witchState[player.id];
      if (!state) return { ok: false };

      let usedHeal = false;
      let poisonTargetId = null;

      if (action.heal && state.hasHeal && room.night.wolfTargetId) {
        state.hasHeal = false;
        usedHeal = true;
        room.night.witchHealed = true;
      }

      if (action.poisonTargetId && state.hasPoison) {
        const target = room.players.find((p) => p.id === action.poisonTargetId && p.alive && p.id !== player.id);
        if (target) {
          state.hasPoison = false;
          poisonTargetId = target.id;
          room.night.witchPoisonIds.push(target.id);
        }
      }

      room.night.witchDone[player.id] = { usedHeal, poisonTargetId };
      this._checkCurrentNightStepDone(room);
      this.broadcastRoomState(room);
      return { ok: true };
    }

    return { ok: false };
  }

  handleDayReady(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.phase !== 'day_discuss') return { ok: false };
    const player = room.players.find((p) => p.id === playerId && p.alive && !p.isBot && !p.isModerator);
    if (!player) return { ok: false };

    if (room.dayReadySet.has(playerId)) room.dayReadySet.delete(playerId);
    else room.dayReadySet.add(playerId);

    const aliveHumans = room.players.filter((p) => p.alive && !p.isBot && !p.isModerator);
    if (
      room.settings.controlMode !== 'manual_mod' &&
      aliveHumans.length > 0 &&
      room.dayReadySet.size >= aliveHumans.length
    ) {
      this._enterPhase(room, 'day_vote', room.settings.voteSeconds);
      return { ok: true };
    }

    this.broadcastRoomState(room);
    return { ok: true };
  }

  handleDayVote(roomCode, playerId, targetId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.phase !== 'day_vote') return { ok: false };
    const voter = room.players.find((p) => p.id === playerId && p.alive && !p.isModerator);
    if (!voter) return { ok: false, error: 'ผู้เสียชีวิตไม่สามารถโหวตได้' };
    if (room.exiledIds?.has(voter.id)) {
      return { ok: false, error: 'คุณถูกแม่หมอสาปไล่ออกจากหมู่บ้านวันนี้ ไม่สามารถโหวตได้' };
    }
    if (voter.role === 'villager_idiot' && targetId === 'skip') {
      return { ok: false, error: 'ไอ้ทึ่มไม่สามารถงดออกเสียงได้ ต้องโหวตผู้เล่นเท่านั้น' };
    }

    if (targetId !== 'skip') {
      if (room.exiledIds?.has(targetId)) {
        return { ok: false, error: 'ผู้เล่นนี้ถูกแม่หมอไล่ออกจากหมู่บ้านวันนี้ ไม่สามารถตกเป็นเป้าโหวตได้' };
      }
      const target = room.players.find((p) => p.id === targetId && p.alive && !p.isModerator && p.id !== voter.id);
      if (!target) return { ok: false, error: 'ไม่สามารถโหวตผู้เล่นนี้ได้' };
    }

    room.dayVotes[voter.id] = targetId;

    const activeVoters = room.players.filter(
      (p) => p.alive && !p.isModerator && !room.exiledIds?.has(p.id) && (p.isBot || p.connected)
    ).length;
    if (room.settings.controlMode !== 'manual_mod' && Object.keys(room.dayVotes).length >= activeVoters) {
      this._resolveDayVote(room);
      return { ok: true };
    }

    this.broadcastRoomState(room);
    return { ok: true };
  }

  handleEndDefense(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room || (room.phase !== 'day_defense' && room.phase !== 'day_verdict')) return { ok: false };
    if (playerId !== room.hostId) {
      return { ok: false, error: 'เฉพาะหัวหน้าห้องเท่านั้นที่สรุปผลโหวตก่อนครบทุกคนได้' };
    }
    this._resolveVerdict(room);
    return { ok: true };
  }

  handleVerdictVote(roomCode, playerId, choice) {
    const room = this.rooms.get(roomCode);
    if (!room || (room.phase !== 'day_defense' && room.phase !== 'day_verdict')) return { ok: false };
    if (!['execute', 'spare'].includes(choice)) return { ok: false };
    const voter = room.players.find((p) => p.id === playerId && p.alive && !p.isModerator);
    if (!voter) return { ok: false, error: 'ผู้เสียชีวิตไม่สามารถโหวตได้' };
    if (room.exiledIds?.has(voter.id)) {
      return { ok: false, error: 'คุณถูกแม่หมอไล่ออกจากหมู่บ้านวันนี้ ไม่สามารถโหวตได้' };
    }
    if (voter.id === room.accusedId) {
      return { ok: false, error: 'ผู้ถูกเสนอชื่อไม่สามารถโหวตตัดสินตัวเองได้' };
    }
    if (voter.role === 'pacifist' && choice === 'execute') {
      return { ok: false, error: 'ผู้รักสันติต้องโหวตปล่อยตัว (ยกเลิกโหวต) เสมอ' };
    }
    if (voter.role === 'villager_idiot' && choice === 'spare') {
      return { ok: false, error: 'ไอ้ทึ่มต้องโหวตประหารเสมอ ไม่สามารถยกเลิกโหวตได้' };
    }

    room.verdictVotes[voter.id] = choice;

    const eligibleVoters = room.players.filter(
      (p) => p.alive && !p.isModerator && !room.exiledIds?.has(p.id) && p.id !== room.accusedId && (p.isBot || p.connected)
    ).length;

    if (room.settings.controlMode !== 'manual_mod' && Object.keys(room.verdictVotes).length >= eligibleVoters) {
      this._resolveVerdict(room);
      return { ok: true };
    }

    this.broadcastRoomState(room);
    return { ok: true };
  }

  handleHunterShoot(roomCode, playerId, targetId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.phase !== 'hunter_revenge') return { ok: false };
    if (room.pendingHunterQueue[0] !== playerId) return { ok: false };

    const hunter = room.players.find((p) => p.id === playerId);
    const target = room.players.find((p) => p.id === targetId && p.alive && !p.isModerator && p.id !== playerId);
    if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };

    room.pendingHunterQueue.shift();
    target.alive = false;
    target.deathCause = 'hunter';
    this._addLog(room, `นายพราน ${hunter.name} ยิงปืนนัดสุดท้ายใส่ ${target.name}`);
    if (target.role === 'wolf_cub') {
      room.wolfDoubleKillNextNight = true;
      this._addLog(room, 'ลูกมนุษย์หมาป่าเสียชีวิต! คืนถัดไปฝูงมนุษย์หมาป่าจะล่าได้ 2 คน');
    }

    if (target.role === 'hunter') {
      room.pendingHunterQueue.push(target.id);
    }

    if (this._checkWinCondition(room)) return { ok: true };

    if (room.pendingHunterQueue.length > 0) {
      this._enterPhase(room, 'hunter_revenge', room.settings.hunterSeconds);
    } else {
      const next = room.hunterNextPhase || 'day_discuss';
      room.hunterNextPhase = null;
      if (next === 'day_discuss') {
        this._enterPhase(room, 'day_discuss', room.settings.discussSeconds);
      } else {
        this._startNight(room);
      }
    }
    return { ok: true };
  }

  handleChat(roomCode, playerId, channel, rawText) {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false };
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return { ok: false };

    const text = String(rawText || '').trim().slice(0, 220);
    if (!text) return { ok: false };

    if (channel === 'wolf') {
      if (!isPackWolf(player.role) || !player.alive) return { ok: false };
    } else if (channel === 'ghost') {
      if (player.alive && !player.isModerator && room.phase !== 'game_over') return { ok: false };
    } else {
      channel = 'village';
      if (room.phase !== 'lobby' && room.phase !== 'game_over') {
        if (!player.alive && !player.isModerator) {
          // Ghost can send 1 single-letter hint per day in village chat!
          if (player.role === 'ghost' && room.phase !== 'night') {
            if (room.ghostLetterUsedDay[player.id] === room.dayNumber) {
              return { ok: false, error: 'พรายกระซิบส่งคำใบ้ 1 ตัวอักษรไปแล้วในวันนี้' };
            }
            const firstChar = Array.from(text)[0] || '';
            if (!firstChar) return { ok: false };
            room.ghostLetterUsedDay[player.id] = room.dayNumber;
            const ghostMsg = {
              id: crypto.randomUUID().slice(0, 8),
              senderId: player.id,
              senderName: `${player.name} (พรายกระซิบ)`,
              senderAvatar: player.avatar,
              text: `คำใบ้: "${firstChar}"`,
              time: Date.now(),
            };
            room.chat.village.push(ghostMsg);
            for (const p of room.players) {
              if (!p.isBot && p.socketId) {
                this.io.to(p.socketId).emit('chat_message', { channel: 'village', message: ghostMsg });
              }
            }
            return { ok: true };
          }
          return { ok: false, error: 'ผู้เสียชีวิตสนทนาได้เฉพาะแชทวิญญาณ' };
        }
        if (room.phase === 'night') return { ok: false, error: 'กลางคืนห้ามคุยในแชทหมู่บ้าน' };
        if (room.silencedIds?.has(player.id)) {
          return { ok: false, error: 'คุณถูกจอมเวทร่ายเวทปิดปาก ห้ามพูดหรือแชทในวันนี้!' };
        }
      }
    }

    const msg = {
      id: crypto.randomUUID().slice(0, 8),
      senderId: player.id,
      senderName: player.name,
      senderAvatar: player.avatar,
      text,
      time: Date.now(),
    };

    room.chat[channel].push(msg);
    if (room.chat[channel].length > 100) room.chat[channel].shift();

    for (const p of room.players) {
      if (p.isBot || !p.socketId) continue;
      const canSee =
        channel === 'village' ||
        (channel === 'wolf' && (isPackWolf(p.role) || p.isModerator || room.phase === 'game_over')) ||
        (channel === 'ghost' && (!p.alive || p.isModerator || room.phase === 'game_over'));
      if (canSee) {
        this.io.to(p.socketId).emit('chat_message', { channel, message: msg });
      }
    }
    return { ok: true };
  }

  // --- Sequential Night Engine ---

  _emptyNightState() {
    return {
      wolfVotes: {},
      wolfTargetId: null,
      wolfTargetIds: [],
      doubleKill: false,
      wolvesSick: false,
      alphaConvert: false,
      cupidDone: {},
      doppelgangerDone: {},
      hoodlumDone: {},
      vampireTargets: {},
      cultTargets: {},
      sorcererInspected: {},
      seerInspected: {},
      mysticInspected: {},
      auraInspected: {},
      piInspected: {},
      mentalistInspected: {},
      doctorChoices: {},
      protectedIds: [],
      priestDone: {},
      witchHealed: false,
      witchPoisonIds: [],
      witchDone: {},
      revealerDone: {},
      revealerKills: [],
      huntressDone: {},
      huntressKills: [],
      spellcasterTargets: {},
      oldHagTargets: {},
      troublemakerDone: {},
      troublemakerTriggered: false,
      stepAdvancing: null,
    };
  }

  _getAliveByRole(room, roleId) {
    if (roleId === 'werewolf') {
      return room.players.filter((p) => p.alive && !p.isModerator && isPackWolf(p.role));
    }
    return room.players.filter((p) => p.alive && !p.isModerator && p.role === roleId);
  }

  _roleExistsInGame(room, roleId) {
    if (roleId === 'werewolf') {
      return room.players.some((p) => !p.isModerator && isPackWolf(p.role));
    }
    return room.players.some((p) => !p.isModerator && p.role === roleId);
  }

  _startNight(room) {
    room.dayNumber += 1;
    room.night = this._emptyNightState();
    room.silencedIds = new Set();
    room.exiledIds = new Set();
    room.remainingVotesToday = 1;

    // Drunk sobers up at Night 4 and discovers their true role!
    if (room.dayNumber === 4) {
      const drunkPool = ['seer', 'doctor', 'hunter', 'mayor', 'witch', 'villager'];
      for (const p of room.players) {
        if (p.alive && p.role === 'drunk') {
          const newRole = drunkPool[Math.floor(Math.random() * drunkPool.length)];
          p.role = newRole;
          if (newRole === 'seer') room.seerResults[p.id] = {};
          if (newRole === 'witch') room.witchState[p.id] = { hasHeal: true, hasPoison: true };
          this._addLog(room, `ขี้เมาสร่างเมาแล้วในคืนที่ 4!`);
        }
      }
    }

    if (room.wolvesSickNextNight) {
      room.night.wolvesSick = true;
      room.wolvesSickNextNight = false;
      this._addLog(room, `คืนที่ ${room.dayNumber}: ฝูงมนุษย์หมาป่าติดเชื้อโรค ไม่สามารถออกล่าได้ในคืนนี้!`);
    } else if (room.wolfDoubleKillNextNight) {
      room.night.doubleKill = true;
      room.wolfDoubleKillNextNight = false;
      this._addLog(room, `คืนที่ ${room.dayNumber} เริ่มต้นขึ้น — ฝูงมนุษย์หมาป่าโกรธแค้น คืนนี้ล่าได้ 2 คน!`);
    } else {
      this._addLog(room, `คืนที่ ${room.dayNumber} เริ่มต้นขึ้น ทุกคนหลับตา`);
    }
    this._beginNightStep(room, 0);
  }

  _beginNightStep(room, startIndex) {
    const isManualMod = room.settings.controlMode === 'manual_mod';

    for (let i = startIndex; i < NIGHT_STEP_ORDER.length; i++) {
      const stepRole = NIGHT_STEP_ORDER[i];
      if (NIGHT1_ONLY_STEPS.has(stepRole) && room.dayNumber > 1) continue;
      if (stepRole === 'werewolf' && room.night.wolvesSick) continue;
      if (!this._roleExistsInGame(room, stepRole)) continue;

      const aliveActors = this._getAliveByRole(room, stepRole);
      let hasActionableActor = aliveActors.length > 0;
      if (stepRole === 'witch') {
        hasActionableActor = aliveActors.some((w) => {
          const st = room.witchState[w.id];
          return st && (st.hasHeal || st.hasPoison);
        });
      } else if (stepRole === 'pi') {
        hasActionableActor = aliveActors.some((p) => !room.piUsed[p.id]);
      } else if (stepRole === 'priest') {
        hasActionableActor = aliveActors.some((p) => !room.priestUsed[p.id]);
      } else if (stepRole === 'huntress') {
        hasActionableActor = aliveActors.some((p) => !room.huntressUsed[p.id]);
      } else if (stepRole === 'troublemaker') {
        hasActionableActor = aliveActors.some((p) => !room.troublemakerUsed[p.id]);
      }

      if (!hasActionableActor) {
        if (isManualMod || NIGHT1_ONLY_STEPS.has(stepRole) || ['pi', 'priest', 'huntress', 'troublemaker'].includes(stepRole)) {
          continue;
        }
        room.nightStep = stepRole;
        this._enterPhase(room, 'night', 4);
        return;
      }

      room.nightStep = stepRole;
      this._enterPhase(room, 'night', isManualMod ? null : room.settings.nightStepSeconds);
      return;
    }

    // All night steps finished -> resolve night!
    room.nightStep = null;
    this._resolveNight(room);
  }

  _checkCurrentNightStepDone(room, delayMs = 1200) {
    if (room.phase !== 'night' || room.settings.controlMode === 'manual_mod') return;
    const step = room.nightStep;
    const aliveActors = this._getAliveByRole(room, step);

    let done = false;
    if (step === 'werewolf') {
      const allVoted = aliveActors.length > 0 && aliveActors.every((w) => Boolean(room.night.wolfVotes[w.id]));
      if (allVoted) {
        const uniqueTargets = new Set(aliveActors.map((w) => room.night.wolfVotes[w.id]));
        done = room.night.doubleKill ? true : uniqueTargets.size === 1;
      }
    } else if (step === 'doctor') {
      done = aliveActors.every((d) => Boolean(room.night.doctorChoices[d.id]));
    } else if (step === 'witch') {
      const activeWitches = aliveActors.filter((w) => {
        const st = room.witchState[w.id];
        return st && (st.hasHeal || st.hasPoison || room.night.witchDone[w.id]);
      });
      done = activeWitches.every((w) => Boolean(room.night.witchDone[w.id]));
    } else if (step === 'cupid') {
      done = aliveActors.every((a) => Boolean(room.night.cupidDone[a.id]));
    } else if (step === 'doppelganger') {
      done = aliveActors.every((a) => Boolean(room.night.doppelgangerDone[a.id]));
    } else if (step === 'hoodlum') {
      done = aliveActors.every((a) => Boolean(room.night.hoodlumDone[a.id]));
    } else if (step === 'vampire') {
      done = aliveActors.every((a) => Boolean(room.night.vampireTargets[a.id]));
    } else if (step === 'cult_leader') {
      done = aliveActors.every((a) => Boolean(room.night.cultTargets[a.id]));
    } else if (step === 'mystic_seer') {
      done = aliveActors.every((a) => Boolean(room.night.mysticInspected[a.id]));
    } else if (step === 'aura_seer') {
      done = aliveActors.every((a) => Boolean(room.night.auraInspected[a.id]));
    } else if (step === 'pi') {
      done = aliveActors.every((a) => Boolean(room.night.piInspected[a.id] || room.piUsed[a.id]));
    } else if (step === 'mentalist') {
      done = aliveActors.every((a) => Boolean(room.night.mentalistInspected[a.id]));
    } else if (step === 'priest') {
      done = aliveActors.every((a) => Boolean(room.night.priestDone[a.id] || room.priestUsed[a.id]));
    } else if (step === 'revealer') {
      done = aliveActors.every((a) => Boolean(room.night.revealerDone[a.id]));
    } else if (step === 'huntress') {
      done = aliveActors.every((a) => Boolean(room.night.huntressDone[a.id] || room.huntressUsed[a.id]));
    } else if (step === 'spellcaster') {
      done = aliveActors.every((a) => Boolean(room.night.spellcasterTargets[a.id]));
    } else if (step === 'old_hag') {
      done = aliveActors.every((a) => Boolean(room.night.oldHagTargets[a.id]));
    } else if (step === 'troublemaker') {
      done = aliveActors.every((a) => Boolean(room.night.troublemakerDone[a.id] || room.troublemakerUsed[a.id]));
    }

    if (done && room.night.stepAdvancing !== step) {
      room.night.stepAdvancing = step;
      if (room.phaseTimer) clearTimeout(room.phaseTimer);
      room.phaseTimer = setTimeout(() => {
        if (room.phase === 'night' && room.nightStep === step) {
          this._advanceNightStep(room);
        }
      }, delayMs);
    }
  }

  _advanceNightStep(room) {
    const currentStep = room.nightStep;
    // Commit results of current step before moving to next
    if (currentStep === 'werewolf') {
      const aliveWolves = this._getAliveByRole(room, 'werewolf');
      const votedEntries = aliveWolves
        .map((w) => room.night.wolfVotes[w.id])
        .filter(Boolean);
      const uniqueTargets = [...new Set(votedEntries)];

      if (room.night.doubleKill) {
        // Double Kill night (Wolf Cub revenge): up to 2 victims
        room.night.wolfTargetIds = uniqueTargets.slice(0, 2);
        room.night.wolfTargetId = room.night.wolfTargetIds[0] || null;
      } else if (
        aliveWolves.length > 0 &&
        votedEntries.length === aliveWolves.length &&
        uniqueTargets.length === 1
      ) {
        // Strict unanimous rule: ALL alive pack wolves must vote for the exact same player!
        room.night.wolfTargetId = uniqueTargets[0];
        room.night.wolfTargetIds = [uniqueTargets[0]];
      } else {
        // Wolves disagreed or failed to vote unanimously -> no one dies tonight
        room.night.wolfTargetId = null;
        room.night.wolfTargetIds = [];
      }
    } else if (currentStep === 'doctor') {
      room.night.protectedIds = Object.values(room.night.doctorChoices);
      for (const [docId, targetId] of Object.entries(room.night.doctorChoices)) {
        room.doctorLastProtected[docId] = targetId;
      }
    }

    const idx = NIGHT_STEP_ORDER.indexOf(currentStep);
    this._beginNightStep(room, idx + 1);
  }

  _clearTimers(room) {
    if (room.phaseTimer) {
      clearTimeout(room.phaseTimer);
      room.phaseTimer = null;
    }
    clearBotTimers(room);
  }

  _enterPhase(room, phase, durationSeconds) {
    this._clearTimers(room);
    room.phase = phase;
    room.phaseEndsAt = durationSeconds ? Date.now() + durationSeconds * 1000 : null;

    if (phase === 'day_discuss') {
      room.dayReadySet = new Set();
      scheduleBotDayChat(room, this);
    } else if (phase === 'day_vote') {
      // Vampire bitten victim dies right when Day Vote starts!
      if (room.vampireBittenId) {
        const vampVictim = room.players.find((p) => p.id === room.vampireBittenId && p.alive && !p.isModerator);
        room.vampireBittenId = null;
        if (vampVictim) {
          this._addLog(room, `${vampVictim.name} ถูกแวมไพร์กัดเมื่อคืนและเสียชีวิตก่อนเริ่มโหวต!`);
          this._killPlayer(room, vampVictim, 'vampire');
          if (this._checkWinCondition(room)) return;
        }
      }
      room.dayVotes = {};
      room.accusedId = null;
      room.verdictVotes = {};
      room.lastVoteSummary = null;
      scheduleBotVotes(room, this);
    } else if (phase === 'day_defense') {
      room.verdictVotes = {};
      scheduleBotDefense(room, this);
      scheduleBotVerdict(room, this);
    } else if (phase === 'day_verdict') {
      room.verdictVotes = {};
      scheduleBotVerdict(room, this);
    } else if (phase === 'night') {
      scheduleBotNightActions(room, this);
    } else if (phase === 'hunter_revenge') {
      scheduleBotHunterShot(room, this);
    }

    this.broadcastRoomState(room);

    if (durationSeconds) {
      room.phaseTimer = setTimeout(() => {
        this._onPhaseTimeout(room);
      }, durationSeconds * 1000);
    }
  }

  _onPhaseTimeout(room) {
    const isManualMod = room.settings.controlMode === 'manual_mod';
    switch (room.phase) {
      case 'role_reveal':
        this._startNight(room);
        break;
      case 'night':
        this._advanceNightStep(room);
        break;
      case 'dawn':
        if (room.pendingHunterQueue.length > 0) {
          room.hunterNextPhase = 'day_discuss';
          this._enterPhase(room, 'hunter_revenge', room.settings.hunterSeconds);
        } else {
          this._enterPhase(room, 'day_discuss', room.settings.discussSeconds);
        }
        break;
      case 'day_discuss':
        this._enterPhase(room, 'day_vote', isManualMod ? null : room.settings.voteSeconds);
        break;
      case 'day_vote':
        this._resolveDayVote(room);
        break;
      case 'day_defense':
        this._enterPhase(room, 'day_verdict', isManualMod ? null : room.settings.verdictSeconds);
        break;
      case 'day_verdict':
        this._resolveVerdict(room);
        break;
      case 'hunter_revenge': {
        const hunterId = room.pendingHunterQueue.shift();
        const hunter = room.players.find((p) => p.id === hunterId);
        if (hunter) this._addLog(room, `นายพราน ${hunter.name} หมดเวลายิงปืน`);
        if (this._checkWinCondition(room)) return;
        if (room.pendingHunterQueue.length > 0) {
          this._enterPhase(room, 'hunter_revenge', room.settings.hunterSeconds);
        } else {
          const next = room.hunterNextPhase || 'day_discuss';
          room.hunterNextPhase = null;
          if (next === 'day_discuss') {
            this._enterPhase(room, 'day_discuss', room.settings.discussSeconds);
          } else {
            this._startNight(room);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  _killPlayer(room, victim, cause, deathsList = null) {
    if (!victim || !victim.alive || victim.isModerator) return;
    victim.alive = false;
    victim.deathCause = cause;
    if (deathsList) {
      deathsList.push({ playerId: victim.id, name: victim.name, avatar: victim.avatar, cause });
    }

    if (victim.role === 'wolf_cub') {
      room.wolfDoubleKillNextNight = true;
      this._addLog(room, 'ลูกมนุษย์หมาป่าเสียชีวิต! คืนถัดไปฝูงมนุษย์หมาป่าจะล่าได้ 2 คน');
    }
    if (victim.role === 'disease' && cause === 'werewolf') {
      room.wolvesSickNextNight = true;
      this._addLog(room, 'มนุษย์หมาป่ากินผู้ป่วยติดเชื้อ! คืนถัดไปหมาป่าจะออกล่าไม่ได้');
    }
    if (cause === 'vote' && isPackWolf(victim.role)) {
      room.wolfDiedByVoteLastDay = true;
    }
    if (victim.role === 'hunter' && !room.pendingHunterQueue.includes(victim.id)) {
      room.pendingHunterQueue.push(victim.id);
    }

    // Apprentice Seer promotion if Seer dies
    if (victim.role === 'seer') {
      for (const p of room.players) {
        if (p.alive && p.role === 'apprentice_seer') {
          p.role = 'seer';
          room.seerResults[p.id] = {};
          this._addLog(room, 'ศิษย์เทพพยากรณ์สืบทอดพลังกลายเป็นเทพพยากรณ์แล้ว!');
        }
      }
    }

    // Doppelganger transformation if their chosen target dies
    for (const [dopId, targetId] of Object.entries(room.doppelgangerTargets || {})) {
      if (targetId === victim.id) {
        const dop = room.players.find((p) => p.id === dopId && p.alive && p.role === 'doppelganger');
        if (dop) {
          dop.role = victim.role;
          if (dop.role === 'seer') room.seerResults[dop.id] = {};
          if (dop.role === 'sorcerer') room.sorcererResults[dop.id] = {};
          if (dop.role === 'mystic_seer') room.mysticResults[dop.id] = {};
          if (dop.role === 'aura_seer') room.auraResults[dop.id] = {};
          if (dop.role === 'witch') room.witchState[dop.id] = { hasHeal: true, hasPoison: true };
          if (dop.role === 'cult_leader') room.cultMembers.add(dop.id);
          this._addLog(room, 'ภูตจำแลงสวมรอยบทบาทใหม่แล้ว!');
        }
      }
    }

    // Cupid Lovers heartbreak chain
    if (Array.isArray(room.lovers) && room.lovers.includes(victim.id)) {
      const otherId = room.lovers.find((id) => id !== victim.id);
      const other = room.players.find((p) => p.id === otherId && p.alive && !p.isModerator);
      if (other) {
        this._addLog(room, `${other.name} ตรอมใจเสียชีวิตตามคู่รัก ${victim.name}`);
        this._killPlayer(room, other, 'lover', deathsList);
      }
    }

    // Mad Bomber explodes alive left & right seat neighbors!
    if (victim.role === 'mad_bomber') {
      const seats = room.players
        .filter((p) => !p.isModerator && (p.alive || p.id === victim.id))
        .sort((a, b) => a.seatNumber - b.seatNumber);
      const vIdx = seats.findIndex((p) => p.id === victim.id);
      if (vIdx !== -1 && seats.length > 1) {
        const left = seats[(vIdx - 1 + seats.length) % seats.length];
        const right = seats[(vIdx + 1) % seats.length];
        const neighbors = [...new Set([left, right])].filter((n) => n && n.id !== victim.id && n.alive);
        for (const nb of neighbors) {
          this._addLog(room, `มือระเบิดพลีชีพ ${victim.name} ระเบิด ${nb.name} เสียชีวิตไปด้วย!`);
          this._killPlayer(room, nb, 'bomber', deathsList);
        }
      }
    }
  }

  _resolveNight(room) {
    const deaths = [];
    const {
      wolfTargetId,
      wolfTargetIds,
      protectedIds,
      witchHealed,
      witchPoisonIds,
      revealerKills,
      huntressKills,
      vampireTargets,
      cultTargets,
      spellcasterTargets,
      oldHagTargets,
      troublemakerTriggered,
      alphaConvert,
    } = room.night;
    const targets = wolfTargetIds?.length ? wolfTargetIds : wolfTargetId ? [wolfTargetId] : [];

    // Ghost dies automatically on Night 1 to begin haunting
    if (room.dayNumber === 1) {
      for (const p of room.players) {
        if (p.alive && p.role === 'ghost') {
          this._killPlayer(room, p, 'ghost', deaths);
        }
      }
    }

    // Tough Guy bitten on previous night now dies
    for (const [tgId, bittenDay] of Object.entries(room.toughGuyBittenDay || {})) {
      if (bittenDay < room.dayNumber) {
        const tg = room.players.find((p) => p.id === tgId && p.alive);
        if (tg) this._killPlayer(room, tg, 'tough_guy', deaths);
        delete room.toughGuyBittenDay[tgId];
      }
    }

    // Cult Leader recruits
    for (const tid of Object.values(cultTargets || {})) {
      if (tid) room.cultMembers.add(tid);
    }

    // Vampire bite (dies at start of day_vote tomorrow)
    const vampPick = Object.values(vampireTargets || {}).find(Boolean);
    room.vampireBittenId = vampPick || null;

    // Spellcaster silence & Old Hag exile
    for (const tid of Object.values(spellcasterTargets || {})) {
      if (tid) room.silencedIds.add(tid);
    }
    for (const tid of Object.values(oldHagTargets || {})) {
      if (tid) room.exiledIds.add(tid);
    }
    room.remainingVotesToday = troublemakerTriggered ? 2 : 1;
    if (troublemakerTriggered) {
      this._addLog(room, 'ตัวป่วนก่อความวุ่นวาย! วันนี้หมู่บ้านจะต้องโหวตประหารถึง 2 รอบ!');
    }

    // Werewolf attacks
    for (const tid of targets) {
      if (protectedIds.includes(tid)) continue;
      if (witchHealed && tid === wolfTargetId) continue;
      const victim = room.players.find((p) => p.id === tid && p.alive && !p.isModerator);
      if (!victim) continue;
      if (room.priestShields.has(victim.id)) {
        room.priestShields.delete(victim.id);
        this._addLog(room, `พลังคุ้มครองของนักบวชช่วยชีวิตผู้เล่นไว้ได้ในคืนนี้!`);
        continue;
      }
      if (victim.role === 'vampire') {
        continue; // Werewolves cannot kill Vampire!
      }
      if (victim.role === 'cursed') {
        victim.role = 'werewolf';
        this._addLog(room, 'ผู้ต้องคำสาปถูกหมาป่ากัดและกลายเป็นมนุษย์หมาป่าแล้ว!');
        continue;
      }
      if (alphaConvert && tid === wolfTargetId && room.wolfDiedByVoteLastDay) {
        const alpha = room.players.find((p) => p.alive && p.role === 'alpha_wolf' && !room.alphaUsed[p.id]);
        if (alpha) {
          room.alphaUsed[alpha.id] = true;
          room.wolfDiedByVoteLastDay = false;
          victim.role = 'werewolf';
          this._addLog(room, 'มนุษย์หมาป่าจ่าฝูงใช้พลังแปลงเหยื่อให้กลายเป็นมนุษย์หมาป่าแทนการฆ่า!');
          continue;
        }
      }
      if (victim.role === 'tough_guy' && !room.toughGuyBittenDay[victim.id]) {
        room.toughGuyBittenDay[victim.id] = room.dayNumber;
        continue; // Tough guy survives today, dies next night!
      }
      this._killPlayer(room, victim, 'werewolf', deaths);
    }
    room.wolfDiedByVoteLastDay = false;

    // Witch poison
    for (const pid of witchPoisonIds) {
      const victim = room.players.find((p) => p.id === pid && p.alive && !p.isModerator);
      if (victim) this._killPlayer(room, victim, 'poison', deaths);
    }

    // Revealer kills/backfires
    for (const rk of revealerKills || []) {
      const victim = room.players.find((p) => p.id === rk.victimId && p.alive && !p.isModerator);
      if (victim) this._killPlayer(room, victim, rk.cause, deaths);
    }

    // Huntress kills
    for (const hid of huntressKills || []) {
      const victim = room.players.find((p) => p.id === hid && p.alive && !p.isModerator);
      if (victim) this._killPlayer(room, victim, 'huntress', deaths);
    }

    room.lastDawnSummary = { dayNumber: room.dayNumber, deaths };

    if (deaths.length === 0) {
      this._addLog(room, `เช้าวันที่ ${room.dayNumber}: เมื่อคืนไม่มีใครเสียชีวิต`);
    } else {
      this._addLog(room, `เช้าวันที่ ${room.dayNumber}: พบผู้เสียชีวิตคือ ${deaths.map((d) => d.name).join(', ')}`);
    }

    if (this._checkWinCondition(room)) return;

    const isManualMod = room.settings.controlMode === 'manual_mod';
    this._enterPhase(room, 'dawn', isManualMod ? null : 6);
  }

  _resolveDayVote(room) {
    const tally = {};
    let skipVotes = 0;

    for (const [voterId, targetId] of Object.entries(room.dayVotes)) {
      const voter = room.players.find((p) => p.id === voterId);
      const weight = voter && voter.role === 'mayor' ? 2 : 1;
      if (targetId === 'skip') skipVotes += weight;
      else tally[targetId] = (tally[targetId] || 0) + weight;
    }

    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    let accused = null;
    let reason = 'no_votes';

    if (entries.length > 0) {
      const [topId, topCount] = entries[0];
      const tied = entries.filter((e) => e[1] === topCount).length > 1;
      if (tied || topCount <= skipVotes) {
        reason = tied ? 'tie' : 'skip';
      } else {
        accused = room.players.find((p) => p.id === topId && p.alive && !p.isModerator);
        if (accused) reason = 'accused';
      }
    } else if (skipVotes > 0) {
      reason = 'skip';
    }

    if (!accused) {
      room.lastVoteSummary = {
        reason,
        eliminatedId: null,
        eliminatedName: null,
        eliminatedRole: null,
        tally,
        skipVotes,
      };
      if (reason === 'tie') {
        this._addLog(room, 'คะแนนโหวตเสมอกัน วันนี้ไม่มีใครถูกเสนอชื่อ');
      } else {
        this._addLog(room, 'หมู่บ้านงดออกเสียง วันนี้ไม่มีใครถูกเสนอชื่อ');
      }
      this._startNight(room);
      return;
    }

    // Enter Defense & Confirmation Phase (no auto-timeout: waits until everyone votes execute or spare!)
    room.accusedId = accused.id;
    room.verdictVotes = {};
    this._addLog(room, `${accused.name} ถูกโหวตเสนอชื่อสูงสุด! เข้าสู่ช่วงแก้ตัวและรอทุกคนโหวตยืนยัน`);
    this._enterPhase(room, 'day_defense', null);
  }

  _resolveVerdict(room) {
    const accused = room.players.find((p) => p.id === room.accusedId && p.alive && !p.isModerator);
    let executeVotes = 0;
    let spareVotes = 0;

    for (const [voterId, choice] of Object.entries(room.verdictVotes)) {
      const voter = room.players.find((p) => p.id === voterId);
      const weight = voter && voter.role === 'mayor' ? 2 : 1;
      if (choice === 'execute') executeVotes += weight;
      else if (choice === 'spare') spareVotes += weight;
    }

    const shouldExecute = Boolean(accused) && executeVotes > spareVotes;
    let eliminated = null;
    let princeSaved = false;

    if (shouldExecute) {
      if (accused.role === 'prince' && !room.princeRevealed[accused.id]) {
        room.princeRevealed[accused.id] = true;
        princeSaved = true;
        this._addLog(room, `เจ้าชาย ${accused.name} เผยตัวตนและรอดพ้นจากการโหวตประหาร!`);
      } else {
        this._killPlayer(room, accused, 'vote');
        eliminated = accused;
      }
    }

    room.lastVoteSummary = {
      reason: princeSaved ? 'prince_saved' : eliminated ? 'eliminated' : 'spared',
      eliminatedId: eliminated ? eliminated.id : null,
      eliminatedName: eliminated ? eliminated.name : null,
      eliminatedRole: eliminated ? eliminated.role : null,
      sparedName: !eliminated && accused ? accused.name : null,
      executeVotes,
      spareVotes,
    };

    room.accusedId = null;
    room.verdictVotes = {};

    if (eliminated) {
      this._addLog(room, `มติตัดสิน (${executeVotes} ประหาร / ${spareVotes} ปล่อยตัว): ${eliminated.name} ถูกประหาร!`);
    } else if (accused && !princeSaved) {
      this._addLog(room, `มติตัดสิน (${executeVotes} ประหาร / ${spareVotes} ปล่อยตัว): ยกเลิกโหวต! ${accused.name} รอดชีวิต`);
    }

    if (eliminated && eliminated.role === 'tanner') {
      room.winner = 'tanner';
      room.winnerPlayerName = eliminated.name;
      this._evaluateHoodlumBonus(room);
      this._addLog(room, `ยาจก (คนคลั่ง) ${eliminated.name} ถูกโหวตประหารและชนะเกมคนเดียวทันที!`);
      this._enterPhase(room, 'game_over', null);
      return;
    }

    if (room.pendingHunterQueue.length > 0) {
      room.hunterNextPhase = room.remainingVotesToday > 1 ? 'day_vote' : 'night';
      if (this._checkWinCondition(room)) return;
      this._enterPhase(room, 'hunter_revenge', room.settings.hunterSeconds);
      return;
    }

    if (this._checkWinCondition(room)) return;

    if (room.remainingVotesToday > 1) {
      room.remainingVotesToday -= 1;
      const isManualMod = room.settings.controlMode === 'manual_mod';
      this._addLog(room, 'เริ่มการโหวตประหารรอบที่ 2 จากพลังของตัวป่วน!');
      this._enterPhase(room, 'day_vote', isManualMod ? null : room.settings.voteSeconds);
      return;
    }

    this._startNight(room);
  }

  _evaluateHoodlumBonus(room) {
    const winningHoodlums = room.players.filter((p) => {
      if (!p.alive || p.role !== 'hoodlum') return false;
      const targets = room.hoodlumTargets?.[p.id] || [];
      if (targets.length !== 2) return false;
      return targets.every((tid) => {
        const t = room.players.find((pl) => pl.id === tid);
        return t && !t.alive;
      });
    });
    if (winningHoodlums.length > 0) {
      room.winnerBonus = `อันธพาล (${winningHoodlums.map((h) => h.name).join(', ')}) ทำภารกิจสำเร็จและร่วมชนะด้วย!`;
      this._addLog(room, room.winnerBonus);
    }
  }

  _checkWinCondition(room) {
    const alive = room.players.filter((p) => p.alive && !p.isModerator);
    const aliveWolves = alive.filter((p) => isPackWolf(p.role));
    const aliveVampires = alive.filter((p) => p.role === 'vampire');
    const aliveNonWolves = alive.filter((p) => !isPackWolf(p.role));

    // Cult Leader solo victory: alive cult_leader + all alive players in cult
    const aliveCultLeader = alive.find((p) => p.role === 'cult_leader');
    if (aliveCultLeader && alive.length > 1 && alive.every((p) => room.cultMembers?.has(p.id))) {
      room.winner = 'cult_leader';
      room.winnerPlayerName = aliveCultLeader.name;
      this._evaluateHoodlumBonus(room);
      this._addLog(room, `เจ้าลัทธิ ${aliveCultLeader.name} ชวนทุกคนเข้าลัทธิได้สำเร็จและชนะเกมคนเดียว!`);
      this._enterPhase(room, 'game_over', null);
      return true;
    }

    // Vampire victory: vampires >= others and no wolves left
    if (aliveVampires.length > 0 && aliveWolves.length === 0 && aliveVampires.length >= alive.length - aliveVampires.length) {
      room.winner = 'vampire';
      room.winnerPlayerName = aliveVampires.map((v) => v.name).join(', ');
      this._evaluateHoodlumBonus(room);
      this._addLog(room, `แวมไพร์ (${room.winnerPlayerName}) ยึดครองหมู่บ้านสำเร็จ!`);
      this._enterPhase(room, 'game_over', null);
      return true;
    }

    if (aliveWolves.length === 0 && aliveVampires.length === 0) {
      room.winner = 'village';
      this._evaluateHoodlumBonus(room);
      this._addLog(room, 'ฝ่ายชาวบ้านเป็นฝ่ายชนะ! มนุษย์หมาป่าทั้งหมดถูกกำจัดแล้ว');
      this._enterPhase(room, 'game_over', null);
      return true;
    }

    // If a Hunter just died and hasn't taken their final revenge shot yet, let them shoot before checking Wolf victory!
    if (room.pendingHunterQueue && room.pendingHunterQueue.length > 0) {
      return false;
    }

    if (aliveWolves.length >= aliveNonWolves.length) {
      const loneWolfOnly = aliveWolves.length === 1 && aliveWolves[0].role === 'lone_wolf';
      if (loneWolfOnly) {
        room.winner = 'lone_wolf';
        room.winnerPlayerName = aliveWolves[0].name;
        this._evaluateHoodlumBonus(room);
        this._addLog(room, `มนุษย์หมาป่าเดียวดาย ${aliveWolves[0].name} เหลือรอดเป็นคนสุดท้ายและชนะเกม!`);
      } else {
        room.winner = 'werewolf';
        this._evaluateHoodlumBonus(room);
        this._addLog(room, 'ฝ่ายมนุษย์หมาป่าเป็นฝ่ายชนะ! หมู่บ้านตกอยู่ใต้อำนาจของฝูงหมาป่าแล้ว');
      }
      this._enterPhase(room, 'game_over', null);
      return true;
    }

    return false;
  }

  _syncSeatNumbersAndRoles(room) {
    const isManualMod = room.settings.controlMode === 'manual_mod';
    let seat = 1;
    room.players.forEach((p) => {
      if (isManualMod && p.id === room.hostId) {
        p.seatNumber = 0;
      } else {
        p.seatNumber = seat++;
      }
    });
    if (room.settings.autoRoles) {
      const count = isManualMod ? Math.max(4, room.players.length - 1) : Math.max(4, room.players.length);
      room.settings.roleConfig = getDefaultRoleConfig(count);
    }
  }

  _reassignHostIfNeeded(room) {
    const currentHost = room.players.find((p) => p.id === room.hostId);
    if (!currentHost) {
      const nextHuman = room.players.find((p) => !p.isBot);
      if (nextHuman) {
        room.hostId = nextHuman.id;
        nextHuman.isHost = true;
        nextHuman.ready = true;
      }
    }
  }

  _destroyRoom(room) {
    this._clearTimers(room);
    this.rooms.delete(room.code);
  }

  _addLog(room, text) {
    room.logs.push({ id: crypto.randomUUID().slice(0, 8), text, time: Date.now() });
    if (room.logs.length > 80) room.logs.shift();
  }

  // --- Strictly Sanitized Per-Player State (Zero Secret Leakage!) ---

  getPlayerView(room, viewerId) {
    const viewer = room.players.find((p) => p.id === viewerId);
    const isGameOver = room.phase === 'game_over';
    const isViewerMod = Boolean(viewer?.isModerator) && room.settings.controlMode === 'manual_mod';
    const isViewerPackWolf = viewer && isPackWolf(viewer.role);
    const isViewerMinion = viewer && viewer.role === 'minion';
    const isViewerDead = viewer && !viewer.alive && !isViewerMod;
    const isHostNarrator = room.settings.controlMode === 'narrator' && viewerId === room.hostId;

    const isMyNightTurn =
      room.phase === 'night' &&
      viewer &&
      viewer.alive &&
      !isViewerMod &&
      ((room.nightStep === 'werewolf' && isPackWolf(viewer.role)) || viewer.role === room.nightStep) &&
      (viewer.role !== 'witch' ||
        Boolean(
          room.witchState[viewer.id]?.hasHeal ||
            room.witchState[viewer.id]?.hasPoison ||
            room.night.witchDone[viewer.id]
        ));

    const isViewerMason = viewer && viewer.role === 'mason';
    const players = room.players.map((p) => {
      const revealRole =
        isGameOver ||
        isViewerMod ||
        p.id === viewerId ||
        ((isViewerPackWolf || isViewerMinion) && isPackWolf(p.role)) ||
        (isViewerMason && p.role === 'mason') ||
        Boolean(room.princeRevealed?.[p.id]);

      return {
        id: p.id,
        seatNumber: p.seatNumber,
        name: p.name,
        avatar: p.avatar,
        isHost: p.id === room.hostId,
        isModerator: p.isModerator,
        isBot: p.isBot,
        ready: p.ready,
        connected: p.connected,
        alive: p.alive,
        deathCause: p.deathCause,
        silenced: room.silencedIds?.has(p.id) || false,
        exiled: room.exiledIds?.has(p.id) || false,
        role: revealRole ? p.role : null,
      };
    });

    // Moderator-only live night status
    let modNightStatus = null;
    if (isViewerMod && room.phase === 'night' && room.nightStep) {
      const actors = this._getAliveByRole(room, room.nightStep);
      const doneIds = actors
        .filter((a) => {
          if (room.nightStep === 'werewolf') return Boolean(room.night.wolfVotes[a.id]);
          if (room.nightStep === 'sorcerer') return Boolean(room.night.sorcererInspected[a.id]);
          if (room.nightStep === 'seer') return Boolean(room.night.seerInspected[a.id]);
          if (room.nightStep === 'doctor') return Boolean(room.night.doctorChoices[a.id]);
          if (room.nightStep === 'witch') return Boolean(room.night.witchDone[a.id]);
          return false;
        })
        .map((a) => a.id);
      modNightStatus = {
        step: room.nightStep,
        actorIds: actors.map((a) => a.id),
        doneIds,
      };
    }

    const privateData = {
      myRole: viewer ? viewer.role : null,
      isModerator: isViewerMod,
      isMyNightTurn,
      doubleKillTonight: isViewerPackWolf || isViewerMod ? Boolean(room.night.doubleKill) : false,
      visibleNightStep: isMyNightTurn || isViewerMod || isHostNarrator ? room.nightStep : null,
      modNightStatus,
      seerResults: viewer && viewer.role === 'seer' ? room.seerResults[viewer.id] || {} : {},
      seerInspectedTonight:
        viewer && viewer.role === 'seer' ? room.night.seerInspected[viewer.id] || null : null,
      sorcererResults: viewer && viewer.role === 'sorcerer' ? room.sorcererResults[viewer.id] || {} : {},
      sorcererInspectedTonight:
        viewer && viewer.role === 'sorcerer' ? room.night.sorcererInspected[viewer.id] || null : null,
      doctorLastProtected:
        viewer && viewer.role === 'doctor' ? room.doctorLastProtected[viewer.id] || null : null,
      doctorChoiceTonight:
        viewer && viewer.role === 'doctor' ? room.night.doctorChoices[viewer.id] || null : null,
      wolfVotes: isViewerPackWolf || isViewerMod || isGameOver ? room.night.wolfVotes : {},
      witchState: viewer && viewer.role === 'witch' ? room.witchState[viewer.id] || null : null,
      witchDoneTonight:
        viewer && viewer.role === 'witch' ? Boolean(room.night.witchDone[viewer.id]) : false,
      witchVictimId:
        viewer &&
        viewer.role === 'witch' &&
        room.phase === 'night' &&
        room.nightStep === 'witch' &&
        room.witchState[viewer.id]?.hasHeal
          ? room.night.wolfTargetId
          : null,
      loverPartnerId:
        viewer && Array.isArray(room.lovers) && room.lovers.includes(viewer.id)
          ? room.lovers.find((id) => id !== viewer.id) || null
          : null,
      mysticResults: viewer && viewer.role === 'mystic_seer' ? room.mysticResults?.[viewer.id] || {} : {},
      mysticInspectedTonight:
        viewer && viewer.role === 'mystic_seer' ? room.night.mysticInspected?.[viewer.id] || null : null,
      auraResults: viewer && viewer.role === 'aura_seer' ? room.auraResults?.[viewer.id] || {} : {},
      auraInspectedTonight:
        viewer && viewer.role === 'aura_seer' ? room.night.auraInspected?.[viewer.id] || null : null,
      piResult: viewer && viewer.role === 'pi' ? room.piResults?.[viewer.id] || null : null,
      piUsed: viewer && viewer.role === 'pi' ? Boolean(room.piUsed?.[viewer.id]) : false,
      mentalistResultTonight:
        viewer && viewer.role === 'mentalist' ? room.night.mentalistInspected?.[viewer.id] || null : null,
      hoodlumTargets: viewer && viewer.role === 'hoodlum' ? room.hoodlumTargets?.[viewer.id] || [] : [],
      doppelgangerTarget: viewer && viewer.role === 'doppelganger' ? room.doppelgangerTargets?.[viewer.id] || null : null,
      inCult: viewer ? room.cultMembers?.has(viewer.id) || false : false,
      cultMemberIds: viewer && viewer.role === 'cult_leader' ? Array.from(room.cultMembers || []) : [],
      alphaCanConvert:
        viewer && viewer.role === 'alpha_wolf' && room.wolfDiedByVoteLastDay && !room.alphaUsed?.[viewer.id],
      alphaConvertActive: isViewerPackWolf ? Boolean(room.night.alphaConvert) : false,
      nightStepDone:
        viewer && room.phase === 'night'
          ? Boolean(
              room.night.cupidDone?.[viewer.id] ||
                room.night.doppelgangerDone?.[viewer.id] ||
                room.night.hoodlumDone?.[viewer.id] ||
                room.night.vampireTargets?.[viewer.id] ||
                room.night.cultTargets?.[viewer.id] ||
                room.night.priestDone?.[viewer.id] ||
                room.night.revealerDone?.[viewer.id] ||
                room.night.huntressDone?.[viewer.id] ||
                room.night.spellcasterTargets?.[viewer.id] ||
                room.night.oldHagTargets?.[viewer.id] ||
                room.night.troublemakerDone?.[viewer.id]
            )
          : false,
    };

    const chat = {
      village: room.chat.village,
      wolf: isViewerPackWolf || isViewerMod || isGameOver ? room.chat.wolf : [],
      ghost: isViewerDead || isViewerMod || isGameOver ? room.chat.ghost : [],
    };

    return {
      code: room.code,
      stateVersion: room.stateVersion || 0,
      hostId: room.hostId,
      myId: viewerId,
      phase: room.phase,
      phaseEndsAt: room.phaseEndsAt,
      serverNow: Date.now(),
      dayNumber: room.dayNumber,
      players,
      settings: room.settings,
      activeRoleCounts: room.activeRoleCounts || room.settings.roleConfig || {},
      dayVotes: room.phase === 'day_vote' ? room.dayVotes : {},
      accusedId: room.phase === 'day_defense' || room.phase === 'day_verdict' ? room.accusedId : null,
      verdictVotes: room.phase === 'day_defense' || room.phase === 'day_verdict' ? room.verdictVotes : {},
      dayReadyIds: Array.from(room.dayReadySet),
      activeHunterId: room.phase === 'hunter_revenge' ? room.pendingHunterQueue[0] || null : null,
      lastDawnSummary: room.lastDawnSummary,
      lastVoteSummary: room.lastVoteSummary,
      winner: room.winner,
      winnerPlayerName: room.winnerPlayerName,
      winnerBonus: room.winnerBonus,
      remainingVotesToday: room.remainingVotesToday || 1,
      privateData,
      chat,
      logs: room.logs,
      rolesCatalog: ROLES,
    };
  }

  broadcastRoomState(room) {
    room.stateVersion = (room.stateVersion || 0) + 1;
    for (const p of room.players) {
      if (p.isBot || !p.socketId) continue;
      this.io.to(p.socketId).emit('room_state', this.getPlayerView(room, p.id));
    }
  }
}
