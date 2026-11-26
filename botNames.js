export const BOT_PROFILES = [
  { name: 'บอทข้าวปั้น', avatar: 'moon' },
  { name: 'บอทต้นกล้า', avatar: 'crown' },
  { name: 'บอทมะลิ', avatar: 'swords' },
  { name: 'บอทสายฟ้า', avatar: 'shield' },
  { name: 'บอทใบบัว', avatar: 'feather' },
  { name: 'บอทภูผา', avatar: 'compass' },
  { name: 'บอทน้ำขิง', avatar: 'key' },
  { name: 'บอทเจ้าขุน', avatar: 'gem' },
  { name: 'บอทพลอยใส', avatar: 'scroll' },
  { name: 'บอทเมฆา', avatar: 'anchor' },
  { name: 'บอทชานม', avatar: 'sparkles' },
  { name: 'บอทตะวัน', avatar: 'bell' },
  { name: 'บอทลูกพีช', avatar: 'book' },
  { name: 'บอทก้อนเมฆ', avatar: 'trees' },
  { name: 'บอทพายุ', avatar: 'hourglass' },
];

export const CHAT_LINES = {
  peacefulMorning: [
    'เมื่อคืนไม่มีใครตายเลย หมอหรือแม่มดสุดยอดมาก!',
    'รอดกันหมดเลยคืนนี้ ขอบคุณหมอหรือแม่มดด้วยนะ',
    'ไม่มีใครเสียชีวิต แสดงว่าเมื่อคืนหมอเซฟได้สวยเลย',
  ],
  deathMorning: [
    'เสียใจกับ {victim} ด้วยนะ ใครดูน่าสงสัยบ้างคืนนี้?',
    '{victim} โดนเก็บไปแล้ว เราต้องรีบหาหมาป่าให้เจอแล้วล่ะ',
    'หมาป่ากล้ามากที่เก็บ {victim} ใครมีเบาะแสบ้าง?',
  ],
  suspectGeneral: [
    'ผมว่า {target} ดูเงียบๆ แปลกๆ นะ ลองอธิบายหน่อยสิ',
    'รู้สึกแปลกๆ กับ {target} ตั้งแต่เมื่อกี้แล้วนะ',
    'มีใครสงสัย {target} เหมือนกันไหม?',
    'จากที่ดูๆ มา {target} น่าสงสัยสุดแล้วตอนนี้',
  ],
  seerRevealWolf: [
    'ผมเป็นเทพพยากรณ์! เมื่อคืนผมส่อง {target} แล้ว เจอว่าเป็นหมาป่าแน่นอน โหวตออกเลย!',
    'ขอเปิดบทบาทเลยนะ ผมคือเทพพยากรณ์ ส่อง {target} แล้วเป็นหมาป่า 100%!',
  ],
  seerRevealGood: [
    'ผมเชื่อว่า {target} น่าจะเป็นคนดีนะ อย่าเพิ่งโหวตเลย',
    'เท่าที่ผมดู {target} น่าจะอยู่ฝ่ายชาวบ้าน ลองไปดูคนอื่นดีกว่า',
  ],
  wolfDeflect: [
    'ผมเป็นชาวบ้านธรรมดานะ ไม่ได้ทำอะไรเลย ลองดู {target} ดีกว่าไหม?',
    'อย่าเพิ่งรีบโหวตมั่วสิ เดี๋ยวเข้าทางหมาป่านะ ผมสงสัย {target} มากกว่า',
    'ผมว่า {target} พยายามเบี่ยงประเด็นนะ น่าสงสัยมาก',
  ],
  defendSelf: [
    'เฮ้ย ไม่ใช่ผมนะ! ผมอยู่ฝ่ายชาวบ้านจริงๆ',
    'อย่าโหวตผมเลย ถ้าโหวตผมออกชาวบ้านเสียเปรียบแน่',
    'ผมบริสุทธิ์นะ ลองคิดดูดีๆ ก่อนโหวต',
  ],
  wolfChat: [
    'คืนนี้เก็บ {target} กันดีไหม ดูน่าจะเล่นเก่ง',
    'ผมโหวตเก็บ {target} นะ ทุกคนว่าไง',
    'เอา {target} ออกก่อนเลยคืนนี้',
  ],
};

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function formatLine(template, vars = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}
