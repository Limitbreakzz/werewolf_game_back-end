import { CHAT_LINES, pickRandom, formatLine } from './botNames.js';
import { isPackWolf } from './roles.js';

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function clearBotTimers(room) {
  for (const t of room.botTimers) clearTimeout(t);
  room.botTimers = [];
}

function addBotTimer(room, fn, delayMs) {
  const timer = setTimeout(() => {
    room.botTimers = room.botTimers.filter((t) => t !== timer);
    fn();
  }, delayMs);
  room.botTimers.push(timer);
}

export function scheduleBotNightActions(room, engine) {
  if (room.phase !== 'night' || !room.nightStep) return;
  const alivePlayers = room.players.filter((p) => p.alive && !p.isModerator);
  const aliveBots = alivePlayers.filter((p) => p.isBot);
  if (aliveBots.length === 0) return;

  const step = room.nightStep;

  if (step === 'werewolf') {
    const wolfBots = aliveBots.filter((p) => isPackWolf(p.role));
    const nonWolves = alivePlayers.filter((p) => !isPackWolf(p.role));
    if (wolfBots.length > 0 && nonWolves.length > 0) {
      let preferred = nonWolves.find((p) => p.id === room.aiMemory.claimedSeerId);
      if (!preferred) preferred = pickRandom(nonWolves);

      wolfBots.forEach((bot, idx) => {
        addBotTimer(room, () => {
          if (room.phase !== 'night' || room.nightStep !== 'werewolf' || !bot.alive) return;
          const existingVotes = Object.values(room.night.wolfVotes);
          const targetId = existingVotes.length > 0 ? existingVotes[0] : preferred.id;

          if (idx === 0 && Math.random() < 0.6) {
            const tPlayer = room.players.find((p) => p.id === targetId);
            if (tPlayer) {
              const msg = formatLine(pickRandom(CHAT_LINES.wolfChat), { target: tPlayer.name });
              engine.handleChat(room.code, bot.id, 'wolf', msg);
            }
          }
          engine.handleNightAction(room.code, bot.id, { type: 'wolf_vote', targetId });
        }, randInt(1400, 3200) + idx * 600);
      });
    }
  } else if (step === 'sorcerer') {
    const sorcBots = aliveBots.filter((p) => p.role === 'sorcerer');
    for (const bot of sorcBots) {
      addBotTimer(room, () => {
        if (room.phase !== 'night' || room.nightStep !== 'sorcerer' || !bot.alive) return;
        const known = room.sorcererResults?.[bot.id] || {};
        const candidates = alivePlayers.filter((p) => p.id !== bot.id && known[p.id] === undefined);
        const pool = candidates.length > 0 ? candidates : alivePlayers.filter((p) => p.id !== bot.id);
        if (pool.length === 0) return;
        engine.handleNightAction(room.code, bot.id, { type: 'sorcerer_inspect', targetId: pickRandom(pool).id });
      }, randInt(1400, 2800));
    }
  } else if (step === 'seer') {
    const seerBots = aliveBots.filter((p) => p.role === 'seer');
    for (const bot of seerBots) {
      addBotTimer(room, () => {
        if (room.phase !== 'night' || room.nightStep !== 'seer' || !bot.alive) return;
        const known = room.seerResults[bot.id] || {};
        const candidates = alivePlayers.filter((p) => p.id !== bot.id && !known[p.id]);
        const pool = candidates.length > 0 ? candidates : alivePlayers.filter((p) => p.id !== bot.id);
        if (pool.length === 0) return;
        engine.handleNightAction(room.code, bot.id, { type: 'seer_inspect', targetId: pickRandom(pool).id });
      }, randInt(1500, 3000));
    }
  } else if (step === 'doctor') {
    const doctorBots = aliveBots.filter((p) => p.role === 'doctor');
    for (const bot of doctorBots) {
      addBotTimer(room, () => {
        if (room.phase !== 'night' || room.nightStep !== 'doctor' || !bot.alive) return;
        const lastProtected = room.doctorLastProtected[bot.id];
        let candidates = alivePlayers.filter((p) => p.id !== lastProtected);
        if (candidates.length === 0) candidates = alivePlayers;
        let target = candidates.find((p) => p.id === room.aiMemory.claimedSeerId);
        if (!target) {
          target = Math.random() < 0.25 && candidates.some((p) => p.id === bot.id) ? bot : pickRandom(candidates);
        }
        engine.handleNightAction(room.code, bot.id, { type: 'doctor_protect', targetId: target.id });
      }, randInt(1400, 2800));
    }
  } else if (step === 'witch') {
    const witchBots = aliveBots.filter((p) => p.role === 'witch');
    for (const bot of witchBots) {
      addBotTimer(room, () => {
        if (room.phase !== 'night' || room.nightStep !== 'witch' || !bot.alive) return;
        const state = room.witchState[bot.id];
        if (!state) return;

        let heal = false;
        let poisonTargetId = null;
        const attackedId = room.night.wolfTargetId;
        const wasProtected = attackedId && room.night.protectedIds.includes(attackedId);

        if (
          state.hasHeal &&
          attackedId &&
          !wasProtected &&
          (attackedId === bot.id || room.dayNumber === 1 || Math.random() < 0.6)
        ) {
          heal = true;
        }

        if (state.hasPoison && room.dayNumber >= 2) {
          const exposedWolfId = room.aiMemory.exposedWolfIds.find((id) => {
            const p = room.players.find((pl) => pl.id === id);
            return p && p.alive && !p.isModerator && p.id !== bot.id;
          });
          if (exposedWolfId) {
            poisonTargetId = exposedWolfId;
          } else if (Math.random() < 0.35) {
            const others = alivePlayers.filter((p) => p.id !== bot.id && p.id !== attackedId);
            if (others.length > 0) poisonTargetId = pickRandom(others).id;
          }
        }

        engine.handleNightAction(room.code, bot.id, { type: 'witch_action', heal, poisonTargetId });
      }, randInt(1600, 3200));
    }
  }
}

export function scheduleBotDayChat(room, engine) {
  const alivePlayers = room.players.filter((p) => p.alive && !p.isModerator);
  const aliveBots = alivePlayers.filter((p) => p.isBot);
  if (aliveBots.length === 0) return;

  const seerBots = aliveBots.filter((p) => p.role === 'seer');
  for (const seer of seerBots) {
    const results = room.seerResults[seer.id] || {};
    const foundWolfId = Object.keys(results).find((pid) => {
      const p = room.players.find((pl) => pl.id === pid);
      return results[pid] === 'werewolf' && p && p.alive;
    });
    if (foundWolfId) {
      const wolfPlayer = room.players.find((p) => p.id === foundWolfId);
      addBotTimer(room, () => {
        if (room.phase !== 'day_discuss' || !seer.alive) return;
        room.aiMemory.claimedSeerId = seer.id;
        if (!room.aiMemory.exposedWolfIds.includes(foundWolfId)) {
          room.aiMemory.exposedWolfIds.push(foundWolfId);
        }
        const msg = formatLine(pickRandom(CHAT_LINES.seerRevealWolf), { target: wolfPlayer.name });
        engine.handleChat(room.code, seer.id, 'village', msg);
      }, randInt(2500, 5000));
    }
  }

  const shuffledBots = [...aliveBots].sort(() => Math.random() - 0.5);
  const speakers = shuffledBots.slice(0, Math.min(shuffledBots.length, randInt(2, 4)));

  speakers.forEach((bot, idx) => {
    addBotTimer(room, () => {
      if (room.phase !== 'day_discuss' || !bot.alive) return;
      const others = alivePlayers.filter((p) => p.id !== bot.id);
      if (others.length === 0) return;

      let msg = '';
      if (idx === 0 && room.lastDawnSummary) {
        if (room.lastDawnSummary.deaths.length === 0) {
          msg = pickRandom(CHAT_LINES.peacefulMorning);
        } else {
          const victim = room.players.find((p) => p.id === room.lastDawnSummary.deaths[0].playerId);
          if (victim) msg = formatLine(pickRandom(CHAT_LINES.deathMorning), { victim: victim.name });
        }
      }

      if (!msg) {
        if (bot.role === 'werewolf') {
          const nonWolves = others.filter((p) => p.role !== 'werewolf');
          const target = nonWolves.length > 0 ? pickRandom(nonWolves) : pickRandom(others);
          msg = formatLine(pickRandom(CHAT_LINES.wolfDeflect), { target: target.name });
        } else {
          const exposedId = room.aiMemory.exposedWolfIds.find((id) =>
            alivePlayers.some((p) => p.id === id && p.id !== bot.id)
          );
          const target = exposedId ? alivePlayers.find((p) => p.id === exposedId) : pickRandom(others);
          msg = formatLine(pickRandom(CHAT_LINES.suspectGeneral), { target: target.name });
        }
      }

      engine.handleChat(room.code, bot.id, 'village', msg);
    }, randInt(2000, 4800) + idx * randInt(3200, 5500));
  });
}

export function scheduleBotVotes(room, engine) {
  const alivePlayers = room.players.filter((p) => p.alive && !p.isModerator);
  const aliveBots = alivePlayers.filter((p) => p.isBot);

  aliveBots.forEach((bot, idx) => {
    addBotTimer(room, () => {
      if (room.phase !== 'day_vote' || !bot.alive) return;
      const others = alivePlayers.filter((p) => p.id !== bot.id);
      if (others.length === 0) return;

      let targetId = 'skip';
      if (isPackWolf(bot.role) || bot.role === 'minion' || bot.role === 'sorcerer') {
        const nonWolves = others.filter((p) => !isPackWolf(p.role));
        if (nonWolves.length > 0) {
          const seerClaim = nonWolves.find((p) => p.id === room.aiMemory.claimedSeerId);
          targetId = seerClaim ? seerClaim.id : pickRandom(nonWolves).id;
        }
      } else {
        const mySeer = room.seerResults[bot.id] || {};
        const myKnownWolf = others.find((p) => mySeer[p.id] === 'werewolf');
        const exposedWolf = others.find((p) => room.aiMemory.exposedWolfIds.includes(p.id));
        if (myKnownWolf) targetId = myKnownWolf.id;
        else if (exposedWolf && Math.random() < 0.85) targetId = exposedWolf.id;
        else if (Math.random() < 0.15) targetId = 'skip';
        else {
          const suspects = others.filter((p) => mySeer[p.id] !== 'village');
          targetId = pickRandom(suspects.length > 0 ? suspects : others).id;
        }
      }

      engine.handleDayVote(room.code, bot.id, targetId);
    }, randInt(1400, 5500) + idx * 400);
  });
}

export function scheduleBotDefense(room, engine) {
  const accused = room.players.find((p) => p.id === room.accusedId);
  if (!accused || !accused.isBot) return;

  addBotTimer(room, () => {
    if (room.phase !== 'day_defense' || room.accusedId !== accused.id) return;
    engine.handleChat(room.code, accused.id, 'village', pickRandom(CHAT_LINES.defendSelf));
  }, randInt(1600, 3200));

  // If the accused is a bot and not manual_mod, auto-finish defense after ~6s so solo players don't wait 30s
  if (room.settings.controlMode !== 'manual_mod') {
    addBotTimer(room, () => {
      if (room.phase === 'day_defense' && room.accusedId === accused.id) {
        engine.handleEndDefense(room.code, accused.id);
      }
    }, 6000);
  }
}

export function scheduleBotVerdict(room, engine) {
  const aliveBots = room.players.filter(
    (p) => p.alive && !p.isModerator && p.isBot && p.id !== room.accusedId
  );
  const accused = room.players.find((p) => p.id === room.accusedId);
  if (!accused) return;

  aliveBots.forEach((bot, idx) => {
    addBotTimer(room, () => {
      if (room.phase !== 'day_verdict' || !bot.alive) return;
      let choice = 'execute';
      if (isPackWolf(bot.role) && isPackWolf(accused.role)) {
        // Pack wolves try to spare their wolf teammate!
        choice = 'spare';
      } else if (room.seerResults?.[bot.id]?.[accused.id] === 'village') {
        // Seer knows accused is innocent -> spare!
        choice = 'spare';
      } else if (Math.random() < 0.3) {
        choice = 'spare';
      }
      engine.handleVerdictVote(room.code, bot.id, choice);
    }, randInt(1200, 4200) + idx * 350);
  });
}

export function scheduleBotHunterShot(room, engine) {
  const hunterId = room.pendingHunterQueue[0];
  if (!hunterId) return;
  const hunter = room.players.find((p) => p.id === hunterId);
  if (!hunter || !hunter.isBot) return;

  addBotTimer(room, () => {
    if (room.phase !== 'hunter_revenge' || room.pendingHunterQueue[0] !== hunterId) return;
    const aliveTargets = room.players.filter((p) => p.alive && !p.isModerator && p.id !== hunterId);
    if (aliveTargets.length === 0) return;
    const exposed = aliveTargets.find((p) => room.aiMemory.exposedWolfIds.includes(p.id));
    engine.handleHunterShoot(room.code, hunterId, (exposed || pickRandom(aliveTargets)).id);
  }, randInt(2200, 4000));
}
