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

  /* ---------- Contact button: copy the store email to the clipboard and say so ---------- */
  var copyLink = document.querySelector('[data-copy-email]');
  var toast = document.getElementById('copy-toast');
  if (copyLink && toast) {
    var toastTimer;
    var showToast = function (email, ok) {
      toast.textContent = '';
      toast.appendChild(document.createTextNode(ok ? 'Email address copied to your clipboard' : 'Our email address'));
      var small = document.createElement('small');
      small.textContent = email;
      toast.appendChild(small);
      /* place the popup just under the button, kept inside the screen */
      toast.classList.remove('show');
      var r = copyLink.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var w = toast.offsetWidth;
      var left = Math.max(12, Math.min(cx - w / 2, document.documentElement.clientWidth - w - 12));
      toast.style.left = left + 'px';
      toast.style.top = (r.bottom + 14) + 'px';
      toast.style.setProperty('--arrow-x', (cx - left) + 'px');
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3500);
    };
    var legacyCopy = function (text) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(ta);
      return ok;
    };
    window.addEventListener('scroll', function () { toast.classList.remove('show'); }, { passive: true });
    copyLink.addEventListener('click', function (e) {
      var email = copyLink.getAttribute('data-copy-email');
      e.preventDefault();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(function () { showToast(email, true); },
          function () { showToast(email, legacyCopy(email)); });
      } else {
        showToast(email, legacyCopy(email));
      }
    });
  }

  /* ---------- staff-picks carousel ---------- */
  (function () {
    var root = document.getElementById('picks-carousel');
    if (!root) return;
    var viewport = root.querySelector('.carousel-viewport');
    var list = root.querySelector('.picks');
    var prevBtn = root.querySelector('.carousel-arrow--prev');
    var nextBtn = root.querySelector('.carousel-arrow--next');
    var originals = Array.prototype.slice.call(list.children);
    var count = originals.length;
    var WAIT = 7000;                       // pause between slides (ms)
    var GAP = 20;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var per = 0, index = 0, timer = null, busy = false, held = false, offscreen = false;
    var active = false;

    function perView() {
      var w = viewport.clientWidth;
      return w >= 960 ? 3 : (w >= 620 ? 2 : 1);
    }
    function clones(flag) {
      return originals.map(function (el) {
        var c = el.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        c.setAttribute('inert', '');
        c.setAttribute('data-clone', flag);
        return c;
      });
    }
    function teardown() {
      stop();
      Array.prototype.slice.call(list.querySelectorAll('[data-clone]')).forEach(function (c) { c.remove(); });
      list.style.transform = '';
      root.classList.remove('is-ready');
      prevBtn.hidden = nextBtn.hidden = true;
      active = false;
    }
    function place(animate) {
      var target = list.children[index];
      if (!target) return;
      if (!animate) list.classList.add('no-anim');
      list.style.transform = 'translateX(' + (-target.offsetLeft) + 'px)';
      if (!animate) { void list.offsetWidth; list.classList.remove('no-anim'); }
    }
    function setup() {
      teardown();
      per = perView();
      list.style.setProperty('--per', per);
      if (count <= per) { return; }      // everything fits: leave the plain grid
      var before = clones('before'), after = clones('after');
      before.forEach(function (c) { list.insertBefore(c, originals[0]); });
      after.forEach(function (c) { list.appendChild(c); });
      root.classList.add('is-ready');
      root.style.setProperty('--gap', GAP + 'px');
      prevBtn.hidden = nextBtn.hidden = false;
      index = count;                      // first real item
      active = true;
      place(false);
      schedule();
    }
    function wrap() {                     // jump back into the middle copy, invisibly
      if (index < count) { index += count; place(false); }
      else if (index >= 2 * count) { index -= count; place(false); }
    }
    function go(dir) {
      if (!active || busy) return;
      busy = true;
      stop();
      wrap();
      index += dir * per;
      place(!reduce.matches);
      var done = false;
      var finish = function () {
        if (done) return; done = true; busy = false; wrap(); schedule();
      };
      list.addEventListener('transitionend', function te(e) {
        if (e.target !== list) return;
        list.removeEventListener('transitionend', te); finish();
      });
      setTimeout(finish, reduce.matches ? 0 : 900);
    }
    function stop() { if (timer) { clearTimeout(timer); timer = null; } }
    function schedule() {
      stop();
      if (!active || held || offscreen || reduce.matches || document.hidden) return;
      timer = setTimeout(function () { go(1); }, WAIT);
    }
    prevBtn.addEventListener('click', function () { go(-1); });
    nextBtn.addEventListener('click', function () { go(1); });

    root.addEventListener('mouseenter', function () { held = true; stop(); });
    root.addEventListener('mouseleave', function () { held = root.contains(document.activeElement) && root.matches(':focus-within'); schedule(); });
    root.addEventListener('focusin', function (e) {
      held = true; stop();
      var item = e.target.closest && e.target.closest('.pick');   // keep a tabbed-to book in view
      if (item && active && !item.hasAttribute('data-clone')) {
        var k = originals.indexOf(item);
        var lo = index, hi = index + per - 1, pos = count + k;
        if (index < count || index >= 2 * count) wrap();
        lo = index; hi = index + per - 1;
        if (pos < lo || pos > hi) { index = count + Math.floor(k / per) * per; if (index + per > list.children.length) index = count + k; place(false); }
      }
    });
    root.addEventListener('focusout', function () {
      setTimeout(function () { if (!root.contains(document.activeElement)) { held = false; schedule(); } }, 0);
    });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : schedule(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        offscreen = !entries[0].isIntersecting;
        offscreen ? stop() : schedule();
      }, { threshold: 0.2 }).observe(root);
    }
    if (reduce.addEventListener) reduce.addEventListener('change', function () { reduce.matches ? stop() : schedule(); });

    /* swipe on touch screens */
    var x0 = null, y0 = 0, moved = false;
    viewport.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      x0 = e.clientX; y0 = e.clientY; moved = false; held = true; stop();
    });
    viewport.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { moved = true; go(dx < 0 ? 1 : -1); }
      held = root.matches(':focus-within');
      if (!moved) schedule();
    });
    viewport.addEventListener('pointercancel', function () { x0 = null; held = false; schedule(); });
    viewport.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);

    var lastW = 0, rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        var w = viewport.clientWidth;
        if (w !== lastW) { lastW = w; setup(); }
      }, 150);
    });
    lastW = viewport.clientWidth;
    setup();
  })();

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
