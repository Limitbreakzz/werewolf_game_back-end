export const ROLES = {
  werewolf: {
    id: 'werewolf',
    nameTh: 'มนุษย์หมาป่า',
    nameEn: 'Werewolf',
    team: 'werewolf',
    points: -6,
    icon: 'werewolf',
    color: '#C83232',
    shortDesc: 'ล่าชาวบ้านในตอนกลางคืน',
    description:
      'ทุกคืนร่วมกับฝูงมนุษย์หมาป่าเลือกเหยื่อ 1 คนเพื่อกำจัด ในตอนกลางวันต้องแฝงตัวและหลอกล่อชาวบ้านไม่ให้จับได้',
  },
  wolf_cub: {
    id: 'wolf_cub',
    nameTh: 'ลูกมนุษย์หมาป่า',
    nameEn: 'Wolf Cub',
    team: 'werewolf',
    points: -8,
    icon: 'wolf_cub',
    color: '#D94646',
    shortDesc: 'หากตาย คืนถัดไปหมาป่าล่าได้ 2 คน',
    description:
      'ตื่นพร้อมฝูงมนุษย์หมาป่าทุกคืน หากลูกมนุษย์หมาป่าถูกกำจัด ฝูงมนุษย์หมาป่าจะโกรธแค้นและสามารถเลือกกำจัดเหยื่อได้ถึง 2 คนในคืนถัดไป',
  },
  minion: {
    id: 'minion',
    nameTh: 'สมุนหมาป่า',
    nameEn: 'Minion',
    team: 'werewolf',
    points: -6,
    icon: 'minion',
    color: '#B84A4A',
    shortDesc: 'รู้ตัวหมาป่าแต่ไม่ตื่นล่า ช่วยปั่นชาวบ้าน',
    description:
      'เป็นมนุษย์ที่อยู่ฝ่ายมนุษย์หมาป่า รู้ว่าใครคือมนุษย์หมาป่าตั้งแต่เริ่มเกม แต่ไม่ตื่นไปล่าเหยื่อ (เทพพยากรณ์ส่องจะเห็นเป็นฝ่ายชาวบ้าน) ชนะเมื่อฝ่ายมนุษย์หมาป่าชนะ',
  },
  sorcerer: {
    id: 'sorcerer',
    nameTh: 'จอมเวทมืด',
    nameEn: 'Sorcerer',
    team: 'werewolf',
    points: -3,
    icon: 'sorcerer',
    color: '#9333EA',
    shortDesc: 'ส่องหาเทพพยากรณ์ให้ฝ่ายหมาป่าทุกคืน',
    description:
      'เป็นมนุษย์ที่อยู่ฝ่ายมนุษย์หมาป่า ทุกคืนสามารถเลือกตรวจสอบผู้เล่น 1 คนเพื่อหาว่าคนนั้นคือ "เทพพยากรณ์" หรือไม่ (เทพพยากรณ์ส่องจะเห็นเป็นฝ่ายชาวบ้าน)',
  },
  seer: {
    id: 'seer',
    nameTh: 'เทพพยากรณ์',
    nameEn: 'Seer',
    team: 'village',
    points: 7,
    icon: 'seer',
    color: '#A87CE8',
    shortDesc: 'ตรวจสอบฝ่ายของผู้เล่นทุกคืน',
    description:
      'ในแต่ละคืนสามารถเลือกตรวจสอบผู้เล่น 1 คน เพื่อรู้ความจริงว่าคนนั้นเป็นฝ่ายมนุษย์หมาป่าหรือฝ่ายชาวบ้าน',
  },
  doctor: {
    id: 'doctor',
    nameTh: 'บอดี้การ์ด',
    nameEn: 'Bodyguard',
    team: 'village',
    points: 3,
    icon: 'doctor',
    color: '#4DA6D6',
    shortDesc: 'ปกป้องผู้เล่น 1 คนทุกคืน',
    description:
      'ในแต่ละคืนเลือกปกป้องผู้เล่น 1 คน (รวมถึงตัวเองได้) จากการโจมตีของมนุษย์หมาป่า ห้ามปกป้องคนเดิมซ้ำ 2 คืนติดต่อกัน',
  },
  witch: {
    id: 'witch',
    nameTh: 'แม่มด',
    nameEn: 'Witch',
    team: 'village',
    points: 4,
    icon: 'witch',
    color: '#2E9E72',
    shortDesc: 'มียาชุบชีวิตและยาพิษอย่างละ 1 ขวด',
    description:
      'มียาชุบชีวิต 1 ขวด (เห็นว่าใครถูกมนุษย์หมาป่าโจมตีคืนนี้และช่วยได้) และยาพิษ 1 ขวด (กำจัดผู้เล่น 1 คนได้ทันที) ใช้ได้ขวดละ 1 ครั้งต่อเกม',
  },
  hunter: {
    id: 'hunter',
    nameTh: 'นายพราน',
    nameEn: 'Hunter',
    team: 'village',
    points: 3,
    icon: 'hunter',
    color: '#D6A354',
    shortDesc: 'ยิงผู้เล่น 1 คนตามไปเมื่อตาย',
    description:
      'หากคุณถูกกำจัดไม่ว่าจะจากมนุษย์หมาป่า แม่มด หรือถูกโหวตออกตอนกลางวัน คุณสามารถเลือกยิงผู้เล่น 1 คนให้ตายตามไปได้ทันที',
  },
  mayor: {
    id: 'mayor',
    nameTh: 'นายกเทศมนตรี',
    nameEn: 'Mayor',
    team: 'village',
    points: 2,
    icon: 'mayor',
    color: '#E0B45A',
    shortDesc: 'คะแนนโหวตตอนกลางวันนับเป็น 2 เสียง',
    description:
      'ผู้นำหมู่บ้าน ไม่มีพลังตอนกลางคืน แต่คะแนนโหวตประหารในตอนกลางวันของนายกเทศมนตรีจะมีค่าเท่ากับ 2 คะแนน',
  },
  lycan: {
    id: 'lycan',
    nameTh: 'ไลแคน',
    nameEn: 'Lycan',
    team: 'village',
    points: -1,
    icon: 'lycan',
    color: '#8C9AB0',
    shortDesc: 'อยู่ฝ่ายชาวบ้าน แต่เทพพยากรณ์ส่องเห็นเป็นหมาป่า',
    description:
      'เป็นชาวบ้านที่ต้องคำสาป อยู่ฝ่ายชาวบ้านและชนะพร้อมชาวบ้าน แต่หากถูกเทพพยากรณ์ตรวจสอบ จะปรากฏผลเป็น "ฝ่ายมนุษย์หมาป่า"',
  },
  villager: {
    id: 'villager',
    nameTh: 'ชาวบ้าน',
    nameEn: 'Villager',
    team: 'village',
    points: 1,
    icon: 'villager',
    color: '#A5A095',
    shortDesc: 'จับผิดและโหวตหมาป่าออก',
    description:
      'ไม่มีความสามารถพิเศษในตอนกลางคืน ใช้การสังเกต คำพูด และตรรกะในตอนกลางวันเพื่อค้นหาและโหวตมนุษย์หมาป่าออกจากหมู่บ้าน',
  },
  tanner: {
    id: 'tanner',
    nameTh: 'คนคลั่ง',
    nameEn: 'Tanner',
    team: 'independent',
    points: 0,
    icon: 'tanner',
    color: '#D97742',
    shortDesc: 'ฝ่ายอิสระ ชนะคนเดียวทันทีหากถูกโหวตออกตอนกลางวัน',
    description:
      'ฝ่ายอิสระ (Third Party) เป้าหมายเดียวคือหลอกให้ชาวบ้านโหวตประหารตัวเองตอนกลางวัน หากถูกโหวตออกจะชนะเกมทันทีคนเดียว (แต่ถ้าตายตอนกลางคืนจะแพ้)',
  },
};

export const ROLE_ORDER = [
  'werewolf',
  'wolf_cub',
  'minion',
  'sorcerer',
  'seer',
  'doctor',
  'witch',
  'hunter',
  'mayor',
  'lycan',
  'villager',
  'tanner',
];

export function isPackWolf(roleId) {
  return roleId === 'werewolf' || roleId === 'wolf_cub';
}

export function getDefaultRoleConfig(playerCount) {
  const n = Math.max(4, Math.min(16, playerCount));
  const cfg = {
    werewolf: 1,
    wolf_cub: 0,
    minion: 0,
    sorcerer: 0,
    seer: 1,
    doctor: 1,
    witch: 0,
    hunter: 0,
    mayor: 0,
    lycan: 0,
    villager: 0,
    tanner: 0,
  };

  if (n >= 6 && n <= 8) cfg.werewolf = 2;
  else if (n >= 9 && n <= 12) {
    cfg.werewolf = 2;
    cfg.wolf_cub = 1;
  } else if (n >= 13) {
    cfg.werewolf = 3;
    cfg.wolf_cub = 1;
  }

  if (n >= 6) cfg.witch = 1;
  if (n >= 5 && n !== 6) cfg.hunter = 1;
  if (n >= 8) cfg.mayor = 1;
  if (n >= 9) cfg.tanner = 1;
  if (n >= 10) cfg.minion = 1;
  if (n >= 11) cfg.lycan = 1;
  if (n >= 12) cfg.sorcerer = 1;

  const used = Object.values(cfg).reduce((a, b) => a + b, 0);
  cfg.villager = Math.max(0, n - used);
  return cfg;
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

  while (deck.length < playerCount) {
    deck.push('villager');
  }
  while (deck.length > playerCount) {
    const vIdx = deck.lastIndexOf('villager');
    if (vIdx !== -1) deck.splice(vIdx, 1);
    else deck.pop();
  }

  if (!deck.some((r) => isPackWolf(r)) && deck.length > 0) {
    deck[0] = 'werewolf';
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}
