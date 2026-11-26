export const ROLES = {
  // === ฝ่ายมนุษย์หมาป่า (Werewolf Team — 7 roles) ===
  werewolf: {
    id: 'werewolf',
    nameTh: 'มนุษย์หมาป่า',
    nameEn: 'Werewolf',
    team: 'werewolf',
    category: 'werewolf',
    color: '#C83232',
    shortDesc: 'ตื่นร่วมกับฝูงหมาป่าทุกคืนเพื่อเลือกเหยื่อ 1 คน',
    description:
      'ทุกคืนตื่นขึ้นมาพร้อมกับฝูงมนุษย์หมาป่าเพื่อเลือกกำจัดผู้เล่น 1 คน และแฝงตัวในหมู่บ้านตอนกลางวัน',
  },
  lone_wolf: {
    id: 'lone_wolf',
    nameTh: 'มนุษย์หมาป่าเดียวดาย',
    nameEn: 'Lone Wolf',
    team: 'werewolf',
    category: 'werewolf',
    color: '#B91C1C',
    shortDesc: 'ตื่นกับฝูงหมาป่า แต่ชนะเฉพาะเมื่อรอดคนสุดท้ายคนเดียว',
    description:
      'ตื่นพร้อมกับฝูงมนุษย์หมาป่าทุกคืน แต่เงื่อนไขชนะของคุณคือต้องเหลือรอดอยู่ในเกมเป็นคนสุดท้ายเพียงคนเดียวเท่านั้น',
  },
  wolf_cub: {
    id: 'wolf_cub',
    nameTh: 'ลูกมนุษย์หมาป่า',
    nameEn: 'Wolf Cub',
    team: 'werewolf',
    category: 'werewolf',
    color: '#D94646',
    shortDesc: 'หากตาย คืนถัดไปฝูงหมาป่าล่าได้ 2 คน',
    description:
      'ตื่นพร้อมฝูงมนุษย์หมาป่าทุกคืน หากลูกมนุษย์หมาป่าถูกกำจัด คืนถัดไปฝูงหมาป่าจะเลือกกำจัดผู้เล่นได้ถึง 2 คน',
  },
  minion: {
    id: 'minion',
    nameTh: 'สมุนรับใช้',
    nameEn: 'Minion',
    team: 'werewolf',
    category: 'werewolf',
    color: '#B84A4A',
    shortDesc: 'รู้ตัวหมาป่าแต่ไม่ตื่นล่า ส่องเห็นเป็นคนดี',
    description:
      'อยู่ฝ่ายมนุษย์หมาป่า รู้ว่าใครคือหมาป่าตั้งแต่เริ่มเกมแต่ไม่ตื่นล่าตอนกลางคืน (เทพพยากรณ์ส่องเห็นเป็นคนดี)',
  },
  sorcerer: {
    id: 'sorcerer',
    nameTh: 'นางปีศาจ',
    nameEn: 'Sorcerer',
    team: 'werewolf',
    category: 'werewolf',
    color: '#9333EA',
    shortDesc: 'ส่องหาว่าใครคือเทพพยากรณ์ทุกคืน (ฝ่ายหมาป่า)',
    description:
      'อยู่ฝ่ายมนุษย์หมาป่า ทุกคืนเลือกตรวจสอบผู้เล่น 1 คนเพื่อหาว่าใครคือเทพพยากรณ์ (เทพพยากรณ์ส่องเห็นเป็นคนดี)',
  },
  hoodlum: {
    id: 'hoodlum',
    nameTh: 'อันธพาล',
    nameEn: 'Hoodlum',
    team: 'werewolf',
    category: 'werewolf',
    color: '#991B1B',
    shortDesc: 'คืนแรกเลือก 2 คน ชนะหากรอดจนจบและ 2 คนนั้นตายแล้ว',
    description:
      'ในคืนแรกเลือกผู้เล่น 2 คนเป็นเป้าหมาย คุณจะชนะเกมก็ต่อเมื่อคุณยังรอดชีวิตจนจบเกมและเป้าหมายทั้ง 2 คนถูกกำจัดไปแล้ว',
  },
  cursed: {
    id: 'cursed',
    nameTh: 'ผู้ต้องคำสาป',
    nameEn: 'Cursed',
    team: 'village',
    category: 'werewolf',
    color: '#7F1D1D',
    shortDesc: 'เริ่มเป็นชาวบ้าน แต่ถ้าถูกหมาป่าฆ่าจะกลายเป็นหมาป่าแทน',
    description:
      'เริ่มเกมด้วยการอยู่ฝ่ายชาวบ้าน แต่หากถูกมนุษย์หมาป่าเลือกกำจัดตอนกลางคืน คุณจะไม่ตายและกลายเป็นมนุษย์หมาป่าทันที',
  },

  // === ฝ่ายมนุษย์ / ชาวบ้าน (Villager Team — 24 roles) ===
  villager: {
    id: 'villager',
    nameTh: 'ชาวบ้าน',
    nameEn: 'Villager',
    team: 'village',
    category: 'village',
    color: '#A5A095',
    shortDesc: 'ไม่มีพลังกลางคืน ช่วยจับผิดและโหวตหมาป่า',
    description:
      'ชาวบ้านธรรมดาไม่มีพลังพิเศษตอนกลางคืน ใช้การสังเกต คำพูด และตรรกะเพื่อจับผิดและกำจัดมนุษย์หมาป่า',
  },
  seer: {
    id: 'seer',
    nameTh: 'เทพพยากรณ์',
    nameEn: 'Seer',
    team: 'village',
    category: 'village',
    color: '#A87CE8',
    shortDesc: 'ส่องผู้เล่นคืนละ 1 คน รู้ว่าเป็นคนดีหรือคนไม่ดี',
    description:
      'ในแต่ละคืนเลือกตรวจสอบผู้เล่น 1 คนเพื่อรู้ว่าเป็นคนดีหรือคนไม่ดี (มนุษย์หมาป่า)',
  },
  spellcaster: {
    id: 'spellcaster',
    nameTh: 'จอมเวท',
    nameEn: 'Spellcaster',
    team: 'village',
    category: 'village',
    color: '#6366F1',
    shortDesc: 'กลางคืนใบ้ผู้เล่น 1 คน ห้ามพูด/แชทในวันถัดไป',
    description:
      'ในแต่ละคืนเลือกผู้เล่น 1 คนเพื่อร่ายเวทปิดปาก ห้ามพูดหรือพิมพ์แชทในวันถัดไป',
  },
  cupid: {
    id: 'cupid',
    nameTh: 'กามเทพ',
    nameEn: 'Cupid',
    team: 'village',
    category: 'village',
    color: '#EC4899',
    shortDesc: 'คืนแรกจับคู่ 2 คน หากคนหนึ่งตาย อีกคนตายตาม',
    description:
      'ในคืนแรกเลือกผู้เล่น 2 คนให้เป็นคู่รักกัน หากคนใดคนหนึ่งในคู่นั้นถูกกำจัด อีกคนจะเสียชีวิตตามไปด้วยทันที',
  },
  doctor: {
    id: 'doctor',
    nameTh: 'บอดี้การ์ด',
    nameEn: 'Bodyguard',
    team: 'village',
    category: 'village',
    color: '#4DA6D6',
    shortDesc: 'ปกป้องผู้เล่น 1 คนทุกคืน (ห้ามซ้ำคนเดิมติดกัน)',
    description:
      'ในแต่ละคืนเลือกปกป้องผู้เล่น 1 คนไม่ให้ถูกมนุษย์หมาป่ากำจัดในคืนนั้น (ห้ามเลือกตัวเองและห้ามปกป้องคนเดิม 2 คืนติดกัน)',
  },
  aura_seer: {
    id: 'aura_seer',
    nameTh: 'ญาณทิพย์',
    nameEn: 'Aura Seer',
    team: 'village',
    category: 'village',
    color: '#38BDF8',
    shortDesc: 'ส่อง 1 คนว่าเป็นบทบาทพิเศษหรือไม่',
    description:
      'ในแต่ละคืนตรวจสอบผู้เล่น 1 คนว่ามีพลังพิเศษหรือไม่ (ไม่ใช่ชาวบ้านธรรมดาและไม่ใช่มนุษย์หมาป่าธรรมดา)',
  },
  drunk: {
    id: 'drunk',
    nameTh: 'ขี้เมา',
    nameEn: 'Drunk',
    team: 'village',
    category: 'village',
    color: '#D97706',
    shortDesc: 'เป็นชาวบ้านจนจบคืนที่ 3 แล้วจึงรู้บทบาทที่แท้จริง',
    description:
      'คุณจะเล่นเป็นชาวบ้านธรรมดาจนกระทั่งหลังคืนที่ 3 จึงจะสร่างเมาและเปิดเผยบทบาทที่แท้จริงของคุณ',
  },
  prince: {
    id: 'prince',
    nameTh: 'เจ้าชาย',
    nameEn: 'Prince',
    team: 'village',
    category: 'village',
    color: '#F59E0B',
    shortDesc: 'หากถูกโหวตประหารตอนกลางวัน เผยตัวแล้วรอดทันที',
    description:
      'เมื่อถูกโหวตประหารในช่วงกลางวัน จะเปิดเผยบทบาทเจ้าชายและรอดชีวิตทันที (แต่หากถูกหมาป่าฆ่าตอนกลางคืนจะตายปกติ)',
  },
  priest: {
    id: 'priest',
    nameTh: 'นักบวช',
    nameEn: 'Priest',
    team: 'village',
    category: 'village',
    color: '#FBBF24',
    shortDesc: 'คุ้มครองผู้เล่น 1 คนให้รอดตายได้ 1 ครั้ง (1 ครั้ง/เกม)',
    description:
      'ในตอนกลางคืนเลือกอวยพรผู้เล่น 1 คนให้รอดพ้นจากการถูกกำจัดตอนกลางคืนได้ 1 ครั้ง (ใช้ได้ 1 ครั้งต่อเกม)',
  },
  pi: {
    id: 'pi',
    nameTh: 'นักสืบเรื่องลี้ลับ',
    nameEn: 'P.I.',
    team: 'village',
    category: 'village',
    color: '#0EA5E9',
    shortDesc: 'ตรวจเป้าหมายและคนข้างๆ ซ้าย-ขวาว่ามีหมาป่าไหม (1 ครั้ง/เกม)',
    description:
      'ในตอนกลางคืนเลือกชี้ผู้เล่น 1 คน เพื่อตรวจดูว่าคนนั้นและผู้เล่นที่นั่งติดกันซ้าย-ขวามีมนุษย์หมาป่าปะปนอยู่หรือไม่ (1 ครั้งต่อเกม)',
  },
  troublemaker: {
    id: 'troublemaker',
    nameTh: 'ตัวป่วน',
    nameEn: 'Troublemaker',
    team: 'village',
    category: 'village',
    color: '#F97316',
    shortDesc: 'ป่วนหมู่บ้านให้โหวตประหารได้ 2 รอบในวันถัดไป (1 ครั้ง/เกม)',
    description:
      'ในตอนกลางคืนสามารถป่วนหมู่บ้านเพื่อให้วันรุ่งขึ้นมีการโหวตประหารถึง 2 รอบ (ใช้ได้ 1 ครั้งต่อเกม)',
  },
  witch: {
    id: 'witch',
    nameTh: 'แม่มด',
    nameEn: 'Witch',
    team: 'village',
    category: 'village',
    color: '#2E9E72',
    shortDesc: 'มียาชุบชีวิต 1 ขวด และยาพิษ 1 ขวด',
    description:
      'มียาชุบชีวิต 1 ขวด (ช่วยเหยื่อมนุษย์หมาป่าในคืนนั้น) และยาพิษ 1 ขวด (กำจัดผู้เล่น 1 คน) ใช้ได้ขวดละ 1 ครั้งต่อเกม',
  },
  old_hag: {
    id: 'old_hag',
    nameTh: 'แม่หมอ',
    nameEn: 'Old Hag',
    team: 'village',
    category: 'village',
    color: '#84CC16',
    shortDesc: 'สาปผู้เล่น 1 คนให้ออกจากหมู่บ้าน 1 วัน (โหวตและถูกโหวตไม่ได้)',
    description:
      'ในแต่ละคืนเลือกสาปแช่งผู้เล่น 1 คนให้ออกจากหมู่บ้าน 1 วัน คนที่ถูกไล่ออกจะโหวตไม่ได้และไม่ตกเป็นเป้าโหวตในวันนั้น',
  },
  apprentice_seer: {
    id: 'apprentice_seer',
    nameTh: 'ศิษย์เทพพยากรณ์',
    nameEn: 'Apprentice Seer',
    team: 'village',
    category: 'village',
    color: '#C084FC',
    shortDesc: 'หากเทพพยากรณ์ตาย จะสืบทอดพลังเป็นเทพพยากรณ์แทน',
    description:
      'หากเทพพยากรณ์ในเกมถูกกำจัด คุณจะสืบทอดพลังกลายเป็นเทพพยากรณ์และตรวจหามนุษย์หมาป่าได้ทุกคืนแทน',
  },
  mayor: {
    id: 'mayor',
    nameTh: 'นายกเทศมนตรี',
    nameEn: 'Mayor',
    team: 'village',
    category: 'village',
    color: '#E0B45A',
    shortDesc: 'คะแนนโหวตตอนกลางวันนับเป็น 2 เสียง',
    description:
      'ผู้นำหมู่บ้าน คะแนนโหวตในช่วงกลางวันของนายกเทศมนตรีจะนับเป็น 2 เสียง',
  },
  hunter: {
    id: 'hunter',
    nameTh: 'นายพราน',
    nameEn: 'Hunter',
    team: 'village',
    category: 'village',
    color: '#D6A354',
    shortDesc: 'เมื่อตาย สามารถยิงผู้เล่น 1 คนตามไปได้ทันที',
    description:
      'หากคุณถูกกำจัดไม่ว่ากลางวันหรือกลางคืน สามารถเลือกยิงผู้เล่นอีก 1 คนให้ตายตามไปได้ทันที',
  },
  disease: {
    id: 'disease',
    nameTh: 'ผู้ป่วยติดเชื้อ',
    nameEn: 'Disease',
    team: 'village',
    category: 'village',
    color: '#10B981',
    shortDesc: 'หากถูกหมาป่าฆ่า คืนถัดไปหมาป่าจะล่าไม่ได้',
    description:
      'หากคุณถูกมนุษย์หมาป่ากำจัด เชื้อโรคจะทำให้มนุษย์หมาป่าไม่สามารถออกล่าใครได้ในคืนถัดไป',
  },
  pacifist: {
    id: 'pacifist',
    nameTh: 'ผู้รักสันติ',
    nameEn: 'Pacifist',
    team: 'village',
    category: 'village',
    color: '#34D399',
    shortDesc: 'ต้องโหวตปล่อยตัวหรืองดออกเสียงเสมอ',
    description:
      'ผู้รักความสงบ ในช่วงโหวตตัดสินคุณสามารถโหวตปล่อยตัว (ยกเลิกโหวต) เท่านั้น ไม่สามารถโหวตประหารใครได้',
  },
  ghost: {
    id: 'ghost',
    nameTh: 'พรายกระซิบ',
    nameEn: 'Ghost',
    team: 'village',
    category: 'village',
    color: '#94A3B8',
    shortDesc: 'ตายตั้งแต่คืนแรก ส่งคำใบ้ให้หมู่บ้านได้วันละ 1 ตัวอักษร',
    description:
      'คุณจะเสียชีวิตตั้งแต่คืนแรก และสามารถส่งสารคำใบ้ให้ผู้เล่นที่ยังมีชีวิตได้วันละ 1 ตัวอักษร',
  },
  mason: {
    id: 'mason',
    nameTh: 'ภราดรแห่งเมสัน',
    nameEn: 'Mason',
    team: 'village',
    category: 'village',
    color: '#60A5FA',
    shortDesc: 'รู้จักภราดรแห่งเมสันด้วยกันตั้งแต่เริ่มเกม (ควรมี ≥ 2 คน)',
    description:
      'สมาชิกสมาคมลับฝ่ายชาวบ้าน คุณจะเห็นทันทีว่าใครคือภราดรแห่งเมสันคนอื่นในหมู่บ้าน (ควรใส่ในเกมอย่างน้อย 2 คน)',
  },
  doppelganger: {
    id: 'doppelganger',
    nameTh: 'ภูตจำแลง',
    nameEn: 'Doppelganger',
    team: 'village',
    category: 'village',
    color: '#A78BFA',
    shortDesc: 'คืนแรกเลือก 1 คน เมื่อคนนั้นตายจะสวมรอยบทบาทนั้นทันที',
    description:
      'ในคืนแรกเลือกผู้เล่น 1 คน เมื่อผู้เล่นคนนั้นถูกกำจัด คุณจะสวมรอยรับบทบาทและความสามารถของคนนั้นทันที',
  },
  lycan: {
    id: 'lycan',
    nameTh: 'ลูกครึ่งมนุษย์หมาป่า',
    nameEn: 'Lycan',
    team: 'village',
    category: 'village',
    color: '#8C9AB0',
    shortDesc: 'ฝ่ายชาวบ้าน แต่เทพพยากรณ์ส่องเห็นเป็นคนไม่ดี',
    description:
      'คุณอยู่ฝ่ายชาวบ้าน แต่ต้องคำสาปทำให้เทพพยากรณ์ส่องเห็นคุณเป็นคนไม่ดี (มนุษย์หมาป่า)',
  },
  tough_guy: {
    id: 'tough_guy',
    nameTh: 'หนุ่มถึก',
    nameEn: 'Tough Guy',
    team: 'village',
    category: 'village',
    color: '#FB923C',
    shortDesc: 'ถูกหมาป่ากัดจะรอดไปอีก 1 วัน แล้วค่อยตายคืนถัดไป',
    description:
      'หากถูกมนุษย์หมาป่าเลือกกำจัด คุณจะยังไม่ตายทันที ยังสามารถอยู่พูดคุยและโหวตตอนกลางวันได้ แล้วจะเสียชีวิตในคืนถัดไป',
  },
  villager_idiot: {
    id: 'villager_idiot',
    nameTh: 'ไอ้ทึ่ม',
    nameEn: 'Villager Idiot',
    team: 'village',
    category: 'village',
    color: '#EAB308',
    shortDesc: 'ต้องโหวตประหารเสมอ (ห้ามงดออกเสียงหรือปล่อยตัว)',
    description:
      'คุณต้องโหวตให้ผู้เล่นถูกประหารเสมอ ไม่สามารถกดงดออกเสียงหรือยกเลิกโหวตได้',
  },

  // === บทบาทอิสระ / อื่น ๆ (Independent — 3 playable roles) ===
  tanner: {
    id: 'tanner',
    nameTh: 'ยาจก (คนคลั่ง)',
    nameEn: 'Tanner',
    team: 'independent',
    category: 'independent',
    color: '#D97742',
    shortDesc: 'ฝ่ายอิสระ ชนะคนเดียวทันทีหากถูกโหวตประหาร',
    description:
      'คุณหมดอาลัยตายอยากกับชีวิต เป้าหมายเดียวคือหลอกให้หมู่บ้านโหวตประหารตัวเองตอนกลางวันเพื่อชนะคนเดียวทันที',
  },
  vampire: {
    id: 'vampire',
    nameTh: 'แวมไพร์',
    nameEn: 'Vampire',
    team: 'independent',
    category: 'independent',
    color: '#881337',
    shortDesc: 'กัดเหยื่อคืนละ 1 คน (ตายตอนเริ่มโหวต) หมาป่าฆ่าไม่ได้',
    description:
      'ฝ่ายอิสระ ในแต่ละคืนเลือกกัดผู้เล่น 1 คน เหยื่อจะเสียชีวิตเมื่อเริ่มการโหวตในวันถัดไป หมาป่าฆ่าแวมไพร์ไม่ได้แต่ตายจากโหวตได้',
  },
  cult_leader: {
    id: 'cult_leader',
    nameTh: 'เจ้าลัทธิ',
    nameEn: 'Cult Leader',
    team: 'independent',
    category: 'independent',
    color: '#D946EF',
    shortDesc: 'ชวนผู้เล่นคืนละ 1 คนเข้าลัทธิ ชนะเมื่อทุกคนอยู่ในลัทธิ',
    description:
      'ฝ่ายอิสระ ในแต่ละคืนเลือกผู้เล่น 1 คนให้เข้าร่วมลัทธิของคุณ คุณจะชนะเกมทันทีเมื่อผู้เล่นที่รอดชีวิตทั้งหมดอยู่ในลัทธิ',
  },

  // === ภาคเสริม Expansion Hunting Party (6 roles) ===
  revealer: {
    id: 'revealer',
    nameTh: 'ผู้เผยตัวตน',
    nameEn: 'Revealer',
    team: 'village',
    category: 'expansion',
    color: '#F43F5E',
    shortDesc: 'กลางคืนชี้ 1 คน ถ้าเป็นหมาป่าตายทันที ถ้าไม่ใช่ตัวเองตายแทน',
    description:
      'ภาคเสริม: ในแต่ละคืนเลือกชี้ผู้เล่น 1 คน หากเป็นมนุษย์หมาป่าคนนั้นจะถูกกำจัดทันที แต่หากไม่ใช่ คุณจะถูกกำจัดแทน',
  },
  mentalist: {
    id: 'mentalist',
    nameTh: 'นักสะกดจิต',
    nameEn: 'Mentalist',
    team: 'village',
    category: 'expansion',
    color: '#14B8A6',
    shortDesc: 'กลางคืนชี้ 2 คน ตรวจว่าอยู่ฝ่ายเดียวกันหรือไม่',
    description:
      'ภาคเสริม: ในแต่ละคืนเลือกผู้เล่น 2 คนเพื่อตรวจสอบว่าทั้งสองคนนั้นอยู่ฝ่ายเดียวกันหรือไม่',
  },
  huntress: {
    id: 'huntress',
    nameTh: 'พรานหญิง',
    nameEn: 'Huntress',
    team: 'village',
    category: 'expansion',
    color: '#E11D48',
    shortDesc: 'กำจัดผู้เล่น 1 คนตอนกลางคืนได้ (1 ครั้งต่อเกม)',
    description:
      'ภาคเสริม: สามารถเลือกกำจัดผู้เล่น 1 คนได้ในช่วงกลางคืน (ใช้ได้ 1 ครั้งต่อเกม)',
  },
  mad_bomber: {
    id: 'mad_bomber',
    nameTh: 'มือระเบิดพลีชีพ',
    nameEn: 'Mad Bomber',
    team: 'village',
    category: 'expansion',
    color: '#EA580C',
    shortDesc: 'หากตาย ผู้เล่นที่นั่งติดกันซ้าย-ขวาจะตายไปด้วย',
    description:
      'ภาคเสริม: หากคุณถูกกำจัดไม่ว่าเวลาใด ผู้เล่นที่ยังมีชีวิตและนั่งติดกับคุณทางซ้ายและขวาจะถูกระเบิดตายตามไปด้วย',
  },
  mystic_seer: {
    id: 'mystic_seer',
    nameTh: 'เทพผู้รู้แจ้ง',
    nameEn: 'Mystic Seer',
    team: 'village',
    category: 'expansion',
    color: '#8B5CF6',
    shortDesc: 'กลางคืนส่อง 1 คน รู้บทบาทที่แท้จริงทันที',
    description:
      'ภาคเสริม: ในแต่ละคืนเลือกชี้ผู้เล่น 1 คนเพื่อตรวจสอบและรู้บทบาทที่แท้จริงของคนนั้นทันที',
  },
  alpha_wolf: {
    id: 'alpha_wolf',
    nameTh: 'มนุษย์หมาป่าจ่าฝูง',
    nameEn: 'Alpha Wolf',
    team: 'werewolf',
    category: 'expansion',
    color: '#9F1239',
    shortDesc: 'คืนหลังหมาป่าโดนโหวตออก แปลงเหยื่อเป็นหมาป่าแทนฆ่า (1 ครั้ง/เกม)',
    description:
      'ภาคเสริม: ตื่นพร้อมฝูงหมาป่า ในคืนหลังจากมีมนุษย์หมาป่าถูกโหวตประหาร สามารถเลือกเปลี่ยนเหยื่อคืนนั้นให้เป็นมนุษย์หมาป่าแทนการฆ่าได้ 1 ครั้งต่อเกม',
  },
};

export const ROLE_ORDER = [
  // Werewolf team
  'werewolf',
  'lone_wolf',
  'wolf_cub',
  'alpha_wolf',
  'minion',
  'sorcerer',
  'hoodlum',
  'cursed',
  // Core Village roles first
  'seer',
  'doctor',
  'witch',
  'hunter',
  'mayor',
  'lycan',
  'villager',
  // Extended Village roles
  'spellcaster',
  'cupid',
  'aura_seer',
  'drunk',
  'prince',
  'priest',
  'pi',
  'troublemaker',
  'old_hag',
  'apprentice_seer',
  'disease',
  'pacifist',
  'ghost',
  'mason',
  'doppelganger',
  'tough_guy',
  'villager_idiot',
  // Independent
  'tanner',
  'vampire',
  'cult_leader',
  // Expansion Hunting Party
  'revealer',
  'mentalist',
  'huntress',
  'mad_bomber',
  'mystic_seer',
];

export function isPackWolf(roleId) {
  return (
    roleId === 'werewolf' ||
    roleId === 'wolf_cub' ||
    roleId === 'lone_wolf' ||
    roleId === 'alpha_wolf'
  );
}

export function getDefaultRoleConfig(playerCount) {
  const n = Math.max(4, Math.min(16, playerCount));
  const cfg = Object.fromEntries(ROLE_ORDER.map((id) => [id, 0]));
  cfg.werewolf = 1;
  cfg.seer = 1;
  cfg.doctor = 1;

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
