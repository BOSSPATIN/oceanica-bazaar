// Oceanica Bazaar — ข้อมูลไอเทม / ตำรา / กัปตัน (ธีมทะเล-เรือ จาก Oceanica Offline)
// ค่าตัวเลขเป็น array 4 ช่อง = ระดับ [ทองแดง, เงิน, ทอง, เพชร]
'use strict';

const BAL = {
  BOARD_SLOTS: 10,
  STASH_SLOTS: 8,
  START_GOLD: 10,
  INCOME_BASE: 8,      // ทองต่อวัน = INCOME_BASE + day
  REROLL_COST: 1,
  WIN_GOLD: 3,         // ชนะได้ทอง
  STREAK_STEP: 1,      // ชนะติดต่อกัน ครั้งที่ 2 ขึ้นไป +1 ต่อขั้น
  STREAK_CAP: 5,       // โบนัสสูงสุด +5 (ชนะติด 6 ครั้งขึ้นไป)
  LIVES: 3,
  WIN_TARGET: 10,
  MAX_DAY: 15,
  XP_PER_LEVEL: 3,
  HP_PER_LEVEL: 30,
  COST_BY_SIZE: { 1: 3, 2: 6, 3: 9 },
  COST_PER_TIER: 3,
  SKILL_COST: 5,
  SELL_RATE: 0.5,
  STORM_AT: 30000,     // พายุหลัง 30 วิ
  STORM_DMG: 2,        // ดาเมจพายุ +2 ทุกวิ
  TICK: 100,
  // ผี (คู่ต่อสู้)
  GHOST_HP_PER_DAY: 15,
  GHOST_TIER_LAG: 2,   // ผีสุ่มระดับไอเทมเหมือนร้านเมื่อ 2 วันก่อน
  GHOST_SLOTS: function (day) { return Math.min(10, 2 + day); },
  GHOST_SKILLS: function (day) { return day >= 9 ? 2 : day >= 4 ? 1 : 0; },
};

const TIERS = ['ทองแดง', 'เงิน', 'ทอง', 'เพชร'];
const SIZE_NAME = { 1: 'เล็ก', 2: 'กลาง', 3: 'ใหญ่' };
const TAG_NAME = {
  weapon: 'อาวุธ', tool: 'เครื่องมือ', food: 'อาหาร', sea: 'สัตว์ทะเล', treasure: 'สมบัติ', crew: 'ลูกเรือ',
  fire: 'ไฟ', water: 'น้ำ', earth: 'ดิน', metal: 'โลหะ', wood: 'ไม้',
};

// fx kinds: dmg(n, crit, ls) shield heal burn poison regen cleanse grow
//           haste/charge {tgt: self|adj|all|weapon}, slow {n}
//           passive (cd 0): maxhp startShield startCharge startHaste income auraWeaponDmg auraCrit
const ITEMS = [
  // ---- อาวุธ ----
  { id: 'dagger', name: 'มีดสั้น', icon: '🔪', img: 'img/dagger.png', size: 1, tags: ['weapon', 'metal'], cd: 2500, w: 10, fx: [{ k: 'dmg', v: [6, 12, 18, 24] }] },
  { id: 'cutlass', name: 'ดาบกะลาสี', icon: '⚔️', img: 'img/cutlass.png', size: 1, tags: ['weapon', 'metal'], cd: 4000, w: 10, fx: [{ k: 'dmg', v: [12, 24, 36, 48] }] },
  { id: 'flintlock', name: 'ปืนพกสั้น', icon: '🎯', img: 'img/flintlock.png', size: 1, tags: ['weapon', 'metal'], cd: 3500, w: 8, fx: [{ k: 'dmg', v: [10, 20, 30, 40], crit: 25 }] },
  { id: 'musket', name: 'ปืนคาบศิลา', icon: '🔫', img: 'img/musket.png', size: 2, tags: ['weapon', 'metal', 'fire'], cd: 5000, w: 8, fx: [{ k: 'dmg', v: [25, 50, 75, 100], crit: 15 }] },
  { id: 'harpoon', name: 'ฉมวก', icon: '🎣', img: 'img/harpoon.png', size: 2, tags: ['weapon', 'water'], cd: 5000, w: 7, fx: [{ k: 'dmg', v: [20, 40, 60, 80] }, { k: 'slow', v: [2, 3, 4, 5], n: 1 }] },
  { id: 'axe', name: 'ขวานกะลาสี', icon: '🪓', img: 'img/axe.png', size: 2, tags: ['weapon', 'metal'], cd: 6000, w: 7, fx: [{ k: 'dmg', v: [30, 60, 90, 120] }, { k: 'grow', v: [4, 8, 12, 16] }] },
  { id: 'trident', name: 'หอกสามง่าม', icon: '🔱', img: 'img/trident.png', size: 2, tags: ['weapon', 'water'], cd: 4500, w: 6, fx: [{ k: 'dmg', v: [12, 24, 36, 48], n: 2 }] },
  { id: 'cannon', name: 'ปืนใหญ่', icon: '💣', img: 'img/cannon.png', size: 3, tags: ['weapon', 'metal', 'fire'], cd: 8000, w: 5, fx: [{ k: 'dmg', v: [55, 110, 165, 220] }, { k: 'burn', v: [2, 4, 6, 8] }] },
  // ---- เครื่องมือ ----
  { id: 'compass', name: 'เข็มทิศ', icon: '🧭', img: 'img/compass.png', size: 1, tags: ['tool', 'metal'], cd: 4000, w: 8, fx: [{ k: 'haste', v: [2, 3, 4, 5], tgt: 'adj' }] },
  { id: 'hourglass', name: 'นาฬิกาทราย', icon: '⏳', img: 'img/hourglass.png', size: 1, tags: ['tool', 'earth'], cd: 5000, w: 7, fx: [{ k: 'slow', v: [2, 3, 4, 5], n: 1 }] },
  { id: 'spyglass', name: 'กล้องส่องทางไกล', icon: '🔭', img: 'img/spyglass.png', size: 1, tags: ['tool', 'metal'], cd: 0, w: 5, fx: [{ k: 'auraCrit', v: [10, 15, 20, 25] }] },
  { id: 'plank', name: 'แผ่นไม้กั้น', icon: '🛡️', img: 'img/plank.png', size: 1, tags: ['tool', 'wood'], cd: 3500, w: 9, fx: [{ k: 'shield', v: [10, 20, 30, 40] }] },
  { id: 'bucket', name: 'ถังตักน้ำ', icon: '🪣', img: 'img/bucket.png', size: 1, tags: ['tool', 'water'], cd: 4000, w: 8, fx: [{ k: 'heal', v: [10, 20, 30, 40] }] },
  { id: 'lantern', name: 'ตะเกียงน้ำมัน', icon: '🏮', img: 'img/lantern.png', size: 1, tags: ['tool', 'fire'], cd: 3000, w: 8, fx: [{ k: 'burn', v: [2, 4, 6, 8] }] },
  { id: 'powderkeg', name: 'ถังดินปืน', icon: '🧨', img: 'img/powderkeg.png', size: 2, tags: ['tool', 'fire'], cd: 6000, w: 6, fx: [{ k: 'burn', v: [6, 12, 18, 24] }] },
  { id: 'chain', name: 'โซ่สมอ', icon: '⛓️', img: 'img/chain.png', size: 2, tags: ['tool', 'metal'], cd: 5000, w: 5, fx: [{ k: 'slow', v: [2, 3, 4, 5], n: 2 }] },
  { id: 'anchor', name: 'สมอเรือ', icon: '⚓', img: 'img/anchor.png', size: 3, tags: ['tool', 'metal', 'earth'], cd: 6000, w: 5, fx: [{ k: 'shield', v: [40, 80, 120, 160] }] },
  { id: 'sail', name: 'ใบเรือใหญ่', icon: '⛵', img: 'img/sail.png', size: 3, tags: ['tool', 'wood'], cd: 7000, w: 4, fx: [{ k: 'haste', v: [1, 2, 3, 4], tgt: 'all' }] },
  // ---- อาหาร ----
  { id: 'rum', name: 'เหล้ารัม', icon: '🍾', img: 'img/rum.png', size: 1, tags: ['food', 'wood'], cd: 5000, w: 8, fx: [{ k: 'heal', v: [20, 40, 60, 80] }] },
  { id: 'driedfish', name: 'ปลาแห้ง', icon: '🐟', img: 'img/driedfish.png', size: 1, tags: ['food', 'sea', 'water'], cd: 0, w: 8, fx: [{ k: 'maxhp', v: [30, 60, 90, 120] }] },
  { id: 'lime', name: 'มะนาวดอง', icon: '🍋', img: 'img/lime.png', size: 1, tags: ['food', 'wood'], cd: 6000, w: 6, fx: [{ k: 'heal', v: [15, 30, 45, 60] }, { k: 'cleanse' }] },
  { id: 'coconut', name: 'มะพร้าว', icon: '🥥', img: 'img/coconut.png', size: 1, tags: ['food', 'wood'], cd: 4000, w: 6, fx: [{ k: 'regen', v: [1, 2, 3, 4] }] },
  { id: 'stew', name: 'สตูว์ปู', icon: '🍲', img: 'img/stew.png', size: 2, tags: ['food', 'sea', 'water'], cd: 0, w: 5, fx: [{ k: 'maxhp', v: [60, 120, 180, 240] }, { k: 'startRegen', v: [1, 2, 3, 4] }] },
  // ---- สัตว์ทะเล ----
  { id: 'jellyfish', name: 'แมงกะพรุนพิษ', icon: '🪼', img: 'img/jellyfish.png', size: 1, tags: ['sea', 'water'], cd: 4000, w: 7, fx: [{ k: 'poison', v: [2, 4, 6, 8] }] },
  { id: 'puffer', name: 'ปลาปักเป้า', icon: '🐡', img: 'img/puffer.png', size: 1, tags: ['sea', 'water'], cd: 3000, w: 7, fx: [{ k: 'dmg', v: [5, 10, 15, 20] }, { k: 'poison', v: [1, 2, 3, 4] }] },
  { id: 'lobster', name: 'กุ้งมังกร', icon: '🦐', img: 'img/lobster.png', size: 1, tags: ['sea', 'fire'], cd: 3000, w: 6, fx: [{ k: 'dmg', v: [8, 16, 24, 32] }, { k: 'burn', v: [1, 2, 3, 4] }] },
  { id: 'crab', name: 'ปูยักษ์', icon: '🦀', img: 'img/crab.png', size: 2, tags: ['sea', 'earth'], cd: 5000, w: 6, fx: [{ k: 'shield', v: [25, 50, 75, 100] }, { k: 'dmg', v: [10, 20, 30, 40] }] },
  { id: 'turtle', name: 'เต่าทะเล', icon: '🐢', img: 'img/turtle.png', size: 2, tags: ['sea', 'earth', 'water'], cd: 6000, w: 6, fx: [{ k: 'shield', v: [35, 70, 105, 140] }] },
  { id: 'octopus', name: 'หมึกยักษ์', icon: '🐙', img: 'img/octopus.png', size: 3, tags: ['sea', 'water'], cd: 7000, w: 4, fx: [{ k: 'dmg', v: [40, 80, 120, 160] }, { k: 'slow', v: [2, 2, 3, 3], n: 3 }] },
  { id: 'shark', name: 'ฉลาม', icon: '🦈', img: 'img/shark.png', size: 3, tags: ['sea', 'water'], cd: 6000, w: 4, fx: [{ k: 'dmg', v: [30, 60, 90, 120], ls: 25 }, { k: 'grow', v: [10, 20, 30, 40] }] },
  // ---- สมบัติ ----
  { id: 'chest', name: 'หีบสมบัติ', icon: '🧰', img: 'img/chest.png', size: 2, tags: ['treasure', 'wood'], cd: 0, w: 4, fx: [{ k: 'income', v: [1, 2, 3, 4] }] },
  { id: 'pearl', name: 'ไข่มุกดำ', icon: '⚫', img: 'img/pearl.png', size: 1, tags: ['treasure', 'water'], cd: 0, w: 4, fx: [{ k: 'startShield', v: [20, 40, 60, 80] }] },
  { id: 'map', name: 'แผนที่สมบัติ', icon: '🗺️', img: 'img/map.png', size: 1, tags: ['treasure', 'earth'], cd: 0, w: 4, fx: [{ k: 'startCharge', v: [0.5, 1, 1.5, 2] }] },
  { id: 'diamond', name: 'เพชร', icon: '💎', img: 'img/diamond.png', size: 1, tags: ['treasure', 'metal'], cd: 0, w: 3, fx: [{ k: 'auraWeaponDmg', v: [5, 10, 15, 20] }] },
  { id: 'prism', name: 'ผลึกสีรุ้ง', icon: '🔮', img: 'img/prism.png', size: 1, tags: ['treasure', 'water'], cd: 8000, w: 3, fx: [{ k: 'haste', v: [1, 2, 3, 4], tgt: 'all' }] },
  // ---- ลูกเรือ ----
  { id: 'sailor', name: 'กะลาสี', icon: '🧔', img: 'img/sailor.png', size: 1, tags: ['crew', 'earth'], cd: 4000, w: 8, fx: [{ k: 'dmg', v: [10, 20, 30, 40] }] },
  { id: 'diver', name: 'นักดำน้ำ', icon: '🤿', img: 'img/diver.png', size: 1, tags: ['crew', 'water'], cd: 4000, w: 6, fx: [{ k: 'dmg', v: [8, 16, 24, 32], ls: 50 }] },
  { id: 'parrot', name: 'นกแก้ว', icon: '🦜', img: 'img/parrot.png', size: 1, tags: ['crew', 'wood'], cd: 3000, w: 6, fx: [{ k: 'dmg', v: [6, 12, 18, 24] }, { k: 'haste', v: [1, 1, 2, 2], tgt: 'random' }] },
  { id: 'navigator', name: 'ต้นหน', icon: '📜', img: 'img/navigator.png', size: 1, tags: ['crew', 'water'], cd: 0, w: 5, fx: [{ k: 'startHaste', v: [1, 2, 3, 4] }] },
  { id: 'cook', name: 'พ่อครัว', icon: '👨‍🍳', img: 'img/cook.png', size: 2, tags: ['crew', 'fire'], cd: 6000, w: 6, fx: [{ k: 'heal', v: [25, 50, 75, 100] }, { k: 'charge', v: [1, 1, 2, 2], tgt: 'adj' }] },
  { id: 'doctor', name: 'แพทย์เรือ', icon: '🧑‍⚕️', img: 'img/doctor.png', size: 2, tags: ['crew', 'wood'], cd: 5000, w: 6, fx: [{ k: 'heal', v: [20, 40, 60, 80] }, { k: 'cleanse' }] },
  { id: 'gunner', name: 'มือปืนใหญ่', icon: '🪖', img: 'img/gunner.png', size: 2, tags: ['crew', 'fire'], cd: 5000, w: 5, fx: [{ k: 'charge', v: [1, 1.5, 2, 2.5], tgt: 'weapon' }] },
];
const ITEM_BY_ID = {};
ITEMS.forEach(function (d) { ITEM_BY_ID[d.id] = d; });

// ตำรา (สกิลติดตัวกัปตัน)
const SKILLS = [
  { id: 'sharp', name: 'อาวุธคม', icon: '✨', w: 8, fx: [{ k: 'weaponDmg', v: [5, 10, 15, 20] }], text: 'อาวุธทุกชิ้นโจมตีเพิ่ม +{v}' },
  { id: 'pyro', name: 'ไฟแรง', icon: '🔥', w: 6, fx: [{ k: 'burnBonus', v: [1, 2, 3, 4] }], text: 'เผาเพิ่ม +{v} ทุกครั้งที่ใส่เผา' },
  { id: 'venom', name: 'พิษเข้มข้น', icon: '☠️', w: 6, fx: [{ k: 'poisonBonus', v: [1, 2, 3, 4] }], text: 'พิษเพิ่ม +{v} ทุกครั้งที่ใส่พิษ' },
  { id: 'thickhull', name: 'เปลือกเรือหนา', icon: '🛡️', w: 7, fx: [{ k: 'startShield', v: [30, 60, 90, 120] }], text: 'เริ่มรบมีโล่ {v}' },
  { id: 'veteran', name: 'ลูกเรือเก๋า', icon: '💪', w: 7, fx: [{ k: 'maxhp', v: [50, 100, 150, 200] }], text: 'HP สูงสุด +{v}' },
  { id: 'medic', name: 'หมอประจำเรือ', icon: '➕', w: 6, fx: [{ k: 'healBonus', v: [5, 10, 15, 20] }], text: 'ฮีลเพิ่ม +{v} ทุกครั้งที่ฮีล' },
  { id: 'quickhands', name: 'มือไว', icon: '⚡', w: 6, fx: [{ k: 'startCharge', v: [1, 1.5, 2, 2.5] }], text: 'เริ่มรบ ไอเทมทุกชิ้นชาร์จล่วงหน้า {v} วิ' },
  { id: 'lucky', name: 'โชคดี', icon: '🍀', w: 5, fx: [{ k: 'income', v: [1, 2, 3, 4] }], text: 'ได้ทองเพิ่ม +{v} ต่อวัน' },
  { id: 'berserk', name: 'คลั่ง', icon: '😤', w: 5, fx: [{ k: 'berserk', v: [3, 4, 5, 6] }], text: 'ครั้งแรกที่ HP ต่ำกว่าครึ่ง อาวุธทุกชิ้นเร่ง {v} วิ' },
  { id: 'shieldwall', name: 'กำแพงโล่', icon: '🧱', w: 5, fx: [{ k: 'shieldBonus', v: [5, 10, 15, 20] }], text: 'โล่เพิ่ม +{v} ทุกครั้งที่ได้โล่' },
];
const SKILL_BY_ID = {};
SKILLS.forEach(function (d) { SKILL_BY_ID[d.id] = d; });

// โบนัสธาตุ — นับชิ้นบนกระดานที่มีธาตุนั้น ครบ 3 / 5 ชิ้น ได้โบนัส (ระดับสูงแทนระดับต่ำ)
const ELEMENTS = [
  { id: 'fire', name: 'ไฟ', icon: '🔥', tiers: [
    { n: 3, mods: { burn: 2 }, text: 'เผาเพิ่ม +2 ทุกครั้ง' },
    { n: 5, mods: { burn: 5, startBurnFoe: 6 }, text: 'เผาเพิ่ม +5 · เริ่มรบศัตรูติดเผา 6' }] },
  { id: 'water', name: 'น้ำ', icon: '💧', tiers: [
    { n: 3, mods: { slow: 1, heal: 5 }, text: 'หน่วงนานขึ้น +1 วิ · ฮีลเพิ่ม +5' },
    { n: 5, mods: { slow: 2, heal: 10, startSlowFoe: 3 }, text: 'หน่วง +2 วิ · ฮีล +10 · เริ่มรบหน่วงศัตรูทุกชิ้น 3 วิ' }] },
  { id: 'earth', name: 'ดิน', icon: '⛰️', tiers: [
    { n: 3, mods: { shield: 10 }, text: 'โล่เพิ่ม +10 ทุกครั้ง' },
    { n: 5, mods: { shield: 20, startShield: 100 }, text: 'โล่เพิ่ม +20 · เริ่มรบมีโล่ 100' }] },
  { id: 'metal', name: 'โลหะ', icon: '⚙️', tiers: [
    { n: 3, mods: { weaponDmg: 8 }, text: 'อาวุธโจมตีเพิ่ม +8' },
    { n: 5, mods: { weaponDmg: 15, crit: 20 }, text: 'อาวุธโจมตี +15 · คริ +20%' }] },
  { id: 'wood', name: 'ไม้', icon: '🌿', tiers: [
    { n: 3, mods: { startRegen: 2 }, text: 'ฟื้นฟู 2/วิ ตลอดรบ' },
    { n: 5, mods: { startRegen: 5, maxhp: 100 }, text: 'ฟื้นฟู 5/วิ · HP สูงสุด +100' }] },
];
function countElems(itemIds) {
  var c = {}; ELEMENTS.forEach(function (e) { c[e.id] = 0; });
  itemIds.forEach(function (id) { var d = ITEM_BY_ID[id]; if (d) d.tags.forEach(function (t) { if (c[t] !== undefined) c[t]++; }); });
  return c;
}
// คืน [{el, tier(0/1), n, text, mods}] เฉพาะธาตุที่ครบเกณฑ์
function elemBonuses(itemIds) {
  var c = countElems(itemIds), out = [];
  ELEMENTS.forEach(function (e) {
    var got = null;
    e.tiers.forEach(function (t, i) { if (c[e.id] >= t.n) got = { el: e, tier: i, n: c[e.id], text: t.text, mods: t.mods }; });
    if (got) out.push(got);
  });
  return out;
}

// เหตุการณ์ระหว่างวัน (ชื่อจากเหตุการณ์ใน Oceanica) — สุ่มหลังรบ ก่อนเข้าร้าน
const EVENTS = [
  { id: 'island', name: 'เกาะร้าง', icon: '🏝️', w: 8, text: 'เรือแวะเกาะร้าง บนหาดมีของกระจัดกระจาย', choices: [
    { t: 'เก็บของ 1 ชิ้น (สุ่ม)', k: 'freeItem' }, { t: 'เก็บทอง +5', k: 'gold', v: 5 }] },
  { id: 'wreck', name: 'ซากเรืออับปาง', icon: '🚢', w: 7, text: 'ซากเรือเก่าจมครึ่งลำ ข้างในมีของดีซ่อนอยู่', choices: [
    { t: 'อัพระดับไอเทมบนกระดานสุ่ม 1 ชิ้น', k: 'upgradeRandom' }, { t: 'งัดหีบเอาทอง +4', k: 'gold', v: 4 }] },
  { id: 'merchant', name: 'เรือพ่อค้าลอยน้ำ', icon: '⛵', w: 7, text: 'พ่อค้ากลางทะเลเสนอของระดับสูงกว่าในตลาด', choices: [
    { t: 'ซื้อ', k: 'buySpecial' }, { t: 'ไม่ซื้อ', k: 'none' }] },
  { id: 'fisher', name: 'หมู่บ้านชาวประมง', icon: '🎣', w: 7, text: 'ชาวบ้านเลี้ยงอาหารลูกเรือ', choices: [
    { t: 'กินให้อิ่ม: HP สูงสุด +20 ถาวร', k: 'maxhp', v: 20 }, { t: 'คุยกับผู้เฒ่า: เรียนตำราสุ่ม 1 เล่ม', k: 'freeSkill' }] },
  { id: 'bottle', name: 'ขวดจดหมาย', icon: '🍾', w: 6, text: 'ขวดลอยมาติดข้างเรือ ข้างในมีลายแทง', choices: [
    { t: 'ตามลายแทง: ทอง +3 และสุ่มร้านฟรี 1 ครั้ง', k: 'goldReroll', v: 3 }, { t: 'ขายขวดเก่า: ทอง +6', k: 'gold', v: 6 }] },
  { id: 'pirates', name: 'โจรสลัด', icon: '🏴‍☠️', w: 6, text: 'เรือโจรสลัดดักปล้นกลางทะเล', choices: [
    { t: 'สู้! รบพิเศษ — ชนะได้ทอง +8 แพ้ไม่เสียเรือ', k: 'bonusFight', v: 8 }, { t: 'จ่ายค่าผ่านทาง 3 ทอง', k: 'gold', v: -3 }] },
  { id: 'survivor', name: 'ผู้รอดชีวิตลอยคอ', icon: '🛟', w: 5, text: 'ช่วยคนลอยคอกลางทะเล เขาขอร่วมเรือ', choices: [
    { t: 'รับเป็นลูกเรือ (ไอเทมหมวดลูกเรือสุ่ม 1 ชิ้น)', k: 'freeCrew' }, { t: 'ส่งขึ้นฝั่ง: ทอง +4', k: 'gold', v: 4 }] },
];

// กัปตัน (เลือกตอนเริ่มรัน) — ชื่อจากลูกเรือใน Oceanica
const HEROES = [
  { id: 'swordsman', name: 'Vilmort', cls: 'นักดาบ', icon: '⚔️', color: '#8a3434', hp: 250, items: ['cutlass', 'dagger'], skill: 'sharp', text: 'สายอาวุธ — อาวุธคม +5' },
  { id: 'gunner', name: 'Mazzy', cls: 'มือปืน', icon: '🔫', color: '#b05a1a', hp: 220, items: ['musket', 'lantern'], skill: 'pyro', text: 'สายไฟ — เผาแรง +1' },
  { id: 'tinker', name: 'Nanorin', cls: 'นักประดิษฐ์', icon: '🔧', color: '#2f6fc0', hp: 240, items: ['compass', 'plank', 'bucket'], skill: 'quickhands', text: 'สายเครื่องมือ — ชาร์จล่วงหน้า 1 วิ' },
];
const HERO_BY_ID = {};
HEROES.forEach(function (d) { HERO_BY_ID[d.id] = d; });

function fxVal(f, tier) { return Array.isArray(f.v) ? f.v[tier] : (f.v || 0); }
function fmtNum(n) { return Math.round(n * 10) / 10; }

// คำอธิบายไอเทมตามระดับ
function itemDescr(def, tier) {
  var parts = [];
  def.fx.forEach(function (f) {
    var v = fmtNum(fxVal(f, tier));
    switch (f.k) {
      case 'dmg': parts.push('โจมตี ' + v + (f.n > 1 ? ' ×' + f.n + ' ครั้ง' : '') + (f.crit ? ' (คริ ' + f.crit + '%)' : '') + (f.ls ? ' ดูดเลือด ' + f.ls + '%' : '')); break;
      case 'shield': parts.push('โล่ ' + v); break;
      case 'heal': parts.push('ฮีล ' + v); break;
      case 'burn': parts.push('เผา ' + v); break;
      case 'poison': parts.push('พิษ ' + v); break;
      case 'regen': parts.push('ฟื้นฟู +' + v); break;
      case 'cleanse': parts.push('ล้างเผา/พิษ'); break;
      case 'grow': parts.push('ใช้แล้วโจมตีเพิ่มถาวร +' + v); break;
      case 'haste': parts.push('เร่ง' + tgtName(f.tgt) + ' ' + v + ' วิ'); break;
      case 'charge': parts.push('ชาร์จ' + tgtName(f.tgt) + ' ' + v + ' วิ'); break;
      case 'slow': parts.push('หน่วงศัตรู ' + (f.n || 1) + ' ชิ้น ' + v + ' วิ'); break;
      case 'maxhp': parts.push('HP สูงสุด +' + v); break;
      case 'startShield': parts.push('เริ่มรบมีโล่ ' + v); break;
      case 'startCharge': parts.push('เริ่มรบ ทุกชิ้นชาร์จล่วงหน้า ' + v + ' วิ'); break;
      case 'startHaste': parts.push('เริ่มรบ เร่งทุกชิ้น ' + v + ' วิ'); break;
      case 'startRegen': parts.push('เริ่มรบ ฟื้นฟู ' + v + '/วิ'); break;
      case 'income': parts.push('ได้ทอง +' + v + ' ต่อวัน'); break;
      case 'auraWeaponDmg': parts.push('อาวุธทุกชิ้นโจมตีเพิ่ม +' + v); break;
      case 'auraCrit': parts.push('อาวุธทุกชิ้นคริเพิ่ม +' + v + '%'); break;
    }
  });
  return (def.cd > 0 ? 'ทุก ' + (def.cd / 1000) + ' วิ: ' : 'ติดตัว: ') + parts.join(' · ');
}
function tgtName(t) { return { self: 'ตัวเอง', adj: 'ชิ้นข้างเคียง', all: 'ทุกชิ้น', weapon: 'อาวุธทุกชิ้น', random: 'สุ่ม 1 ชิ้น' }[t] || ''; }
function skillDescr(def, tier) { return def.text.replace('{v}', fmtNum(fxVal(def.fx[0], tier))); }
function itemCost(def, tier) { return BAL.COST_BY_SIZE[def.size] + BAL.COST_PER_TIER * tier; }
function skillCost(tier) { return BAL.SKILL_COST + BAL.COST_PER_TIER * tier; }
function sellPrice(def, tier) { return Math.max(1, Math.floor(itemCost(def, tier) * BAL.SELL_RATE)); }

if (typeof module !== 'undefined') module.exports = { BAL: BAL, TIERS: TIERS, SIZE_NAME: SIZE_NAME, TAG_NAME: TAG_NAME, ITEMS: ITEMS, ITEM_BY_ID: ITEM_BY_ID, SKILLS: SKILLS, SKILL_BY_ID: SKILL_BY_ID, HEROES: HEROES, HERO_BY_ID: HERO_BY_ID, ELEMENTS: ELEMENTS, EVENTS: EVENTS, countElems: countElems, elemBonuses: elemBonuses, fxVal: fxVal, fmtNum: fmtNum, itemDescr: itemDescr, skillDescr: skillDescr, itemCost: itemCost, skillCost: skillCost, sellPrice: sellPrice };
