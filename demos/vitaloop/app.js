(() => {
  'use strict';

  const SEED_DEFAULT = 20240615;
  const TICK_MS = 2000;
  const RANGES = {
    5: { label: 'Last 5 minutes', ms: 5 * 60 * 1000, bucketMs: 2000 },
    15: { label: 'Last 15 minutes', ms: 15 * 60 * 1000, bucketMs: 2000 },
    30: { label: 'Last 30 minutes', ms: 30 * 60 * 1000, bucketMs: 10000 },
    60: { label: 'Last 1 hour', ms: 60 * 60 * 1000, bucketMs: 20000 },
    360: { label: 'Last 6 hours', ms: 6 * 60 * 60 * 1000, bucketMs: 120000 },
    1440: { label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000, bucketMs: 300000 }
  };

  const els = {
    timeRange: document.getElementById('timeRange'),
    resetDemo: document.getElementById('resetDemo'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    bpmValue: document.getElementById('bpmValue'),
    bpmStatus: document.getElementById('bpmStatus'),
    bpmGauge: document.getElementById('bpmGauge'),
    spo2Value: document.getElementById('spo2Value'),
    spo2Status: document.getElementById('spo2Status'),
    spo2Gauge: document.getElementById('spo2Gauge'),
    payloadValue: document.getElementById('payloadValue'),
    lastUpdate: document.getElementById('lastUpdate'),
    pointCount: document.getElementById('pointCount'),
    bpmChart: document.getElementById('bpmChart'),
    spo2Chart: document.getElementById('spo2Chart'),
    bpmChartRange: document.getElementById('bpmChartRange'),
    spo2ChartRange: document.getElementById('spo2ChartRange'),
    bpmChartFoot: document.getElementById('bpmChartFoot'),
    spo2ChartFoot: document.getElementById('spo2ChartFoot'),
    deviceState: document.getElementById('deviceState')
  };

  let state = null;
  let timer = null;

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function fmtShort(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function fmtDateTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function makeInitialState() {
    const now = Date.now();
    // Anchor to a stable recent minute so refreshes are consistent within session,
    // but still feel current. Seed keeps values deterministic.
    const anchor = Math.floor(now / 1000) * 1000;
    return {
      seed: SEED_DEFAULT,
      rng: mulberry32(SEED_DEFAULT),
      anchor: anchor,
      tick: 0,
      points: [],
      lastFinger: true,
      bpmWindow: [],
      spo2Window: []
    };
  }

  function generatePoint(s, tickIndex) {
    // Use deterministic RNG stream in order. tickIndex drives scenario.
    const r1 = s.rng();
    const r2 = s.rng();
    const r3 = s.rng();
    const r4 = s.rng();

    // Simulate occasional no-finger periods (brief)
    const cycle = tickIndex % 240;
    const noFinger = (cycle >= 150 && cycle < 158) || (cycle >= 210 && cycle < 214);
    s.lastFinger = !noFinger;

    // Heart rate: base around 74 with slow wave + noise, occasional activity bump
    const wave = Math.sin(tickIndex / 45) * 6 + Math.sin(tickIndex / 11) * 2;
    const activity = (cycle > 60 && cycle < 90) ? 12 + Math.sin((tickIndex - 60) / 4) * 4 : 0;
    const noise = (r1 - 0.5) * 4;
    let bpmRaw = 74 + wave + activity + noise;
    if (noFinger) bpmRaw = 68 + (r2 - 0.5) * 6;

    // 4-sample average acceptance 40-180 BPM
    s.bpmWindow.push(bpmRaw);
    if (s.bpmWindow.length > 4) s.bpmWindow.shift();
    const bpmAvg = s.bpmWindow.reduce((a, b) => a + b, 0) / s.bpmWindow.length;
    const bpmAccepted = bpmAvg >= 40 && bpmAvg <= 180;
    const bpm = bpmAccepted ? Math.round(bpmAvg) : null;

    // SpO2: 200-sample estimate, 80 when no finger detected
    let spo2;
    if (noFinger) {
      spo2 = 80;
    } else {
      const spo2Base = 97.6 + Math.sin(tickIndex / 70) * 0.8 - (activity > 0 ? 0.6 : 0);
      const spo2Noise = (r3 - 0.5) * 0.8;
      spo2 = clamp(spo2Base + spo2Noise, 94, 100);
      spo2 = Math.round(spo2 * 10) / 10;
    }

    const t = s.anchor - (24 * 60 * 60 * 1000) + tickIndex * TICK_MS;
    return {
      t,
      bpm,
      spo2,
      finger: !noFinger,
      rawBpm: Math.round(bpmRaw)
    };
  }

  function buildHistory(s) {
    s.points = [];
    s.bpmWindow = [];
    s.spo2Window = [];
    s.rng = mulberry32(s.seed);
    const totalTicks = Math.floor((24 * 60 * 60 * 1000) / TICK_MS) + 1; // 24h + current
    for (let i = 0; i < totalTicks; i++) {
      s.points.push(generatePoint(s, i));
    }
    s.tick = totalTicks - 1;
  }

  function tickForward(s) {
    s.tick += 1;
    const p = generatePoint(s, s.tick);
    // Keep last point near real now for the live feel, but deterministic sequence
    p.t = Date.now();
    s.points.push(p);
    // keep 24h+buffer
    const cutoff = Date.now() - (24 * 60 * 60 * 1000 + 5 * 60 * 1000);
    while (s.points.length > 2 && s.points[1].t < cutoff) {
      s.points.shift();
    }
  }

  function getRangePoints(points, rangeMin) {
    const cfg = RANGES[rangeMin];
    const cutoff = Date.now() - cfg.ms;
    const inRange = points.filter(p => p.t >= cutoff);
    if (inRange.length === 0) return [];

    if (cfg.bucketMs <= TICK_MS) return inRange;

    const buckets = [];
    let bucket = null;
    for (const p of inRange) {
      const bucketKey = Math.floor(p.t / cfg.bucketMs);
      if (!bucket || bucket.key !== bucketKey) {
        if (bucket) buckets.push(finalizeBucket(bucket));
        bucket = { key: bucketKey, tSum: 0, count: 0, bpmSum: 0, bpmCount: 0, spo2Sum: 0, spo2Count: 0, fingerCount: 0 };
      }
      bucket.tSum += p.t;
      bucket.count += 1;
      if (typeof p.bpm === 'number') { bucket.bpmSum += p.bpm; bucket.bpmCount += 1; }
      if (typeof p.spo2 === 'number') { bucket.spo2Sum += p.spo2; bucket.spo2Count += 1; }
      if (p.finger) bucket.fingerCount += 1;
    }
    if (bucket) buckets.push(finalizeBucket(bucket));
    return buckets;
  }

  function finalizeBucket(b) {
    return {
      t: Math.round(b.tSum / b.count),
      bpm: b.bpmCount ? Math.round(b.bpmSum / b.bpmCount) : null,
      spo2: b.spo2Count ? Math.round((b.spo2Sum / b.spo2Count) * 10) / 10 : null,
      finger: b.fingerCount > b.count / 2
    };
  }

  function setStatus(el, text, cls) {
    el.textContent = text;
    el.classList.remove('good', 'warn', 'bad');
    if (cls) el.classList.add(cls);
  }

  function updateKpis(latest) {
    if (!latest) return;

    if (typeof latest.bpm === 'number') {
      els.bpmValue.textContent = String(latest.bpm);
      const bpmPct = clamp(((latest.bpm - 40) / (180 - 40)) * 100, 0, 100);
      els.bpmGauge.setAttribute('width', bpmPct.toFixed(1));
      if (latest.bpm < 55 || latest.bpm > 110) {
        setStatus(els.bpmStatus, 'Outside typical resting range (synthetic)', 'warn');
      } else {
        setStatus(els.bpmStatus, 'Simulated reading within accepted range', 'good');
      }
    } else {
      els.bpmValue.textContent = '--';
      els.bpmGauge.setAttribute('width', '0');
      setStatus(els.bpmStatus, 'No accepted BPM sample', 'bad');
    }

    if (typeof latest.spo2 === 'number') {
      const spo2Text = Number.isInteger(latest.spo2) ? String(latest.spo2) : latest.spo2.toFixed(1);
      els.spo2Value.textContent = spo2Text;
      const spo2Pct = clamp(((latest.spo2 - 80) / 20) * 100, 0, 100);
      els.spo2Gauge.setAttribute('width', spo2Pct.toFixed(1));
      if (!latest.finger || latest.spo2 <= 90) {
        setStatus(els.spo2Status, 'No finger detected (synthetic fixed value)', 'warn');
      } else if (latest.spo2 < 95) {
        setStatus(els.spo2Status, 'Simulated low SpO2 reading', 'warn');
      } else {
        setStatus(els.spo2Status, 'Simulated normal SpO2 reading', 'good');
      }
    } else {
      els.spo2Value.textContent = '--';
      els.spo2Gauge.setAttribute('width', '0');
      setStatus(els.spo2Status, 'No SpO2 reading', 'bad');
    }

    const bpmPayload = typeof latest.bpm === 'number' ? latest.bpm : null;
    const spo2Payload = typeof latest.spo2 === 'number' ? latest.spo2 : null;
    els.payloadValue.textContent = '{ "bpm": ' + bpmPayload + ', "spo2": ' + spo2Payload + ' }';
    els.lastUpdate.textContent = fmtDateTime(latest.t);
  }

  function buildChart(svg, points, opts) {
    const W = 720;
    const H = 260;
    const pad = { top: 16, right: 16, bottom: 30, left: 44 };
    const iw = W - pad.left - pad.right;
    const ih = H - pad.top - pad.bottom;
    const minY = opts.minY;
    const maxY = opts.maxY;
    const rangeY = maxY - minY || 1;

    const xFor = (t) => {
      const t0 = points[0].t;
      const t1 = points[points.length - 1].t;
      const span = (t1 - t0) || 1;
      return pad.left + ((t - t0) / span) * iw;
    };
    const yFor = (v) => pad.top + (1 - (v - minY) / rangeY) * ih;

    const parts = [];
    parts.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>');

    // Grid lines
    const gridCount = 5;
    for (let i = 0; i <= gridCount; i++) {
      const v = minY + (rangeY * i / gridCount);
      const y = yFor(v);
      parts.push('<line x1="' + pad.left + '" y1="' + y.toFixed(2) + '" x2="' + (W - pad.right) + '" y2="' + y.toFixed(2) + '" stroke="#edf0f4" stroke-width="1"/>');
      parts.push('<text x="' + (pad.left - 8) + '" y="' + (y + 4).toFixed(2) + '" text-anchor="end" font-size="11" fill="#8b97a8" font-family="Roboto,Segoe UI,Arial,sans-serif">' + Math.round(v) + '</text>');
    }

    // X labels
    const labelCount = Math.min(6, points.length);
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.round((points.length - 1) * (i / (labelCount - 1 || 1)));
      const p = points[idx];
      const x = xFor(p.t);
      parts.push('<line x1="' + x.toFixed(2) + '" y1="' + pad.top + '" x2="' + x.toFixed(2) + '" y2="' + (H - pad.bottom) + '" stroke="#f5f7fa" stroke-width="1"/>');
      parts.push('<text x="' + x.toFixed(2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="#8b97a8" font-family="Roboto,Segoe UI,Arial,sans-serif">' + fmtShort(p.t) + '</text>');
    }

    // Area + line
    let segment = [];
    const flushSegment = () => {
      if (segment.length === 0) return;
      if (segment.length === 1) {
        const x = xFor(segment[0].t);
        const y = yFor(segment[0].v);
        parts.push('<circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="2.5" fill="' + opts.color + '"/>');
        segment = [];
        return;
      }
      const linePoints = segment.map(pt => xFor(pt.t).toFixed(2) + ',' + yFor(pt.v).toFixed(2)).join(' ');
      const first = segment[0];
      const last = segment[segment.length - 1];
      const areaPoints = xFor(first.t).toFixed(2) + ',' + (H - pad.bottom).toFixed(2) + ' ' + linePoints + ' ' + xFor(last.t).toFixed(2) + ',' + (H - pad.bottom).toFixed(2);
      parts.push('<polygon points="' + areaPoints + '" fill="' + opts.area + '" stroke="none"/>');
      parts.push('<polyline points="' + linePoints + '" fill="none" stroke="' + opts.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>');
      segment = [];
    };

    for (const p of points) {
      const v = p[opts.key];
      if (typeof v === 'number') {
        segment.push({ t: p.t, v });
      } else {
        flushSegment();
      }
    }
    flushSegment();

    // Last point marker
    for (let i = points.length - 1; i >= 0; i--) {
      const v = points[i][opts.key];
      if (typeof v === 'number') {
        const x = xFor(points[i].t);
        const y = yFor(v);
        parts.push('<circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="3.5" fill="#fff" stroke="' + opts.color + '" stroke-width="2"/>');
        break;
      }
    }

    // Border
    parts.push('<rect x="' + pad.left + '" y="' + pad.top + '" width="' + iw + '" height="' + ih + '" fill="none" stroke="#e5e9f0" stroke-width="1"/>');

    svg.innerHTML = parts.join('');
    svg.setAttribute('aria-label', opts.ariaLabel + '. Showing ' + points.length + ' points from ' + fmtDateTime(points[0].t) + ' to ' + fmtDateTime(points[points.length - 1].t) + '.');
  }

  function summarize(points, key) {
    const vals = points.map(p => p[key]).filter(v => typeof v === 'number');
    if (vals.length === 0) return 'No data in range';
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const fmt = (v) => key === 'spo2' ? v.toFixed(1) + '%' : Math.round(v) + ' BPM';
    return 'Min ' + fmt(min) + ' · Avg ' + fmt(key === 'spo2' ? avg : Math.round(avg)) + ' · Max ' + fmt(max);
  }

  function render() {
    const rangeMin = parseInt(els.timeRange.value, 10);
    const cfg = RANGES[rangeMin] || RANGES[15];
    const rangePoints = getRangePoints(state.points, rangeMin);
    const latest = state.points[state.points.length - 1];

    updateKpis(latest);

    els.bpmChartRange.textContent = cfg.label;
    els.spo2ChartRange.textContent = cfg.label;
    els.pointCount.textContent = String(rangePoints.length);

    if (rangePoints.length > 1) {
      buildChart(els.bpmChart, rangePoints, {
        key: 'bpm',
        minY: 40,
        maxY: 140,
        color: '#e05252',
        area: 'rgba(224,82,82,0.10)',
        ariaLabel: 'Heart rate history line chart'
      });
      buildChart(els.spo2Chart, rangePoints, {
        key: 'spo2',
        minY: 80,
        maxY: 100,
        color: '#2a9d8f',
        area: 'rgba(42,157,143,0.10)',
        ariaLabel: 'SpO2 history line chart'
      });
      els.bpmChartFoot.textContent = summarize(rangePoints, 'bpm');
      els.spo2ChartFoot.textContent = summarize(rangePoints, 'spo2');
    } else {
      els.bpmChart.innerHTML = '';
      els.spo2Chart.innerHTML = '';
      els.bpmChartFoot.textContent = 'Not enough data in selected range.';
      els.spo2ChartFoot.textContent = 'Not enough data in selected range.';
    }
  }

  function resetDemo() {
    if (timer) clearInterval(timer);
    state = makeInitialState();
    buildHistory(state);
    render();
    timer = setInterval(() => {
      tickForward(state);
      render();
    }, TICK_MS);
  }

  function initSidebar() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);

    function closeSidebar() {
      document.body.classList.remove('sidebar-open');
      els.sidebarToggle.setAttribute('aria-expanded', 'false');
    }
    function openSidebar() {
      document.body.classList.add('sidebar-open');
      els.sidebarToggle.setAttribute('aria-expanded', 'true');
    }

    els.sidebarToggle.addEventListener('click', () => {
      if (document.body.classList.contains('sidebar-open')) closeSidebar();
      else openSidebar();
    });
    overlay.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });

    // Close sidebar on nav click in mobile
    document.querySelectorAll('.nav-item').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        closeSidebar();
      });
    });

    // On desktop, sidebar is always visible; keep aria state sensible
    const mq = window.matchMedia('(max-width: 760px)');
    const sync = () => {
      if (!mq.matches) {
        document.body.classList.remove('sidebar-open');
        els.sidebarToggle.setAttribute('aria-expanded', 'true');
      } else {
        els.sidebarToggle.setAttribute('aria-expanded', 'false');
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', sync);
    else mq.addListener(sync);
    sync();
  }

  function init() {
    initSidebar();
    els.timeRange.addEventListener('change', render);
    els.resetDemo.addEventListener('click', resetDemo);
    resetDemo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
