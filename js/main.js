// Oceanica Bazaar — จุดเริ่ม
'use strict';
window.addEventListener('error', function (e) {
  var eb = document.getElementById('errbar');
  if (eb) { eb.style.display = 'block'; eb.textContent = 'เกิดข้อผิดพลาด: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')'; }
});
document.addEventListener('DOMContentLoaded', function () { UI.init(); });
