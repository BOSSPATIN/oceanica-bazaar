// Oceanica Bazaar — สถานะรัน (ร้าน / กระดาน / ผี / เซฟ) ไม่แตะ DOM
'use strict';
var Game = (function () {
  var SAVE_KEY = 'oceanica_bazaar_save_v1';
  var G = null;
  var uidN = 1;

  function rndPick(rnd, arr, wkey) {
    var tot = 0; arr.forEach(function (x) { tot += (wkey ? x[wkey] : 1); });
    var r = rnd() * tot;
    for (var i = 0; i < arr.length; i++) { r -= (wkey ? arr[i][wkey] : 1); if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }
  // ระดับไอเทมในร้าน/ผี ตามวัน
  function rollTier(rnd, day) {
    var p3 = Math.max(0, (day - 8) * 0.15), p2 = Math.max(0, (day - 5) * 0.2), p1 = Math.max(0, (day - 2) * 0.25);
    var r = rnd();
    if (r < p3) return 3; r -= p3;
    if (r < p2) return 2; r -= p2;
    if (r < p1) return 1;
    return 0;
  }

  function newRun(heroId) {
    var hero = HERO_BY_ID[heroId];
    var seed = (Date.now() % 2147483647) >>> 0;
    G = {
      heroId: heroId, seed: seed, day: 1, wins: 0, lives: BAL.LIVES, gold: BAL.START_GOLD, xp: 0,
      board: [], stash: [], skills: [{ id: hero.skill, tier: 0 }], shop: [], rerolls: 0,
      screen: 'shop', history: [], lastBattle: null, ended: null, shopN: 0,
      permHp: 0, event: null, bonusFight: null, freeRerolls: 0, streak: 0, bestStreak: 0,
    };
    var pos = 0;
    hero.items.forEach(function (id) { var d = ITEM_BY_ID[id]; G.board.push({ uid: uidN++, id: id, tier: 0, pos: pos }); pos += d.size; });
    genShop();
    save();
    return G;
  }

  function shopRnd() { return Combat.mulberry(G.seed + G.day * 1000 + G.shopN * 7919); }
  function genShop() {
    G.shopN++;
    var rnd = shopRnd();
    // ของที่ล็อกไว้ (🔒) อยู่ต่อ ไม่ถูกสุ่มทิ้ง
    G.shop = G.shop.filter(function (o) { return o.locked && !o.sold; });
    var hasSkill = G.shop.some(function (o) { return o.type === 'skill'; });
    var nSkill = (!hasSkill && G.day >= 2 && rnd() < 0.6) ? 1 : 0;
    var used = {}; G.shop.forEach(function (o) { used[o.id] = 1; });
    for (var i = G.shop.length; i < 4 - nSkill; i++) {
      var def, guard = 0;
      do { def = rndPick(rnd, ITEMS, 'w'); } while (used[def.id] && guard++ < 20);
      used[def.id] = 1;
      var tier = rollTier(rnd, G.day);
      G.shop.push({ type: 'item', id: def.id, tier: tier, cost: itemCost(def, tier), sold: false });
    }
    if (nSkill) {
      var owned = {}; G.skills.forEach(function (s) { owned[s.id] = s.tier; });
      var pool = SKILLS.filter(function (s) { return owned[s.id] === undefined || owned[s.id] < 3; });
      var sk = rndPick(rnd, pool, 'w');
      var st = owned[sk.id] !== undefined ? owned[sk.id] + 1 : rollTier(rnd, G.day);
      G.shop.push({ type: 'skill', id: sk.id, tier: st, cost: skillCost(st), sold: false });
    }
  }

  // ---- กระดาน ----
  function occupied() {
    var occ = new Array(BAL.BOARD_SLOTS).fill(null);
    G.board.forEach(function (it) { var d = ITEM_BY_ID[it.id]; for (var i = 0; i < d.size; i++) occ[it.pos + i] = it; });
    return occ;
  }
  function sameRow(pos, size) { return Math.floor(pos / BAL.BOARD_ROW) === Math.floor((pos + size - 1) / BAL.BOARD_ROW); }
  function findSlot(size, ignoreUid) {
    var occ = occupied();
    for (var p = 0; p + size <= BAL.BOARD_SLOTS; p++) {
      if (!sameRow(p, size)) continue;
      var ok = true;
      for (var i = 0; i < size; i++) if (occ[p + i] && occ[p + i].uid !== ignoreUid) { ok = false; break; }
      if (ok) return p;
    }
    return -1;
  }
  function findOwned(id, tier) {
    var all = G.board.concat(G.stash);
    for (var i = 0; i < all.length; i++) if (all[i].id === id && all[i].tier === tier) return all[i];
    return null;
  }
  function canBuy(i) {
    var o = G.shop[i];
    if (!o || o.sold) return { ok: false, why: 'ขายแล้ว' };
    if (G.gold < o.cost) return { ok: false, why: 'ทองไม่พอ' };
    if (o.type === 'skill') return { ok: true, why: '' };
    var def = ITEM_BY_ID[o.id];
    if (o.tier < 3 && findOwned(o.id, o.tier)) return { ok: true, why: 'merge' };
    if (findSlot(def.size) >= 0) return { ok: true, why: '' };
    if (G.stash.length < BAL.STASH_SLOTS) return { ok: true, why: 'stash' };
    return { ok: false, why: 'ไม่มีที่ว่าง' };
  }
  function buy(i, pos) {
    var c = canBuy(i); if (!c.ok) return c;
    var o = G.shop[i];
    G.gold -= o.cost; o.sold = true;
    if (o.type === 'skill') {
      var ex = null; G.skills.forEach(function (s) { if (s.id === o.id) ex = s; });
      if (ex) ex.tier = Math.max(ex.tier, o.tier); else G.skills.push({ id: o.id, tier: o.tier });
      save(); return { ok: true, msg: 'เรียนตำรา ' + SKILL_BY_ID[o.id].name + ' (' + TIERS[o.tier] + ')' };
    }
    var def = ITEM_BY_ID[o.id];
    G.xp++;
    if (c.why === 'merge') {
      var own = findOwned(o.id, o.tier); own.tier++;
      save(); return { ok: true, msg: def.icon + ' ' + def.name + ' รวมร่าง → ' + TIERS[own.tier] + '!' };
    }
    var item = { uid: uidN++, id: o.id, tier: o.tier, pos: -1 };
    if (pos !== undefined && pos !== null) {
      // ลากจากร้านไปวางช่องที่เลือก — ใส่ช่องเก็บชั่วคราวแล้วให้ placeAt จัดการสลับ
      G.stash.push(item);
      var pr = placeAt(item.uid, pos);
      if (pr.ok) return { ok: true, msg: 'ซื้อ ' + def.icon + ' ' + def.name + (pr.msg ? ' · ' + pr.msg : '') };
      G.stash.splice(G.stash.indexOf(item), 1);
    }
    var p = findSlot(def.size);
    if (p >= 0) { item.pos = p; G.board.push(item); } else { G.stash.push(item); }
    save(); return { ok: true, msg: 'ซื้อ ' + def.icon + ' ' + def.name + (p < 0 ? ' (เข้าช่องเก็บ)' : '') };
  }
  function reroll() {
    if (G.freeRerolls > 0) { G.freeRerolls--; G.rerolls++; genShop(); save(); return { ok: true, msg: 'สุ่มร้านฟรี' }; }
    if (G.gold < BAL.REROLL_COST) return { ok: false, why: 'ทองไม่พอ' };
    G.gold -= BAL.REROLL_COST; G.rerolls++; genShop(); save(); return { ok: true };
  }
  function findItem(uid) {
    for (var i = 0; i < G.board.length; i++) if (G.board[i].uid === uid) return { it: G.board[i], where: 'board' };
    for (var j = 0; j < G.stash.length; j++) if (G.stash[j].uid === uid) return { it: G.stash[j], where: 'stash' };
    return null;
  }
  function sell(uid) {
    var f = findItem(uid); if (!f) return { ok: false };
    var def = ITEM_BY_ID[f.it.id], price = sellPrice(def, f.it.tier);
    G.gold += price;
    if (f.where === 'board') G.board.splice(G.board.indexOf(f.it), 1); else G.stash.splice(G.stash.indexOf(f.it), 1);
    save(); return { ok: true, msg: 'ขาย ' + def.name + ' ได้ ' + price + ' ทอง' };
  }
  function toStash(uid) {
    var f = findItem(uid); if (!f || f.where !== 'board') return { ok: false };
    if (G.stash.length >= BAL.STASH_SLOTS) return { ok: false, why: 'ช่องเก็บเต็ม' };
    G.board.splice(G.board.indexOf(f.it), 1); f.it.pos = -1; G.stash.push(f.it); save(); return { ok: true };
  }
  function toBoard(uid) {
    var f = findItem(uid); if (!f || f.where !== 'stash') return { ok: false };
    var p = findSlot(ITEM_BY_ID[f.it.id].size); if (p < 0) return { ok: false, why: 'กระดานไม่มีที่ว่าง' };
    G.stash.splice(G.stash.indexOf(f.it), 1); f.it.pos = p; G.board.push(f.it); save(); return { ok: true };
  }
  function move(uid, dir) {
    var f = findItem(uid); if (!f || f.where !== 'board') return { ok: false };
    var it = f.it, d = ITEM_BY_ID[it.id], np = it.pos + dir;
    if (np < 0 || np + d.size > BAL.BOARD_SLOTS) return { ok: false };
    if (!sameRow(np, d.size)) return { ok: false, why: 'ของชิ้นเดียวต้องอยู่แถวเดียวกัน' };
    var occ = occupied();
    var blocker = dir < 0 ? occ[np] : occ[np + d.size - 1];
    if (blocker && blocker.uid !== it.uid) {
      // สลับกับชิ้นที่ขวาง
      var bd = ITEM_BY_ID[blocker.id];
      if (dir < 0) { var newBlk = it.pos + d.size - bd.size; it.pos = blocker.pos; blocker.pos = newBlk; }
      else { blocker.pos = it.pos; it.pos = it.pos + bd.size; }
      save(); return { ok: true };
    }
    it.pos = np; save(); return { ok: true };
  }

  function fits(pos, size, ignore) {
    if (pos < 0 || pos + size > BAL.BOARD_SLOTS || !sameRow(pos, size)) return false;
    var occ = occupied();
    for (var i = 0; i < size; i++) if (occ[pos + i] && (ignore || []).indexOf(occ[pos + i].uid) < 0) return false;
    return true;
  }
  // ลาก-วาง: วางชิ้น uid ที่ช่อง pos (จากกระดานหรือช่องเก็บ) ทับ 1 ชิ้น = สลับที่ให้
  function placeAt(uid, pos) {
    var f = findItem(uid); if (!f) return { ok: false };
    var it = f.it, d = ITEM_BY_ID[it.id];
    pos = Math.max(0, Math.min(BAL.BOARD_SLOTS - d.size, pos));
    if (!sameRow(pos, d.size)) { var rowEnd = (Math.floor(pos / BAL.BOARD_ROW) + 1) * BAL.BOARD_ROW; pos = Math.max(Math.floor(pos / BAL.BOARD_ROW) * BAL.BOARD_ROW, rowEnd - d.size); }  // ดันให้อยู่ในแถวเดียวกัน
    var occ = occupied(), blockers = [];
    for (var i = 0; i < d.size; i++) { var b = occ[pos + i]; if (b && b.uid !== uid && blockers.indexOf(b) < 0) blockers.push(b); }
    if (blockers.length === 0) {
      if (f.where === 'stash') G.stash.splice(G.stash.indexOf(it), 1), G.board.push(it);
      it.pos = pos; save(); return { ok: true };
    }
    if (blockers.length > 1) return { ok: false, why: 'วางตรงนี้ไม่ได้ ทับของ ' + blockers.length + ' ชิ้น' };
    var bk = blockers[0], bd = ITEM_BY_ID[bk.id], oldPos = it.pos, oldWhere = f.where;
    // ถอดทั้งสองชิ้นออกก่อน แล้ววางชิ้นที่ลากลงที่ใหม่
    G.board = G.board.filter(function (x) { return x.uid !== uid && x.uid !== bk.uid; });
    if (oldWhere === 'stash') G.stash.splice(G.stash.indexOf(it), 1);
    it.pos = pos; G.board.push(it);
    var bp = (oldWhere === 'board' && fits(oldPos, bd.size)) ? oldPos : findSlot(bd.size);
    if (bp >= 0) { bk.pos = bp; G.board.push(bk); save(); return { ok: true, msg: 'สลับที่กับ ' + bd.icon + ' ' + bd.name }; }
    if (G.stash.length < BAL.STASH_SLOTS) { bk.pos = -1; G.stash.push(bk); save(); return { ok: true, msg: bd.icon + ' ' + bd.name + ' ถูกย้ายไปช่องเก็บ' }; }
    // คืนสภาพเดิม
    G.board = G.board.filter(function (x) { return x.uid !== uid; });
    G.board.push(bk);
    if (oldWhere === 'stash') { it.pos = -1; G.stash.push(it); } else { it.pos = oldPos; G.board.push(it); }
    return { ok: false, why: 'สลับไม่ได้ ไม่มีที่ให้ ' + bd.name };
  }
  function level() { return Math.floor(G.xp / BAL.XP_PER_LEVEL) + 1; }
  function maxHp() { return HERO_BY_ID[G.heroId].hp + BAL.HP_PER_LEVEL * (level() - 1) + (G.permHp || 0); }
  function toggleLock(i) { var o = G.shop[i]; if (!o || o.sold) return; o.locked = !o.locked; save(); }

  // ---- เหตุการณ์ระหว่างวัน ----
  function genEvent() {
    var rnd = Combat.mulberry((G.seed + G.day * 77 + 13) >>> 0);
    if (G.day < 2 || rnd() > 0.65) return null;
    var ev = rndPick(rnd, EVENTS, 'w');
    var e = { id: ev.id, seed: Math.floor(rnd() * 1e9) };
    if (ev.id === 'merchant') {
      var def = rndPick(rnd, ITEMS, 'w'), tier = Math.min(3, rollTier(rnd, G.day) + 1);
      e.item = { id: def.id, tier: tier, cost: itemCost(def, tier) };
    }
    return e;
  }
  function addItem(id, tier) {
    var def = ITEM_BY_ID[id], item = { uid: uidN++, id: id, tier: tier, pos: -1 };
    var own = tier < 3 ? findOwned(id, tier) : null;
    if (own) { own.tier++; return def.icon + ' ' + def.name + ' รวมร่าง → ' + TIERS[own.tier]; }
    var p = findSlot(def.size);
    if (p >= 0) { item.pos = p; G.board.push(item); return 'ได้ ' + def.icon + ' ' + def.name + ' (' + TIERS[tier] + ')'; }
    if (G.stash.length < BAL.STASH_SLOTS) { G.stash.push(item); return 'ได้ ' + def.icon + ' ' + def.name + ' (เข้าช่องเก็บ)'; }
    var g = sellPrice(def, tier); G.gold += g; return 'ที่เต็ม ขาย ' + def.name + ' ได้ทอง +' + g;
  }
  function chooseEvent(ci) {
    var e = G.event; if (!e) return { ok: false };
    var ev = EVENTS.filter(function (x) { return x.id === e.id; })[0], ch = ev.choices[ci];
    var rnd = Combat.mulberry(e.seed), msg = '';
    switch (ch.k) {
      case 'gold': G.gold = Math.max(0, G.gold + ch.v); msg = 'ทอง ' + (ch.v > 0 ? '+' : '') + ch.v; break;
      case 'freeItem': { var d = rndPick(rnd, ITEMS, 'w'); msg = addItem(d.id, rollTier(rnd, G.day)); break; }
      case 'freeCrew': { var crew = ITEMS.filter(function (x) { return x.tags.indexOf('crew') >= 0; }); var dc = rndPick(rnd, crew, 'w'); msg = addItem(dc.id, rollTier(rnd, G.day)); break; }
      case 'upgradeRandom': {
        var cands = G.board.filter(function (it) { return it.tier < 3; });
        if (!cands.length) { G.gold += 4; msg = 'ไม่มีชิ้นที่อัพได้ ได้ทอง +4 แทน'; break; }
        var it = cands[Math.floor(rnd() * cands.length)]; it.tier++; msg = ITEM_BY_ID[it.id].icon + ' ' + ITEM_BY_ID[it.id].name + ' อัพเป็น ' + TIERS[it.tier]; break;
      }
      case 'maxhp': G.permHp += ch.v; msg = 'HP สูงสุด +' + ch.v + ' ถาวร'; break;
      case 'freeSkill': {
        var owned = {}; G.skills.forEach(function (s) { owned[s.id] = s.tier; });
        var pool = SKILLS.filter(function (s) { return owned[s.id] === undefined || owned[s.id] < 3; });
        if (!pool.length) { G.gold += 5; msg = 'ตำราเต็มแล้ว ได้ทอง +5 แทน'; break; }
        var sk = rndPick(rnd, pool, 'w');
        if (owned[sk.id] !== undefined) { G.skills.forEach(function (s) { if (s.id === sk.id) s.tier++; }); msg = 'ตำรา ' + sk.name + ' อัพระดับ'; }
        else { G.skills.push({ id: sk.id, tier: 0 }); msg = 'เรียนตำรา ' + sk.icon + ' ' + sk.name; }
        break;
      }
      case 'goldReroll': G.gold += ch.v; G.freeRerolls = (G.freeRerolls || 0) + 1; msg = 'ทอง +' + ch.v + ' และสุ่มร้านฟรี 1 ครั้ง'; break;
      case 'buySpecial': {
        var sp = e.item, sd = ITEM_BY_ID[sp.id];
        if (G.gold < sp.cost) return { ok: false, why: 'ทองไม่พอ' };
        G.gold -= sp.cost; G.xp++; msg = addItem(sp.id, sp.tier); break;
      }
      case 'bonusFight': G.bonusFight = { reward: ch.v }; G.event = null; G.screen = 'shop'; save(); return { ok: true, msg: 'เตรียมรบโจรสลัด! ชนะได้ทอง +' + ch.v + ' แพ้ไม่เสียเรือ', fight: true };
      case 'none': msg = 'ผ่านไป'; break;
    }
    G.event = null; G.screen = 'shop'; save();
    return { ok: true, msg: ev.icon + ' ' + ev.name + ': ' + msg };
  }

  // ---- สถิติข้ามรัน ----
  var STATS_KEY = 'oceanica_bazaar_stats_v1';
  function loadStats() { try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { runs: 0, victories: 0, bestWins: 0, heroes: {} }; } catch (e) { return { runs: 0, victories: 0, bestWins: 0, heroes: {} }; } }
  function recordStats() {
    if (typeof localStorage === 'undefined') return;
    var st = loadStats(); st.runs++; if (G.ended === 'victory') st.victories++; st.bestWins = Math.max(st.bestWins, G.wins);
    var h = st.heroes[G.heroId] || { runs: 0, victories: 0 }; h.runs++; if (G.ended === 'victory') h.victories++; st.heroes[G.heroId] = h;
    try { localStorage.setItem(STATS_KEY, JSON.stringify(st)); } catch (e) { }
  }
  function income() {
    var inc = BAL.INCOME_BASE + G.day;
    elemBonuses(G.board.map(function (it) { return it.id; })).forEach(function (b) { inc += b.mods.income || 0; });   // โบนัสหมวดสมบัติ
    G.board.forEach(function (it) { ITEM_BY_ID[it.id].fx.forEach(function (f) { if (f.k === 'income') inc += fxVal(f, it.tier); }); });
    G.skills.forEach(function (s) { SKILL_BY_ID[s.id].fx.forEach(function (f) { if (f.k === 'income') inc += fxVal(f, s.tier); }); });
    return inc;
  }

  function playerSpec() {
    var hero = HERO_BY_ID[G.heroId];
    return { name: hero.name + ' ' + hero.cls, icon: hero.icon, hp: maxHp(), items: G.board.map(function (it) { return { id: it.id, tier: it.tier, pos: it.pos }; }), skills: G.skills.slice() };
  }
  // ผี = คู่ต่อสู้ที่ระบบสร้างตามวัน (seed ตายตัวต่อวัน → รบซ้ำได้ผลเดิม)
  // บอสประจำวัน (BAL.BOSS_DAYS) — กระดานตายตัว ระดับตาม tier ของบอส HP ฐาน + ต่อวัน
  // บอสของวันนี้: วันบอสมีตัวเลือก 2 ตัว สุ่มตาม seed ของรัน (รันเดียวกันได้ตัวเดิม)
  function bossFor(day, seed) {
    var arr = BAL.BOSS_DAYS[day]; if (!arr) return null;
    if (seed === undefined) seed = G ? G.seed : 1;
    return BOSS_BY_ID[arr[Math.floor(Combat.mulberry((seed + day * 97) >>> 0)() * arr.length)]];
  }
  function bossSpec(day, seed) {
    var b = bossFor(day, seed), pos = 0, items = [];
    b.items.forEach(function (id) { var d = ITEM_BY_ID[id]; if (!sameRow(pos, d.size)) pos = BAL.BOARD_ROW; if (pos + d.size > BAL.BOARD_SLOTS) return; items.push({ id: id, tier: b.tier, pos: pos }); pos += d.size; });
    return { name: b.name + ' (บอสวันที่ ' + day + ')', icon: b.icon, hp: b.hp + BAL.GHOST_HP_PER_DAY * day, items: items, skills: b.skills.map(function (s) { return { id: s.id, tier: s.tier }; }), boss: b.id, kind: 'boss', mods: b.mods || {}, text: b.text };
  }
  // ศัตรูรายวัน (10-16): สุ่มจากโหล ENEMIES 3 ประเภท (สัตว์ประหลาด/ผี/โจรสลัด) — kind = บังคับประเภท (รบพิเศษ = โจรสลัด)
  function ghostSpec(day, seed, noBoss, kind) {
    if (!noBoss && BAL.BOSS_DAYS[day]) return bossSpec(day, seed);
    var rnd = Combat.mulberry((seed + day * 31337) >>> 0);
    var pool0 = kind ? ENEMIES.filter(function (e) { return e.kind === kind; }) : ENEMIES;
    var en = rndPick(rnd, pool0, 'w');
    var arch = ARCH_BY_ID[en.arch];
    var slots = BAL.GHOST_SLOTS(day), pos = 0, items = [], guard = 0, tday = day - BAL.GHOST_TIER_LAG;
    // ไอเทมเข้าสาย = น้ำหนักสุ่ม ×GHOST_TAG_W ทำให้ของผีเสริมกันเอง (โบนัสธาตุ/หมวด/ตำรา)
    var pool = ITEMS.map(function (d) { var hit = d.tags.some(function (t) { return arch.tags.indexOf(t) >= 0; }); return { def: d, w: d.w * (hit ? BAL.GHOST_TAG_W : 1) }; });
    en.items.forEach(function (id) { if (pos + ITEM_BY_ID[id].size <= slots && sameRow(pos, ITEM_BY_ID[id].size)) { items.push({ id: id, tier: rollTier(rnd, tday), pos: pos }); pos += ITEM_BY_ID[id].size; } });
    while (pos < slots && guard++ < 200) {
      var def = rndPick(rnd, pool, 'w').def;
      if (def.size > slots - pos || !sameRow(pos, def.size)) continue;
      items.push({ id: def.id, tier: rollTier(rnd, tday), pos: pos }); pos += def.size;
    }
    var skills = [{ id: arch.skill, tier: Math.min(3, Math.floor(day / 4)) }];
    if (en.skill !== arch.skill) skills.push({ id: en.skill, tier: Math.min(3, Math.floor(day / 5)) });
    for (var i = 0; i < BAL.GHOST_SKILLS(day); i++) { var sk = rndPick(rnd, SKILLS, 'w'); if (!skills.some(function (s) { return s.id === sk.id; })) skills.push({ id: sk.id, tier: rollTier(rnd, tday) }); }
    var hp = en.hp + BAL.GHOST_HP_PER_DAY * day + BAL.HP_PER_LEVEL * Math.floor(day / 3);
    return { name: en.name + ' (วันที่ ' + day + ')', icon: en.icon, hp: hp, items: items, skills: skills, arch: arch.id, enemy: en.id, kind: en.kind, mods: day >= 2 ? (en.mods || {}) : {}, text: en.text };
  }
  // โจรสลัด (รบพิเศษ) = ศัตรูประเภทโจรสลัด ระดับของวันก่อนหน้า (ไม่เอาบอส)
  function pirateSpec() { var g = ghostSpec(Math.max(1, G.day - 1), G.seed + 4242, true, 'pirate'); g.name = g.name.replace(/ \(วันที่ \d+\)$/, ''); return g; }
  function makeBattle() {
    if (G.bonusFight) return Combat.create(playerSpec(), pirateSpec(), (G.seed + G.day * 303) >>> 0);
    return Combat.create(playerSpec(), ghostSpec(G.day, G.seed), (G.seed + G.day * 101) >>> 0);
  }

  function afterBattle(result) {
    if (G.bonusFight) {
      var rw = G.bonusFight.reward; G.bonusFight = null;
      if (result === 'win') G.gold += rw;
      G.history.push({ day: G.day, result: result, bonus: true });
      G.screen = 'shop'; save(); return { bonus: true, result: result, reward: result === 'win' ? rw : 0 };
    }
    G.history.push({ day: G.day, result: result });
    var reward = null;
    if (result === 'win') { G.wins++; G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak); reward = winReward(G.streak); G.gold += reward.total; }
    else if (result === 'lose') { G.lives--; G.streak = 0; }
    if (G.wins >= BAL.WIN_TARGET) { G.ended = 'victory'; G.screen = 'end'; recordStats(); save(); return; }
    if (G.lives <= 0) { G.ended = 'defeat'; G.screen = 'end'; recordStats(); save(); return; }
    if (G.day >= BAL.MAX_DAY) { G.ended = 'timeout'; G.screen = 'end'; recordStats(); save(); return; }
    G.day++;
    G.gold += income();
    G.shopN = 0; genShop();
    G.event = genEvent();
    G.screen = G.event ? 'event' : 'shop';
    save();
    return reward;
  }
  // ทองจากการชนะ: ฐาน + โบนัสขั้นบันไดตามจำนวนชนะติดต่อกัน
  function winReward(streak) {
    var bonus = Math.min(BAL.STREAK_CAP, BAL.STREAK_STEP * Math.max(0, streak - 1));
    return { base: BAL.WIN_GOLD, bonus: bonus, total: BAL.WIN_GOLD + bonus, streak: streak };
  }

  function save() { if (typeof localStorage !== 'undefined') { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { } } }
  function load() {
    if (typeof localStorage === 'undefined') return null;
    try { var s = localStorage.getItem(SAVE_KEY); if (!s) return null; G = JSON.parse(s); } catch (e) { return null; }
    var mx = 0; G.board.concat(G.stash).forEach(function (it) { mx = Math.max(mx, it.uid); }); uidN = mx + 1;
    if (G.screen === 'battle' || G.screen === 'result') G.screen = 'shop';
    if (G.permHp === undefined) { G.permHp = 0; G.event = null; G.bonusFight = null; G.freeRerolls = 0; }
    if (G.streak === undefined) { G.streak = 0; G.bestStreak = 0; }
    return G;
  }
  function clear() { G = null; if (typeof localStorage !== 'undefined') localStorage.removeItem(SAVE_KEY); }

  return {
    get: function () { return G; }, newRun: newRun, genShop: genShop, canBuy: canBuy, buy: buy, reroll: reroll, sell: sell, toStash: toStash, toBoard: toBoard, move: move,
    findSlot: findSlot, occupied: occupied, placeAt: placeAt, fits: fits, sameRow: sameRow, level: level, maxHp: maxHp, income: income, playerSpec: playerSpec, ghostSpec: ghostSpec, pirateSpec: pirateSpec, bossFor: bossFor, makeBattle: makeBattle, afterBattle: afterBattle,
    toggleLock: toggleLock, genEvent: genEvent, chooseEvent: chooseEvent, loadStats: loadStats, winReward: winReward,
    save: save, load: load, clear: clear, setScreen: function (s) { G.screen = s; save(); },
  };
})();
if (typeof module !== 'undefined') module.exports = Game;
