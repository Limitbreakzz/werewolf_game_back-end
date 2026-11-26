import crypto from 'crypto';
import { ROLES, isPackWolf, getDefaultRoleConfig, buildRoleDeck } from './roles.js';
import { BOT_PROFILES } from './botNames.js';
import {
  clearBotTimers,
  scheduleBotNightActions,
  scheduleBotDayChat,
  scheduleBotVotes,
  scheduleBotHunterShot,
} from './aiManager.js';

const AVATAR_POOL = [
  'moon', 'crown', 'swords', 'shield', 'feather', 'compass', 'key', 'gem',
  'scroll', 'anchor', 'sparkles', 'bell', 'book', 'trees', 'hourglass', 'landmark',
];
const NIGHT_STEP_ORDER = ['werewolf', 'sorcerer', 'seer', 'doctor', 'witch'];

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
      dayVotes: {},
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

  joinRoom(socket, { roomCode, playerName, avatar }) {
    const code = (roomCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ไม่พบห้องรหัสนี้ กรุณาตรวจสอบรหัสห้องอีกครั้ง' };
    if (room.phase !== 'lobby') {
      return { ok: false, error: 'เกมในห้องนี้เริ่มไปแล้ว ไม่สามารถเข้าร่วมกลางคันได้' };
    }
    if (room.players.length >= 16) {
      return { ok: false, error: 'ห้องเต็มแล้ว (สูงสุด 16 คน)' };
    }

    const cleanName = (playerName || 'ผู้เล่น').trim().slice(0, 18) || 'ผู้เล่น';
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

    player.socketId = socket.id;
    player.connected = true;
    this.socketToPlayer.set(socket.id, { roomCode: code, playerId });
    socket.join(code);
    this.broadcastRoomState(room);
    return { ok: true, roomCode: code, playerId };
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

    room.dayNumber = 0;
    room.nightStep = null;
    room.winner = null;
    room.winnerPlayerName = null;
    room.seerResults = {};
    room.sorcererResults = {};
    room.doctorLastProtected = {};
    room.witchState = {};
    room.wolfDoubleKillNextNight = false;
    room.dayVotes = {};
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
        if (p.role === 'witch') room.witchState[p.id] = { hasHeal: true, hasPoison: true };
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

  leaveRoom(socket) {
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

    if (room.phase === 'lobby') {
      room.players.splice(idx, 1);
      this._addLog(room, `${player.name} ออกจากห้อง`);
      this._reassignHostIfNeeded(room);
      this._syncSeatNumbersAndRoles(room);
      if (!room.players.some((p) => !p.isBot)) {
        this._destroyRoom(room);
        return;
      }
      this.broadcastRoomState(room);
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
    this.leaveRoom(socket);
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

    if (room.nightStep === 'doctor' && action.type === 'doctor_protect' && player.role === 'doctor') {
      const target = room.players.find((p) => p.id === action.targetId && p.alive);
      if (!target) return { ok: false, error: 'เป้าหมายไม่ถูกต้อง' };
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

    if (targetId !== 'skip') {
      const target = room.players.find((p) => p.id === targetId && p.alive && !p.isModerator && p.id !== voter.id);
      if (!target) return { ok: false, error: 'ไม่สามารถโหวตผู้เล่นนี้ได้' };
    }

    room.dayVotes[voter.id] = targetId;

    const activeVoters = room.players.filter((p) => p.alive && !p.isModerator && (p.isBot || p.connected)).length;
    if (room.settings.controlMode !== 'manual_mod' && Object.keys(room.dayVotes).length >= activeVoters) {
      this._resolveDayVote(room);
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
        if (!player.alive && !player.isModerator) return { ok: false, error: 'ผู้เสียชีวิตสนทนาได้เฉพาะแชทวิญญาณ' };
        if (room.phase === 'night') return { ok: false, error: 'กลางคืนห้ามคุยในแชทหมู่บ้าน' };
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
        (channel === 'wolf' && (isPackWolf(p.role) || !p.alive || p.isModerator || room.phase === 'game_over')) ||
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
      sorcererInspected: {},
      seerInspected: {},
      doctorChoices: {},
      protectedIds: [],
      witchHealed: false,
      witchPoisonIds: [],
      witchDone: {},
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
    if (room.wolfDoubleKillNextNight) {
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

    // Find next night role that exists in this match (even if dead, we skip if dead in manual_mod or run short decoy in auto mode)
    for (let i = startIndex; i < NIGHT_STEP_ORDER.length; i++) {
      const stepRole = NIGHT_STEP_ORDER[i];
      if (!this._roleExistsInGame(room, stepRole)) continue;

      const aliveActors = this._getAliveByRole(room, stepRole);
      // Special check for Witch: if Witch has no potions left, treat as inactive
      const hasActionableActor =
        stepRole === 'witch'
          ? aliveActors.some((w) => {
              const st = room.witchState[w.id];
              return st && (st.hasHeal || st.hasPoison);
            })
          : aliveActors.length > 0;

      if (!hasActionableActor) {
        if (isManualMod) continue;
        // Decoy silent pause (3.5s) so nobody can tell a role is dead!
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

  _checkCurrentNightStepDone(room) {
    if (room.phase !== 'night' || room.settings.controlMode === 'manual_mod') return;
    const step = room.nightStep;
    const aliveActors = this._getAliveByRole(room, step);

    let done = false;
    if (step === 'werewolf') {
      const allVoted = aliveActors.length > 0 && aliveActors.every((w) => Boolean(room.night.wolfVotes[w.id]));
      if (allVoted) {
        const uniqueTargets = new Set(aliveActors.map((w) => room.night.wolfVotes[w.id]));
        // Normal night: wolves MUST agree on the exact same victim to auto-advance!
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
    }

    if (done && room.night.stepAdvancing !== step) {
      room.night.stepAdvancing = step;
      if (room.phaseTimer) clearTimeout(room.phaseTimer);
      // Small 1.2s buffer for natural pacing (never reset on repeated clicks)
      room.phaseTimer = setTimeout(() => {
        if (room.phase === 'night' && room.nightStep === step) {
          this._advanceNightStep(room);
        }
      }, 1200);
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
      room.dayVotes = {};
      room.lastVoteSummary = null;
      scheduleBotVotes(room, this);
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
      case 'hunter_revenge': {
        const hunterId = room.pendingHunterQueue.shift();
        const hunter = room.players.find((p) => p.id === hunterId);
        if (hunter) this._addLog(room, `นักล่า ${hunter.name} หมดเวลายิงปืน`);
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

  _resolveNight(room) {
    const deaths = [];
    const { wolfTargetId, wolfTargetIds, protectedIds, witchHealed, witchPoisonIds } = room.night;
    const targets = wolfTargetIds?.length ? wolfTargetIds : wolfTargetId ? [wolfTargetId] : [];

    for (const tid of targets) {
      if (protectedIds.includes(tid)) continue;
      if (witchHealed && tid === wolfTargetId) continue;
      const victim = room.players.find((p) => p.id === tid && p.alive && !p.isModerator);
      if (victim) {
        victim.alive = false;
        victim.deathCause = 'werewolf';
        deaths.push({ playerId: victim.id, name: victim.name, avatar: victim.avatar, cause: 'werewolf' });
      }
    }

    for (const pid of witchPoisonIds) {
      const victim = room.players.find((p) => p.id === pid && p.alive && !p.isModerator);
      if (victim) {
        victim.alive = false;
        victim.deathCause = 'poison';
        deaths.push({ playerId: victim.id, name: victim.name, avatar: victim.avatar, cause: 'poison' });
        if (victim.role === 'wolf_cub') {
          room.wolfDoubleKillNextNight = true;
          this._addLog(room, 'ลูกมนุษย์หมาป่าเสียชีวิต! คืนถัดไปฝูงมนุษย์หมาป่าจะล่าได้ 2 คน');
        }
      }
    }

    room.lastDawnSummary = { dayNumber: room.dayNumber, deaths };

    if (deaths.length === 0) {
      this._addLog(room, `เช้าวันที่ ${room.dayNumber}: เมื่อคืนไม่มีใครเสียชีวิต`);
    } else {
      this._addLog(room, `เช้าวันที่ ${room.dayNumber}: พบผู้เสียชีวิตคือ ${deaths.map((d) => d.name).join(', ')}`);
    }

    room.pendingHunterQueue = deaths
      .map((d) => room.players.find((p) => p.id === d.playerId))
      .filter((p) => p && p.role === 'hunter')
      .map((p) => p.id);

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
    let eliminated = null;
    let reason = 'no_votes';

    if (entries.length > 0) {
      const [topId, topCount] = entries[0];
      const tied = entries.filter((e) => e[1] === topCount).length > 1;
      if (tied || topCount <= skipVotes) {
        reason = tied ? 'tie' : 'skip';
      } else {
        eliminated = room.players.find((p) => p.id === topId && p.alive && !p.isModerator);
        if (eliminated) {
          eliminated.alive = false;
          eliminated.deathCause = 'vote';
          reason = 'eliminated';
        }
      }
    } else if (skipVotes > 0) {
      reason = 'skip';
    }

    room.lastVoteSummary = {
      reason,
      eliminatedId: eliminated ? eliminated.id : null,
      eliminatedName: eliminated ? eliminated.name : null,
      eliminatedRole: eliminated ? eliminated.role : null,
      tally,
      skipVotes,
    };

    if (eliminated) {
      this._addLog(room, `มติหมู่บ้านโหวต ${eliminated.name} ออกจากหมู่บ้าน`);
    } else if (reason === 'tie') {
      this._addLog(room, `คะแนนโหวตเสมอกัน วันนี้ไม่มีใครถูกโหวตออก`);
    } else {
      this._addLog(room, `หมู่บ้านงดออกเสียง วันนี้ไม่มีใครถูกโหวตออก`);
    }

    // Official Ultimate Werewolf: Tanner wins alone immediately if eliminated by Day Vote!
    if (eliminated && eliminated.role === 'tanner') {
      room.winner = 'tanner';
      room.winnerPlayerName = eliminated.name;
      this._addLog(room, `คนคลั่ง ${eliminated.name} ถูกโหวตออกและชนะเกมคนเดียวทันที!`);
      this._enterPhase(room, 'game_over', null);
      return;
    }

    // Official Ultimate Werewolf: Wolf Cub death triggers Double Kill next night!
    if (eliminated && eliminated.role === 'wolf_cub') {
      room.wolfDoubleKillNextNight = true;
      this._addLog(room, 'ลูกมนุษย์หมาป่าเสียชีวิต! คืนถัดไปฝูงมนุษย์หมาป่าจะล่าได้ 2 คน');
    }

    if (eliminated && eliminated.role === 'hunter') {
      room.pendingHunterQueue = [eliminated.id];
      room.hunterNextPhase = 'night';
      if (this._checkWinCondition(room)) return;
      this._enterPhase(room, 'hunter_revenge', room.settings.hunterSeconds);
      return;
    }

    if (this._checkWinCondition(room)) return;

    this._startNight(room);
  }

  _checkWinCondition(room) {
    const alive = room.players.filter((p) => p.alive && !p.isModerator);
    const aliveWolves = alive.filter((p) => isPackWolf(p.role));
    const aliveNonWolves = alive.filter((p) => !isPackWolf(p.role));

    if (aliveWolves.length === 0) {
      room.winner = 'village';
      this._addLog(room, 'ฝ่ายชาวบ้านเป็นฝ่ายชนะ! มนุษย์หมาป่าทั้งหมดถูกกำจัดแล้ว');
      this._enterPhase(room, 'game_over', null);
      return true;
    }

    if (aliveWolves.length >= aliveNonWolves.length) {
      room.winner = 'werewolf';
      this._addLog(room, 'ฝ่ายมนุษย์หมาป่าเป็นฝ่ายชนะ! หมู่บ้านตกอยู่ใต้อำนาจของฝูงหมาป่าแล้ว');
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
    const isViewerMod = Boolean(viewer?.isModerator);
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

    const players = room.players.map((p) => {
      const revealRole =
        isGameOver ||
        isViewerMod ||
        p.id === viewerId ||
        ((isViewerPackWolf || isViewerMinion) && isPackWolf(p.role)) ||
        (isViewerDead && room.phase !== 'lobby');

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
      wolfVotes: isViewerPackWolf || isViewerMod || isViewerDead || isGameOver ? room.night.wolfVotes : {},
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
    };

    const chat = {
      village: room.chat.village,
      wolf: isViewerPackWolf || isViewerMod || isViewerDead || isGameOver ? room.chat.wolf : [],
      ghost: isViewerDead || isViewerMod || isGameOver ? room.chat.ghost : [],
    };

    return {
      code: room.code,
      hostId: room.hostId,
      myId: viewerId,
      phase: room.phase,
      phaseEndsAt: room.phaseEndsAt,
      serverNow: Date.now(),
      dayNumber: room.dayNumber,
      players,
      settings: room.settings,
      dayVotes: room.phase === 'day_vote' ? room.dayVotes : {},
      dayReadyIds: Array.from(room.dayReadySet),
      activeHunterId: room.phase === 'hunter_revenge' ? room.pendingHunterQueue[0] || null : null,
      lastDawnSummary: room.lastDawnSummary,
      lastVoteSummary: room.lastVoteSummary,
      winner: room.winner,
      winnerPlayerName: room.winnerPlayerName,
      privateData,
      chat,
      logs: room.logs,
      rolesCatalog: ROLES,
    };
  }

  broadcastRoomState(room) {
    for (const p of room.players) {
      if (p.isBot || !p.socketId) continue;
      this.io.to(p.socketId).emit('room_state', this.getPlayerView(room, p.id));
    }
  }
}
