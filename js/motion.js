// Oceanica Bazaar — Motion: ความลื่นไหลของหน้าจอ (10-15 บอสสั่ง "ทำให้ภาพดูดีดูลื่นไหล สไตล์ลื่นๆ ล้ำๆ")
// หลักคิด: 1 โมเมนต์หลัก = "คลื่นซัด" ตอนออกรบ (เปลี่ยนฉากด้วยคลื่นอุกิโยะ) · ที่เหลือคือ feedback ให้รู้ว่าเกิดอะไรขึ้น
//   - เปลี่ยนฉาก: shop→battle คลื่นซัดเต็มจอ + 2 ฝ่ายไถลเข้าหากัน / ฉากอื่น หมึกจางเร็ว
//   - ซื้อของ: ของบินจากร้านไปลงช่องบนกระดาน (FLIP) / รวมร่าง = ของเดิมวิบวับทอง
//   - ทอง: ตัวเลขนับขึ้น-ลงแทนกระโดด
//   - การ์ดเอียงตามเมาส์ (3D tilt) + ไฮไลต์แสงตามตำแหน่งเมาส์ · กัปตัน/ไอคอนมองตามเมาส์ (แบบ page-mascot)
//   - ปิดทั้งหมดเมื่อ prefers-reduced-motion หรือจอสัมผัส (ไม่มี hover)
'use strict';
var Motion = (function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = !(window.matchMedia && window.matchMedia('(hover: none)').matches);
  var lastScreen = null, lastGold = null, goldAnim = null;
  var $c = null;
  function center() { return $c || ($c = document.getElementById('center')); }

  // ---------- เปลี่ยนฉาก ----------
  // เรียกก่อน render ฉากใหม่ (บอกว่ากำลังจะไปฉากไหน) และหลัง render (ใส่ class ให้ CSS เล่นแอนิเมชันเข้า)
  function before(screen) { return { from: lastScreen, to: screen }; }
  function after(screen) {
    var c = center(); if (!c) { lastScreen = screen; return; }
    var from = lastScreen; lastScreen = screen;
    if (reduce || from === null || from === screen) { syncGold(true); return; }
    // ล้าง class เก่าแล้วบังคับ reflow ให้ keyframe เริ่มใหม่ทุกครั้ง
    c.classList.remove('wipe', 'enter', 'to-battle', 'to-shop', 'to-end', 'to-event');
    void c.offsetWidth;
    var big = screen === 'battle' || screen === 'end', cols = document.getElementById('cols');
    c.classList.add(big ? 'wipe' : 'enter', 'to-' + screen);
    // แถบฟองคลื่นวิ่งนำหน้าขอบเผย อยู่บน #cols (นอก mask ของ #center ไม่งั้นโดน mask บังพอดี)
    if (cols) { cols.classList.remove('wiping'); if (big) { void cols.offsetWidth; cols.classList.add('wiping'); } }
    clearTimeout(after._t);
    after._t = setTimeout(function () { c.classList.remove('wipe', 'enter', 'to-battle', 'to-shop', 'to-end', 'to-event'); if (cols) cols.classList.remove('wiping'); }, big ? 900 : 400);
    syncGold(true);
  }

  // ---------- ทองนับขึ้น ----------
  // จำค่าทองล่าสุดที่โชว์ ถ้าเปลี่ยนให้ตัวเลขวิ่งจากค่าเก่าไปค่าใหม่ใน ~450ms
  function goldEls() { return document.querySelectorAll('.topbar .st.gp b, .goldbadge'); }
  function syncGold(animate) {
    var G = (typeof Game !== 'undefined' && Game.get) ? Game.get() : null;
    var els = goldEls(); if (!G || !els.length) { lastGold = G ? G.gold : null; return; }
    var to = G.gold, from = lastGold;
    lastGold = to;
    if (from === null || from === to || reduce || !animate) return;
    if (goldAnim) cancelAnimationFrame(goldAnim);
    var t0 = performance.now(), dur = 450, dir = to > from ? 'up' : 'down';
    // กันแท็บถูกพัก (rAF หยุด) แล้วตัวเลขค้างค่าเก่า: บังคับค่าปลายทางเมื่อครบเวลาเสมอ
    clearTimeout(syncGold._t); syncGold._t = setTimeout(function () { if (goldAnim) { cancelAnimationFrame(goldAnim); goldAnim = null; } goldEls().forEach(function (e) { e.textContent = e.classList.contains('goldbadge') ? '💰 ' + to + ' ทอง' : String(to); }); }, dur + 80);
    els.forEach(function (e) { e.classList.remove('bump-up', 'bump-down'); void e.offsetWidth; e.classList.add('bump-' + dir); });
    (function tick(now) {
      var p = Math.min(1, (now - t0) / dur), ease = 1 - Math.pow(1 - p, 3);
      var v = Math.round(from + (to - from) * ease);
      els.forEach(function (e) { e.textContent = e.classList.contains('goldbadge') ? '💰 ' + v + ' ทอง' : String(v); });
      if (p < 1) goldAnim = requestAnimationFrame(tick); else goldAnim = null;
    })(t0);
  }

  // ---------- ซื้อของ: บินจากร้านไปกระดาน ----------
  // snap(): เก็บตำแหน่งการ์ดในร้านที่กดซื้อ + รายการ uid ก่อนซื้อ · fly(snap): หลัง render หา uid ใหม่แล้วบินไปหา
  function snap(offerEl) {
    var G = Game.get(); if (!G || !offerEl) return null;
    var img = offerEl.querySelector('.icimg, .ic');
    var r = (img || offerEl).getBoundingClientRect();
    return { rect: r, src: img && img.tagName === 'IMG' ? img.getAttribute('src') : null, txt: img && img.tagName !== 'IMG' ? img.textContent : '', uids: G.board.concat(G.stash).map(function (it) { return it.uid; }) };
  }
  function fly(s) {
    if (!s || reduce) return;
    var G = Game.get(); if (!G) return;
    var fresh = null, all = G.board.concat(G.stash);
    for (var i = 0; i < all.length; i++) if (s.uids.indexOf(all[i].uid) < 0) fresh = all[i];
    if (!fresh) { // รวมร่าง: ไม่มี uid ใหม่ → หาชิ้นที่ tier เพิ่ม (ใช้ชิ้นที่ถูกเลือกล่าสุดโดย Game ไม่ได้ จึงวิบวับทุกชิ้นชื่อเดียวกันที่ขึ้นระดับ)
      document.querySelectorAll('#board .item.t1, #board .item.t2, #board .item.t3, .stash .item.t1, .stash .item.t2, .stash .item.t3').forEach(function (e) { e.classList.add('merged'); setTimeout(function () { e.classList.remove('merged'); }, 900); });
      return;
    }
    var dest = document.querySelector('[data-uid="' + fresh.uid + '"]'); if (!dest) return;
    var dr = dest.getBoundingClientRect(), sr = s.rect;
    var ghost = document.createElement('div'); ghost.className = 'flyghost';
    ghost.innerHTML = s.src ? '<img src="' + s.src + '" alt="">' : '<span>' + s.txt + '</span>';
    ghost.style.cssText = 'left:' + sr.left + 'px;top:' + sr.top + 'px;width:' + sr.width + 'px;height:' + sr.height + 'px;';
    document.body.appendChild(ghost);
    dest.classList.add('landing');
    var dx = (dr.left + dr.width / 2) - (sr.left + sr.width / 2), dy = (dr.top + dr.height / 2) - (sr.top + sr.height / 2);
    var sc = Math.max(0.6, Math.min(2.2, dr.width / Math.max(1, sr.width)));
    var a = ghost.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
      { transform: 'translate(' + (dx * 0.5) + 'px,' + (dy * 0.5 - 40) + 'px) scale(' + ((1 + sc) / 2) + ') rotate(-6deg)', opacity: 1, offset: 0.55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sc + ') rotate(0deg)', opacity: 0.95, offset: 1 }
    ], { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
    a.onfinish = function () { ghost.remove(); dest.classList.remove('landing'); dest.classList.add('landed'); setTimeout(function () { dest.classList.remove('landed'); }, 500); };
  }

  // ---------- เอียงตามเมาส์ + มองตามเมาส์ ----------
  var tiltEl = null, raf = null, px = 0, py = 0;
  function onMove(ev) {
    px = ev.clientX; py = ev.clientY;
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = null;
      var root = document.documentElement;
      // ทิศทางสายตา (ทั้งหน้า): -1..1 จากกลางจอ
      root.style.setProperty('--mx', ((px / window.innerWidth) * 2 - 1).toFixed(3));
      root.style.setProperty('--my', ((py / window.innerHeight) * 2 - 1).toFixed(3));
      // กัปตันบนหน้าเลือก: มองไปทางเมาส์จากตำแหน่งตัวเอง (แบบ page-mascot)
      document.querySelectorAll('.hero .portrait, .endhero .portrait').forEach(function (p) {
        var r = p.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var dx = px - cx, dy = py - cy, d = Math.max(1, Math.hypot(dx, dy)), k = Math.min(1, d / 260);
        p.style.setProperty('--gx', (dx / d * k).toFixed(3)); p.style.setProperty('--gy', (dy / d * k).toFixed(3));
      });
      // การ์ดใต้เมาส์เอียงตาม
      var t = document.elementFromPoint(px, py);
      var card = t && t.closest ? t.closest('.offer:not(.sold), #board .item, .stash .item, .hero') : null;
      if (card !== tiltEl) { if (tiltEl) { tiltEl.classList.remove('tilt'); tiltEl.style.removeProperty('--rx'); tiltEl.style.removeProperty('--ry'); tiltEl.style.removeProperty('--lx'); tiltEl.style.removeProperty('--ly'); } tiltEl = card; if (card) card.classList.add('tilt'); }
      if (card && !card.classList.contains('dragging')) {
        var cr = card.getBoundingClientRect();
        var nx = (px - cr.left) / cr.width - 0.5, ny = (py - cr.top) / cr.height - 0.5;
        card.style.setProperty('--ry', (nx * 10).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-ny * 10).toFixed(2) + 'deg');
        card.style.setProperty('--lx', ((nx + 0.5) * 100).toFixed(1) + '%');
        card.style.setProperty('--ly', ((ny + 0.5) * 100).toFixed(1) + '%');
      }
    });
  }
  function onLeave() { if (tiltEl) { tiltEl.classList.remove('tilt'); tiltEl = null; } }

  function init() {
    if (reduce) document.documentElement.classList.add('reduce-motion');
    if (!canHover || reduce) return;
    document.documentElement.classList.add('has-hover');
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('dragstart', onLeave);
  }
  return { init: init, before: before, after: after, snap: snap, fly: fly, gold: syncGold };
})();
