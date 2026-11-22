(() => {
  'use strict';

  const SEED = {
    clockStart: Date.UTC(2026, 4, 22, 15, 31, 7),
    temp: 31.1,
    humidity: 68.8,
    distance: 63,
    fireActive: false,
    intrusionActive: false,
    chart: [
      { t: Date.UTC(2026, 4, 22, 10, 55, 56), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 10, 56, 10), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 10, 56, 27), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 10, 56, 40), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 10, 56, 59), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 10, 57, 15), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 10, 57, 25), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 10, 57, 40), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 11, 0, 29), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 11, 0, 45), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 11, 1, 5), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 11, 1, 26), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 11, 4, 36), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 11, 4, 44), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 11, 5, 58), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 11, 8, 35), v: 31.2 },
      { t: Date.UTC(2026, 4, 22, 11, 9, 22), v: 31.18 },
      { t: Date.UTC(2026, 4, 22, 11, 11, 57), v: 31.1 },
      { t: Date.UTC(2026, 4, 22, 11, 12, 15), v: 31.1 },
      { t: Date.UTC(2026, 4, 22, 11, 12, 48), v: 31.1 },
      { t: Date.UTC(2026, 4, 22, 11, 13, 1), v: 31.1 },
      { t: Date.UTC(2026, 4, 22, 11, 13, 22), v: 31.1 },
      { t: Date.UTC(2026, 4, 22, 11, 14, 8), v: 31.1 },
      { t: Date.UTC(2026, 4, 22, 11, 14, 24), v: 31.1 },
      { t: Date.UTC(2026, 4, 22, 11, 14, 38), v: 31.1 },
      { t: Date.UTC(2026, 4, 22, 11, 15, 11), v: 31.1 },
      { t: Date.UTC(2026, 4, 22, 11, 15, 18), v: 31.1 },
      { t: Date.UTC(2026, 4, 22, 11, 15, 29), v: 31.1 },
      { t: Date.UTC(2026, 4, 22, 11, 15, 45), v: 31.1 }
    ],
    history: [
      { t: Date.UTC(2026, 4, 22, 15, 31, 7), type: 'system', detail: 'Demo SCAFI dimuat dengan data sintetis lokal. Tidak ada koneksi perangkat, Firebase, atau Telegram.', status: 'Informasi', statusClass: 'status-neutral' },
      { t: Date.UTC(2026, 4, 22, 15, 30, 0), type: 'info', detail: 'Pembacaan rutin: suhu 31.1 °C, kelembapan 68.8 %, jarak 63 cm.', status: 'Normal', statusClass: 'status-ok' },
      { t: Date.UTC(2026, 4, 22, 15, 25, 0), type: 'info', detail: 'Pembacaan rutin: suhu 31.1 °C, kelembapan 68.7 %, jarak 64 cm.', status: 'Normal', statusClass: 'status-ok' },
      { t: Date.UTC(2026, 4, 22, 15, 20, 0), type: 'safe', detail: 'Status area tetap aman. Tidak ada indikasi api atau intrusi.', status: 'Aman', statusClass: 'status-ok' }
    ]
  };

  const dom = {
    clock: document.getElementById('clockText'),
    devicePill: document.getElementById('devicePill'),
    deviceDot: document.getElementById('deviceDot'),
    deviceStatusText: document.getElementById('deviceStatusText'),
    simToggle: document.getElementById('simToggle'),
    mainBanner: document.getElementById('mainBanner'),
    bannerIcon: document.getElementById('bannerIcon'),
    bannerText: document.getElementById('bannerText'),
    tempValue: document.getElementById('tempValue'),
    humidityValue: document.getElementById('humidityValue'),
    intruderValue: document.getElementById('intruderValue'),
    thermoFill: document.getElementById('thermoFill'),
    thermoBulb: document.getElementById('thermoBulb'),
    humidityArc: document.getElementById('humidityArc'),
    intruderShield: document.getElementById('intruderShield'),
    intruderPill: document.getElementById('intruderPill'),
    chart: document.getElementById('tempChart'),
    chartTooltip: document.getElementById('chartTooltip'),
    chartCurrent: document.getElementById('chartCurrent'),
    chartAvg: document.getElementById('chartAvg'),
    fireBtn: document.getElementById('fireBtn'),
    intrusionBtn: document.getElementById('intrusionBtn'),
    resetBtn: document.getElementById('resetBtn'),
    fireState: document.getElementById('fireState'),
    intrusionState: document.getElementById('intrusionState'),
    historyBody: document.getElementById('historyBody'),
    historyMeta: document.getElementById('historyMeta')
  };

  const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  let state;
  let tickTimer = null;
  let sampleTimer = null;
  let chartTimer = null;
  let lastTickMs = 0;
  let hoverIndex = -1;

  function cloneSeed() {
    return {
      clockMs: SEED.clockStart,
      temp: SEED.temp,
      humidity: SEED.humidity,
      distance: SEED.distance,
      fireActive: SEED.fireActive,
      intrusionActive: SEED.intrusionActive,
      fireAlertLatched: false,
      intrusionAlertLatched: false,
      simEnabled: true,
      chart: SEED.chart.map((p) => ({ t: p.t, v: p.v })),
      history: SEED.history.map((e) => ({ ...e }))
    };
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function round1(n) { return Math.round(n * 10) / 10; }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function formatClock(ms) {
    const d = new Date(ms);
    const day = DAY_NAMES[d.getUTCDay()];
    const date = d.getUTCDate();
    const month = MONTH_NAMES[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    const hh = pad2(d.getUTCHours());
    const mm = pad2(d.getUTCMinutes());
    const ss = pad2(d.getUTCSeconds());
    return `${day}, ${date} ${month} ${year} ${hh}.${mm}.${ss}`;
  }

  function formatTimeShort(ms) {
    const d = new Date(ms);
    return `${pad2(d.getUTCHours())}.${pad2(d.getUTCMinutes())}.${pad2(d.getUTCSeconds())}`;
  }

  function formatHistoryTime(ms) {
    const d = new Date(ms);
    const day = DAY_NAMES[d.getUTCDay()];
    return `${day}, ${pad2(d.getUTCDate())} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} WIB`;
  }

  function addHistory(type, detail, status, statusClass) {
    state.history.unshift({
      t: state.clockMs,
      type,
      detail,
      status,
      statusClass
    });
    if (state.history.length > 40) state.history.length = 40;
  }

  function typeLabel(type) {
    const map = {
      info: 'Info',
      fire: 'Api',
      intrusion: 'Intrusi',
      safe: 'Aman',
      system: 'Sistem'
    };
    return map[type] || 'Info';
  }

  function typeClass(type) {
    const map = {
      info: 'type-info',
      fire: 'type-fire',
      intrusion: 'type-intrusion',
      safe: 'type-safe',
      system: 'type-system'
    };
    return map[type] || 'type-info';
  }

  function renderHistory() {
    dom.historyBody.textContent = '';
    dom.historyMeta.textContent = `${state.history.length} event`;
    if (state.history.length === 0) {
      const tr = document.createElement('tr');
      tr.className = 'empty-row';
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = 'Belum ada event.';
      tr.appendChild(td);
      dom.historyBody.appendChild(tr);
      return;
    }
    for (const item of state.history) {
      const tr = document.createElement('tr');

      const tdTime = document.createElement('td');
      tdTime.textContent = formatHistoryTime(item.t);

      const tdType = document.createElement('td');
      const typeSpan = document.createElement('span');
      typeSpan.className = `event-type ${typeClass(item.type)}`;
      typeSpan.textContent = typeLabel(item.type);
      tdType.appendChild(typeSpan);

      const tdDetail = document.createElement('td');
      tdDetail.textContent = item.detail;

      const tdStatus = document.createElement('td');
      const statusSpan = document.createElement('span');
      statusSpan.className = `event-status ${item.statusClass || 'status-neutral'}`;
      statusSpan.textContent = item.status;
      tdStatus.appendChild(statusSpan);

      tr.append(tdTime, tdType, tdDetail, tdStatus);
      dom.historyBody.appendChild(tr);
    }
  }

  function setBanner(mode, text) {
    dom.mainBanner.className = `banner ${mode}`;
    dom.bannerText.textContent = text;
    const safeIcon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>';
    const dangerIcon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    dom.bannerIcon.innerHTML = mode === 'safe' ? safeIcon : dangerIcon;
  }

  function updateUI() {
    dom.clock.textContent = formatClock(state.clockMs);

    dom.deviceStatusText.textContent = state.simEnabled ? 'Simulasi Aktif' : 'Simulasi Dijeda';
    dom.devicePill.classList.toggle('offline', !state.simEnabled);
    dom.simToggle.classList.toggle('on', state.simEnabled);
    dom.simToggle.setAttribute('aria-checked', state.simEnabled ? 'true' : 'false');

    const temp = round1(state.temp);
    const hum = round1(state.humidity);
    const dist = Math.round(state.distance);

    dom.tempValue.textContent = temp.toFixed(1);
    dom.humidityValue.textContent = hum.toFixed(1);
    dom.intruderValue.textContent = String(dist);

    const tempPct = clamp(((temp - 20) / 35) * 100, 6, 100);
    dom.thermoFill.style.height = `${tempPct}%`;
    dom.thermoBulb.style.background = temp >= 40 ? 'linear-gradient(180deg,#f97316,#ef4444)' : 'linear-gradient(180deg,#f97316,#ef4444)';

    const circumference = 2 * Math.PI * 46;
    const humPct = clamp(hum / 100, 0, 1);
    dom.humidityArc.style.strokeDasharray = String(circumference);
    dom.humidityArc.style.strokeDashoffset = String(circumference * (1 - humPct));

    const fireAlert = temp >= 40;
    const intrusionAlert = dist <= 15;

    dom.intruderShield.classList.toggle('alert', intrusionAlert);
    dom.intruderPill.className = `area-pill ${intrusionAlert ? 'alert' : 'safe'}`;
    dom.intruderPill.textContent = intrusionAlert ? 'INTRUSI TERDETEKSI' : 'AREA AMAN';
    dom.intruderValue.style.color = intrusionAlert ? '#f87171' : '#34d399';

    if (fireAlert && intrusionAlert) {
      setBanner('danger', 'BAHAYA: API & INTRUSI TERDETEKSI');
    } else if (fireAlert) {
      setBanner('danger', 'PERINGATAN KEBAKARAN');
    } else if (intrusionAlert) {
      setBanner('warning', 'PERINGATAN INTRUSI');
    } else {
      setBanner('safe', 'LABORATORIUM AMAN');
    }

    dom.fireBtn.textContent = state.fireActive ? 'Hentikan simulasi api' : 'Mulai simulasi api';
    dom.fireBtn.classList.toggle('active', state.fireActive);
    dom.fireState.textContent = state.fireActive ? 'Aktif' : 'Tidak aktif';
    dom.fireState.className = `control-state ${state.fireActive ? 'active-fire' : ''}`;

    dom.intrusionBtn.textContent = state.intrusionActive ? 'Hentikan simulasi intrusi' : 'Mulai simulasi intrusi';
    dom.intrusionBtn.classList.toggle('active', state.intrusionActive);
    dom.intrusionState.textContent = state.intrusionActive ? 'Aktif' : 'Tidak aktif';
    dom.intrusionState.className = `control-state ${state.intrusionActive ? 'active-intrusion' : ''}`;

    dom.chartCurrent.textContent = `${temp.toFixed(1)} °C`;
    const avg = state.chart.length ? state.chart.reduce((a, p) => a + p.v, 0) / state.chart.length : temp;
    dom.chartAvg.textContent = `Avg: ${avg.toFixed(1)}`;

    drawChart();
  }

  function pushChartPoint() {
    const v = round1(state.temp);
    const last = state.chart[state.chart.length - 1];
    if (!last || state.clockMs - last.t >= 10000 || Math.abs(last.v - v) >= 0.05) {
      state.chart.push({ t: state.clockMs, v });
      if (state.chart.length > 48) state.chart.shift();
    }
  }

  function stepSimulation(dtSec) {
    const noiseT = state.clockMs / 4000;
    const targetTemp = state.fireActive ? 52.5 : 31.1;
    const targetHum = state.fireActive ? 42.0 : 68.8;
    const targetDist = state.intrusionActive ? 8 : 63;

    const tempRate = state.fireActive ? 2.6 : 1.4;
    const humRate = state.fireActive ? 2.0 : 1.1;
    const distRate = state.intrusionActive ? 30 : 18;

    state.temp += (targetTemp - state.temp) * Math.min(1, dtSec * tempRate * 0.08);
    state.humidity += (targetHum - state.humidity) * Math.min(1, dtSec * humRate * 0.08);
    state.distance += (targetDist - state.distance) * Math.min(1, dtSec * distRate * 0.08);

    state.temp += Math.sin(noiseT) * 0.01;
    state.humidity += Math.cos(noiseT * 0.8) * 0.03;
    state.distance += Math.sin(noiseT * 0.6) * 0.12;

    if (!state.fireActive) state.temp = clamp(state.temp, 30.6, 31.8);
    if (!state.intrusionActive) state.distance = clamp(state.distance, 58, 68);
    state.humidity = clamp(state.humidity, 38, 72);

    const fireAlert = state.temp >= 40;
    const intrusionAlert = state.distance <= 15;

    if (fireAlert && !state.fireAlertLatched) {
      state.fireAlertLatched = true;
      addHistory('fire', `Suhu mencapai ${round1(state.temp).toFixed(1)} °C, melewati ambang 40 °C. Status kebakaran dipicu.`, 'Peringatan', 'status-alert');
      renderHistory();
    }
    if (!fireAlert && state.fireAlertLatched) {
      state.fireAlertLatched = false;
      addHistory('safe', `Suhu turun ke ${round1(state.temp).toFixed(1)} °C. Peringatan kebakaran selesai.`, 'Aman', 'status-ok');
      renderHistory();
    }

    if (intrusionAlert && !state.intrusionAlertLatched) {
      state.intrusionAlertLatched = true;
      addHistory('intrusion', `Objek terdeteksi pada jarak ${Math.round(state.distance)} cm, melewati ambang 15 cm.`, 'Peringatan', 'status-warn');
      renderHistory();
    }
    if (!intrusionAlert && state.intrusionAlertLatched) {
      state.intrusionAlertLatched = false;
      addHistory('safe', `Jarak kembali ${Math.round(state.distance)} cm. Peringatan intrusi selesai.`, 'Aman', 'status-ok');
      renderHistory();
    }
  }

  function tick() {
    const now = Date.now();
    const dtMs = Math.min(2000, Math.max(0, now - lastTickMs));
    lastTickMs = now;
    if (!state.simEnabled) {
      updateUI();
      return;
    }
    state.clockMs += dtMs;
    stepSimulation(dtMs / 1000);
    updateUI();
  }

  function startTimers() {
    stopTimers();
    lastTickMs = Date.now();
    tickTimer = window.setInterval(tick, 1000);
    chartTimer = window.setInterval(() => {
      if (!state.simEnabled) return;
      pushChartPoint();
      updateUI();
    }, 10000);
    sampleTimer = window.setInterval(() => {
      if (!state.simEnabled) return;
      addHistory('info', `Pembacaan rutin: suhu ${round1(state.temp).toFixed(1)} °C, kelembapan ${round1(state.humidity).toFixed(1)} %, jarak ${Math.round(state.distance)} cm.`, 'Normal', 'status-ok');
      renderHistory();
    }, 30000);
  }

  function stopTimers() {
    if (tickTimer) window.clearInterval(tickTimer);
    if (chartTimer) window.clearInterval(chartTimer);
    if (sampleTimer) window.clearInterval(sampleTimer);
    tickTimer = chartTimer = sampleTimer = null;
  }

  function resizeChart() {
    const canvas = dom.chart;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, Math.floor(rect.width * dpr));
    const height = Math.max(200, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    drawChart();
  }

  function drawChart() {
    const canvas = dom.chart;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 16, right: 54, bottom: 34, left: 52 };
    const iw = w - pad.left - pad.right;
    const ih = h - pad.top - pad.bottom;
    const points = state.chart.slice(-30);
    if (points.length < 2) { ctx.restore(); return; }

    let minV = Math.min(...points.map((p) => p.v));
    let maxV = Math.max(...points.map((p) => p.v));
    if (maxV - minV < 0.2) {
      const mid = (maxV + minV) / 2;
      minV = mid - 0.1;
      maxV = mid + 0.1;
    }
    const rangePad = (maxV - minV) * 0.2;
    minV -= rangePad;
    maxV += rangePad;

    const xFor = (i) => pad.left + (i / (points.length - 1)) * iw;
    const yFor = (v) => pad.top + (1 - (v - minV) / (maxV - minV || 1)) * ih;

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const v = minV + ((maxV - minV) * i) / gridLines;
      const y = yFor(v);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + iw, y);
      ctx.stroke();
      ctx.fillText(v.toFixed(2), pad.left - 8, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelEvery = Math.max(1, Math.floor(points.length / 6));
    for (let i = 0; i < points.length; i++) {
      if (i % labelEvery !== 0 && i !== points.length - 1) continue;
      const x = xFor(i);
      ctx.fillText(formatTimeShort(points[i].t), x, pad.top + ih + 8);
    }

    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xFor(i);
      const y = yFor(p.v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(xFor(points.length - 1), pad.top + ih);
    ctx.lineTo(xFor(0), pad.top + ih);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ih);
    grad.addColorStop(0, 'rgba(239,68,68,0.20)');
    grad.addColorStop(1, 'rgba(239,68,68,0.01)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xFor(i);
      const y = yFor(p.v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    points.forEach((p, i) => {
      const x = xFor(i);
      const y = yFor(p.v);
      ctx.beginPath();
      ctx.arc(x, y, i === hoverIndex ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    const last = points[points.length - 1];
    const lx = xFor(points.length - 1);
    const ly = yFor(last.v);
    ctx.fillStyle = '#ef5b5b';
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${last.v.toFixed(1)} °C`, lx + 6, ly);

    ctx.restore();
  }

  function chartPointAt(clientX, clientY) {
    const rect = dom.chart.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const pad = { top: 16, right: 54, bottom: 34, left: 52 };
    const iw = rect.width - pad.left - pad.right;
    const points = state.chart.slice(-30);
    if (points.length < 2) return -1;
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const px = pad.left + (i / (points.length - 1)) * iw;
      const dist = Math.abs(px - x);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    if (x < pad.left - 8 || x > rect.width - pad.right + 8 || y < pad.top - 8 || y > rect.height - pad.bottom + 8) return -1;
    return bestDist <= 24 ? best : -1;
  }

  function showChartTooltip(index, clientX, clientY) {
    const points = state.chart.slice(-30);
    const p = points[index];
    if (!p) return;
    hoverIndex = index;
    dom.chartTooltip.innerHTML = '';
    const t = document.createElement('div');
    t.className = 'tt-time';
    t.textContent = formatTimeShort(p.t);
    const row = document.createElement('div');
    row.className = 'tt-row';
    const dot = document.createElement('span');
    dot.className = 'tt-dot';
    const label = document.createElement('span');
    label.textContent = `Suhu (°C): ${p.v.toFixed(1)}`;
    row.append(dot, label);
    dom.chartTooltip.append(t, row);
    dom.chartTooltip.classList.add('visible');

    const wrapRect = dom.chart.parentElement.getBoundingClientRect();
    let left = clientX - wrapRect.left + 12;
    let top = clientY - wrapRect.top - 10;
    const ttRect = dom.chartTooltip.getBoundingClientRect();
    if (left + ttRect.width > wrapRect.width - 8) left = clientX - wrapRect.left - ttRect.width - 12;
    if (top + ttRect.height > wrapRect.height - 8) top = wrapRect.height - ttRect.height - 8;
    if (top < 8) top = 8;
    dom.chartTooltip.style.left = `${left}px`;
    dom.chartTooltip.style.top = `${top}px`;
    drawChart();
  }

  function hideChartTooltip() {
    if (hoverIndex === -1) return;
    hoverIndex = -1;
    dom.chartTooltip.classList.remove('visible');
    drawChart();
  }

  function bindEvents() {
    dom.simToggle.addEventListener('click', () => {
      state.simEnabled = !state.simEnabled;
      addHistory('system', state.simEnabled ? 'Simulasi dilanjutkan.' : 'Simulasi dijeda. Pembacaan dibekukan sementara.', 'Informasi', 'status-neutral');
      renderHistory();
      updateUI();
    });

    dom.fireBtn.addEventListener('click', () => {
      state.fireActive = !state.fireActive;
      addHistory(
        'fire',
        state.fireActive
          ? 'Simulasi api dimulai. Suhu akan naik melewati ambang 40 °C.'
          : 'Simulasi api dihentikan. Suhu akan kembali ke rentang aman.',
        state.fireActive ? 'Aktif' : 'Dihentikan',
        state.fireActive ? 'status-alert' : 'status-neutral'
      );
      renderHistory();
      updateUI();
    });

    dom.intrusionBtn.addEventListener('click', () => {
      state.intrusionActive = !state.intrusionActive;
      addHistory(
        'intrusion',
        state.intrusionActive
          ? 'Simulasi intrusi dimulai. Jarak akan turun melewati ambang 15 cm.'
          : 'Simulasi intrusi dihentikan. Jarak akan kembali ke kondisi aman.',
        state.intrusionActive ? 'Aktif' : 'Dihentikan',
        state.intrusionActive ? 'status-warn' : 'status-neutral'
      );
      renderHistory();
      updateUI();
    });

    dom.resetBtn.addEventListener('click', () => {
      state = cloneSeed();
      hoverIndex = -1;
      dom.chartTooltip.classList.remove('visible');
      renderHistory();
      updateUI();
      pushChartPoint();
    });

    dom.chart.addEventListener('mousemove', (e) => {
      const idx = chartPointAt(e.clientX, e.clientY);
      if (idx < 0) { hideChartTooltip(); return; }
      showChartTooltip(idx, e.clientX, e.clientY);
    });
    dom.chart.addEventListener('mouseleave', hideChartTooltip);

    dom.chart.addEventListener('touchstart', (e) => {
      if (!e.touches[0]) return;
      const t = e.touches[0];
      const idx = chartPointAt(t.clientX, t.clientY);
      if (idx >= 0) showChartTooltip(idx, t.clientX, t.clientY);
    }, { passive: true });
    dom.chart.addEventListener('touchmove', (e) => {
      if (!e.touches[0]) return;
      const t = e.touches[0];
      const idx = chartPointAt(t.clientX, t.clientY);
      if (idx >= 0) showChartTooltip(idx, t.clientX, t.clientY);
    }, { passive: true });
    dom.chart.addEventListener('touchend', hideChartTooltip, { passive: true });

    window.addEventListener('resize', resizeChart);

    document.getElementById('menuBtn').addEventListener('click', () => {
      addHistory('system', 'Menu ditekan pada demo statis. Navigasi tambahan tidak tersedia di versi synthetic ini.', 'Informasi', 'status-neutral');
      renderHistory();
    });
  }

  function init() {
    state = cloneSeed();
    bindEvents();
    renderHistory();
    resizeChart();
    updateUI();
    startTimers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
