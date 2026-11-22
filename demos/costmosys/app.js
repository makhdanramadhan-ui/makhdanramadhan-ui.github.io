(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, '0');
  const fmt1 = (n) => Number(n).toFixed(1);
  const fmtDateWib = (d) => {
    const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };
  const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const fmtDateTime = (d) => `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}, ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())} WIB`;
  const fmtShortDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const DEFAULTS = {
    basis: 'temp',
    window: 'all',
    schedStart: '07:00',
    schedEnd: '17:00',
    threshold: 30.0,
    durationMin: 10,
    cooldownMin: 120,
    maxPerDay: 3,
  };

  const state = {
    view: 'overview',
    theme: localStorage.getItem('costmosys-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    now: new Date(2026, 10, 14, 21, 11, 18), // Sabtu, 14 Nov 2026 21:11:18 WIB (synthetic fixed base)
    settings: { ...DEFAULTS },
    mode: 'auto', // auto | manual
    manualOn: false,
    cycle: { phase: 'idle', remainSec: 0, cooldownRemainSec: 0, today: 0, lastStopMs: null },
    nodes: {
      left: { online: true, ds: 3, dsTotal: 3, dht: 2, dhtTotal: 2, seenSec: 2 },
      right: { online: true, ds: 3, dsTotal: 3, dht: 2, dhtTotal: 2, seenSec: 2 },
    },
    sensors: makeSensors(29.2, 64.6),
    history: [],
    activity: [],
    accounts: [
      { id: 'a1', initials: 'AD', name: 'Adminfapet', email: 'admin@contoh.test', role: 'ADMIN', active: true, console: true },
      { id: 'u1', initials: 'CA', name: '', email: 'cadangan@contoh.test', role: 'USER', active: false, console: false },
      { id: 'u2', initials: 'OP', name: 'Operator', email: 'operator@contoh.test', role: 'USER', active: true, console: false },
      { id: 'u3', initials: 'VI', name: 'Viewer', email: 'viewer@contoh.test', role: 'USER', active: true, console: false },
    ],
    adminRole: 'user',
    chartCleared: false,
  };

  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function rand(seed) { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; }

  function makeSensors(avgTemp, avgRh) {
    const dsBase = [avgTemp - 0.6, avgTemp - 0.2, avgTemp, avgTemp + 0.1, avgTemp + 0.3, avgTemp + 0.6];
    const dhtBase = [avgRh - 3.8, avgRh - 1.2, avgRh + 0.4, avgRh + 1.6];
    return {
      ds: dsBase.map(v => +v.toFixed(1)),
      dht: dhtBase.map(v => +v.toFixed(1)),
    };
  }

  function calcAvg(arr) { const v = arr.filter(x => typeof x === 'number' && !Number.isNaN(x)); if (!v.length) return null; return v.reduce((a,b)=>a+b,0)/v.length; }
  function calcThi(tempC, rh) { if (tempC == null || rh == null) return null; const t = tempC; return (0.8 * t) + ((rh / 100) * (t - 14.4)) + 46.4; }

  function currentReadings() {
    const ds = state.sensors.ds.slice();
    const dht = state.sensors.dht.slice();
    const avgDs = calcAvg(ds);
    const avgRh = calcAvg(dht);
    const thi = calcThi(avgDs, avgRh);
    return { ds, dht, avgDs, avgRh, thi };
  }

  function seedHistory() {
    const readings = [];
    const base = new Date(state.now.getTime());
    let temp = 29.1;
    let rh = 64.5;
    for (let i = 119; i >= 0; i--) {
      const t = new Date(base.getTime() - i * 30000);
      const drift = Math.sin(i / 9) * 0.25 + (i % 7 === 0 ? 0.1 : 0);
      temp = clamp(29.1 + drift, 28.4, 29.8);
      rh = clamp(64.6 + Math.cos(i / 8) * 1.8, 60.2, 68.5);
      const sensors = makeSensors(temp, rh);
      const avgDs = calcAvg(sensors.ds);
      const avgRh = calcAvg(sensors.dht);
      const thi = calcThi(avgDs, avgRh);
      const status = statusForBasis('temp', avgDs, thi, state.settings.threshold);
      readings.push({
        time: t, ds: sensors.ds, dht: sensors.dht, avgDs, avgRh, thi,
        statusLabel: status.label,
        sprinkler: i > 110 ? 'OFF' : 'OFF',
      });
    }
    state.history = readings;
  }

  function seedActivity() {
    const base = new Date(state.now.getTime());
    state.activity = [
      { t: new Date(base.getTime() - 49 * 60000), text: 'Sprinkler berhenti: durasi maksimum tercapai', kind: 'neutral' },
      { t: new Date(base.getTime() - 51 * 60000), text: 'Sprinkler menyala otomatis: suhu mencapai threshold', kind: 'ok' },
      { t: new Date(base.getTime() - 58 * 60000), text: 'Setting Suhu: threshold 30 °C, sepanjang waktu', kind: 'neutral' },
    ];
  }

  function statusForBasis(basis, avgDs, thi, threshold) {
    const val = basis === 'thi' ? thi : avgDs;
    if (val == null) return { key: 'unknown', label: 'Data belum tersedia', badge: 'DATA BELUM TERSEDIA', cls: 'badge-neutral' };
    if (basis === 'thi') {
      if (val >= threshold) return { key: 'above', label: 'THI: ≥ threshold', badge: 'THRESHOLD THI TERCAPAI', cls: 'badge-danger' };
      if (val >= threshold - 1) return { key: 'near', label: 'THI: mendekati threshold', badge: 'MENDEKATI THRESHOLD', cls: 'badge-warn' };
      return { key: 'below', label: 'THI: < threshold', badge: 'DI BAWAH THRESHOLD', cls: 'badge-ok' };
    }
    if (val >= threshold) return { key: 'above', label: 'Suhu: ≥ threshold', badge: 'THRESHOLD SUHU TERCAPAI', cls: 'badge-danger' };
    if (val >= threshold - 1) return { key: 'near', label: 'Suhu: mendekati threshold', badge: 'MENDEKATI THRESHOLD', cls: 'badge-warn' };
    return { key: 'below', label: 'Suhu: < threshold', badge: 'DI BAWAH THRESHOLD SUHU', cls: 'badge-ok' };
  }

  function tempBandLabel(temp, threshold) {
    if (temp == null) return { text: 'Data belum tersedia', cls: 'badge-neutral' };
    if (temp >= threshold) return { text: 'THRESHOLD SUHU TERCAPAI', cls: 'badge-danger' };
    if (temp >= threshold - 1) return { text: 'MENDEKATI THRESHOLD', cls: 'badge-warn' };
    return { text: 'DI BAWAH THRESHOLD SUHU', cls: 'badge-ok' };
  }

  const refs = {};
  function cacheRefs() {
    refs.views = $$('.view');
    refs.navItems = $$('.nav-item[data-view]');
    refs.crumb = $('#crumbCurrent');
    refs.themeBtn = $('#themeBtn');
    refs.menuBtn = $('#menuBtn');
    refs.drawer = $('#drawer');
    refs.drawerBackdrop = $('#drawerBackdrop');
    refs.drawerClose = $('#drawerClose');
    refs.clockText = $('#clockText');
    refs.clockBig = $('#clockBig');
    refs.clockDate = $('#clockDate');
    refs.sprinklerStatePill = $('#sprinklerStatePill');
    refs.sprinklerStatusText = $('#sprinklerStatusText');
    refs.sprinklerDesc = $('#sprinklerDesc');
    refs.sprinklerTemp = $('#sprinklerTemp');
    refs.sprinklerThreshold = $('#sprinklerThreshold');
    refs.sprinklerQuota = $('#sprinklerQuota');
    refs.sprinklerDate = $('#sprinklerDate');
    refs.sprinklerQuotaNote = $('#sprinklerQuotaNote');
    refs.sprinklerCooldown = $('#sprinklerCooldown');
    refs.sprinklerRule = $('#sprinklerRule');
    refs.tempValue = $('#tempValue');
    refs.tempBadge = $('#tempBadge');
    refs.tempMarker = $('#tempMarker');
    refs.tempMin = $('#tempMin');
    refs.tempMax = $('#tempMax');
    refs.tempThresholdLabel = $('#tempThresholdLabel');
    refs.tempValidity = $('#tempValidity');
    refs.rhValue = $('#rhValue');
    refs.rhBadge = $('#rhBadge');
    refs.rhMarker = $('#rhMarker');
    refs.rhMin = $('#rhMin');
    refs.rhMax = $('#rhMax');
    refs.rhValidity = $('#rhValidity');
    refs.thiValue = $('#thiValue');
    refs.thiBadge = $('#thiBadge');
    refs.thiMarker = $('#thiMarker');
    refs.thiValidity = $('#thiValidity');
    refs.nodeLeftBadge = $('#nodeLeftBadge');
    refs.nodeRightBadge = $('#nodeRightBadge');
    refs.nodeLeftDs = $('#nodeLeftDs');
    refs.nodeLeftDht = $('#nodeLeftDht');
    refs.nodeLeftSeen = $('#nodeLeftSeen');
    refs.nodeRightDs = $('#nodeRightDs');
    refs.nodeRightDht = $('#nodeRightDht');
    refs.nodeRightSeen = $('#nodeRightSeen');
    refs.evHeatBadge = $('#evHeatBadge');
    refs.evHeatText = $('#evHeatText');
    refs.evPostureBadge = $('#evPostureBadge');
    refs.evPeopleBadge = $('#evPeopleBadge');
    refs.evSprinklerBadge = $('#evSprinklerBadge');
    refs.evSprinklerText = $('#evSprinklerText');
    refs.historyBody = $('#historyBody');
    refs.historyFoot = $('#historyFoot');
    refs.historyCountPill = $('#historyCountPill');
    refs.historyFilter = $('#historyFilter');
    refs.activityList = $('#activityList');
    refs.activityCountPill = $('#activityCountPill');
    refs.accountList = $('#accountList');
    refs.accountCount = $('#accountCount');
    refs.chartCanvas = $('#trendCanvas');
    refs.chartEmpty = $('#chartEmpty');
    refs.trendLegend = $('#trendLegend');
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('costmosys-theme', theme);
    refs.themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap');
    drawChart();
  }

  function switchView(view) {
    state.view = view;
    refs.views.forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    refs.navItems.forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const labels = { overview: 'Overview', history: 'Riwayat sensor', sprinkler: 'Aktivitas sprinkler', admin: 'Dashboard Admin' };
    refs.crumb.textContent = labels[view] || view;
    closeDrawer();
    if (view === 'history') renderHistory();
    if (view === 'sprinkler') renderActivity();
    if (view === 'admin') renderAccounts();
    if (view === 'overview') drawChart();
  }

  function openDrawer() { refs.drawer.classList.add('open'); refs.drawer.setAttribute('aria-hidden', 'false'); refs.drawerBackdrop.hidden = false; refs.menuBtn.setAttribute('aria-expanded', 'true'); }
  function closeDrawer() { refs.drawer.classList.remove('open'); refs.drawer.setAttribute('aria-hidden', 'true'); refs.drawerBackdrop.hidden = true; refs.menuBtn.setAttribute('aria-expanded', 'false'); }

  function sprinklerPhaseLabel() {
    const c = state.cycle;
    if (state.mode === 'manual' && state.manualOn) return { key: 'manual-on', pill: 'MENYEMPROT', pillCls: 'state-on', text: 'MENYEMPROT', textCls: 'is-on', desc: 'Mode manual · menyala sampai dimatikan.' };
    if (c.phase === 'spraying') return { key: 'spraying', pill: 'MENYEMPROT', pillCls: 'state-on', text: 'MENYEMPROT', textCls: 'is-on', desc: `Siklus otomatis berjalan. Sisa durasi semprot ${fmtRemain(c.remainSec)}.` };
    if (c.phase === 'cooldown') return { key: 'cooldown', pill: 'COOLDOWN', pillCls: 'state-warn', text: 'MATI', textCls: 'is-warn', desc: `Cooldown sejak berhenti aktual. Sisa cooldown ${fmtRemain(c.cooldownRemainSec)}.` };
    if (state.mode === 'manual' && !state.manualOn) return { key: 'manual-off', pill: 'MATI', pillCls: 'state-off', text: 'MATI', textCls: 'is-off', desc: 'Mode manual. Relay mati sampai perintah ON.' };
    return { key: 'idle', pill: 'MATI', pillCls: 'state-off', text: 'MATI', textCls: 'is-off', desc: 'Siklus sedang tidak menyiram. Syarat mulai diperiksa perangkat.' };
  }

  function fmtRemain(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m >= 60) { const h = Math.floor(m / 60); const mm = m % 60; return `${h} jam ${mm} menit ${s} detik`; }
    return `${m} menit ${s} detik`;
  }

  function isSprinklerOn() {
    if (state.mode === 'manual') return !!state.manualOn;
    return state.cycle.phase === 'spraying';
  }

  function renderOverview() {
    const r = currentReadings();
    const s = state.settings;
    const st = statusForBasis(s.basis, r.avgDs, r.thi, s.threshold);
    const tempBand = tempBandLabel(r.avgDs, s.threshold);

    $('#clockBig').textContent = fmtClock(state.now);
    $('#clockDate').textContent = fmtDateWib(state.now);
    $('#clockText').textContent = `${fmtDateWib(state.now)} · ${fmtClock(state.now)} WIB`;

    refs.tempValue.innerHTML = `${fmt1(r.avgDs)} <span class="metric-unit">°C</span>`;
    refs.tempBadge.textContent = tempBand.text;
    refs.tempBadge.className = `badge ${tempBand.cls}`;
    refs.tempMin.textContent = `${fmt1(Math.min(...r.ds))} °C`;
    refs.tempMax.textContent = `${fmt1(Math.max(...r.ds))} °C`;
    refs.tempThresholdLabel.textContent = `${fmt1(s.threshold)} °C`;
    refs.tempValidity.textContent = `${r.ds.filter(v => v != null).length}/6 DS valid`;
    const tPct = clamp(((r.avgDs - 24) / (38 - 24)) * 100, 0, 100);
    refs.tempMarker.style.left = `${tPct}%`;

    refs.rhValue.innerHTML = `${fmt1(r.avgRh)} <span class="metric-unit">%RH</span>`;
    refs.rhBadge.textContent = `${r.dht.filter(v => v != null).length} TITIK TERPANTAU`;
    refs.rhBadge.className = 'badge badge-info';
    refs.rhMin.textContent = `${fmt1(Math.min(...r.dht))} %`;
    refs.rhMax.textContent = `${fmt1(Math.max(...r.dht))} %`;
    refs.rhValidity.textContent = `${r.dht.filter(v => v != null).length}/4 DHT valid`;
    refs.rhMarker.style.left = `${clamp(((r.avgRh - 20) / 80) * 100, 0, 100)}%`;

    refs.thiValue.innerHTML = `${fmt1(r.thi)} <span class="metric-unit">THI</span>`;
    refs.thiBadge.textContent = 'MONITORING THI';
    refs.thiBadge.className = 'badge badge-ok';
    refs.thiValidity.textContent = `${r.ds.length}/6 DS + ${r.dht.length}/4 DHT valid · dasar agregat tersedia`;
    refs.thiMarker.style.left = `${clamp(((r.thi - 60) / 35) * 100, 0, 100)}%`;

    // Node status
    renderNodeStatus();

    // Sprinkler
    const ph = sprinklerPhaseLabel();
    refs.sprinklerStatePill.textContent = ph.pill;
    refs.sprinklerStatePill.className = `state-pill ${ph.pillCls}`;
    refs.sprinklerStatusText.textContent = ph.text;
    refs.sprinklerStatusText.className = `sprinkler-status ${ph.textCls}`;
    refs.sprinklerDesc.textContent = ph.desc;
    refs.sprinklerTemp.textContent = s.basis === 'thi' ? `${fmt1(r.thi)} THI` : `${fmt1(r.avgDs)} °C`;
    refs.sprinklerThreshold.textContent = s.basis === 'thi' ? `${fmt1(s.threshold)} THI` : `${fmt1(s.threshold)} °C`;
    refs.sprinklerQuota.textContent = `${state.cycle.today}/${s.maxPerDay}`;
    refs.sprinklerDate.textContent = `${fmtShortDate(state.now)} WIB`;
    refs.sprinklerQuotaNote.textContent = state.cycle.today >= s.maxPerDay ? 'batas harian tercapai' : 'tersedia';
    refs.sprinklerCooldown.textContent = state.cycle.phase === 'cooldown' ? fmtRemain(state.cycle.cooldownRemainSec) : 'tidak aktif';
    refs.sprinklerRule.textContent = `Mulai saat ${s.basis === 'thi' ? 'THI' : 'Suhu'} ≥ ${fmt1(s.threshold)} ${s.basis === 'thi' ? 'THI' : '°C'}, ${s.window === 'all' ? 'sepanjang waktu' : `jadwal ${s.schedStart}–${s.schedEnd} WIB`}. Semprot ${s.durationMin} menit, cooldown ${s.cooldownMin} menit setelah berhenti, maks ${s.maxPerDay} mulai otomatis/hari (WIB).`;

    // Mode buttons
    $$('.seg-btn[data-mode]').forEach(b => { const on = b.dataset.mode === state.mode; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    const on = isSprinklerOn();
    $('#btnManualOn').disabled = state.mode !== 'manual' || on;
    $('#btnManualOff').disabled = state.mode !== 'manual' || !on;
    $('#modeNote').textContent = state.mode === 'manual'
      ? (on ? 'Mode manual aktif. Sprinkler menyala sampai dimatikan manual.' : 'Mode manual aktif. Relay mati sampai perintah ON.')
      : 'Mode otomatis aktif. Tombol manual tersedia untuk intervensi.';

    // Evidence cards
    refs.evHeatBadge.textContent = tempBand.text;
    refs.evHeatBadge.className = `badge ${tempBand.cls}`;
    refs.evHeatText.textContent = `Suhu rata-rata ${fmt1(r.avgDs)} °C berada di pita ${bandText(r.avgDs, s.threshold)}. Ini sinyal lingkungan, bukan diagnosis kondisi sapi.`;
    refs.evSprinklerBadge.textContent = ph.pill;
    refs.evSprinklerBadge.className = `badge ${ph.pillCls === 'state-on' ? 'badge-ok' : ph.pillCls === 'state-warn' ? 'badge-warn' : ph.pillCls === 'state-danger' ? 'badge-danger' : 'badge-off'}`;
    refs.evSprinklerText.textContent = on ? `Relay aktif (${ph.key === 'manual-on' ? 'manual' : 'siklus otomatis'}). Status mengikuti simulasi kontrol.` : (state.cycle.phase === 'cooldown' ? `Relay mati. Cooldown aktif ${fmtRemain(state.cycle.cooldownRemainSec)}.` : 'Relay mati. Siklus otomatis tidak aktif; perangkat memeriksa syarat mulai berdasarkan threshold dan kebijakan cooldown.');

    // Settings inputs
    syncSettingsUI();
  }

  function bandText(temp, threshold) {
    if (temp >= threshold) return `≥ ${fmt1(threshold)} °C (threshold tercapai)`;
    if (temp >= threshold - 1) return `${fmt1(threshold - 1)}–${fmt1(threshold)} °C (mendekati threshold)`;
    return `< ${fmt1(threshold - 1)} °C (di bawah threshold)`;
  }

  function renderNodeStatus() {
    const ln = state.nodes.left, rn = state.nodes.right;
    refs.nodeLeftBadge.textContent = ln.online ? 'ONLINE' : 'OFFLINE';
    refs.nodeLeftBadge.className = `badge ${ln.online ? 'badge-ok' : 'badge-danger'}`;
    refs.nodeRightBadge.textContent = rn.online ? 'ONLINE' : 'OFFLINE';
    refs.nodeRightBadge.className = `badge ${rn.online ? 'badge-ok' : 'badge-danger'}`;
    refs.nodeLeftDs.textContent = `${ln.ds}/${ln.dsTotal}`;
    refs.nodeLeftDht.textContent = `${ln.dht}/${ln.dhtTotal}`;
    refs.nodeLeftSeen.textContent = ln.online ? `${ln.seenSec} detik lalu` : 'tidak tersedia';
    refs.nodeRightDs.textContent = `${rn.ds}/${rn.dsTotal}`;
    refs.nodeRightDht.textContent = `${rn.dht}/${rn.dhtTotal}`;
    refs.nodeRightSeen.textContent = rn.online ? `${rn.seenSec} detik lalu` : 'tidak tersedia';
  }

  function syncSettingsUI() {
    const s = state.settings;
    $$('input[name="basis"]').forEach(r => r.checked = r.value === s.basis);
    $$('input[name="window"]').forEach(r => r.checked = r.value === s.window);
    $('#schedStart').value = s.schedStart;
    $('#schedEnd').value = s.schedEnd;
    $('#thresholdRange').value = s.threshold;
    $('#thresholdNum').value = s.threshold;
    $('#durationMin').value = s.durationMin;
    $('#cooldownMin').value = s.cooldownMin;
    $('#maxPerDay').value = s.maxPerDay;
    $('#thresholdUnit').textContent = s.basis === 'thi' ? 'THI' : '°C';
    $('#thresholdRange').min = s.basis === 'thi' ? 60 : 24;
    $('#thresholdRange').max = s.basis === 'thi' ? 95 : 38;
    $('#thresholdNum').min = s.basis === 'thi' ? 60 : 24;
    $('#thresholdNum').max = s.basis === 'thi' ? 95 : 38;
    $('#scheduleRow').style.opacity = s.window === 'schedule' ? '1' : '0.55';
  }

  function renderHistory() {
    const filter = $('#historyFilter').value;
    const s = state.settings;
    let rows = state.history.slice().reverse();
    if (filter !== 'all') {
      rows = rows.filter(r => {
        const st = statusForBasis(s.basis, r.avgDs, r.thi, s.threshold);
        return st.key === filter;
      });
    }
    const show = rows.slice(0, 120);
    refs.historyBody.innerHTML = show.map(r => {
      const st = statusForBasis(s.basis, r.avgDs, r.thi, s.threshold);
      const tagCls = st.key === 'above' ? 'tag-danger' : st.key === 'near' ? 'tag-warn' : st.key === 'below' ? 'tag-ok' : 'tag-neutral';
      return `<tr>
        <td>${fmtDateTime(r.time)}</td>
        ${r.ds.map(v => `<td>${fmt1(v)}</td>`).join('')}
        ${r.dht.map(v => `<td>${fmt1(v)}</td>`).join('')}
        <td><strong>${fmt1(r.avgDs)}</strong></td>
        <td>${fmt1(r.avgRh)}</td>
        <td>${fmt1(r.thi)}</td>
        <td><span class="status-tag ${tagCls}">${st.label}</span></td>
        <td>${r.sprinkler}</td>
      </tr>`;
    }).join('');
    refs.historyFoot.textContent = `${show.length}/${state.history.length} baris terbaru`;
    refs.historyCountPill.textContent = `${state.history.length} pembacaan terakhir`;
  }

  function renderActivity() {
    const items = state.activity.slice().sort((a,b) => b.t - a.t);
    refs.activityList.innerHTML = items.map(it => `
      <li class="activity-item">
        <span class="activity-dot ${it.kind || 'neutral'}" aria-hidden="true"></span>
        <div class="activity-text">${escapeHtml(it.text)}</div>
        <div class="activity-time">${fmtDateTime(it.t)}</div>
      </li>
    `).join('') || '<li class="activity-item"><span class="activity-dot neutral"></span><div class="activity-text">Belum ada aktivitas.</div><div></div></li>';
    refs.activityCountPill.textContent = `${items.length} aktivitas`;
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function renderAccounts() {
    refs.accountCount.textContent = `${state.accounts.length} akun`;
    refs.accountList.innerHTML = state.accounts.map(a => {
      const initials = a.initials || (a.name || a.email).slice(0,2).toUpperCase();
      const display = a.name || a.email;
      const action = a.role === 'ADMIN' ? `<span class="acc-meta">Dikelola di Firebase Console</span>` : `<div class="acc-actions"><button class="btn btn-ghost btn-sm" type="button" data-toggle-account="${a.id}">${a.active ? 'Nonaktifkan' : 'Aktifkan'}</button></div>`;
      return `<div class="account-row">
        <div class="avatar" aria-hidden="true">${escapeHtml(initials)}</div>
        <div>
          <div class="acc-name">${escapeHtml(display)} <span class="badge ${a.role === 'ADMIN' ? 'badge-admin' : 'badge-neutral'}">${a.role}</span></div>
          <div class="acc-email">${escapeHtml(a.email)}</div>
          <div class="acc-meta"><span class="dot ${a.active ? 'ok' : ''}" aria-hidden="true" style="${a.active ? '' : 'color:var(--neutral)'}"></span>${a.active ? 'Aktif' : 'Nonaktif'}</div>
        </div>
        ${action}
      </div>`;
    }).join('');
  }

  function drawChart() {
    const canvas = refs.chartCanvas;
    const empty = refs.chartEmpty;
    const ctx = canvas.getContext('2d');
    const metric = $('#trendMetric').value;
    const showAvg = $('#trendAvg').checked;
    const s = state.settings;
    const data = state.history.slice(-120);
    const hasData = data.length > 0 && !state.chartCleared;
    empty.hidden = hasData;
    canvas.style.visibility = hasData ? 'visible' : 'hidden';
    if (!hasData) { ctx.clearRect(0,0,canvas.width,canvas.height); renderLegend(metric, showAvg); return; }

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || 1200;
    const cssH = 320;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const padL = 52, padR = 20, padT = 20, padB = 36;
    const W = cssW - padL - padR;
    const H = cssH - padT - padB;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridC = isDark ? 'rgba(148,167,191,.15)' : 'rgba(100,116,139,.12)';
    const textC = isDark ? '#8ea2bc' : '#64748b';

    let series = [];
    let yMin, yMax, thresholdVal = null, unit = '';
    if (metric === 'temp') {
      series = [0,1,2,3,4,5].map(i => ({ label: `DS${i+1}`, color: ['#f59e0b','#efb34c','#34c759','#3b82f6','#a855f7','#ec4899'][i], values: data.map(r => r.ds[i]) }));
      if (showAvg) series.push({ label: 'Rata-rata', color: isDark ? '#edf3fb' : '#18283c', values: data.map(r => r.avgDs), dash: [6,4], width: 2.5 });
      yMin = 24; yMax = 38; thresholdVal = s.basis === 'temp' ? s.threshold : 30; unit = '°C';
    } else if (metric === 'rh') {
      series = [0,1,2,3].map(i => ({ label: `DHT${i+1}`, color: ['#3b82f6','#06b6d4','#8b5cf6','#10b981'][i], values: data.map(r => r.dht[i]) }));
      if (showAvg) series.push({ label: 'Rata-rata', color: isDark ? '#edf3fb' : '#18283c', values: data.map(r => r.avgRh), dash: [6,4], width: 2.5 });
      yMin = 20; yMax = 100; unit = '%RH';
    } else {
      series = [{ label: 'THI', color: '#10b981', values: data.map(r => r.thi), width: 2.5 }];
      if (showAvg) series.push({ label: 'Rata-rata', color: isDark ? '#edf3fb' : '#18283c', values: data.map(r => r.thi), dash: [6,4], width: 2 });
      yMin = 60; yMax = 95; thresholdVal = s.basis === 'thi' ? s.threshold : null; unit = 'THI';
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

    // threshold line
    if (thresholdVal != null && thresholdVal >= yMin && thresholdVal <= yMax) {
      const y = yFor(thresholdVal);
      ctx.save(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.setLineDash([6,4]);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke();
      ctx.restore();
    }

    series.forEach(ser => {
      ctx.save();
      ctx.strokeStyle = ser.color; ctx.lineWidth = ser.width || 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (ser.dash) ctx.setLineDash(ser.dash);
      let started = false;
      ser.values.forEach((v, i) => {
        if (v == null || Number.isNaN(v)) { started = false; return; }
        const x = xFor(i), y = yFor(clamp(v, yMin, yMax));
        if (!started) { ctx.beginPath(); ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    });

    // x labels
    ctx.fillStyle = textC; ctx.font = '12px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const labelEvery = Math.max(1, Math.floor(data.length / 6));
    data.forEach((r, i) => {
      if (i % labelEvery !== 0 && i !== data.length - 1) return;
      ctx.fillText(`${pad(r.time.getHours())}:${pad(r.time.getMinutes())}`, xFor(i), padT + H + 8);
    });

    renderLegend(metric, showAvg);
  }

  function renderLegend(metric, showAvg) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    let items = [];
    if (metric === 'temp') {
      items = ['DS1','DS2','DS3','DS4','DS5','DS6'].map((l,i) => ({ l, c: ['#f59e0b','#efb34c','#34c759','#3b82f6','#a855f7','#ec4899'][i] }));
      if (showAvg) items.push({ l: 'Rata-rata', c: isDark ? '#edf3fb' : '#18283c' });
    } else if (metric === 'rh') {
      items = ['DHT1','DHT2','DHT3','DHT4'].map((l,i) => ({ l, c: ['#3b82f6','#06b6d4','#8b5cf6','#10b981'][i] }));
      if (showAvg) items.push({ l: 'Rata-rata', c: isDark ? '#edf3fb' : '#18283c' });
    } else {
      items = [{ l: 'THI', c: '#10b981' }];
      if (showAvg) items.push({ l: 'Rata-rata', c: isDark ? '#edf3fb' : '#18283c' });
    }
    refs.trendLegend.innerHTML = items.map(it => `<span class="legend-item"><span class="legend-dot" style="background:${it.c}"></span>${it.l}</span>`).join('');
  }

  function addActivity(text, kind = 'neutral') {
    state.activity.push({ t: new Date(state.now.getTime()), text, kind });
    if (state.activity.length > 50) state.activity = state.activity.slice(-50);
  }

  function addHistoryReading() {
    const r = currentReadings();
    const s = state.settings;
    const st = statusForBasis(s.basis, r.avgDs, r.thi, s.threshold);
    state.history.push({
      time: new Date(state.now.getTime()),
      ds: r.ds, dht: r.dht, avgDs: r.avgDs, avgRh: r.avgRh, thi: r.thi,
      statusLabel: st.label,
      sprinkler: isSprinklerOn() ? 'ON' : 'OFF',
    });
    if (state.history.length > 240) state.history = state.history.slice(-240);
  }

  function maybeAutoStart() {
    const s = state.settings;
    if (state.mode !== 'auto') return;
    if (state.cycle.phase === 'spraying' || state.cycle.phase === 'cooldown') return;
    if (state.cycle.today >= s.maxPerDay) return;
    const r = currentReadings();
    const val = s.basis === 'thi' ? r.thi : r.avgDs;
    if (val == null) return;
    if (val >= s.threshold) {
      startSpray('auto');
    }
  }

  function startSpray(reason) {
    const s = state.settings;
    state.cycle.phase = 'spraying';
    state.cycle.remainSec = s.durationMin * 60;
    state.cycle.cooldownRemainSec = 0;
    if (reason === 'auto') {
      state.cycle.today += 1;
      addActivity(`Sprinkler menyala otomatis: ${s.basis === 'thi' ? 'THI' : 'suhu'} mencapai threshold`, 'ok');
    } else {
      addActivity('Sprinkler dinyalakan manual', 'ok');
    }
  }

  function stopSpray(reason) {
    const s = state.settings;
    const wasSpraying = state.cycle.phase === 'spraying' || (state.mode === 'manual' && state.manualOn);
    if (state.mode === 'manual' && reason === 'manual') {
      state.manualOn = false;
      addActivity('Sprinkler dimatikan manual', 'neutral');
      // manual off: no auto cooldown unless we were in auto spray; keep simple
      if (state.cycle.phase !== 'spraying') { renderAll(); return; }
    }
    if (state.cycle.phase === 'spraying') {
      state.cycle.phase = 'cooldown';
      state.cycle.cooldownRemainSec = s.cooldownMin * 60;
      state.cycle.remainSec = 0;
      state.cycle.lastStopMs = state.now.getTime();
      if (reason === 'duration') addActivity('Sprinkler berhenti: durasi maksimum tercapai', 'neutral');
      else if (reason === 'manual') addActivity('Sprinkler berhenti: dimatikan manual saat siklus aktif', 'neutral');
      else addActivity('Sprinkler berhenti', 'neutral');
    } else if (state.mode === 'manual' && reason === 'manual') {
      // already handled
    }
  }

  function tick() {
    state.now = new Date(state.now.getTime() + 1000);
    // small sensor drift
    const drift = Math.sin(state.now.getSeconds() / 11) * 0.05;
    state.sensors.ds = state.sensors.ds.map((v, i) => +clamp(v + drift * (i % 2 ? 1 : -0.5), 27.5, 33.5).toFixed(1));
    state.sensors.dht = state.sensors.dht.map((v, i) => +clamp(v + drift * 0.3 * (i % 2 ? -1 : 1), 55, 75).toFixed(1));

    if (state.cycle.phase === 'spraying') {
      state.cycle.remainSec -= 1;
      if (state.cycle.remainSec <= 0) stopSpray('duration');
    } else if (state.cycle.phase === 'cooldown') {
      state.cycle.cooldownRemainSec -= 1;
      if (state.cycle.cooldownRemainSec <= 0) {
        state.cycle.phase = 'idle';
        state.cycle.cooldownRemainSec = 0;
        addActivity('Cooldown selesai: siklus otomatis siap dievaluasi', 'neutral');
      }
    }

    maybeAutoStart();

    if (state.now.getSeconds() % 30 === 0) addHistoryReading();
    renderAll();
  }

  function renderAll() {
    renderOverview();
    if (state.view === 'history') renderHistory();
    if (state.view === 'sprinkler') renderActivity();
    if (state.view === 'admin') renderAccounts();
    if (state.view === 'overview') drawChart();
  }

  function exportCsv() {
    const header = ['WAKTU_WIB','DS1','DS2','DS3','DS4','DS5','DS6','DHT1','DHT2','DHT3','DHT4','RATA2_DS','RATA2_RH','THI','STATUS','SPRINKLER'];
    const rows = state.history.map(r => [
      fmtDateTime(r.time), ...r.ds.map(v=>fmt1(v)), ...r.dht.map(v=>fmt1(v)),
      fmt1(r.avgDs), fmt1(r.avgRh), fmt1(r.thi), r.statusLabel, r.sprinkler
    ]);
    const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `costmosys-riwayat-sintetis-${fmtShortDate(state.now)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    addActivity('Export CSV riwayat sensor (simulasi lokal)', 'neutral');
    renderActivity();
  }

  function openNodeDialog(kind) {
    const r = currentReadings();
    const dialog = $('#nodeDialog');
    const body = $('#nodeDialogBody');
    const title = $('#nodeDialogTitle');
    if (kind === 'ds') {
      title.textContent = 'Detail titik sensor DS18B20';
      body.innerHTML = `<table class="detail-table"><tbody>
        ${r.ds.map((v,i)=>`<tr><th>DS${i+1} (${i < 3 ? 'Node kiri' : 'Node kanan'})</th><td>${fmt1(v)} °C · valid</td></tr>`).join('')}
        <tr><th>Rata-rata DS</th><td>${fmt1(r.avgDs)} °C</td></tr>
        <tr><th>Threshold aktif</th><td>${fmt1(state.settings.threshold)} ${state.settings.basis === 'thi' ? 'THI' : '°C'}</td></tr>
      </tbody></table>`;
    } else {
      title.textContent = 'Detail titik kelembapan DHT22';
      body.innerHTML = `<table class="detail-table"><tbody>
        ${r.dht.map((v,i)=>`<tr><th>DHT${i+1} (${i < 2 ? 'Node kiri' : 'Node kanan'})</th><td>${fmt1(v)} %RH · valid</td></tr>`).join('')}
        <tr><th>Rata-rata RH</th><td>${fmt1(r.avgRh)} %RH</td></tr>
        <tr><th>THI agregat</th><td>${fmt1(r.thi)} THI</td></tr>
      </tbody></table>`;
    }
    dialog.showModal();
  }

  function wireEvents() {
    refs.themeBtn.addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'));
    refs.menuBtn.addEventListener('click', openDrawer);
    refs.drawerClose.addEventListener('click', closeDrawer);
    refs.drawerBackdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

    refs.navItems.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

    $$('.seg-btn[data-mode]').forEach(btn => btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      addActivity(`Mode operasi diubah ke ${state.mode === 'auto' ? 'Otomatis' : 'Manual'}`, 'neutral');
      renderAll();
    }));

    $('#btnManualOn').addEventListener('click', () => {
      if (state.mode !== 'manual') return;
      state.manualOn = true;
      addActivity('Sprinkler dinyalakan manual', 'ok');
      renderAll();
    });
    $('#btnManualOff').addEventListener('click', () => {
      if (state.mode !== 'manual') return;
      const wasOn = state.manualOn;
      state.manualOn = false;
      if (wasOn) addActivity('Sprinkler dimatikan manual', 'neutral');
      renderAll();
    });

    $('#btnSaveSettings').addEventListener('click', () => {
      const basis = $('input[name="basis"]:checked').value;
      const windowMode = $('input[name="window"]:checked').value;
      const threshold = Number($('#thresholdNum').value);
      const durationMin = clamp(Number($('#durationMin').value) || 10, 1, 60);
      const cooldownMin = clamp(Number($('#cooldownMin').value) || 120, 1, 240);
      const maxPerDay = clamp(Number($('#maxPerDay').value) || 3, 1, 12);
      state.settings = {
        ...state.settings, basis, window: windowMode,
        schedStart: $('#schedStart').value || '07:00',
        schedEnd: $('#schedEnd').value || '17:00',
        threshold, durationMin, cooldownMin, maxPerDay,
      };
      $('#settingsStatus').textContent = 'Pengaturan disimpan (simulasi lokal).';
      addActivity(`Pengaturan disimpan: basis ${basis === 'thi' ? 'THI' : 'Suhu DS'}, threshold ${fmt1(threshold)} ${basis === 'thi' ? 'THI' : '°C'}, durasi ${durationMin} mnt, cooldown ${cooldownMin} mnt, maks ${maxPerDay}/hari`, 'neutral');
      renderAll();
    });

    $$('input[name="basis"]').forEach(r => r.addEventListener('change', () => {
      const basis = $('input[name="basis"]:checked').value;
      $('#thresholdUnit').textContent = basis === 'thi' ? 'THI' : '°C';
      if (basis === 'thi') { $('#thresholdRange').min = 60; $('#thresholdRange').max = 95; $('#thresholdNum').min = 60; $('#thresholdNum').max = 95; if (Number($('#thresholdNum').value) < 60) { $('#thresholdNum').value = 80; $('#thresholdRange').value = 80; } }
      else { $('#thresholdRange').min = 24; $('#thresholdRange').max = 38; $('#thresholdNum').min = 24; $('#thresholdNum').max = 38; if (Number($('#thresholdNum').value) > 38) { $('#thresholdNum').value = 30; $('#thresholdRange').value = 30; } }
    }));
    $$('input[name="window"]').forEach(r => r.addEventListener('change', () => {
      $('#scheduleRow').style.opacity = $('input[name="window"]:checked').value === 'schedule' ? '1' : '0.55';
    }));
    $('#thresholdRange').addEventListener('input', e => $('#thresholdNum').value = e.target.value);
    $('#thresholdNum').addEventListener('input', e => $('#thresholdRange').value = e.target.value);

    $('#trendMetric').addEventListener('change', drawChart);
    $('#trendAvg').addEventListener('change', drawChart);
    $('#btnClearChart').addEventListener('click', () => { state.chartCleared = true; drawChart(); });
    $('#historyFilter').addEventListener('change', renderHistory);
    $('#btnExportCsv').addEventListener('click', exportCsv);
    $('#btnClearHistory').addEventListener('click', () => { state.history = []; renderHistory(); addActivity('Riwayat sensor dihapus lokal (simulasi browser)', 'neutral'); });
    $('#btnAddReading').addEventListener('click', () => { addHistoryReading(); renderHistory(); drawChart(); });
    $('#btnClearActivity').addEventListener('click', () => { state.activity = []; renderActivity(); });

    $$('.link-btn[data-open="node-detail"]').forEach(btn => btn.addEventListener('click', () => openNodeDialog(btn.dataset.kind)));
    $('#nodeDialogClose').addEventListener('click', () => $('#nodeDialog').close());
    $('#nodeDialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

    // Admin
    $$('.seg-btn[data-role]').forEach(btn => btn.addEventListener('click', () => {
      state.adminRole = btn.dataset.role;
      $$('.seg-btn[data-role]').forEach(b => { const on = b.dataset.role === state.adminRole; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    }));
    $('#adminForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#adminName').value.trim();
      const email = $('#adminEmail').value.trim();
      const pass = $('#adminPass').value;
      const msg = $('#adminFormMsg');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Email tidak valid.'; msg.className = 'form-msg error'; return; }
      if (pass.length < 8) { msg.textContent = 'Password awal minimal 8 karakter.'; msg.className = 'form-msg error'; return; }
      if (state.accounts.some(a => a.email.toLowerCase() === email.toLowerCase())) { msg.textContent = 'Email sudah ada di daftar simulasi.'; msg.className = 'form-msg error'; return; }
      const initials = (name || email).split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(s=>s[0].toUpperCase()).join('');
      state.accounts.push({ id: 'u' + Date.now(), initials: initials || 'US', name, email, role: state.adminRole.toUpperCase(), active: true, console: false });
      msg.textContent = 'Akun simulasi ditambahkan (lokal, tidak dikirim ke server).';
      msg.className = 'form-msg';
      $('#adminForm').reset();
      state.adminRole = 'user';
      $$('.seg-btn[data-role]').forEach(b => { const on = b.dataset.role === 'user'; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
      renderAccounts();
    });
    refs.accountList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-toggle-account]');
      if (!btn) return;
      const a = state.accounts.find(x => x.id === btn.dataset.toggleAccount);
      if (!a || a.role === 'ADMIN') return;
      a.active = !a.active;
      addActivity(`Akun ${a.email} ${a.active ? 'diaktifkan' : 'dinonaktifkan'} (simulasi)`, 'neutral');
      renderAccounts();
    });

    window.addEventListener('resize', () => { if (state.view === 'overview') drawChart(); });
  }

  function init() {
    cacheRefs();
    setTheme(state.theme);
    seedHistory();
    seedActivity();
    wireEvents();
    renderAll();
    setInterval(tick, 1000);

    window.__COSTMOSYS_DEMO__ = {
      version: 1,
      getState: () => JSON.parse(JSON.stringify({
        view: state.view, theme: state.theme, mode: state.mode, manualOn: state.manualOn,
        cycle: state.cycle, settings: state.settings, nodes: state.nodes,
        historyCount: state.history.length, activityCount: state.activity.length,
        accounts: state.accounts.length,
        sprinklerOn: isSprinklerOn(),
      })),
      switchView,
      setMode: (m) => { state.mode = m; renderAll(); },
      manualOn: () => { state.mode = 'manual'; state.manualOn = true; addActivity('Sprinkler dinyalakan manual', 'ok'); renderAll(); },
      manualOff: () => { state.mode = 'manual'; state.manualOn = false; addActivity('Sprinkler dimatikan manual', 'neutral'); renderAll(); },
      saveSettings: (patch) => { Object.assign(state.settings, patch || {}); syncSettingsUI(); renderAll(); },
      addReading: () => { addHistoryReading(); renderAll(); },
      clearHistory: () => { state.history = []; renderAll(); },
      clearActivity: () => { state.activity = []; renderAll(); },
      exportCsv,
      tick: (n = 1) => { for (let i = 0; i < n; i++) tick(); },
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
