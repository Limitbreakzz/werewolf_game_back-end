export const ROLES = {
  werewolf: {
    id: 'werewolf',
    nameTh: 'หมาป่า',
    nameEn: 'Werewolf',
    team: 'werewolf',
    icon: 'werewolf',
    color: '#C83232',
    shortDesc: 'ล่าชาวบ้านในตอนกลางคืน',
    description:
      'ทุกคืนร่วมกับฝูงหมาป่าเลือกเหยื่อ 1 คนเพื่อกำจัด ในตอนกลางวันต้องแฝงตัวและหลอกล่อชาวบ้านไม่ให้จับได้',
  },
  villager: {
    id: 'villager',
    nameTh: 'ชาวบ้าน',
    nameEn: 'Villager',
    team: 'village',
    icon: 'villager',
    color: '#A5A095',
    shortDesc: 'จับผิดและโหวตหมาป่าออก',
    description:
      'ไม่มีความสามารถพิเศษในตอนกลางคืน ใช้การสังเกต คำพูด และตรรกะในตอนกลางวันเพื่อค้นหาและโหวตหมาป่าออกจากหมู่บ้าน',
  },
  seer: {
    id: 'seer',
    nameTh: 'เทพพยากรณ์',
    nameEn: 'Seer',
    team: 'village',
    icon: 'seer',
    color: '#A87CE8',
    shortDesc: 'ส่องฝ่ายของผู้เล่นทุกคืน',
    description:
      'ในแต่ละคืนสามารถเลือกส่องผู้เล่น 1 คน เพื่อรู้ความจริงว่าคนนั้นเป็นฝ่ายหมาป่าหรือฝ่ายชาวบ้าน',
  },
  doctor: {
    id: 'doctor',
    nameTh: 'หมอ / บอดี้การ์ด',
    nameEn: 'Doctor',
    team: 'village',
    icon: 'doctor',
    color: '#4DA6D6',
    shortDesc: 'ปกป้องผู้เล่น 1 คนทุกคืน',
    description:
      'ในแต่ละคืนเลือกปกป้องผู้เล่น 1 คน (รวมถึงตัวเองได้) จากการโจมตีของหมาป่า ห้ามปกป้องคนเดิมซ้ำ 2 คืนติดต่อกัน',
  },
  witch: {
    id: 'witch',
    nameTh: 'แม่มด',
    nameEn: 'Witch',
    team: 'village',
    icon: 'witch',
    color: '#2E9E72',
    shortDesc: 'มียาชุบชีวิตและยาพิษอย่างละ 1 ขวด',
    description:
      'มียาชุบชีวิต 1 ขวด (เห็นว่าใครถูกหมาป่าโจมตีคืนนี้และช่วยได้) และยาพิษ 1 ขวด (กำจัดผู้เล่น 1 คนได้ทันที) ใช้ได้ขวดละ 1 ครั้งต่อเกม',
  },
  hunter: {
    id: 'hunter',
    nameTh: 'นักล่า',
    nameEn: 'Hunter',
    team: 'village',
    icon: 'hunter',
    color: '#D6A354',
    shortDesc: 'ยิงผู้เล่น 1 คนตามไปเมื่อตาย',
    description:
      'หากคุณถูกกำจัดไม่ว่าจะจากหมาป่า แม่มด หรือถูกโหวตออกตอนกลางวัน คุณสามารถเลือกยิงผู้เล่น 1 คนให้ตายตามไปได้ทันที',
  },
};

export const ROLE_ORDER = ['werewolf', 'seer', 'doctor', 'witch', 'hunter', 'villager'];

export function getDefaultRoleConfig(playerCount) {
  const n = Math.max(4, Math.min(16, playerCount));
  let werewolf = 1;
  if (n >= 6 && n <= 8) werewolf = 2;
  else if (n >= 9 && n <= 12) werewolf = 3;
  else if (n >= 13) werewolf = 4;

  const seer = 1;
  const doctor = 1;
  const witch = n >= 6 ? 1 : 0;
  const hunter = n >= 5 && n !== 6 ? 1 : 0;
  const used = werewolf + seer + doctor + witch + hunter;
  const villager = Math.max(0, n - used);

  return { werewolf, seer, doctor, witch, hunter, villager };
}

export function buildRoleDeck(playerCount, customConfig = null) {
  const config = customConfig ? { ...customConfig } : getDefaultRoleConfig(playerCount);
  const deck = [];

  for (const roleId of ROLE_ORDER) {
    const count = Math.max(0, Math.floor(Number(config[roleId]) || 0));
    for (let i = 0; i < count; i++) {
      deck.push(roleId);
    }
  }

  // Ensure exact playerCount
  while (deck.length < playerCount) {
    deck.push('villager');
  }
  while (deck.length > playerCount) {
    // Prefer removing villagers first
    const vIdx = deck.lastIndexOf('villager');
    if (vIdx !== -1) deck.splice(vIdx, 1);
    else deck.pop();
  }

  // Ensure at least 1 werewolf
  if (!deck.includes('werewolf') && deck.length > 0) {
    deck[0] = 'werewolf';
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}
