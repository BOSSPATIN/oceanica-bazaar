// Oceanica Bazaar — เอนจินรบอัตโนมัติ (deterministic ด้วย seed) ไม่แตะ DOM
'use strict';
var Combat = (function () {
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // spec: { name, icon, hp, items:[{id,tier,pos}], skills:[{id,tier}] }
  function makeSide(spec, key) {
    var s = {
      key: key, name: spec.name, icon: spec.icon, maxhp: spec.hp, hp: spec.hp,
      shield: 0, burn: 0, poison: 0, regen: 0, burnT: 0, poisT: 0, regT: 0,
      dealt: 0, taken: 0, berserked: false, items: [], skills: [],
    };
    (spec.items || []).slice().sort(function (a, b) { return a.pos - b.pos; }).forEach(function (it) {
      var def = ITEM_BY_ID[it.id];
      if (!def) throw new Error('ไม่รู้จักไอเทม ' + it.id);
      s.items.push({ def: def, tier: it.tier || 0, pos: it.pos, cd: def.cd, timer: 0, haste: 0, slow: 0, bonus: 0, uses: 0, dealt: 0, healed: 0, shielded: 0 });
    });
    (spec.skills || []).forEach(function (sk) {
      var def = SKILL_BY_ID[sk.id];
      if (!def) throw new Error('ไม่รู้จักตำรา ' + sk.id);
      s.skills.push({ def: def, tier: sk.tier || 0 });
    });
    return s;
  }

  function skillVal(side, kind) {
    var sum = 0;
    side.skills.forEach(function (sk) { sk.def.fx.forEach(function (f) { if (f.k === kind) sum += fxVal(f, sk.tier); }); });
    return sum;
  }
  function itemPassive(side, kind) {
    var sum = 0;
    side.items.forEach(function (it) { it.def.fx.forEach(function (f) { if (f.k === kind) sum += fxVal(f, it.tier); }); });
    return sum;
  }

  function prepare(side) {
    // โบนัสธาตุจากชิ้นบนกระดาน
    side.elems = elemBonuses(side.items.map(function (it) { return it.def.id; }));
    var em = {}; side.elems.forEach(function (b) { Object.keys(b.mods).forEach(function (k) { em[k] = (em[k] || 0) + b.mods[k]; }); });
    side.emods = em;
    side.maxhp += itemPassive(side, 'maxhp') + skillVal(side, 'maxhp') + (em.maxhp || 0);
    side.hp = side.maxhp;
    side.shield = itemPassive(side, 'startShield') + skillVal(side, 'startShield') + (em.startShield || 0);
    side.regen = itemPassive(side, 'startRegen') + (em.startRegen || 0);
    var charge = (itemPassive(side, 'startCharge') + skillVal(side, 'startCharge')) * 1000;
    var haste = itemPassive(side, 'startHaste') * 1000;
    side.items.forEach(function (it) { if (it.cd > 0) { it.timer = Math.min(it.cd - 1, charge); it.haste = haste; } });
    side.mods = {
      weaponDmg: skillVal(side, 'weaponDmg') + itemPassive(side, 'auraWeaponDmg') + (em.weaponDmg || 0),
      crit: itemPassive(side, 'auraCrit') + (em.crit || 0),
      burn: skillVal(side, 'burnBonus') + (em.burn || 0), poison: skillVal(side, 'poisonBonus'),
      heal: skillVal(side, 'healBonus') + (em.heal || 0), shield: skillVal(side, 'shieldBonus') + (em.shield || 0),
      slow: em.slow || 0,
      berserk: skillVal(side, 'berserk'),
    };
  }
  function applyStartFoe(B, me, foe) {
    if (me.emods.startBurnFoe) { foe.burn += me.emods.startBurnFoe; log(B, me, '<span class="burn">🔥 โบนัสธาตุไฟ: ศัตรูติดเผา ' + me.emods.startBurnFoe + '</span>'); }
    if (me.emods.startSlowFoe) { foe.items.forEach(function (x) { if (isActive(x)) x.slow += me.emods.startSlowFoe * 1000; }); log(B, me, '<span class="avo">💧 โบนัสธาตุน้ำ: หน่วงศัตรูทุกชิ้น ' + me.emods.startSlowFoe + ' วิ</span>'); }
  }

  function create(specA, specB, seed) {
    var B = { t: 0, over: false, result: null, events: [], stormT: 0, stormN: 0, rnd: mulberry(seed || 1) };
    B.a = makeSide(specA, 'a'); B.b = makeSide(specB, 'b');
    prepare(B.a); prepare(B.b);
    [B.a, B.b].forEach(function (s) { if (s.elems.length) log(B, s, s.elems.map(function (b) { return b.el.icon + ' ' + b.el.name + ' ' + b.n + ' ชิ้น: ' + b.text; }).join(' · ')); });
    applyStartFoe(B, B.a, B.b); applyStartFoe(B, B.b, B.a);
    return B;
  }

  // extra: { item: index ของชิ้นที่ทำงาน, fx: [{k, v, crit}] } ให้ UI ทำแอนิเมชัน/ตัวเลขลอย
  function log(B, side, text, cls, extra) { var e = { t: B.t, side: side ? side.key : '', text: text, cls: cls || '' }; if (extra) { e.item = extra.item; e.fx = extra.fx; } B.events.push(e); }

  function dealDamage(foe, v) {
    v = Math.round(v);
    var toShield = Math.min(foe.shield, v);
    foe.shield -= toShield;
    foe.hp -= (v - toShield);
    foe.taken += v;
    return v;
  }
  function healSide(side, v) {
    v = Math.round(v);
    var before = side.hp;
    side.hp = Math.min(side.maxhp, side.hp + v);
    return side.hp - before;
  }

  function isActive(it) { return it.cd > 0; }
  // ข้างเคียง = ชิ้นที่ "ติดกัน" บนกระดาน 2 แถว×5: ซ้าย/ขวาในแถวเดียวกัน หรืออยู่คนละแถวแต่คอลัมน์ซ้อนกัน
  function touching(a, b) {
    var R = BAL.BOARD_ROW, ra = Math.floor(a.pos / R), rb = Math.floor(b.pos / R);
    var a0 = a.pos % R, a1 = a0 + a.def.size - 1, b0 = b.pos % R, b1 = b0 + b.def.size - 1;
    if (ra === rb) return a1 + 1 === b0 || b1 + 1 === a0;
    return Math.abs(ra - rb) === 1 && a0 <= b1 && b0 <= a1;
  }
  function targets(side, it, tgt, rnd) {
    var act = side.items.filter(isActive);
    if (tgt === 'self') return [it];
    if (tgt === 'all') return act;
    if (tgt === 'weapon') return act.filter(function (x) { return x.def.tags.indexOf('weapon') >= 0; });
    if (tgt === 'random') { var others = act.filter(function (x) { return x !== it; }); return others.length ? [others[Math.floor(rnd() * others.length)]] : []; }
    if (tgt === 'adj') return side.items.filter(function (x) { return x !== it && touching(it, x) && isActive(x); });
    return [];
  }

  function trigger(B, me, foe, it) {
    it.uses++;
    var m = me.mods, d = it.def, parts = [], cls = '', fxs = [];
    d.fx.forEach(function (f) {
      var v = fxVal(f, it.tier);
      switch (f.k) {
        case 'dmg': {
          var isW = d.tags.indexOf('weapon') >= 0;
          v += it.bonus + (isW ? m.weaponDmg : 0);
          var critC = (f.crit || 0) + (isW ? m.crit : 0);
          var n = f.n || 1, total = 0, crit = false;
          for (var i = 0; i < n; i++) {
            var hit = v;
            if (critC > 0 && B.rnd() * 100 < critC) { hit *= 2; crit = true; }
            total += dealDamage(foe, hit);
          }
          me.dealt += total; it.dealt += total;
          if (f.ls) { var h = healSide(me, total * f.ls / 100); it.healed += h; }
          parts.push('โจมตี ' + total + (crit ? ' <span class="cri">คริ!</span>' : '') + (f.ls ? ' ดูดเลือด' : ''));
          fxs.push({ k: 'dmg', v: total, crit: crit });
          break;
        }
        case 'shield': v += m.shield; me.shield += v; it.shielded += v; parts.push('โล่ +' + v); fxs.push({ k: 'shield', v: v }); break;
        case 'heal': v += m.heal; var hh = healSide(me, v); it.healed += hh; parts.push('ฮีล +' + hh); fxs.push({ k: 'heal', v: hh }); break;
        case 'burn': v += m.burn; foe.burn += v; parts.push('<span class="burn">เผา +' + v + '</span>'); fxs.push({ k: 'burn', v: v }); break;
        case 'poison': v += m.poison; foe.poison += v; parts.push('<span class="poi">พิษ +' + v + '</span>'); fxs.push({ k: 'poison', v: v }); break;
        case 'regen': me.regen += v; parts.push('ฟื้นฟู +' + v); break;
        case 'cleanse': if (me.burn || me.poison) { parts.push('ล้างเผา/พิษ'); } me.burn = 0; me.poison = 0; break;
        case 'grow': it.bonus += v; parts.push('แกร่งขึ้น +' + v); break;
        case 'haste': { var ts = targets(me, it, f.tgt, B.rnd); ts.forEach(function (x) { x.haste += v * 1000; }); if (ts.length) parts.push('<span class="sk">เร่ง ' + ts.map(function (x) { return x.def.icon; }).join('') + ' ' + v + 'วิ</span>'); break; }
        case 'charge': { var tc = targets(me, it, f.tgt, B.rnd); tc.forEach(function (x) { x.timer += v * 1000; }); if (tc.length) parts.push('ชาร์จ ' + tc.map(function (x) { return x.def.icon; }).join('') + ' ' + v + 'วิ'); break; }
        case 'slow': {
          v += m.slow;
          var pool = foe.items.filter(isActive), n2 = Math.min(f.n || 1, pool.length), picked = [];
          for (var j = 0; j < n2; j++) { var idx = Math.floor(B.rnd() * pool.length); picked.push(pool.splice(idx, 1)[0]); }
          picked.forEach(function (x) { x.slow += v * 1000; });
          if (picked.length) parts.push('<span class="avo">หน่วง ' + picked.map(function (x) { return x.def.icon; }).join('') + ' ' + v + 'วิ</span>');
          break;
        }
      }
    });
    log(B, me, d.icon + ' ' + d.name + ': ' + parts.join(' · '), cls, { item: me.items.indexOf(it), fx: fxs });
  }

  function tickSide(B, me, foe, dt) {
    // สถานะ
    me.burnT += dt; me.poisT += dt; me.regT += dt;
    if (me.burnT >= 500) { me.burnT -= 500; if (me.burn > 0) { var bd = dealDamage(me, me.burn); me.burn -= 1; log(B, me, '<span class="burn">🔥 โดนเผา -' + bd + '</span>', '', { fx: [{ k: 'burnTick', v: bd }] }); } }
    if (me.poisT >= 1000) { me.poisT -= 1000; if (me.poison > 0) { me.hp -= me.poison; me.taken += me.poison; log(B, me, '<span class="poi">☠ โดนพิษ -' + me.poison + '</span>', '', { fx: [{ k: 'poisonTick', v: me.poison }] }); } }
    if (me.regT >= 1000) { me.regT -= 1000; if (me.regen > 0 && me.hp < me.maxhp) { healSide(me, me.regen); } }
    // คลั่ง
    if (!me.berserked && me.mods.berserk > 0 && me.hp < me.maxhp / 2) {
      me.berserked = true;
      me.items.forEach(function (x) { if (isActive(x) && x.def.tags.indexOf('weapon') >= 0) x.haste += me.mods.berserk * 1000; });
      log(B, me, '<span class="sk">😤 คลั่ง! อาวุธเร่ง ' + me.mods.berserk + ' วิ</span>');
    }
    // คูลดาวน์
    me.items.forEach(function (it) {
      if (!isActive(it)) return;
      var rate = 1;
      if (it.haste > 0) { rate *= 2; it.haste -= dt; }
      if (it.slow > 0) { rate *= 0.5; it.slow -= dt; }
      it.timer += dt * rate;
      var guard = 0;
      while (it.timer >= it.cd && guard++ < 5 && foe.hp > 0 && me.hp > 0) { it.timer -= it.cd; trigger(B, me, foe, it); }
    });
  }

  function step(B, dt) {
    if (B.over) return;
    B.t += dt;
    tickSide(B, B.a, B.b, dt);
    tickSide(B, B.b, B.a, dt);
    if (B.t >= BAL.STORM_AT) {
      B.stormT += dt;
      if (B.stormT >= 1000) {
        B.stormT -= 1000; B.stormN++;
        var sd = BAL.STORM_DMG * B.stormN;
        B.a.hp -= sd; B.b.hp -= sd; B.a.taken += sd; B.b.taken += sd;
        log(B, null, '<span class="warn">🌊 พายุซัดทั้งสองฝ่าย -' + sd + '</span>', '', { fx: [{ k: 'storm', v: sd }] });
      }
    }
    var ad = B.a.hp <= 0, bd = B.b.hp <= 0;
    if (ad || bd) {
      B.over = true;
      B.result = ad && bd ? 'draw' : ad ? 'lose' : 'win';
      log(B, null, B.result === 'win' ? '<b class="good">🏆 ' + B.a.name + ' ชนะ!</b>' : B.result === 'lose' ? '<b class="bad">💀 ' + B.a.name + ' แพ้</b>' : '<b class="warn">🤝 เสมอ</b>');
    }
  }

  function runAll(B) { var guard = 0; while (!B.over && guard++ < 5000) step(B, BAL.TICK); if (!B.over) { B.over = true; B.result = 'draw'; } return B; }

  return { create: create, step: step, runAll: runAll, mulberry: mulberry };
})();
if (typeof module !== 'undefined') module.exports = Combat;
