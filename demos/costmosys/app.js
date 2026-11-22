(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, '0');
  const fmt1 = (n) => (typeof n === 'number' && Number.isFinite(n)) ? n.toFixed(1) : '—';
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const fmtDateWib = (d) => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const fmtDateTime = (d) => `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}, ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())} WIB`;
  const fmtShortDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const SENSOR_NAMES = ['Titik 1 • Depan','Titik 2 • Depan','Titik 3 • Tengah','Titik 4 • Tengah','Titik 5 • Belakang','Titik 6 • Belakang'];
  const DHT_NAMES = ['DHT 1 • Depan Kanan','DHT 2 • Depan Kiri','DHT 3 • Belakang Kanan','DHT 4 • Belakang Kiri'];
  const COLORS = ['#bd6b3a','#9b831e','#328b70','#4a86ae','#9272bd','#b96787'];
  const PAGE_TITLES = { dash: 'Overview', log: 'Riwayat sensor', event: 'Aktivitas sprinkler', herd: 'Aktivitas Sapi', admin: 'Dashboard Admin' };

  const DEFAULTS = {
    controlBasis: 'temperature',
    autoSrc: 'threshold',
    thresholdTemp: 30.0,
    thresholdThi: 78.0,
    maxDurMin: 10,
    cooldownMin: 120,
    maxCycles: 3,
  };

  const state = {
    view: 'dash',
    theme: localStorage.getItem('scs_theme') === 'dark' ? 'dark' : 'light',
    now: new Date(2026, 10, 14, 21, 11, 18),
    settings: { ...DEFAULTS },
    mode: 'auto',
    manualOn: false,
    cycle: { phase: 'idle', remainSec: 0, cooldownRemainSec: 0, today: 0 },
    ds: [28.6, 29.0, 29.2, 29.3, 29.5, 29.8],
    dht: [60.8, 63.2, 66.2, 68.2],
    history: [],
    events: [],
    accounts: [
      { id: 'a1', initials: 'A', name: 'Admin', email: 'admin@contoh.test', role: 'ADMIN', active: true },
      { id: 'u1', initials: 'CA', name: '', email: 'cadangan@contoh.test', role: 'USER', active: false },
      { id: 'u2', initials: 'OP', name: 'Operator', email: 'operator@contoh.test', role: 'USER', active: true },
      { id: 'u3', initials: 'VI', name: 'Viewer', email: 'viewer@contoh.test', role: 'USER', active: true },
    ],
    newRole: 'user',
    chartCleared: false,
  };

  function avg(arr) { const v = arr.filter(x => typeof x === 'number' && Number.isFinite(x)); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; }
  function thiOf(t, rh) { if (t == null || rh == null) return null; return (1.8 * t + 32) - (0.55 - 0.0055 * rh) * (1.8 * t - 26); }
  function readings() {
    const ds = state.ds.slice();
    const dht = state.dht.slice();
    const avgDs = avg(ds), avgRh = avg(dht);
    return { ds, dht, avgDs, avgRh, thi: thiOf(avgDs, avgRh) };
  }
  function activeThreshold() { return state.settings.controlBasis === 'thi' ? state.settings.thresholdThi : state.settings.thresholdTemp; }
  function activeMetric(r) { return state.settings.controlBasis === 'thi' ? r.thi : r.avgDs; }
  function statusFor(value, threshold, basis) {
    if (value == null) return { key: 'unknown', text: 'DATA BELUM TERSEDIA', cls: 'neutral', detail: 'Data belum tersedia.' };
    if (value >= threshold) return { key: 'hot', text: basis === 'thi' ? 'THRESHOLD THI TERCAPAI' : 'THRESHOLD SUHU TERCAPAI', cls: 'bahaya' };
    if (value >= threshold - 1) return { key: 'warn', text: 'MENDEKATI THRESHOLD', cls: 'waspada' };
    return { key: 'ok', text: basis === 'thi' ? 'DI BAWAH THRESHOLD THI' : 'DI BAWAH THRESHOLD SUHU', cls: 'normal' };
  }

  function seedHistory() {
    const base = new Date(state.now.getTime());
    const out = [];
    for (let i = 119; i >= 0; i--) {
      const t = new Date(base.getTime() - i * 30000);
      const drift = Math.sin(i / 9) * 0.25;
      const temp = clamp(29.1 + drift, 28.4, 29.8);
      const rh = clamp(64.6 + Math.cos(i / 8) * 1.8, 60.2, 68.5);
      const ds = [temp-0.6,temp-0.2,temp,temp+0.1,temp+0.3,temp+0.6].map(v=>+v.toFixed(1));
      const dht = [rh-3.8,rh-1.2,rh+0.4,rh+1.6].map(v=>+v.toFixed(1));
      const avgDs = avg(ds), avgRh = avg(dht), thi = thiOf(avgDs, avgRh);
      const st = statusFor(avgDs, 30, 'temperature');
      out.push({ time: t, ds, dht, avgDs, avgRh, thi, status: st.key === 'hot' ? 'Suhu: ≥ threshold' : st.key === 'warn' ? 'Suhu: mendekati threshold' : 'Suhu: < threshold', sprinkler: 'OFF' });
    }
    state.history = out;
  }
  function seedEvents() {
    const base = new Date(state.now.getTime());
    state.events = [
      { t: new Date(base.getTime() - 49*60000), msg: 'Sprinkler berhenti: durasi maksimum tercapai' },
      { t: new Date(base.getTime() - 51*60000), msg: 'Sprinkler menyala otomatis: suhu mencapai threshold' },
      { t: new Date(base.getTime() - 58*60000), msg: 'Setting Suhu: threshold 30.0 °C, sepanjang waktu' },
    ];
  }

  const el = {};
  function cache() {
    ['connBadge','themeBtn','menuBtn','sideClose','sidebar','sideOverlay','pageBreadcrumb','clock','dateLine','greetingName',
     'sprinklerState','sprinklerText','sprinklerTimer','sprinklerReason','cyclePhase','cycleQuota','modeInfo',
     'btnAuto','btnManual','btnSprayOn','btnSprayOff',
     'avgTemp','avgStatus','zoneTemp','zoneLo','zoneHi','zoneOkText','zoneWarnText','zoneHotText','zoneNote','minTemp','maxTemp','thresholdLabel','dsSummary','btnTemperatureDetails',
     'avgHumidity','humidityStatus','minHumidity','maxHumidity','rhSummary','btnHumidityDetails','rulerRh',
     'thiValue','thiStatus','thiThresholdLabel','thiSummary','rulerThi',
     'condHeatPill','condHeatDetail','condPosturePill','condPostureDetail','condPersonPill','condPersonDetail','condSprayPill','condSprayDetail',
     'chart','chartMetric','showAvg','legend','chartEmpty','btnClearChart','thresholdKey',
     'inThreshold','rangeThreshold','inMaxDur','inCooldown','inMaxCycles','btnSaveCfg','settingsStatus',
     'basisTemperature','basisThi','srcThreshold','srcSchedule','schedGroup','schedList','btnAddSched','scheduleTitle','schedHint','controlBasisHint','thresholdInputLabel',
     'logHead','logBody','logCount','btnLogNow','btnExport','btnClearLog','filterSensor',
     'eventList','btnClearEvents',
     'herdPill','herdMessage','herdMeta','herdDay','herdZones','herdSynthetic',
     'adminStatus','createUserForm','newUserName','newUserEmail','newUserPassword','btnCreateUser','userList','userCount',
     'currentAccountAvatar','currentAccountName','currentAccountRole','currentAccountEmail','currentAccountState',
     'sensorDialog','btnCloseSensors','sensorSection','sensorTitle','updateAge','sensorGrid','noSensor','humidityGrid','humidityCount',
     'rightNode','leftNode'
    ].forEach(id => el[id] = $(id));
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('scs_theme', theme); } catch {}
    const light = theme === 'light';
    el.themeBtn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-${light ? 'moon' : 'sun'}"/></svg>`;
    el.themeBtn.title = light ? 'Gunakan tema gelap' : 'Gunakan tema terang';
    el.themeBtn.setAttribute('aria-label', el.themeBtn.title);
    drawChart();
  }

  function openSidebar() {
    el.sidebar.classList.add('open');
    el.sidebar.setAttribute('aria-hidden', 'false');
    el.sidebar.inert = false;
    el.sideOverlay.hidden = false;
    el.sideOverlay.classList.add('show');
    el.menuBtn.setAttribute('aria-expanded', 'true');
    document.getElementById('appShell').classList.add('sidebar-open');
  }
  function closeSidebar() {
    el.sidebar.classList.remove('open');
    el.sidebar.setAttribute('aria-hidden', 'true');
    el.sidebar.inert = true;
    el.sideOverlay.classList.remove('show');
    el.sideOverlay.hidden = true;
    el.menuBtn.setAttribute('aria-expanded', 'false');
    document.getElementById('appShell').classList.remove('sidebar-open');
  }

  function switchView(view) {
    state.view = view;
    $$('.side-link[data-page]').forEach(btn => {
      const on = btn.dataset.page === view;
      btn.classList.toggle('active', on);
      if (on) { if (!btn.querySelector('.nav-indicator')) { const s = document.createElement('span'); s.className='nav-indicator'; btn.appendChild(s); } }
      else { const ind = btn.querySelector('.nav-indicator'); if (ind) ind.remove(); }
    });
    $$('[data-page]').forEach(node => {
      if (node.classList.contains('side-link')) return;
      node.hidden = node.dataset.page !== view;
    });
    el.pageBreadcrumb.textContent = PAGE_TITLES[view] || view;
    closeSidebar();
    if (view === 'log') renderHistory();
    if (view === 'event') renderEvents();
    if (view === 'herd') renderHerd();
    if (view === 'admin') renderAdmin();
    if (view === 'dash') { renderOverview(); drawChart(); syncSettingsUI(); }
  }

  function fmtRemain(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}j ${m}m ${s}d`;
    return `${m}m ${s}d`;
  }

  function isSprinklerOn() { return state.mode === 'manual' ? !!state.manualOn : state.cycle.phase === 'spraying'; }

  function sprinklerPhase() {
    if (state.mode === 'manual' && state.manualOn) return { text: 'MENYALA', cls: 'on', reason: 'Mode manual · menyala sampai dimatikan.', phase: 'Manual aktif: sprinkler menyala.', timer: 'Manual · tanpa batas durasi otomatis' };
    if (state.cycle.phase === 'spraying') return { text: 'MENYALA', cls: 'on', reason: `Siklus otomatis berjalan. Sisa durasi semprot ${fmtRemain(state.cycle.remainSec)}.`, phase: `Menyemprot · sisa ${fmtRemain(state.cycle.remainSec)}.`, timer: `Sisa semprot ${fmtRemain(state.cycle.remainSec)}` };
    if (state.cycle.phase === 'cooldown') return { text: 'MATI', cls: 'off', reason: `Cooldown sejak berhenti aktual. Sisa cooldown ${fmtRemain(state.cycle.cooldownRemainSec)}.`, phase: `Cooldown · sisa ${fmtRemain(state.cycle.cooldownRemainSec)}.`, timer: `Cooldown ${fmtRemain(state.cycle.cooldownRemainSec)}` };
    if (state.mode === 'manual') return { text: 'MATI', cls: 'off', reason: 'Mode manual. Relay mati sampai perintah ON.', phase: 'Manual aktif: relay mati.', timer: '' };
    return { text: 'MATI', cls: 'off', reason: 'Siklus sedang tidak menyiram. Syarat mulai diperiksa perangkat.', phase: 'Status siklus: siap dievaluasi.', timer: '' };
  }

  function placeZones(avgDs, active) {
    const box = el.zoneTemp;
    const threshold = state.settings.thresholdTemp;
    const on = active && state.settings.controlBasis === 'temperature';
    const mark = box.querySelector('.ruler-mark');
    box.dataset.state = on ? 'on' : 'off';
    const zone = on && avgDs != null ? (avgDs >= threshold ? 'hot' : avgDs >= threshold - 1 ? 'warn' : 'ok') : '';
    box.dataset.zone = zone;
    const f = v => Number(v).toFixed(1);
    const low = threshold - 1;
    const lo = Math.floor(Math.min(24, low - 4));
    const hi = Math.ceil(Math.max(38, threshold + 4));
    const at = v => clamp((v - lo) / (hi - lo) * 100, 0, 100);
    const ok = box.querySelector('.zone-ok'), warn = box.querySelector('.zone-warn'), hot = box.querySelector('.zone-hot');
    if (on) {
      ok.style.width = at(low) + '%';
      warn.style.left = at(low) + '%'; warn.style.width = Math.max(0, at(threshold) - at(low)) + '%';
      hot.style.left = at(threshold) + '%'; hot.style.width = Math.max(0, 100 - at(threshold)) + '%';
    } else {
      ok.style.width = ''; warn.style.left = ''; warn.style.width = ''; hot.style.left = ''; hot.style.width = '';
    }
    el.zoneOkText.textContent = on ? `< ${f(low)} °C` : 'Belum aktif';
    el.zoneWarnText.textContent = on ? `${f(low)} ≤ T < ${f(threshold)} °C` : 'Belum aktif';
    el.zoneHotText.textContent = on ? `≥ ${f(threshold)} °C` : 'Belum aktif';
    el.zoneNote.textContent = on
      ? `Oranye menandai 1 °C sebelum threshold ${f(threshold)} °C, hanya untuk tampilan. Warna bukan diagnosis sapi, batas mati, atau status sprinkler. Threshold hanya memulai siklus; durasi, cooldown, kuota, sensor, dan jadwal dijalankan perangkat.`
      : 'Indikator threshold suhu belum aktif. Pilih dasar Suhu lalu simpan untuk melihat indikator. Pembacaan sensor tetap tersedia.';
    ['ok','warn','hot'].forEach(name => box.querySelector('.zone-legend .zone-' + name).classList.toggle('active', zone === name));
    mark.hidden = !zone;
    if (zone) mark.style.left = at(avgDs) + '%';
    el.zoneLo.textContent = String(lo);
    el.zoneHi.textContent = String(hi);
  }

  function placeRuler(id, value, lo, hi, threshold) {
    const box = $(id);
    if (!box) return;
    const mark = box.querySelector('.ruler-mark');
    const thr = box.querySelector('.ruler-thr');
    const at = v => clamp((v - lo) / (hi - lo) * 100, 0, 100);
    mark.hidden = !(typeof value === 'number' && Number.isFinite(value));
    if (!mark.hidden) mark.style.left = at(value) + '%';
    if (thr) { thr.hidden = !(typeof threshold === 'number' && Number.isFinite(threshold)); if (!thr.hidden) thr.style.left = at(threshold) + '%'; }
  }

  function renderOverview() {
    const r = readings();
    const s = state.settings;
    const threshold = activeThreshold();
    const basis = s.controlBasis;
    const metric = activeMetric(r);
    const st = statusFor(metric, threshold, basis);
    const tempSt = statusFor(r.avgDs, s.thresholdTemp, 'temperature');

    el.clock.textContent = fmtClock(state.now);
    el.dateLine.textContent = fmtDateWib(state.now);

    // Temperature
    el.avgTemp.textContent = r.avgDs == null ? '—' : fmt1(r.avgDs);
    el.avgTemp.parentElement.classList.toggle('no-data', r.avgDs == null);
    el.avgStatus.textContent = tempSt.text;
    el.avgStatus.className = `status-pill ${tempSt.cls}`;
    el.minTemp.textContent = r.avgDs == null ? '—' : fmt1(Math.min(...r.ds)) + ' °C';
    el.maxTemp.textContent = r.avgDs == null ? '—' : fmt1(Math.max(...r.ds)) + ' °C';
    el.thresholdLabel.textContent = fmt1(s.thresholdTemp) + ' °C';
    el.dsSummary.textContent = `${r.ds.filter(Number.isFinite).length}/6 sensor valid`;
    placeZones(r.avgDs, true);
    el.thresholdLabel.closest('[data-threshold-basis]').hidden = basis !== 'temperature';

    // Humidity
    el.avgHumidity.textContent = r.avgRh == null ? '—' : fmt1(r.avgRh);
    el.avgHumidity.parentElement.classList.toggle('no-data', r.avgRh == null);
    el.humidityStatus.textContent = r.avgRh == null ? 'DATA BELUM TERSEDIA' : '4 TITIK TERPANTAU';
    el.humidityStatus.className = `status-pill ${r.avgRh == null ? 'neutral' : 'neutral'}`;
    el.minHumidity.textContent = r.avgRh == null ? '—' : fmt1(Math.min(...r.dht)) + ' %RH';
    el.maxHumidity.textContent = r.avgRh == null ? '—' : fmt1(Math.max(...r.dht)) + ' %RH';
    el.rhSummary.textContent = `${r.dht.filter(Number.isFinite).length}/4 sensor valid · input RH untuk THI`;
    placeRuler('rulerRh', r.avgRh, 20, 100, null);
    const rhSpan = el.rulerRh.querySelector('.ruler-span');
    if (rhSpan) { rhSpan.hidden = r.avgRh == null; if (r.avgRh != null) { const lo=20,hi=100,at=v=>clamp((v-lo)/(hi-lo)*100,0,100); rhSpan.style.left = at(Math.min(...r.dht))+'%'; rhSpan.style.width = Math.max(1.5, at(Math.max(...r.dht))-at(Math.min(...r.dht)))+'%'; } }

    // THI
    el.thiValue.textContent = r.thi == null ? '—' : fmt1(r.thi);
    el.thiValue.parentElement.classList.toggle('no-data', r.thi == null);
    const thiSt = statusFor(r.thi, s.thresholdThi, 'thi');
    el.thiStatus.textContent = basis === 'thi' ? thiSt.text : 'MONITORING THI';
    el.thiStatus.className = `status-pill ${basis === 'thi' ? thiSt.cls : 'neutral'}`;
    el.thiThresholdLabel.textContent = fmt1(s.thresholdThi) + ' THI';
    el.thiThresholdLabel.closest('[data-threshold-basis]').hidden = basis !== 'thi';
    el.thiSummary.textContent = `Rata-rata 6 DS + RH rata-rata 4 DHT`;
    placeRuler('rulerThi', r.thi, 60, 95, basis === 'thi' ? s.thresholdThi : null);

    // Sprinkler
    const ph = sprinklerPhase();
    el.sprinklerState.className = `sprinkler ${ph.cls}`;
    el.sprinklerText.textContent = ph.text;
    el.sprinklerTimer.textContent = ph.timer;
    el.sprinklerReason.textContent = ph.reason;
    el.cyclePhase.textContent = ph.phase;
    el.cycleQuota.textContent = `${state.cycle.today}/${s.maxCycles} mulai otomatis hari ini · ${state.cycle.today >= s.maxCycles ? 'batas harian tercapai' : 'tersedia'}.`;
    el.modeInfo.textContent = state.mode === 'manual' ? 'Mode manual aktif: kendali langsung dari dashboard.' : 'Mode otomatis aktif: perangkat mengevaluasi threshold dan proteksi.';

    el.btnAuto.classList.toggle('active', state.mode === 'auto');
    el.btnManual.classList.toggle('active', state.mode === 'manual');
    el.btnSprayOn.disabled = state.mode !== 'manual' || isSprinklerOn();
    el.btnSprayOff.disabled = state.mode !== 'manual' || !isSprinklerOn();

    // Condition cards
    el.condHeatPill.textContent = tempSt.text;
    el.condHeatPill.className = `status-pill ${tempSt.cls}`;
    el.condHeatDetail.textContent = r.avgDs == null ? 'Data suhu belum tersedia.' : `Suhu rata-rata ${fmt1(r.avgDs)} °C dibanding threshold ${fmt1(s.thresholdTemp)} °C. Ini sinyal lingkungan, bukan diagnosis kondisi sapi.`;
    el.condPosturePill.textContent = 'TERAMATI';
    el.condPosturePill.className = 'status-pill neutral';
    el.condPostureDetail.textContent = 'Contoh sintetis: sebagian sapi terdeteksi berdiri, sebagian berbaring. Umpan pengamatan terpisah dari dashboard kontrol.';
    el.condPersonPill.textContent = 'TIDAK TERDETEKSI';
    el.condPersonPill.className = 'status-pill neutral';
    el.condPersonDetail.textContent = '0 dari 120 contoh frame sintetis menandai orang di area kandang. Ini konteks visual terpisah, bukan sensor kehadiran.';
    el.condSprayPill.textContent = ph.text === 'MENYALA' ? 'MENYALA' : state.cycle.phase === 'cooldown' ? 'COOLDOWN' : 'MATI';
    el.condSprayPill.className = `status-pill ${ph.text === 'MENYALA' ? 'normal' : state.cycle.phase === 'cooldown' ? 'waspada' : 'neutral'}`;
    el.condSprayDetail.textContent = ph.reason;

    // Node pills
    el.rightNode.textContent = 'ESP kanan · simulasi aktif';
    el.leftNode.textContent = 'ESP kiri · simulasi aktif';
    el.rightNode.classList.add('online');
    el.leftNode.classList.add('online');
  }

  function renderLegend(metric, showAvg) {
    let items = [];
    if (metric === 'temperature') {
      items = ['DS1','DS2','DS3','DS4','DS5','DS6'].map((l,i)=>({l,c:COLORS[i]}));
      if (showAvg) items.push({l:'Rata-rata',c:getComputedStyle(document.documentElement).getPropertyValue('--txt').trim() || '#1d2531'});
    } else if (metric === 'humidity') {
      items = ['DHT1','DHT2','DHT3','DHT4'].map((l,i)=>({l,c:COLORS[i]}));
      if (showAvg) items.push({l:'Rata-rata',c:getComputedStyle(document.documentElement).getPropertyValue('--txt').trim() || '#1d2531'});
    } else {
      items = [{l:'THI',c:getComputedStyle(document.documentElement).getPropertyValue('--green').trim() || '#328b70'}];
      if (showAvg) items.push({l:'Rata-rata',c:getComputedStyle(document.documentElement).getPropertyValue('--txt').trim() || '#1d2531'});
    }
    el.legend.innerHTML = items.map(it => `<span><i class="swatch" style="background:${it.c}"></i>${it.l}</span>`).join('');
  }

  function drawChart() {
    const canvas = el.chart;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const metric = el.chartMetric.value;
    const showAvg = el.showAvg.checked;
    const s = state.settings;
    const data = state.history.slice(-120);
    const hasData = data.length > 0 && !state.chartCleared;
    el.chartEmpty.style.display = hasData ? 'none' : '';
    canvas.style.visibility = hasData ? 'visible' : 'hidden';
    renderLegend(metric, showAvg);
    if (!hasData) { ctx.clearRect(0,0,canvas.width,canvas.height); return; }

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || 900;
    const cssH = parseInt(canvas.getAttribute('height'), 10) || 220;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const padL = 52, padR = 16, padT = 16, padB = 32;
    const W = cssW - padL - padR;
    const H = cssH - padT - padB;
    const style = getComputedStyle(document.documentElement);
    const gridC = style.getPropertyValue('--line').trim() || '#cbd3de';
    const textC = style.getPropertyValue('--muted').trim() || '#565e6c';
    const txt = style.getPropertyValue('--txt').trim() || '#1d2531';

    let series = [], yMin, yMax, thresholdVal = null;
    if (metric === 'temperature') {
      series = [0,1,2,3,4,5].map(i => ({ color: COLORS[i], values: data.map(r => r.ds[i]), width: 1.8 }));
      if (showAvg) series.push({ color: txt, values: data.map(r => r.avgDs), width: 2.4, dash: [6,4] });
      yMin = 24; yMax = 38; thresholdVal = s.controlBasis === 'temperature' ? s.thresholdTemp : null;
    } else if (metric === 'humidity') {
      series = [0,1,2,3].map(i => ({ color: COLORS[i], values: data.map(r => r.dht[i]), width: 1.8 }));
      if (showAvg) series.push({ color: txt, values: data.map(r => r.avgRh), width: 2.4, dash: [6,4] });
      yMin = 20; yMax = 100;
    } else {
      series = [{ color: style.getPropertyValue('--green').trim() || '#328b70', values: data.map(r => r.thi), width: 2.4 }];
      if (showAvg) series.push({ color: txt, values: data.map(r => r.thi), width: 2, dash: [6,4] });
      yMin = 60; yMax = 95; thresholdVal = s.controlBasis === 'thi' ? s.thresholdThi : null;
    }
    const yFor = v => padT + H - ((v - yMin) / (yMax - yMin)) * H;
    const xFor = i => padL + (i / Math.max(1, data.length - 1)) * W;

    ctx.strokeStyle = gridC; ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = padT + (g / 4) * H;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke();
      const val = yMax - (g / 4) * (yMax - yMin);
      ctx.fillStyle = textC; ctx.font = '12px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(Number.isInteger(val) ? String(val) : val.toFixed(1), padL - 8, y);
    }

    if (thresholdVal != null && thresholdVal >= yMin && thresholdVal <= yMax) {
      const y = yFor(thresholdVal);
      ctx.save(); ctx.strokeStyle = style.getPropertyValue('--threshold-line').trim() || '#a55b16'; ctx.lineWidth = 1.5; ctx.setLineDash([6,4]);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke(); ctx.restore();
    }

    series.forEach(ser => {
      ctx.save(); ctx.strokeStyle = ser.color; ctx.lineWidth = ser.width || 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (ser.dash) ctx.setLineDash(ser.dash);
      let started = false;
      ser.values.forEach((v, i) => {
        if (v == null || Number.isNaN(v)) { started = false; return; }
        const x = xFor(i), y = yFor(clamp(v, yMin, yMax));
        if (!started) { ctx.beginPath(); ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      });
      ctx.stroke(); ctx.restore();
    });

    ctx.fillStyle = textC; ctx.font = '12px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const labelEvery = Math.max(1, Math.floor(data.length / 6));
    data.forEach((r, i) => {
      if (i % labelEvery !== 0 && i !== data.length - 1) return;
      ctx.fillText(`${pad(r.time.getHours())}:${pad(r.time.getMinutes())}`, xFor(i), padT + H + 8);
    });
  }

  function buildLogHead() {
    let h = '<th>Waktu (WIB)</th>';
    for (let i = 1; i <= 6; i++) h += `<th>DS${i} °C</th>`;
    for (let i = 1; i <= 4; i++) h += `<th>DHT${i} %RH</th>`;
    h += '<th>Rata² DS</th><th>Rata² RH</th><th>THI</th><th>Status dasar terpilih</th><th>Sprinkler</th>';
    el.logHead.innerHTML = h;
  }

  function renderHistory() {
    const filter = el.filterSensor.value;
    const s = state.settings;
    let rows = state.history.slice().reverse();
    if (filter === 'panas') rows = rows.filter(r => statusFor(activeMetric(r), activeThreshold(), s.controlBasis).key === 'hot');
    if (filter === 'normal') rows = rows.filter(r => statusFor(activeMetric(r), activeThreshold(), s.controlBasis).key !== 'hot');
    const show = rows.slice(0, 120);
    el.logBody.innerHTML = show.map(r => {
      const st = statusFor(activeMetric(r), activeThreshold(), s.controlBasis);
      const cls = st.key === 'hot' ? 'hot' : st.key === 'ok' ? 'cold' : '';
      return `<tr>
        <td>${fmtDateTime(r.time)}</td>
        ${r.ds.map(v => `<td>${fmt1(v)}</td>`).join('')}
        ${r.dht.map(v => `<td>${fmt1(v)}</td>`).join('')}
        <td><strong>${fmt1(r.avgDs)}</strong></td>
        <td>${fmt1(r.avgRh)}</td>
        <td>${fmt1(r.thi)}</td>
        <td class="${cls}">${st.key === 'hot' ? (s.controlBasis === 'thi' ? 'THI: ≥ threshold' : 'Suhu: ≥ threshold') : st.key === 'warn' ? (s.controlBasis === 'thi' ? 'THI: mendekati threshold' : 'Suhu: mendekati threshold') : (s.controlBasis === 'thi' ? 'THI: < threshold' : 'Suhu: < threshold')}</td>
        <td>${r.sprinkler}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="16" class="empty">Belum ada riwayat sensor.</td></tr>';
    el.logCount.textContent = `${show.length}/${state.history.length} baris`;
  }

  function renderEvents() {
    const items = state.events.slice().sort((a,b)=>b.t-a.t).slice(0, 50);
    el.eventList.innerHTML = items.length ? items.map(it => `<li><div>${escapeHtml(it.msg)}</div><div class="t">${fmtDateTime(it.t)}</div></li>`).join('') : '<li class="hint">Belum ada aktivitas.</li>';
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function renderHerd() {
    el.herdPill.textContent = 'DATA SINTETIS';
    el.herdPill.className = 'status-pill neutral';
    el.herdMessage.textContent = 'Umpan sintetis dimuat untuk demo portofolio. Tidak ada data kamera nyata.';
    el.herdMeta.innerHTML = `<span>Rentang pengamatan: <b>08:00–16:00 WIB</b></span><span>Cakupan: <b>66%</b></span><span>Sampel: <b>960</b></span>`;
    el.herdDay.innerHTML = `<option value="2026-11-14">2026-11-14</option>`;
    const zones = [
      { name: 'Zona Makan', standing: 142, lying: 38, mixed: 26, partial: 54, unobserved: 220 },
      { name: 'Zona Istirahat', standing: 64, lying: 188, mixed: 22, partial: 40, unobserved: 166 },
      { name: 'Zona Minum', standing: 48, lying: 18, mixed: 12, partial: 24, unobserved: 378 },
    ];
    el.herdZones.innerHTML = zones.map(z => {
      const total = z.standing+z.lying+z.mixed+z.partial+z.unobserved;
      const cov = Math.round(((total - z.unobserved) / total) * 100);
      return `<article class="card zone-card"><h3>${z.name}</h3>
        <div class="coverage"><div class="coverage-bar"><i style="width:${cov}%"></i></div><p><b>${cov}%</b> teramati</p></div>
        <dl class="duration-list"><dt>Berdiri</dt><dd>${z.standing} mnt</dd><dt>Berbaring</dt><dd>${z.lying} mnt</dd><dt>Campuran</dt><dd>${z.mixed} mnt</dd><dt>Sebagian teramati</dt><dd>${z.partial} mnt</dd><dt>Tidak teramati</dt><dd>${z.unobserved} mnt</dd></dl>
        <p class="zone-reasons">Data sintetis. Bukan durasi postur satu sapi.</p>
      </article>`;
    }).join('');
  }

  function renderAdmin() {
    el.userCount.textContent = `${state.accounts.length} akun`;
    el.userList.innerHTML = state.accounts.map(a => {
      const initials = a.initials || (a.name || a.email).slice(0,2).toUpperCase();
      const display = a.name || a.email;
      const isAdmin = a.role === 'ADMIN';
      const stateCls = a.active ? 'is-active' : '';
      const stateTxt = a.active ? 'Aktif' : 'Nonaktif';
      const actions = isAdmin ? `<span class="admin-owner-note">Dikelola melalui Firebase Console.</span>` : `<div class="user-management"><p class="user-management-note">Akses simulasi lokal.</p><div class="user-actions"><label class="access-toggle"><input type="checkbox" ${a.active ? 'checked' : ''} data-toggle-account="${a.id}" /> ${a.active ? 'Aktif' : 'Nonaktif'}</label><div class="user-action-buttons"><button class="btn small red" type="button" data-delete-account="${a.id}">Hapus</button></div></div></div>`;
      return `<div class="user-row ${isAdmin ? 'user-row-admin' : ''}">
        <div class="user-heading"><span class="user-avatar" aria-hidden="true">${escapeHtml(initials)}</span><div class="user-identity"><div class="user-name"><b>${escapeHtml(display)}</b><span class="user-role">${a.role}</span></div><span class="user-email">${escapeHtml(a.email)}</span></div><span class="user-state ${stateCls}">${stateTxt}</span></div>
        ${actions}
      </div>`;
    }).join('');
  }

  function syncSettingsUI() {
    const s = state.settings;
    el.basisTemperature.checked = s.controlBasis === 'temperature';
    el.basisThi.checked = s.controlBasis === 'thi';
    el.srcThreshold.checked = s.autoSrc === 'threshold';
    el.srcSchedule.checked = s.autoSrc === 'schedule';
    const basis = s.controlBasis;
    const thresh = basis === 'thi' ? s.thresholdThi : s.thresholdTemp;
    el.thresholdInputLabel.textContent = basis === 'thi' ? 'Threshold semprot THI' : 'Threshold semprot suhu (°C)';
    el.inThreshold.value = thresh;
    el.rangeThreshold.value = thresh;
    el.inThreshold.min = basis === 'thi' ? 60 : 20;
    el.inThreshold.max = basis === 'thi' ? 95 : 40;
    el.rangeThreshold.min = basis === 'thi' ? 60 : 20;
    el.rangeThreshold.max = basis === 'thi' ? 95 : 40;
    el.inMaxDur.value = s.maxDurMin;
    el.inCooldown.value = s.cooldownMin;
    el.inMaxCycles.value = s.maxCycles;
    el.scheduleTitle.textContent = `Jendela jadwal ${basis === 'thi' ? 'THI' : 'Suhu'} (maks 6×)`;
    el.schedGroup.style.display = s.autoSrc === 'schedule' ? '' : 'none';
    el.controlBasisHint.textContent = 'Hanya profil terpilih yang mengendalikan relay. Suhu dan THI tersimpan terpisah.';
  }

  function addEvent(msg) {
    state.events.push({ t: new Date(state.now.getTime()), msg });
    if (state.events.length > 50) state.events = state.events.slice(-50);
  }

  function addHistoryReading() {
    const r = readings();
    const st = statusFor(activeMetric(r), activeThreshold(), state.settings.controlBasis);
    state.history.push({
      time: new Date(state.now.getTime()),
      ds: r.ds, dht: r.dht, avgDs: r.avgDs, avgRh: r.avgRh, thi: r.thi,
      status: st.key === 'hot' ? (state.settings.controlBasis === 'thi' ? 'THI: ≥ threshold' : 'Suhu: ≥ threshold') : st.key === 'warn' ? (state.settings.controlBasis === 'thi' ? 'THI: mendekati threshold' : 'Suhu: mendekati threshold') : (state.settings.controlBasis === 'thi' ? 'THI: < threshold' : 'Suhu: < threshold'),
      sprinkler: isSprinklerOn() ? 'ON' : 'OFF',
    });
    if (state.history.length > 240) state.history = state.history.slice(-240);
  }

  function startSpray(reason) {
    const s = state.settings;
    state.cycle.phase = 'spraying';
    state.cycle.remainSec = Math.max(1, Math.round(s.maxDurMin * 60));
    state.cycle.cooldownRemainSec = 0;
    if (reason === 'auto') {
      state.cycle.today += 1;
      addEvent(`Sprinkler menyala otomatis: ${s.controlBasis === 'thi' ? 'THI' : 'suhu'} mencapai threshold`);
    } else {
      addEvent('Sprinkler dinyalakan manual');
    }
  }

  function stopSpray(reason) {
    const s = state.settings;
    if (state.cycle.phase === 'spraying') {
      state.cycle.phase = 'cooldown';
      state.cycle.cooldownRemainSec = Math.max(0, Math.round(s.cooldownMin * 60));
      state.cycle.remainSec = 0;
      if (reason === 'duration') addEvent('Sprinkler berhenti: durasi maksimum tercapai');
      else if (reason === 'manual') addEvent('Sprinkler berhenti: dimatikan manual saat siklus aktif');
      else addEvent('Sprinkler berhenti');
    }
  }

  function maybeAutoStart() {
    const s = state.settings;
    if (state.mode !== 'auto') return;
    if (state.cycle.phase === 'spraying' || state.cycle.phase === 'cooldown') return;
    if (state.cycle.today >= s.maxCycles) return;
    const r = readings();
    const val = activeMetric(r);
    if (val == null) return;
    if (val >= activeThreshold()) startSpray('auto');
  }

  function tick() {
    state.now = new Date(state.now.getTime() + 1000);
    const drift = Math.sin(state.now.getSeconds() / 11) * 0.05;
    state.ds = state.ds.map((v,i) => +clamp(v + drift * (i % 2 ? 1 : -0.5), 27.5, 33.5).toFixed(1));
    state.dht = state.dht.map((v,i) => +clamp(v + drift * 0.3 * (i % 2 ? -1 : 1), 55, 75).toFixed(1));

    if (state.cycle.phase === 'spraying') {
      state.cycle.remainSec -= 1;
      if (state.cycle.remainSec <= 0) stopSpray('duration');
    } else if (state.cycle.phase === 'cooldown') {
      state.cycle.cooldownRemainSec -= 1;
      if (state.cycle.cooldownRemainSec <= 0) {
        state.cycle.phase = 'idle';
        state.cycle.cooldownRemainSec = 0;
        addEvent('Cooldown selesai: siklus otomatis siap dievaluasi');
      }
    }
    maybeAutoStart();
    if (state.now.getSeconds() % 30 === 0) addHistoryReading();

    renderOverview();
    if (state.view === 'log') renderHistory();
    if (state.view === 'event') renderEvents();
    if (state.view === 'dash') drawChart();
  }

  function renderSensorDialog(kind) {
    const r = readings();
    if (kind === 'temperature') {
      el.sensorTitle.textContent = '6 titik suhu kandang';
      el.sensorSection.hidden = false;
      el.sensorDialog.querySelector('[data-sensor-panel="humidity"]').hidden = true;
      el.noSensor.style.display = 'none';
      el.sensorGrid.innerHTML = r.ds.map((v, i) => {
        const temp = v == null ? '—' : fmt1(v) + '°C';
        const st = statusFor(v, state.settings.thresholdTemp, 'temperature');
        return `<div class="sensor"><div class="sensor-meta"><span>DS${i+1}</span><span>${i < 3 ? 'KANAN' : 'KIRI'}</span></div><div class="s-name">${SENSOR_NAMES[i]}</div><div class="s-temp" style="color:${st.key==='hot'?'var(--negative-txt)':st.key==='warn'?'var(--warning-txt)':'var(--positive-txt)'}">${temp}</div><div class="bar"><i style="width:${v==null?0:clamp((v-25)/(38-25)*100,4,100)}%;background:${st.key==='hot'?'var(--negative-txt)':st.key==='warn'?'var(--warning-txt)':'var(--positive-txt)'}"></i></div><div class="s-state ${st.key==='hot'?'hot':st.key==='warn'?'warn':st.key==='ok'?'ok':'off'}">${v==null?'BELUM TERBACA':st.text}</div></div>`;
      }).join('');
    } else {
      el.sensorTitle.textContent = 'Udara di sekitar ternak';
      el.sensorSection.hidden = true;
      el.sensorDialog.querySelector('[data-sensor-panel="humidity"]').hidden = false;
      el.humidityCount.textContent = `${r.dht.filter(Number.isFinite).length}/4 valid`;
      el.humidityGrid.innerHTML = r.dht.map((v, i) => {
        return `<div class="sensor humidity-sensor"><div class="sensor-meta"><span>DHT${i+1}</span><span>${i < 2 ? 'KANAN' : 'KIRI'}</span></div><div class="s-name">${DHT_NAMES[i]}</div><div class="s-temp">${v==null?'—':fmt1(v)+'%RH'}</div><div class="bar"><i style="width:${v==null?0:clamp((v-20)/80*100,4,100)}%"></i></div><div class="dht-companion hint">Suhu DHT: —</div><div class="s-state ${v==null?'off':'ok'}">${v==null?'BELUM TERBACA':'TERPANTAU'}</div></div>`;
      }).join('');
    }
  }

  function wire() {
    el.themeBtn.addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'));
    el.menuBtn.addEventListener('click', () => el.sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
    el.sideClose.addEventListener('click', closeSidebar);
    el.sideOverlay.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });

    $$('.side-link[data-page]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.page)));
    $$('[data-goto]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.goto)));

    el.btnAuto.addEventListener('click', () => { state.mode = 'auto'; addEvent('Mode operasi diubah ke Otomatis'); renderOverview(); });
    el.btnManual.addEventListener('click', () => { state.mode = 'manual'; addEvent('Mode operasi diubah ke Manual'); renderOverview(); });
    el.btnSprayOn.addEventListener('click', () => { if (state.mode !== 'manual') return; state.manualOn = true; addEvent('Sprinkler dinyalakan manual'); renderOverview(); if (state.view === 'event') renderEvents(); });
    el.btnSprayOff.addEventListener('click', () => { if (state.mode !== 'manual') return; const wasOn = state.manualOn; state.manualOn = false; if (wasOn) addEvent('Sprinkler dimatikan manual'); renderOverview(); if (state.view === 'event') renderEvents(); });

    el.btnTemperatureDetails.addEventListener('click', () => { renderSensorDialog('temperature'); el.sensorDialog.showModal(); });
    el.btnHumidityDetails.addEventListener('click', () => { renderSensorDialog('humidity'); el.sensorDialog.showModal(); });
    el.btnCloseSensors.addEventListener('click', () => el.sensorDialog.close());
    el.sensorDialog.addEventListener('click', (e) => { if (e.target === e.currentTarget) el.sensorDialog.close(); });

    el.basisTemperature.addEventListener('change', () => { if (el.basisTemperature.checked) { state.settings.controlBasis = 'temperature'; syncSettingsUI(); } });
    el.basisThi.addEventListener('change', () => { if (el.basisThi.checked) { state.settings.controlBasis = 'thi'; syncSettingsUI(); } });
    el.srcThreshold.addEventListener('change', () => { if (el.srcThreshold.checked) { state.settings.autoSrc = 'threshold'; syncSettingsUI(); } });
    el.srcSchedule.addEventListener('change', () => { if (el.srcSchedule.checked) { state.settings.autoSrc = 'schedule'; syncSettingsUI(); } });
    el.rangeThreshold.addEventListener('input', e => el.inThreshold.value = e.target.value);
    el.inThreshold.addEventListener('input', e => el.rangeThreshold.value = e.target.value);
    el.btnSaveCfg.addEventListener('click', () => {
      const basis = el.basisThi.checked ? 'thi' : 'temperature';
      const thresh = Number(el.inThreshold.value);
      state.settings.controlBasis = basis;
      state.settings.autoSrc = el.srcSchedule.checked ? 'schedule' : 'threshold';
      if (basis === 'thi') state.settings.thresholdThi = thresh; else state.settings.thresholdTemp = thresh;
      state.settings.maxDurMin = clamp(Number(el.inMaxDur.value) || 10, 0.016666666666666666, 180);
      state.settings.cooldownMin = clamp(Number(el.inCooldown.value) || 120, 0, 1440);
      state.settings.maxCycles = clamp(Math.round(Number(el.inMaxCycles.value) || 3), 1, 100);
      el.settingsStatus.textContent = 'Pengaturan disimpan (simulasi lokal).';
      addEvent(`Pengaturan disimpan: basis ${basis === 'thi' ? 'THI' : 'Suhu DS'}, threshold ${fmt1(thresh)} ${basis === 'thi' ? 'THI' : '°C'}, durasi ${state.settings.maxDurMin} mnt, cooldown ${state.settings.cooldownMin} mnt, maks ${state.settings.maxCycles}/hari`);
      renderOverview(); drawChart();
      if (state.view === 'event') renderEvents();
    });

    el.chartMetric.addEventListener('change', drawChart);
    el.showAvg.addEventListener('change', drawChart);
    el.btnClearChart.addEventListener('click', () => { state.chartCleared = true; drawChart(); });
    el.filterSensor.addEventListener('change', renderHistory);
    el.btnExport.addEventListener('click', () => {
      const header = ['WAKTU_WIB','DS1','DS2','DS3','DS4','DS5','DS6','DHT1','DHT2','DHT3','DHT4','RATA2_DS','RATA2_RH','THI','STATUS','SPRINKLER'];
      const rows = state.history.map(r => [fmtDateTime(r.time), ...r.ds.map(v=>fmt1(v)), ...r.dht.map(v=>fmt1(v)), fmt1(r.avgDs), fmt1(r.avgRh), fmt1(r.thi), r.status, r.sprinkler]);
      const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `costmosys-riwayat-sintetis-${fmtShortDate(state.now)}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      addEvent('Export CSV riwayat sensor (simulasi lokal)'); renderEvents();
    });
    el.btnClearLog.addEventListener('click', () => { state.history = []; renderHistory(); addEvent('Riwayat sensor dihapus lokal (simulasi browser)'); renderEvents(); drawChart(); });
    el.btnLogNow.addEventListener('click', () => { addHistoryReading(); renderHistory(); drawChart(); });
    el.btnClearEvents.addEventListener('click', () => { state.events = []; renderEvents(); });

    // Admin
    el.createUserForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = el.newUserName.value.trim();
      const email = el.newUserEmail.value.trim();
      const pass = el.newUserPassword.value;
      el.adminStatus.hidden = false;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { el.adminStatus.textContent = 'Email tidak valid.'; return; }
      if (pass.length < 8) { el.adminStatus.textContent = 'Password awal minimal 8 karakter.'; return; }
      if (state.accounts.some(a => a.email.toLowerCase() === email.toLowerCase())) { el.adminStatus.textContent = 'Email sudah ada di daftar simulasi.'; return; }
      const initials = (name || email).split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(s=>s[0].toUpperCase()).join('') || 'US';
      const role = (document.querySelector('input[name="newAccountRole"]:checked')?.value || 'user').toUpperCase();
      state.accounts.push({ id: 'u' + Date.now(), initials, name, email, role, active: true });
      el.adminStatus.textContent = 'Akun simulasi ditambahkan (lokal, tidak dikirim ke server).';
      el.createUserForm.reset();
      renderAdmin();
    });
    el.userList.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-toggle-account]');
      if (toggle) { const a = state.accounts.find(x => x.id === toggle.dataset.toggleAccount); if (a && a.role !== 'ADMIN') { a.active = !a.active; addEvent(`Akun ${a.email} ${a.active ? 'diaktifkan' : 'dinonaktifkan'} (simulasi)`); renderAdmin(); if (state.view === 'event') renderEvents(); } return; }
      const del = e.target.closest('[data-delete-account]');
      if (del) { const idx = state.accounts.findIndex(x => x.id === del.dataset.deleteAccount); if (idx >= 0 && state.accounts[idx].role !== 'ADMIN') { const [a] = state.accounts.splice(idx,1); addEvent(`Akses akun ${a.email} dihapus (simulasi)`); renderAdmin(); if (state.view === 'event') renderEvents(); } }
    });

    window.addEventListener('resize', () => { if (state.view === 'dash') drawChart(); });
  }

  function renderAll() {
    renderOverview();
    if (state.view === 'log') renderHistory();
    if (state.view === 'event') renderEvents();
    if (state.view === 'herd') renderHerd();
    if (state.view === 'admin') renderAdmin();
    if (state.view === 'dash') drawChart();
  }

  function init() {
    cache();
    setTheme(state.theme);
    buildLogHead();
    seedHistory();
    seedEvents();
    wire();
    switchView('dash');
    renderAll();
    syncSettingsUI();
    setInterval(tick, 1000);

    window.__COSTMOSYS_DEMO__ = {
      version: 2,
      getState: () => JSON.parse(JSON.stringify({
        view: state.view, theme: state.theme, mode: state.mode, manualOn: state.manualOn,
        cycle: state.cycle, settings: state.settings,
        historyCount: state.history.length, activityCount: state.events.length,
        accounts: state.accounts.length,
        sprinklerOn: isSprinklerOn(),
      })),
      switchView,
      setMode: (m) => { state.mode = m; renderAll(); },
      manualOn: () => { state.mode = 'manual'; state.manualOn = true; addEvent('Sprinkler dinyalakan manual'); renderAll(); },
      manualOff: () => { state.mode = 'manual'; state.manualOn = false; addEvent('Sprinkler dimatikan manual'); renderAll(); },
      saveSettings: (patch) => { Object.assign(state.settings, patch || {}); syncSettingsUI(); renderAll(); },
      addReading: () => { addHistoryReading(); renderAll(); },
      clearHistory: () => { state.history = []; renderAll(); },
      clearActivity: () => { state.events = []; renderAll(); },
      tick: (n = 1) => { for (let i = 0; i < n; i++) tick(); },
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
