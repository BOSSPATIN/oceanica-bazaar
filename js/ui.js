// Oceanica Bazaar — หน้าจอ (สไตล์แผง/ปุ่มของ Oceanica Offline)
'use strict';
// เสียงเอฟเฟกต์สังเคราะห์ด้วย WebAudio (ไม่มีไฟล์เสียง) ปิดได้ที่ปุ่ม 🔊
var SFX = (function () {
  var ctx = null, on = true, last = {};
  try { on = (localStorage.getItem('ob_sfx') || '1') === '1'; } catch (e) { }
  function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } return ctx; }
  function tone(freq, dur, type, vol, slide) {
    var c = ac(); if (!c || !on) return;
    var o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime;
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol || 0.08, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur);
  }
  function play(k) {
    var now = Date.now(); if (last[k] && now - last[k] < 70) return; last[k] = now;
    switch (k) {
      case 'hit': tone(220, 0.08, 'square', 0.05, 110); break;
      case 'crit': tone(330, 0.16, 'sawtooth', 0.09, 80); break;
      case 'heal': tone(660, 0.12, 'sine', 0.05, 990); break;
      case 'shield': tone(440, 0.1, 'triangle', 0.05, 560); break;
      case 'buy': tone(880, 0.07, 'sine', 0.05, 1320); break;
      case 'click': tone(600, 0.04, 'sine', 0.03); break;
      case 'win': [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, 0.25, 'triangle', 0.09); }, i * 120); }); break;
      case 'lose': [392, 294, 196].forEach(function (f, i) { setTimeout(function () { tone(f, 0.3, 'sawtooth', 0.07); }, i * 170); }); break;
    }
  }
  return { play: play, isOn: function () { return on; }, toggle: function () { on = !on; try { localStorage.setItem('ob_sfx', on ? '1' : '0'); } catch (e) { } return on; } };
})();
var UI = (function () {
  var $c, sel = null, flash = null, B = null, timer = null, speed = 1, logN = 0;

  function h(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  var TAG_EL = { fire: 1, water: 1, earth: 1, metal: 1, wood: 1 };
  // ไอคอน: ถ้ามีภาพวาด (d.img) ใช้ภาพ ไม่งั้นใช้อีโมจิ
  // full = ภาพเต็มการ์ด (กระดาน/หน้ารบ), thumb = ย่อเล็ก (ร้าน/เหตุการณ์)
  function iconHtml(d, mode) { return d.img ? '<img class="icimg ' + (mode === 'thumb' ? 'thumb' : 'full') + '" src="' + d.img + '" alt="">' : '<span class="ic">' + d.icon + '</span>'; }
  var EL_ICON = { fire: '🔥 ไฟ', water: '💧 น้ำ', earth: '⛰️ ดิน', metal: '⚙️ โลหะ', wood: '🌿 ไม้' };
  function elBadge(d) { if (!d || !d.tags) return ''; var e = elemOf(d); return EL_ICON[e] ? '<span class="elb eb-' + e + '">' + EL_ICON[e] + '</span>' : ''; }
  function elemOf(d) { for (var i = 0; i < d.tags.length; i++) if (TAG_EL[d.tags[i]]) return d.tags[i]; return 'none'; }
  // ภาพประกอบหน้าแรก: เรือโจรสลัดเงาดำ พระอาทิตย์แดง คลื่นลายเซกะอิฮะ (วาดด้วย SVG ไม่มีไฟล์ภาพ)
  var HERO_SVG = '<svg class="heroart" viewBox="0 0 1000 330" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<defs><pattern id="sgh" width="60" height="30" patternUnits="userSpaceOnUse">' +
    '<g fill="none" stroke="#9fd3ff" stroke-width="2.2"><circle cx="30" cy="30" r="28"/><circle cx="30" cy="30" r="21"/><circle cx="30" cy="30" r="14"/><circle cx="30" cy="30" r="7"/>' +
    '<circle cx="0" cy="15" r="28"/><circle cx="0" cy="15" r="21"/><circle cx="0" cy="15" r="14"/><circle cx="0" cy="15" r="7"/><circle cx="60" cy="15" r="28"/><circle cx="60" cy="15" r="21"/><circle cx="60" cy="15" r="14"/><circle cx="60" cy="15" r="7"/></g></pattern>' +
    '<radialGradient id="sun" cx="50%" cy="50%"><stop offset="0" stop-color="#ff6a3d"/><stop offset=".7" stop-color="#d7263d"/><stop offset="1" stop-color="#9b1b30"/></radialGradient>' +
    '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#120f1c"/><stop offset="1" stop-color="#3a1f3a"/></linearGradient></defs>' +
    '<rect width="1000" height="330" fill="url(#sky)"/>' +
    '<g opacity=".22" fill="#f6d77a">' + [-85, -75, -65, -55, -45, -35, -25, -15, -5, 5, 15, 25, 35, 45, 55, 65, 75, 85].map(function (a) { return '<polygon points="500,230 488,-60 512,-60" transform="rotate(' + a + ' 500 230)"/>'; }).join('') + '</g>' +
    '<circle cx="500" cy="230" r="135" fill="url(#sun)" stroke="#1b1612" stroke-width="5"/>' +
    '<g fill="none" stroke="#f3e9d2" stroke-width="4" stroke-linecap="round" opacity=".9"><path d="M60 90 q40 -40 90 -10 q30 -40 80 -5 q40 -20 60 15"/><path d="M700 60 q40 -40 90 -8 q40 -30 80 10"/><path d="M820 130 q30 -30 70 -5"/></g>' +
    '<rect x="0" y="250" width="1000" height="80" fill="#1d4e89"/><rect x="0" y="250" width="1000" height="80" fill="url(#sgh)" opacity=".55"/>' +
    '<g stroke="#1b1612" stroke-width="4" stroke-linejoin="round"><path d="M290 215 L710 215 L670 268 L330 268 Z" fill="#2b1d14"/><path d="M290 215 q-30 -20 -20 -60 l40 60 z" fill="#2b1d14"/><path d="M710 215 q40 -30 30 -70 l-50 70 z" fill="#2b1d14"/><path d="M335 232 L665 232" stroke="#e9b949" stroke-width="3"/>' +
    '<rect x="420" y="70" width="8" height="150" fill="#1b1612"/><rect x="530" y="40" width="8" height="180" fill="#1b1612"/><rect x="620" y="90" width="8" height="130" fill="#1b1612"/>' +
    '<path d="M424 90 q60 40 0 110 z" fill="#f3e9d2"/><path d="M424 90 q-60 40 0 110 z" fill="#e8dcc0"/><path d="M534 60 q80 50 0 150 z" fill="#f3e9d2"/><path d="M534 60 q-80 50 0 150 z" fill="#e8dcc0"/><path d="M624 110 q50 30 0 100 z" fill="#f3e9d2"/><path d="M624 110 q-50 30 0 100 z" fill="#e8dcc0"/>' +
    '<path d="M538 40 l70 14 l-70 14 z" fill="#1b1612"/></g>' +
    '<text x="574" y="60" font-size="18" fill="#f3e9d2" text-anchor="middle" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">☠</text>' +
    '<path d="M0 260 q120 -70 240 -10 q-60 -70 -140 -60 q-30 -2 -50 10 z" fill="#1d4e89" stroke="#1b1612" stroke-width="4"/><path d="M100 190 q40 -40 110 -20 q-30 -10 -60 0 q-10 5 -20 15" fill="none" stroke="#f3e9d2" stroke-width="4"/>' +
    '<g fill="#f3e9d2"><circle cx="95" cy="200" r="6"/><circle cx="150" cy="185" r="5"/><circle cx="205" cy="198" r="7"/><circle cx="235" cy="225" r="5"/></g>' +
    '<path d="M0 255 q50 -20 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 v10 H0 z" fill="#1b1612" opacity=".5"/>' +
    '</svg>';
  function tierTag(t) { return '<span class="tier t' + t + '">' + TIERS[t] + '</span>'; }
  function tagList(def) { return def.tags.map(function (t) { return '<span class="tag tg-' + t + '">' + TAG_NAME[t] + '</span>'; }).join(' '); }
  function setFlash(msg, cls) { flash = msg ? { msg: msg, cls: cls || '' } : null; }
  var toastT = null;
  function flashHtml() {
    if (!flash) return '';
    var f = flash; flash = null;
    setTimeout(function () {
      var t = document.getElementById('toast');
      if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
      t.className = 'toast ' + f.cls + ' show'; t.innerHTML = f.msg;
      clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 3200);
    }, 0);
    return '';
  }

  function render() {
    if ($c) $c.classList.remove('hasres');
    var G = Game.get();
    if (!G) return renderTitle();
    if (G.screen === 'shop') return renderShop();
    if (G.screen === 'battle') return renderBattle();
    if (G.screen === 'event') return renderEvent();
    if (G.screen === 'end') return renderEnd();
    renderShop();
  }
  function elemPanel(itemIds, compact) {
    var c = countElems(itemIds), bon = {};
    elemBonuses(itemIds).forEach(function (b) { bon[b.el.id] = b; });
    if (compact) return ELEMENTS.filter(function (e) { return bon[e.id]; }).map(function (e) { return e.icon + ' ' + e.name + ' ' + bon[e.id].n + ': ' + bon[e.id].text; }).join(' · ');
    var s = '<div class="elems">';
    ELEMENTS.forEach(function (e) {
      var b = bon[e.id], n = c[e.id];
      s += '<div class="elem el-' + e.id + (b ? (b.tier === 1 ? ' on2' : ' on') : '') + '" title="ครบ 3 ชิ้น: ' + h(e.tiers[0].text) + ' / ครบ 5 ชิ้น: ' + h(e.tiers[1].text) + '"><b>' + e.icon + ' ' + e.name + '</b><span class="cnt">' + n + ' ชิ้น</span>';
      s += '<div class="tl' + (n >= 3 ? ' done' : '') + '">' + (n >= 3 ? '✅' : '▫️') + ' 3 ชิ้น: ' + e.tiers[0].text + '</div><div class="tl' + (n >= 5 ? ' done' : '') + '">' + (n >= 5 ? '✅' : '▫️') + ' 5 ชิ้น: ' + e.tiers[1].text + '</div></div>';
    });
    return s + '</div>';
  }

  // ---------- หน้าแรก ----------
  function renderTitle() {
    var s = '<div class="title">' + HERO_SVG + '<div class="big">BAZAAR</div><div class="tag">ตลาดโจรสลัด · 海賊市場 · AUTO-BATTLER</div>';
    s += '<div class="lore">ซื้อของจากตลาดท่าเรือ จัดลงกระดาน 10 ช่อง แล้วปล่อยให้ของทุกชิ้นทำงานเองตามเวลา<br>ชนะผีคู่ต่อสู้ให้ครบ <b>' + BAL.WIN_TARGET + ' ครั้ง</b> ก่อนเรือจม (แพ้ได้ ' + BAL.LIVES + ' ครั้ง) · ไม่มี Stamina ไม่จำกัดรายวัน</div>';
    s += '<h2>เลือกกัปตัน</h2><div class="heroes">';
    HEROES.forEach(function (hr) {
      s += '<div class="hero" data-hero="' + hr.id + '"><div class="portrait" style="background:' + hr.color + '"><span>' + hr.icon + '</span><small>' + hr.cls + '</small></div>';
      s += '<div class="hn">' + hr.name + '</div><div class="dim">HP ' + hr.hp + ' · ' + hr.text + '</div>';
      s += '<div class="dim">เริ่มด้วย ' + hr.items.map(function (id) { return ITEM_BY_ID[id].icon + ' ' + ITEM_BY_ID[id].name; }).join(', ') + '</div>';
      s += '<button class="pri" data-act="start" data-hero="' + hr.id + '">ออกเรือกับ ' + hr.name + '</button></div>';
    });
    s += '</div>';
    var st = Game.loadStats();
    if (st.runs) s += '<div class="stats slot"><b>สถิติ:</b> เล่น ' + st.runs + ' รัน · ชนะครบ 10 ได้ ' + st.victories + ' รัน · ชนะสูงสุดในรันเดียว ' + st.bestWins + ' · ' + HEROES.map(function (hr) { var x = st.heroes[hr.id]; return x ? hr.icon + ' ' + hr.name + ' ' + x.victories + '/' + x.runs : ''; }).filter(Boolean).join(' · ') + '</div>';
    s += '<div class="lore dim">โบนัสธาตุ: ของบนกระดานมีธาตุ ไฟ/น้ำ/ดิน/โลหะ/ไม้ — ธาตุเดียวกันครบ 3 หรือ 5 ชิ้นได้โบนัสพิเศษ · ระหว่างทางมีเหตุการณ์ให้เลือก (เกาะร้าง ซากเรือ พ่อค้า โจรสลัด...)</div>';
    s += '</div>';
    $c.innerHTML = s;
  }

  // ---------- เหตุการณ์ ----------
  function renderEvent() {
    var G = Game.get(), e = G.event, ev = EVENTS.filter(function (x) { return x.id === e.id; })[0];
    var s = '<div class="title"><div class="big sm">📅 วันที่ ' + G.day + ' — เหตุการณ์ระหว่างทาง</div>';
    s += '<div class="evt"><div class="eh"><span>' + ev.icon + '</span>' + ev.name + '</div><div class="evr">' + ev.text + '</div>';
    if (e.item) { var d = ITEM_BY_ID[e.item.id]; s += '<div class="offer t' + e.item.tier + '" style="margin:8px 0;text-align:left"><div class="oh">' + iconHtml(d, 'thumb') + '<b>' + d.name + '</b> ' + elBadge(d) + tierTag(e.item.tier) + '</div><div class="dim">' + SIZE_NAME[d.size] + ' ' + d.size + ' ช่อง · ' + tagList(d) + '</div><div class="info">' + itemDescr(d, e.item.tier) + '</div></div>'; }
    ev.choices.forEach(function (ch, i) {
      var label = ch.t;
      if (ch.k === 'buySpecial') label = 'ซื้อ ' + ITEM_BY_ID[e.item.id].name + ' (' + TIERS[e.item.tier] + ') ราคา ' + e.item.cost + ' ทอง' + (G.gold < e.item.cost ? ' — ทองไม่พอ' : '');
      s += '<button class="wide' + (i === 0 ? ' pri' : '') + '" data-act="evchoice" data-i="' + i + '"' + (ch.k === 'buySpecial' && G.gold < e.item.cost ? ' disabled' : '') + '>' + (i + 1) + '. ' + label + '</button>';
    });
    s += '<div class="dim">ทอง ' + G.gold + ' · HP ' + Game.maxHp() + ' · กด 1/2 เลือกได้</div></div></div>';
    $c.innerHTML = s;
  }

  // ---------- ร้าน / กระดาน ----------
  function posCls(p) { return 'p' + p + ' r' + (Math.floor(p / BAL.BOARD_ROW) + 1) + ' c' + (p % BAL.BOARD_ROW + 1); }
  function itemBox(it, extra, cls) {
    var d = ITEM_BY_ID[it.id];
    return '<div class="item t' + it.tier + (sel === it.uid ? ' sel' : '') + ' s' + d.size + ' el-' + elemOf(d) + (cls ? ' ' + cls : '') + '" draggable="true" data-uid="' + it.uid + '" data-size="' + d.size + '" style="' + (extra || '') + '" title="' + h(itemDescr(d, it.tier)) + '">' +
      '' + iconHtml(d) + elBadge(d) + '<span class="nm">' + d.name + '</span><span class="cd">' + (d.cd ? (d.cd / 1000) + 'วิ' : 'ติดตัว') + '</span></div>';
  }
  function renderShop() {
    var G = Game.get(), hero = HERO_BY_ID[G.heroId];
    var s = '<div class="topbar"><div class="hb"><span class="hic" style="background:' + hero.color + '">' + hero.icon + '</span><b>' + hero.name + '</b> ' + hero.cls + ' <span class="dim">Lv' + Game.level() + '</span></div>';
    s += '<div class="st">❤️ HP <b>' + Game.maxHp() + '</b></div><div class="st gp">💰 ทอง <b>' + G.gold + '</b></div><div class="st">📅 วันที่ <b>' + G.day + '</b>/' + BAL.MAX_DAY + '</div>';
    s += '<div class="st good">🏆 ชนะ <b>' + G.wins + '</b>/' + BAL.WIN_TARGET + '</div>';
    if (G.streak >= 1) s += '<div class="st warn" title="ชนะติดต่อกัน ครั้งถัดไปได้ทอง ' + Game.winReward(G.streak + 1).total + '">🔥 ชนะติด <b>' + G.streak + '</b> · ครั้งหน้า +' + Game.winReward(G.streak + 1).total + ' ทอง</div>';
    s += '<div class="st bad">⛵ เรือเหลือ <b>' + '⛵'.repeat(G.lives) + '</b></div>';
    s += '<button class="tiny" data-act="sfx" title="เปิด/ปิดเสียง">' + (SFX.isOn() ? '🔊' : '🔇') + '</button></div>';
    s += flashHtml();
    s += '<div class="shopgrid"><div class="colE"><h3>โบนัสธาตุ <small>ครบ 3 / 5 ชิ้นบนกระดาน</small></h3>' + elemPanel(G.board.map(function (it) { return it.id; })) + '</div><div class="colL">';
    // กระดาน
    s += '<h2>กระดานเรือ <small>2 แถว แถวละ 5 ช่อง · ของชิ้นเดียวอยู่แถวเดียวกัน · ข้างเคียง = ชิ้นที่ติดกันทั้งซ้าย/ขวา/บน/ล่าง · ลากวาง/ลากทับ = สลับที่</small></h2>';
    s += '<div class="board" id="board">';
    var occ = Game.occupied();
    for (var i = 0; i < BAL.BOARD_SLOTS; i++) s += '<div class="slot ' + posCls(i) + '" data-pos="' + i + '">' + (i + 1) + '</div>';
    G.board.forEach(function (it) { s += itemBox(it, '', posCls(it.pos)); });
    s += '</div>';
    // แถบจัดการชิ้นที่เลือก
    var f = sel !== null ? findSel() : null;
    if (f) {
      var d = ITEM_BY_ID[f.it.id];
      s += '<div class="selbar"><div><b>' + d.icon + ' ' + d.name + '</b> ' + tierTag(f.it.tier) + ' <span class="dim">' + SIZE_NAME[d.size] + ' (' + d.size + ' ช่อง)</span> ' + tagList(d) + '<div class="info">' + itemDescr(d, f.it.tier) + '</div></div><div class="acts">';
      if (f.where === 'board') s += '<button data-act="mv" data-dir="-1">◀ ซ้าย</button><button data-act="mv" data-dir="1">ขวา ▶</button><button data-act="stash">เก็บเข้าช่องเก็บ</button>';
      else s += '<button class="pri" data-act="board">วางลงกระดาน</button>';
      s += '<button class="on" data-act="sell">ขาย +' + sellPrice(d, f.it.tier) + ' ทอง</button><button data-act="unsel">✕</button></div></div>';
    }
    // โบนัสธาตุ
    // ช่องเก็บ
    s += '<h3>ช่องเก็บ <small>' + G.stash.length + '/' + BAL.STASH_SLOTS + ' · ของในช่องเก็บไม่ร่วมรบ · ลากของจากกระดานมาวางที่นี่ได้</small></h3><div class="stash" id="stash">';
    G.stash.forEach(function (it) { s += itemBox(it); });
    if (!G.stash.length) s += '<span class="dim">ว่าง</span>';
    s += '</div>';
    // ตำรา
    s += '<h3>ตำราติดตัว</h3><div class="skills">' + G.skills.map(function (sk) { var sd = SKILL_BY_ID[sk.id]; return '<span class="skill t' + sk.tier + '" title="' + h(skillDescr(sd, sk.tier)) + '">' + sd.icon + ' ' + sd.name + ' ' + tierTag(sk.tier) + ' <span class="dim">' + skillDescr(sd, sk.tier) + '</span></span>'; }).join('') + '</div>';
    s += '</div><div class="colR">';
    // ร้าน
    s += '<h2>ตลาดท่าเรือ <span class="goldbadge" title="ทองที่มีตอนนี้">💰 ' + G.gold + ' ทอง</span><small>วันที่ ' + G.day + ' · ซื้อชิ้นเดิมซ้ำ = รวมร่าง · 🔒 ล็อก = เก็บไว้ถึงวันถัดไป</small></h2>';
    var rerollBtn = '<button data-act="reroll"' + (G.gold < BAL.REROLL_COST && !G.freeRerolls ? ' disabled' : '') + '>🔄 สุ่มร้านใหม่ (' + (G.freeRerolls ? 'ฟรี ' + G.freeRerolls + ' ครั้ง' : BAL.REROLL_COST + ' ทอง') + ') [R]</button>';
    s += '<div class="offers">';
    G.shop.forEach(function (o, i) {
      var c = Game.canBuy(i), own;
      if (o.type === 'item') {
        var d = ITEM_BY_ID[o.id];
        s += '<div class="offer t' + o.tier + (o.sold ? ' sold' : '') + (o.locked ? ' locked' : '') + ' el-' + elemOf(d) + '"' + (o.sold ? '' : ' draggable="true" data-offer="' + i + '" data-size="' + d.size + '" title="ลากไปวางบนกระดานเพื่อซื้อลงช่องที่ต้องการ"') + '><div class="oh">' + iconHtml(d, 'thumb') + '<b>' + d.name + '</b> ' + elBadge(d) + tierTag(o.tier) + (o.sold ? '' : '<button class="tiny lock' + (o.locked ? ' on' : '') + '" data-act="lock" data-i="' + i + '" title="ล็อกไว้ถึงวันถัดไป">' + (o.locked ? '🔒' : '🔓') + '</button>') + '</div>';
        s += '<div class="dim">' + SIZE_NAME[d.size] + ' ' + d.size + ' ช่อง · ' + tagList(d) + '</div><div class="info">' + itemDescr(d, o.tier) + '</div>';
        s += '<div class="ob">' + (o.sold ? '<span class="dim">ซื้อแล้ว</span>' : '<button class="pri" data-act="buy" data-i="' + i + '"' + (c.ok ? '' : ' disabled') + '>ซื้อ ' + o.cost + '<span class="bx"> ทอง' + (c.why === 'merge' ? ' 🔼 รวมร่าง' : c.why === 'stash' ? ' (เข้าช่องเก็บ)' : '') + '</span>' + (c.why === 'merge' ? '<span class="bxs">🔼</span>' : '') + '</button>' + (c.ok ? '' : '<span class="bad"> ' + c.why + '</span>')) + '</div></div>';
      } else {
        var sd = SKILL_BY_ID[o.id];
        s += '<div class="offer skl t' + o.tier + (o.sold ? ' sold' : '') + (o.locked ? ' locked' : '') + '"><div class="oh"><span class="ic">' + sd.icon + '</span><b>ตำรา: ' + sd.name + '</b> ' + elBadge(d) + tierTag(o.tier) + (o.sold ? '' : '<button class="tiny lock' + (o.locked ? ' on' : '') + '" data-act="lock" data-i="' + i + '" title="ล็อกไว้ถึงวันถัดไป">' + (o.locked ? '🔒' : '🔓') + '</button>') + '</div><div class="info">' + skillDescr(sd, o.tier) + '</div>';
        s += '<div class="ob">' + (o.sold ? '<span class="dim">เรียนแล้ว</span>' : '<button class="pri" data-act="buy" data-i="' + i + '"' + (c.ok ? '' : ' disabled') + '>เรียน ' + o.cost + '<span class="bx"> ทอง</span></button>' + (c.ok ? '' : '<span class="bad"> ' + c.why + '</span>')) + '</div></div>';
      }
    });
    s += '</div><div class="shopfoot">' + rerollBtn + '</div>';
    // ผีวันนี้ (ดูก่อนรบ)
    var gs = G.bonusFight ? Game.pirateSpec() : Game.ghostSpec(G.day, G.seed);
    s += '<h3>' + (G.bonusFight ? '🏴‍☠️ โจรสลัดที่จะเจอ (รบพิเศษ)' : '👻 ผีที่จะเจอวันนี้') + ' <small>ดูก่อนแล้วจัดของรับมือ</small></h3>';
    s += '<div class="ghostbox"><span class="hic">' + gs.icon + '</span><div><b>' + h(gs.name) + '</b> · HP ' + gs.hp + ' · ' + gs.skills.map(function (k) { return SKILL_BY_ID[k.id].icon + SKILL_BY_ID[k.id].name + '(' + TIERS[k.tier] + ')'; }).join(' ') + '<br>';
    s += gs.items.map(function (it) { var d = ITEM_BY_ID[it.id]; return '<span class="gi t' + it.tier + '" title="' + h(itemDescr(d, it.tier)) + '">' + d.icon + ' ' + d.name + '</span>'; }).join('');
    var ge = elemPanel(gs.items.map(function (it) { return it.id; }), true); if (ge) s += '<br><span class="warn">โบนัสธาตุ: ' + ge + '</span>';
    s += '</div></div>';
    if (G.bonusFight) s += '<div class="row c fightrow"><button class="big pri" data-act="fight">🏴‍☠️ สู้โจรสลัด (Enter)</button><div class="dim">ชนะได้ทอง +' + G.bonusFight.reward + ' · แพ้ไม่เสียเรือ · ไม่นับเป็นวัน</div></div>';
    else s += '<div class="row c fightrow"><button class="big pri glow" data-act="fight">⚔️ ออกรบ วันที่ ' + G.day + ' (Enter)</button><div class="dim">ชนะได้ทอง <b class="gp">+' + Game.winReward(G.streak + 1).total + '</b>' + (G.streak >= 1 ? ' (ชนะติด ' + (G.streak + 1) + ')' : '') + ' · ชนะติดต่อกันได้เพิ่มขั้นละ +' + BAL.STREAK_STEP + ' สูงสุด +' + BAL.STREAK_CAP + ' · แพ้เสียเรือ 1 ลำ รีเซ็ตชนะติด · ทองรายวัน +' + Game.income() + ' ได้ทุกวัน</div></div>';
    s += '<div class="row r savebar"><span class="lnk" data-act="exportsave" title="คัดลอกโค้ดเซฟไปวางในเครื่องอื่น (คอม-มือถือ)">📋 คัดลอกโค้ดเซฟ</span><span class="lnk" data-act="importsave">📥 วางโค้ดเซฟ</span><span class="lnk" data-act="abandon">ล้มเลิกรันนี้</span></div>';
    s += '</div></div>';
    $c.innerHTML = s;
  }
  function findSel() {
    var G = Game.get();
    for (var i = 0; i < G.board.length; i++) if (G.board[i].uid === sel) return { it: G.board[i], where: 'board' };
    for (var j = 0; j < G.stash.length; j++) if (G.stash[j].uid === sel) return { it: G.stash[j], where: 'stash' };
    sel = null; return null;
  }

  // ---------- รบ ----------
  function startBattle() {
    B = Game.makeBattle(); logN = 0; speed = 1;
    Game.setScreen('battle');
    renderBattle();
    runTimer();
  }
  function runTimer() {
    clearInterval(timer);
    timer = setInterval(function () {
      for (var i = 0; i < speed && !B.over; i++) Combat.step(B, BAL.TICK);
      updateBattle();
      if (B.over) { clearInterval(timer); timer = null; renderResult(); }
    }, BAL.TICK);
  }
  function sideBox(sd, who) {
    var s = '<div class="side ' + who + '" id="side-' + who + '"><div class="sh"><span class="hic big">' + sd.icon + '</span><b>' + h(sd.name) + '</b> <span class="dim">' + sd.skills.map(function (k) { return k.def.icon + k.def.name + '(' + TIERS[k.tier] + ')'; }).join(' ') + '</span></div>';
    if (sd.elems.length) s += '<div class="elt">' + sd.elems.map(function (b) { return b.el.icon + ' ' + b.el.name + ' ' + b.n + ': ' + b.text; }).join(' · ') + '</div>';
    s += '<div class="barwrap"><div class="bar hp big"><i id="hp-' + who + '"></i><i class="shd" id="sh-' + who + '"></i><em id="hpt-' + who + '"></em></div><div class="flhost" id="fl-' + who + '"></div></div>';
    s += '<div class="status" id="st-' + who + '"></div>';
    s += '<div class="bboard">';
    sd.items.forEach(function (it, i) {
      var d = it.def;
      s += '<div class="bitem t' + it.tier + ' s' + d.size + ' el-' + elemOf(d) + '" id="bi-' + who + '-' + i + '" title="' + h(itemDescr(d, it.tier)) + '">' + iconHtml(d) + elBadge(d) + '<span class="nm">' + d.name + '</span><span class="use" id="bu-' + who + '-' + i + '"></span><div class="cdbar"><i id="bc-' + who + '-' + i + '"></i></div></div>';
    });
    s += '</div></div>';
    return s;
  }
  function renderBattle() {
    if (!B) { Game.setScreen('shop'); return renderShop(); }
    var s = '<div class="bhead"><h2 style="margin:0">⚔️ รบวันที่ ' + Game.get().day + ' <small id="bt">0.0 วิ</small></h2><div class="bctl">ความเร็ว ' + [1, 2, 4, 8].map(function (x) { return '<button class="tiny' + (speed === x ? ' on' : '') + '" data-act="speed" data-v="' + x + '">×' + x + '</button>'; }).join('') + ' <button class="tiny" data-act="skip">⏩ ข้ามไปผล</button></div></div>';
    s += sideBox(B.b, 'b') + '<div class="vs">VS <span class="dim" id="storm"></span></div>' + sideBox(B.a, 'a');
    s += '<div class="blog" id="blog"></div>';
    s += '<div id="bres"></div>';
    $c.innerHTML = s;
    updateBattle();
  }
  function updSide(sd, who) {
    var hp = document.getElementById('hp-' + who); if (!hp) return;
    var pct = Math.max(0, sd.hp / sd.maxhp * 100);
    hp.style.width = pct + '%';
    var shEl = document.getElementById('sh-' + who); if (shEl) shEl.style.width = Math.min(100, sd.shield / sd.maxhp * 100) + '%';
    document.getElementById('hpt-' + who).textContent = Math.max(0, Math.round(sd.hp)) + ' / ' + sd.maxhp + (sd.shield > 0 ? '  🛡️' + Math.round(sd.shield) : '');
    var st = [];
    if (sd.shield > 0) st.push('<span class="shd">🛡️ โล่ ' + Math.round(sd.shield) + '</span>');
    if (sd.burn > 0) st.push('<span class="burn">🔥 เผา ' + sd.burn + '</span>');
    if (sd.poison > 0) st.push('<span class="poi">☠ พิษ ' + sd.poison + '</span>');
    if (sd.regen > 0) st.push('<span class="good">💚 ฟื้นฟู ' + sd.regen + '/วิ</span>');
    document.getElementById('st-' + who).innerHTML = st.join(' ') || '<span class="dim">—</span>';
    sd.items.forEach(function (it, i) {
      var el = document.getElementById('bi-' + who + '-' + i), bc = document.getElementById('bc-' + who + '-' + i), bu = document.getElementById('bu-' + who + '-' + i);
      if (!el) return;
      el.classList.toggle('haste', it.haste > 0); el.classList.toggle('slow', it.slow > 0);
      bc.style.width = it.cd ? Math.min(100, it.timer / it.cd * 100) + '%' : '0';
      bu.textContent = it.uses ? '×' + it.uses : '';
    });
  }
  function updateBattle() {
    if (!B) return;
    updSide(B.a, 'a'); updSide(B.b, 'b');
    var bt = document.getElementById('bt'); if (bt) bt.textContent = (B.t / 1000).toFixed(1) + ' วิ';
    var stm = document.getElementById('storm'); if (stm) stm.textContent = B.t >= BAL.STORM_AT ? '🌊 พายุ! ทั้งสองฝ่ายโดน -' + (BAL.STORM_DMG * (B.stormN + 1)) + '/วิ' : 'พายุมาใน ' + Math.max(0, (BAL.STORM_AT - B.t) / 1000).toFixed(0) + ' วิ';
    var lg = document.getElementById('blog'); if (!lg) return;
    for (; logN < B.events.length; logN++) {
      var e = B.events[logN], div = document.createElement('div');
      div.className = 'bl ' + (e.side === 'a' ? 'me' : e.side === 'b' ? 'foe' : 'sys');
      div.innerHTML = '<span class="bn">' + (e.t / 1000).toFixed(1) + '</span> ' + (e.side === 'a' ? '🟢' : e.side === 'b' ? '🔴' : '⚪') + ' ' + e.text;
      lg.appendChild(div);
      if (speed < 4) animEvent(e);
    }
    lg.scrollTop = lg.scrollHeight;
  }
  // แอนิเมชันรบ: ชิ้นกระเด้งตอนทำงาน + ตัวเลขลอย + กะพริบตอนโดน + เสียง
  function animEvent(e) {
    if (e.item !== undefined && e.side) { var el = document.getElementById('bi-' + e.side + '-' + e.item); if (el) { el.classList.remove('trig'); void el.offsetWidth; el.classList.add('trig'); } }
    if (!e.fx) return;
    var who = e.side, foe = who === 'a' ? 'b' : 'a';
    e.fx.forEach(function (f) {
      switch (f.k) {
        case 'dmg': floatText(foe, '-' + f.v, 'fdmg' + (f.crit ? ' fcrit' : '')); hitFlash(foe); SFX.play(f.crit ? 'crit' : 'hit'); break;
        case 'shield': floatText(who, '🛡️ +' + f.v, 'fshield'); SFX.play('shield'); break;
        case 'heal': if (f.v > 0) { floatText(who, '+' + f.v, 'fheal'); SFX.play('heal'); } break;
        case 'burn': floatText(foe, '🔥 +' + f.v, 'fburn'); break;
        case 'poison': floatText(foe, '☠ +' + f.v, 'fpoi'); break;
        case 'burnTick': floatText(who, '-' + f.v, 'fburn'); hitFlash(who); break;
        case 'poisonTick': floatText(who, '-' + f.v, 'fpoi'); hitFlash(who); break;
        case 'storm': floatText('a', '🌊 -' + f.v, 'fstorm'); floatText('b', '🌊 -' + f.v, 'fstorm'); break;
      }
    });
  }
  function floatText(who, txt, cls) {
    var host = document.getElementById('fl-' + who); if (!host) return;
    if (host.childElementCount > 14) host.firstChild.remove();
    var sp = document.createElement('span'); sp.className = 'float ' + cls; sp.textContent = txt;
    sp.style.left = (8 + Math.random() * 80) + '%';
    host.appendChild(sp);
    setTimeout(function () { sp.remove(); }, 1100);
  }
  function hitFlash(who) { var el = document.getElementById('side-' + who); if (!el) return; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  function topItems(sd, key) {
    return sd.items.filter(function (x) { return x[key] > 0; }).sort(function (a, b) { return b[key] - a[key]; }).slice(0, 3).map(function (x) { return x.def.icon + ' ' + x.def.name + ' ' + Math.round(x[key]); }).join(' · ') || '—';
  }
  function renderResult() {
    var r = B.result, G = Game.get();
    var el = document.getElementById('bres'); if (!el) return;
    $c.classList.add('hasres');
    var head;
    if (G.bonusFight) head = r === 'win' ? '<span class="good">🏆 ปราบโจรสลัด!</span> ได้ทอง +' + G.bonusFight.reward : r === 'lose' ? '<span class="bad">💀 แพ้โจรสลัด</span> ไม่เสียเรือ' : '<span class="warn">🤝 เสมอ</span>';
    else {
      var rw = Game.winReward(G.streak + 1);
      head = r === 'win' ? '<span class="good">🏆 ชนะ!</span> ได้ทอง <b class="gp">+' + rw.total + '</b>' + (rw.bonus ? ' <span class="warn">(ชนะติด ' + rw.streak + ' โบนัส +' + rw.bonus + ')</span>' : '') + ' · ชนะสะสม ' + (G.wins + 1) + '/' + BAL.WIN_TARGET : r === 'lose' ? '<span class="bad">💀 แพ้</span> เรือเหลือ ' + (G.lives - 1) + ' ลำ' + (G.streak >= 2 ? ' · ชนะติด ' + G.streak + ' ถูกรีเซ็ต' : '') : '<span class="warn">🤝 เสมอ</span> ไม่เสียอะไร ชนะติดยังอยู่';
    }
    SFX.play(r === 'win' ? 'win' : r === 'lose' ? 'lose' : 'click');
    var s = '<div class="banner ' + r + '">' + (r === 'win' ? '🏆 ชนะ!' : r === 'lose' ? '💀 แพ้' : '🤝 เสมอ') + '</div>';
    s += '<div class="sum ' + r + '"><div class="big">' + head + '</div>';
    s += '<div class="dmgsum"><div class="dcol"><div class="dh">🟢 ฝ่ายเรา <small>ดาเมจรวม ' + Math.round(B.a.dealt) + '</small></div><div class="drow">โจมตี: ' + topItems(B.a, 'dealt') + '</div><div class="drow">ฮีล: ' + topItems(B.a, 'healed') + '</div><div class="drow">โล่: ' + topItems(B.a, 'shielded') + '</div></div>';
    s += '<div class="dcol"><div class="dh">🔴 ผี <small>ดาเมจรวม ' + Math.round(B.b.dealt) + '</small></div><div class="drow">โจมตี: ' + topItems(B.b, 'dealt') + '</div><div class="drow">ฮีล: ' + topItems(B.b, 'healed') + '</div><div class="drow">โล่: ' + topItems(B.b, 'shielded') + '</div></div></div>';
    s += '<div class="row c"><button class="big pri" data-act="next">' + (G.bonusFight ? '⛵ กลับเข้าตลาด (Enter)' : r === 'win' && G.wins + 1 >= BAL.WIN_TARGET ? '🎉 จบรัน' : r === 'lose' && G.lives - 1 <= 0 ? 'เรือจม...' : '📅 วันถัดไป (Enter)') + '</button></div></div>';
    el.innerHTML = s;
    el.scrollIntoView({ behavior: 'smooth' });
  }

  // ---------- จบรัน ----------
  function renderEnd() {
    var G = Game.get(), hero = HERO_BY_ID[G.heroId];
    var s = '<div class="title"><div class="big sm">' + (G.ended === 'victory' ? '🏆 ชนะครบ ' + BAL.WIN_TARGET + ' ครั้ง — สมบัติฟากโพ้นเป็นของบอส!' : G.ended === 'defeat' ? '💀 เรือจม — รันนี้จบลง' : '⏳ หมดวัน — รันนี้จบลง') + '</div>';
    s += '<div class="lore">' + hero.icon + ' ' + hero.name + ' ' + hero.cls + ' · ชนะ ' + G.wins + ' · แพ้ ' + G.history.filter(function (x) { return x.result === 'lose'; }).length + ' · เสมอ ' + G.history.filter(function (x) { return x.result === 'draw'; }).length + ' · ถึงวันที่ ' + G.day + ' · Lv' + Game.level() + '</div>';
    s += '<div class="slot"><b>กระดานสุดท้าย:</b> ' + G.board.map(function (it) { return ITEM_BY_ID[it.id].icon + ' ' + ITEM_BY_ID[it.id].name + ' (' + TIERS[it.tier] + ')'; }).join(' · ') + '<br><b>ตำรา:</b> ' + G.skills.map(function (k) { return SKILL_BY_ID[k.id].icon + ' ' + SKILL_BY_ID[k.id].name + ' (' + TIERS[k.tier] + ')'; }).join(' · ') + '</div>';
    s += '<div class="slot"><b>ประวัติ:</b> ' + G.history.map(function (x) { return 'วัน' + x.day + (x.result === 'win' ? '🏆' : x.result === 'lose' ? '💀' : '🤝'); }).join(' ') + '</div>';
    s += '<div class="row c"><button class="big pri" data-act="newrun">เริ่มรันใหม่ (Enter)</button></div></div>';
    $c.innerHTML = s;
  }

  // ---------- events ----------
  function onClick(ev) {
    var t = ev.target.closest('[data-act],[data-uid],[data-pos]'); if (!t) return;
    var act = t.getAttribute('data-act') || (t.hasAttribute('data-pos') ? 'slot' : null), G = Game.get(), r;
    if (t.hasAttribute('data-uid') && !act) { var u = +t.getAttribute('data-uid'); sel = sel === u ? null : u; setFlash(sel !== null ? 'จิ้มช่องว่างบนกระดานเพื่อวาง หรือใช้ปุ่มด้านล่าง' : null, 'good'); return render(); }
    if (act === 'slot') { if (sel !== null) { var pr = Game.placeAt(sel, +t.getAttribute('data-pos')); setFlash(pr.ok ? (pr.msg || null) : pr.why, pr.ok ? 'good' : 'bad'); if (pr.ok) sel = null; render(); } return; }
    switch (act) {
      case 'start': Game.newRun(t.getAttribute('data-hero')); sel = null; setFlash('ออกเรือ! ซื้อของจากตลาดแล้วกดออกรบ', 'good'); break;
      case 'buy': r = Game.buy(+t.getAttribute('data-i')); setFlash(r.ok ? r.msg : r.why, r.ok ? 'good' : 'bad'); if (r.ok) SFX.play('buy'); break;
      case 'reroll': r = Game.reroll(); setFlash(r.ok ? null : r.why, 'bad'); break;
      case 'sell': r = Game.sell(sel); sel = null; setFlash(r.msg, 'good'); break;
      case 'stash': r = Game.toStash(sel); if (!r.ok) setFlash(r.why, 'bad'); break;
      case 'board': r = Game.toBoard(sel); if (!r.ok) setFlash(r.why, 'bad'); break;
      case 'mv': Game.move(sel, +t.getAttribute('data-dir')); break;
      case 'unsel': sel = null; break;
      case 'fight': sel = null; setFlash(null); return startBattle();
      case 'speed': speed = +t.getAttribute('data-v'); return renderBattleCtl();
      case 'skip': if (B && !B.over) { clearInterval(timer); timer = null; Combat.runAll(B); updateBattle(); renderResult(); } return;
      case 'next': if (B) { var ab = Game.afterBattle(B.result); B = null; setFlash(ab && ab.bonus ? (ab.reward ? 'ปราบโจรสลัด ได้ทอง +' + ab.reward : 'รอดจากโจรสลัดมาได้ ไม่เสียอะไร') : (ab && ab.total ? 'ชนะได้ทอง +' + ab.total + (ab.bonus ? ' (โบนัสชนะติด ' + ab.streak + ' = +' + ab.bonus + ')' : '') + ' + ทองรายวัน → ตอนนี้มี ' + G.gold : 'วันใหม่ ได้ทองรายวัน ตอนนี้มี ' + G.gold), 'good'); } break;
      case 'sfx': SFX.toggle(); SFX.play('click'); break;
      case 'exportsave': { var code = 'OB1.' + btoa(unescape(encodeURIComponent(JSON.stringify(G)))); var copied = false; try { if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(code); copied = true; } } catch (e) { } if (copied) { setFlash('คัดลอกโค้ดเซฟแล้ว ไปกด "วางโค้ดเซฟ" ที่อีกเครื่อง', 'good'); } else { window.prompt('คัดลอกโค้ดนี้ไปวางที่อีกเครื่อง', code); return; } break; }
      case 'importsave': { var inp = window.prompt('วางโค้ดเซฟ (ขึ้นต้น OB1.) จะทับรันปัจจุบัน'); if (!inp) return; try { var obj = JSON.parse(decodeURIComponent(escape(atob(inp.trim().replace(/^OB1\./, ''))))); if (!obj.heroId || !obj.board) throw new Error('bad'); localStorage.setItem('oceanica_bazaar_save_v1', JSON.stringify(obj)); Game.load(); sel = null; setFlash('โหลดเซฟจากโค้ดแล้ว', 'good'); } catch (e) { setFlash('โค้ดเซฟไม่ถูกต้อง', 'bad'); } break; }
      case 'lock': Game.toggleLock(+t.getAttribute('data-i')); break;
      case 'evchoice': r = Game.chooseEvent(+t.getAttribute('data-i')); if (!r.ok) { setFlash(r.why, 'bad'); break; } setFlash(r.msg, 'good'); if (r.fight) { render(); return; } break;
      case 'newrun': Game.clear(); sel = null; setFlash(null); break;
      case 'abandon': if (confirm('ล้มเลิกรันนี้แล้วเริ่มใหม่?')) { Game.clear(); sel = null; setFlash(null); } break;
      default: return;
    }
    render();
  }
  function renderBattleCtl() { document.querySelectorAll('[data-act=speed]').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-v') === speed); }); }
  function onKey(ev) {
    var G = Game.get(); if (!G) return;
    if (G.screen === 'event' && (ev.key === '1' || ev.key === '2')) { var eb = document.querySelector('[data-act=evchoice][data-i="' + (+ev.key - 1) + '"]'); if (eb && !eb.disabled) eb.click(); return; }
    if (G.screen === 'shop' && (ev.key === 'r' || ev.key === 'R')) { var rb = document.querySelector('[data-act=reroll]'); if (rb && !rb.disabled) rb.click(); return; }
    if (ev.key !== 'Enter') return;
    if (G.screen === 'shop') return startBattle();
    if (G.screen === 'battle' && B && B.over) { var b = document.querySelector('[data-act=next]'); if (b) b.click(); return; }
    if (G.screen === 'battle' && B && !B.over) { var sk = document.querySelector('[data-act=skip]'); if (sk) sk.click(); return; }
    if (G.screen === 'end') { var n = document.querySelector('[data-act=newrun]'); if (n) n.click(); }
  }

  // ---------- ลาก-วาง ----------
  var drag = null;
  // ตำแหน่งช่องจากพิกัดเมาส์/นิ้ว — รองรับทั้งกระดานแถวเดียว 10 ช่อง และ 5×2 (ดูจากจำนวนคอลัมน์จริง)
  function boardPos(ev) {
    var bd = document.getElementById('board'); if (!bd) return -1;
    var r = bd.getBoundingClientRect(), cols = getComputedStyle(bd).gridTemplateColumns.split(' ').length || BAL.BOARD_SLOTS;
    var rows = Math.ceil(BAL.BOARD_SLOTS / cols), size = drag ? drag.size : 1;
    var col = Math.floor((ev.clientX - r.left) / (r.width / cols)), row = Math.floor((ev.clientY - r.top) / (r.height / rows));
    col = Math.max(0, Math.min(cols - 1, col)); row = Math.max(0, Math.min(rows - 1, row));
    var p = row * cols + col, rowStart = Math.floor(p / BAL.BOARD_ROW) * BAL.BOARD_ROW;
    p = Math.min(p, rowStart + BAL.BOARD_ROW - size);   // ไม่ให้ชิ้นล้นแถว
    return Math.max(0, Math.min(BAL.BOARD_SLOTS - size, p));
  }
  function clearHl() { document.querySelectorAll('.slot.over, .stash.over').forEach(function (e) { e.classList.remove('over', 'bad'); }); }
  function onDragStart(ev) {
    var t = ev.target.closest('[data-uid],[data-offer]'); if (!t || !t.hasAttribute('draggable')) return;
    drag = { uid: t.hasAttribute('data-uid') ? +t.getAttribute('data-uid') : null, offer: t.hasAttribute('data-offer') ? +t.getAttribute('data-offer') : null, size: +t.getAttribute('data-size') || 1 };
    try { ev.dataTransfer.setData('text/plain', String(drag.uid !== null ? drag.uid : 'offer' + drag.offer)); ev.dataTransfer.effectAllowed = 'move'; } catch (e) { }
    t.classList.add('dragging');
  }
  function onDragOver(ev) {
    if (!drag) return;
    var bd = ev.target.closest('#board'), st = ev.target.closest('#stash');
    if (!bd && !st) { clearHl(); return; }
    ev.preventDefault();
    clearHl();
    if (st) { if (drag.uid !== null) st.classList.add('over'); return; }
    var p = boardPos(ev), slots = bd.querySelectorAll('.slot');
    var ok = drag.uid !== null ? true : Game.canBuy(drag.offer).ok;
    for (var i = p; i < p + drag.size && i < slots.length; i++) slots[i].classList.add('over', ok ? 'ok' : 'bad');
  }
  function onDrop(ev) {
    if (!drag) return;
    var bd = ev.target.closest('#board'), st = ev.target.closest('#stash'), r = null;
    ev.preventDefault();
    if (bd) {
      var p = boardPos(ev);
      if (drag.uid !== null) r = Game.placeAt(drag.uid, p);
      else r = Game.buy(drag.offer, p);
    } else if (st && drag.uid !== null) {
      r = Game.toStash(drag.uid);
    }
    drag = null; clearHl();
    if (r) { setFlash(r.ok ? (r.msg || null) : r.why, r.ok ? 'good' : 'bad'); render(); }
  }
  function onDragEnd() { drag = null; clearHl(); document.querySelectorAll('.dragging').forEach(function (e) { e.classList.remove('dragging'); }); }

  // ---------- ลากด้วยนิ้ว (มือถือ) — HTML5 DnD ไม่ทำงานบนจอสัมผัส ----------
  var tdrag = null;
  function onPtrDown(ev) {
    if (ev.pointerType !== 'touch') return;
    var t = ev.target.closest('.item[data-uid], .offer[data-offer]'); if (!t) return;
    tdrag = { uid: t.hasAttribute('data-uid') ? +t.getAttribute('data-uid') : null, offer: t.hasAttribute('data-offer') ? +t.getAttribute('data-offer') : null, size: +t.getAttribute('data-size') || 1, x0: ev.clientX, y0: ev.clientY, moved: false, el: t };
  }
  function onPtrMove(ev) {
    if (!tdrag || ev.pointerType !== 'touch') return;
    if (!tdrag.moved && Math.hypot(ev.clientX - tdrag.x0, ev.clientY - tdrag.y0) < 12) return;
    tdrag.moved = true; ev.preventDefault();
    tdrag.el.classList.add('dragging');
    drag = { uid: tdrag.uid, offer: tdrag.offer, size: tdrag.size };
    var under = document.elementFromPoint(ev.clientX, ev.clientY), bd = under && under.closest('#board'), st = under && under.closest('#stash');
    clearHl();
    if (bd) { var p = boardPos(ev), slots = bd.querySelectorAll('.slot'); for (var i = p; i < p + drag.size && i < slots.length; i++) slots[i].classList.add('over', 'ok'); }
    else if (st && drag.uid !== null) st.classList.add('over');
  }
  function onPtrUp(ev) {
    if (!tdrag || ev.pointerType !== 'touch') { tdrag = null; return; }
    var d = tdrag; tdrag = null; d.el.classList.remove('dragging');
    if (!d.moved) { drag = null; clearHl(); return; }
    var under = document.elementFromPoint(ev.clientX, ev.clientY), bd = under && under.closest('#board'), st = under && under.closest('#stash'), r = null;
    if (bd) { var p = boardPos(ev); r = d.uid !== null ? Game.placeAt(d.uid, p) : Game.buy(d.offer, p); }
    else if (st && d.uid !== null) r = Game.toStash(d.uid);
    drag = null; clearHl();
    if (r) { setFlash(r.ok ? (r.msg || null) : r.why, r.ok ? 'good' : 'bad'); sel = null; render(); }
  }
  function init() {
    document.addEventListener('pointerdown', onPtrDown, { passive: true });
    document.addEventListener('pointermove', onPtrMove, { passive: false });
    document.addEventListener('pointerup', onPtrUp);
    document.addEventListener('pointercancel', function () { tdrag = null; drag = null; clearHl(); });
    $c = document.getElementById('center');
    Game.load();
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    document.addEventListener('dragend', onDragEnd);
    render();
  }
  return { init: init, render: render, startBattle: startBattle, battle: function () { return B; } };
})();
