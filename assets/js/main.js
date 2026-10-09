/* Parnassus Books and Gifts
   1. Hours: picks summer/winter by date (Alaska time), highlights today, shows an Open now / Closed callout.
   2. Walking map: draws itself when scrolled into view; click the map to replay.
   Hours come from _data/hours.yml (embedded in the page as JSON). */
(function () {
  'use strict';

  /* ---------- hours ---------- */
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function toMins(hhmm) {
    var p = String(hhmm).split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1] || '0', 10);
  }
  function fmt(m) {
    var h = Math.floor(m / 60), mm = m % 60, h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + (mm ? ':' + String(mm).padStart(2, '0') : '') + (h < 12 ? 'am' : 'pm');
  }
  function span(r) { return r.closed ? 'Closed' : fmt(toMins(r.open)) + '–' + fmt(toMins(r.close)); }

  function nowInStore(tz) {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
      }).formatToParts(new Date());
      var g = function (t) { return parts.filter(function (p) { return p.type === t; })[0].value; };
      var y = g('year'), mo = parseInt(g('month'), 10), d = parseInt(g('day'), 10);
      return {
        dow: DOW.indexOf(g('weekday')),
        month: mo,
        iso: y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'),
        mins: parseInt(g('hour'), 10) * 60 + parseInt(g('minute'), 10)
      };
    } catch (e) {
      var n = new Date();
      return {
        dow: n.getDay(), month: n.getMonth() + 1,
        iso: n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'),
        mins: n.getHours() * 60 + n.getMinutes()
      };
    }
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderHours(H) {
    var pill = document.getElementById('hours-pill');
    var status = document.getElementById('hours-status');
    var footHead = document.getElementById('foot-season');
    var footRows = document.getElementById('foot-rows');
    if (!pill || !H.seasons || !H.seasons.length) return;

    var now = nowInStore(H.timezone || 'America/Sitka');
    var season = H.seasons.filter(function (s) { return s.months.indexOf(now.month) >= 0; })[0] || H.seasons[0];
    var today = season.rows.filter(function (r) { return r.days.indexOf(now.dow) >= 0; })[0];
    var holiday = (H.holidays || []).indexOf(now.iso) >= 0;
    var hasHours = !!(today && !today.closed && !holiday);
    var isOpen = hasHours && now.mins >= toMins(today.open) && now.mins < toMins(today.close);

    pill.textContent = '';
    season.rows.forEach(function (r) {
      var cur = r === today;
      var li = el('li', cur ? 'is-current' : '');
      li.setAttribute('aria-current', cur ? 'true' : 'false');
      if (cur) {
        var badge = el('span', 'status-badge ' + (isOpen ? 'is-open' : 'is-closed'), isOpen ? 'Open now' : 'Closed');
        badge.setAttribute('aria-hidden', 'true');
        li.appendChild(badge);
      }
      var seg = el('div', 'seg');
      seg.appendChild(el('span', 'seg-day', r.label));
      seg.appendChild(el('span', '', span(r)));
      li.appendChild(seg);
      pill.appendChild(li);
    });
    if (status) status.textContent = holiday ? 'Closed today for the holiday' : (isOpen ? 'Open now' : 'Closed right now');

    if (footHead) footHead.textContent = season.label;
    if (footRows) {
      footRows.textContent = '';
      season.rows.forEach(function (r) {
        var row = el('div', 'foot-row');
        row.appendChild(el('span', '', r.label));
        row.appendChild(el('span', '', span(r)));
        footRows.appendChild(row);
      });
    }
  }

  var hoursNode = document.getElementById('hours-data');
  if (hoursNode) {
    var H;
    try { H = JSON.parse(hoursNode.textContent); } catch (e) { H = null; }
    if (H) {
      renderHours(H);
      setInterval(function () { renderHours(H); }, 60000);
    }
  }

  /* ---------- walking map ---------- */
  var stage = document.getElementById('map-stage');
  var replay = document.getElementById('map-replay');
  if (stage) {
    var started = false;
    var start = function () {
      if (started) return;
      started = true;
      stage.classList.add('run-a');
    };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) {
          start();
          io.disconnect();
        }
      }, { threshold: 0.35 });
      io.observe(stage);
    } else {
      start();
    }
    if (replay) {
      replay.addEventListener('click', function () {
        started = true;
        var a = stage.classList.contains('run-a');
        stage.classList.remove('run-a', 'run-b');
        // Swap between two identical animations so the browser restarts them.
        void stage.offsetWidth;
        stage.classList.add(a ? 'run-b' : 'run-a');
      });
    }
  }

  /* ---------- Bookshop.org search: visit our shop first so the sale is credited to us, then run the search ---------- */
  var bs = document.getElementById('book-search');
  if (bs) {
    bs.addEventListener('submit', function (e) {
      var q = bs.elements['keywords'].value.trim();
      if (!q) { return; }
      var w;
      try { w = window.open(bs.getAttribute('data-shop'), '_blank'); } catch (err) { w = null; }
      if (!w) { return; }                      /* popup blocked: fall back to the plain form */
      e.preventDefault();
      var url = bs.action + '?keywords=' + encodeURIComponent(q);
      setTimeout(function () { try { w.location.href = url; } catch (err) { window.open(url, '_blank'); } }, 2000);
    });
  }

  /* ---------- pre-launch color-theme switcher ---------- */
  var switcher = document.querySelector('.theme-switcher');
  if (switcher) {
    var buttons = switcher.querySelectorAll('[data-theme-btn]');
    var root = document.documentElement;
    var markPressed = function () {
      var current = root.getAttribute('data-theme');
      Array.prototype.forEach.call(buttons, function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-theme-btn') === current ? 'true' : 'false');
      });
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--c-dark').trim());
    };
    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener('click', function () {
        var name = b.getAttribute('data-theme-btn');
        root.setAttribute('data-theme', name);
        try { localStorage.setItem('pb-theme', name); } catch (e) {}
        markPressed();
      });
    });
    markPressed();
  }
})();
