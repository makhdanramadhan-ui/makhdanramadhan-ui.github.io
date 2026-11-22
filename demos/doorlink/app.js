(() => {
  'use strict';

  const SEEDED_USERS = [
    { id: 'u1', name: 'Sample Owner', username: 'owner', password: 'demo-owner', role: 'owner', room: 'A-101', status: 'Active' },
    { id: 'u2', name: 'Sample Tenant', username: 'tenant1', password: 'demo-tenant', role: 'tenant', room: 'B-203', status: 'Active' },
    { id: 'u3', name: 'Sample Guest', username: 'guest1', password: 'demo-guest', role: 'guest', room: 'C-105', status: 'Active' },
    { id: 'u4', name: 'Sample Technician', username: 'tech1', password: 'demo-tech', role: 'technician', room: '', status: 'Active' },
  ];

  const SEEDED_LOGS = [
    { time: '05 Jun 2026 09:55:00', username: 'owner', method: 'web', status: 'Allowed', message: 'Pintu dibuka (lewat Dashboard)' },
    { time: '05 Jun 2026 09:40:00', username: 'tenant1', method: 'esp32', status: 'Allowed', message: 'Access granted' },
    { time: '05 Jun 2026 09:15:00', username: 'guest1', method: 'web', status: 'Denied', message: "Role 'guest' tidak memiliki izin buka pintu" },
    { time: '05 Jun 2026 08:00:00', username: 'unknown', method: 'esp32', status: 'Denied', message: 'User tidak ditemukan atau tidak aktif' },
    { time: '05 Jun 2026 07:00:00', username: 'tech1', method: 'web', status: 'Allowed', message: 'Pintu dibuka (lewat Dashboard)' },
  ];

  let state = seedState();
  let editingUserId = null;

  function seedState() {
    return {
      currentUser: null,
      users: SEEDED_USERS.map((u) => ({ ...u })),
      logs: SEEDED_LOGS.map((l) => ({ ...l })),
      logFilter: 'all',
    };
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtNow() {
    return '05 Jun 2026 10:00:00';
  }

  function $(id) { return document.getElementById(id); }
  function qsa(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

  function showView(name) {
    qsa('.view').forEach((v) => {
      const active = v.id === `view-${name}`;
      v.classList.toggle('active', active);
      v.hidden = !active;
    });
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function showAdminPanel(name) {
    const titles = { dashboard: 'Dashboard', users: 'User Management', logs: 'Access Logs', door: 'Door Access' };
    qsa('.admin-panel').forEach((p) => {
      const active = p.id === `admin-panel-${name}`;
      p.classList.toggle('active', active);
      p.hidden = !active;
    });
    qsa('.nav-item[data-admin-view]').forEach((btn) => {
      const active = btn.dataset.adminView === name;
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    $('admin-title').textContent = titles[name] || 'Dashboard';
    closeSidebar();
  }

  function openSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = $('sidebar-overlay');
    sidebar.classList.add('open');
    overlay.hidden = false;
    overlay.classList.add('active');
    $('mobile-menu-btn').setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = $('sidebar-overlay');
    if (!sidebar || !overlay) return;
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    overlay.hidden = true;
    const btn = $('mobile-menu-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function resetDemo() {
    state = seedState();
    editingUserId = null;
    clearFeedback();
    $('login-form').reset();
    $('add-user-form').reset();
    $('door-username').value = '';
    $('door-status-text').textContent = 'Masukkan username untuk membuka pintu.';
    $('door-status-idle').className = 'door-status-idle';
    renderAll();
    showView('login');
  }

  function clearFeedback() {
    ['login-error', 'guest-feedback', 'add-user-feedback', 'door-feedback', 'logs-feedback', 'hotspot-feedback'].forEach((id) => {
      const el = $(id);
      if (el) { el.textContent = ''; el.className = el.className.replace(/\b(success|error)\b/g, '').trim(); }
    });
  }

  function setFeedback(id, msg, type) {
    const el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('success', 'error');
    if (type) el.classList.add(type);
  }

  function currentLogs() {
    if (state.logFilter === '7d' || state.logFilter === '30d') return [];
    return state.logs;
  }

  function renderStats() {
    $('stat-users').textContent = String(state.users.length);
    $('stat-roles').textContent = String(new Set(state.users.map((u) => u.role)).size);
    $('stat-logs').textContent = String(state.logs.length);
    $('stat-hotspot').textContent = '0';
  }

  function statusPill(status) {
    const cls = status === 'Allowed' ? 'status-allowed' : 'status-denied';
    return `<span class="status-pill-sm ${cls}">${esc(status)}</span>`;
  }

  function renderDashboardLogs() {
    const recent = state.logs.slice(0, 5);
    $('recent-log-count').textContent = String(recent.length);
    $('dashboard-log-body').innerHTML = recent.map((l) => `
      <tr>
        <td>${esc(l.time)}</td>
        <td><span class="mono">${esc(l.username)}</span></td>
        <td><span class="method-pill">${esc(l.method)}</span></td>
        <td>${statusPill(l.status)}</td>
        <td>${esc(l.message)}</td>
      </tr>
    `).join('');
  }

  function renderLogs() {
    const logs = currentLogs();
    $('logs-entries-pill').textContent = `${logs.length} entries`;
    $('logs-table-body').innerHTML = logs.length ? logs.map((l) => `
      <tr>
        <td>${esc(l.time)}</td>
        <td><span class="mono">${esc(l.username)}</span></td>
        <td><span class="method-pill">${esc(l.method)}</span></td>
        <td>${statusPill(l.status)}</td>
        <td>${esc(l.message)}</td>
      </tr>
    `).join('') : `<tr><td colspan="5" class="empty-state-cell">Tidak ada log untuk filter ini. Data sintetis dapat di-reset.</td></tr>`;
  }

  function renderUsers() {
    $('users-table-body').innerHTML = state.users.map((u) => `
      <tr>
        <td>${esc(u.name)}</td>
        <td><span class="mono">${esc(u.username)}</span></td>
        <td><span class="role-pill">${esc(u.role)}</span></td>
        <td>${u.room ? esc(u.room) : '—'}</td>
        <td><span class="status-pill-sm status-active">${esc(u.status)}</span></td>
        <td class="action-cell">
          <button type="button" class="icon-btn icon-btn-edit" data-edit-user="${esc(u.id)}" aria-label="Edit ${esc(u.username)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="icon-btn icon-btn-delete" data-delete-user="${esc(u.id)}" aria-label="Hapus ${esc(u.username)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
  }

  function renderAll() {
    renderStats();
    renderDashboardLogs();
    renderLogs();
    renderUsers();
  }

  function addLog(entry) {
    state.logs.unshift(entry);
    renderStats();
    renderDashboardLogs();
    renderLogs();
  }

  function handleLogin(e) {
    e.preventDefault();
    clearFeedback();
    const username = $('login-username').value.trim();
    const password = $('login-password').value;
    const user = state.users.find((u) => u.username === username && u.password === password && u.status === 'Active');
    if (!user) {
      setFeedback('login-error', 'Username atau password tidak cocok dengan akun demo sintetis.', 'error');
      return;
    }
    state.currentUser = { username: user.username, role: user.role, name: user.name, room: user.room };
    if (user.role === 'guest') {
      $('guest-username').value = user.username;
      const gp = $('guest-password');
      if (gp) gp.value = 'demo-guest';
      setFeedback('guest-feedback', '', null);
      showView('guest');
      return;
    }
    if (user.role === 'owner') {
      showView('admin');
      showAdminPanel('dashboard');
      renderAll();
      return;
    }
    setFeedback('login-error', 'Peran ini tidak memiliki tampilan demo khusus. Gunakan akun owner atau guest.', 'error');
  }

  function handleLogout() {
    state.currentUser = null;
    closeSidebar();
    clearFeedback();
    $('login-form').reset();
    showView('login');
  }

  function handleGuestOpen() {
    clearFeedback();
    const user = state.currentUser;
    if (!user || user.role !== 'guest') {
      setFeedback('guest-feedback', 'Sesi demo tidak valid. Silakan login ulang.', 'error');
      return;
    }
    const room = user.room || 'C-105';
    addLog({
      time: fmtNow(),
      username: user.username,
      method: 'web',
      status: 'Allowed',
      message: `Pintu kamar ${room} dibuka (simulasi Guest Portal)`,
    });
    setFeedback('guest-feedback', `Simulasi berhasil: pintu kamar ${room} dibuka untuk ${user.username}.`, 'success');
  }

  function handleDoorOpen() {
    clearFeedback();
    const username = $('door-username').value.trim();
    const statusIdle = $('door-status-idle');
    const statusText = $('door-status-text');
    if (!username) {
      setFeedback('door-feedback', 'Masukkan username untuk simulasi akses pintu.', 'error');
      statusIdle.className = 'door-status-idle';
      statusText.textContent = 'Masukkan username untuk membuka pintu.';
      return;
    }
    const user = state.users.find((u) => u.username === username);
    const allowed = !!user && user.status === 'Active' && user.role !== 'guest';
    const message = allowed
      ? 'Pintu dibuka (lewat Dashboard)'
      : (!user || user.status !== 'Active')
        ? 'User tidak ditemukan atau tidak aktif'
        : "Role 'guest' tidak memiliki izin buka pintu";
    addLog({ time: fmtNow(), username, method: 'web', status: allowed ? 'Allowed' : 'Denied', message });
    if (allowed) {
      statusIdle.className = 'door-status-idle is-success';
      statusText.textContent = `Akses diizinkan untuk ${username}.`;
      setFeedback('door-feedback', 'Simulasi berhasil: pintu dibuka.', 'success');
    } else {
      statusIdle.className = 'door-status-idle is-denied';
      statusText.textContent = `Akses ditolak untuk ${username}.`;
      setFeedback('door-feedback', message, 'error');
    }
  }

  function handleAddOrUpdateUser(e) {
    e.preventDefault();
    clearFeedback();
    const name = $('new-name').value.trim();
    const username = $('new-username').value.trim();
    const password = $('new-password').value;
    const role = $('new-role').value;
    const room = $('new-room').value.trim();

    if (!name || !username || !role || (!editingUserId && password.length < 4)) {
      setFeedback('add-user-feedback', 'Lengkapi nama, username, role, dan password minimal 4 karakter.', 'error');
      return;
    }
    const exists = state.users.some((u) => u.username === username && u.id !== editingUserId);
    if (exists) {
      setFeedback('add-user-feedback', 'Username sudah digunakan di data sintetis ini.', 'error');
      return;
    }

    if (editingUserId) {
      const user = state.users.find((u) => u.id === editingUserId);
      if (!user) return;
      user.name = name;
      user.username = username;
      if (password) user.password = password;
      user.role = role;
      user.room = room;
      setFeedback('add-user-feedback', `User ${username} diperbarui (simulasi lokal).`, 'success');
      editingUserId = null;
      document.querySelector('.btn-add-user span').textContent = 'Tambah User';
    } else {
      state.users.push({
        id: `u${Date.now()}`,
        name,
        username,
        password,
        role,
        room,
        status: 'Active',
      });
      setFeedback('add-user-feedback', `User ${username} ditambahkan (simulasi lokal).`, 'success');
    }
    $('add-user-form').reset();
    renderAll();
  }

  function startEditUser(id) {
    const user = state.users.find((u) => u.id === id);
    if (!user) return;
    editingUserId = id;
    $('new-name').value = user.name;
    $('new-username').value = user.username;
    $('new-password').value = '';
    $('new-role').value = user.role;
    $('new-room').value = user.room || '';
    document.querySelector('.btn-add-user span').textContent = 'Simpan Perubahan';
    setFeedback('add-user-feedback', `Mode edit untuk ${user.username}. Kosongkan password jika tidak ingin mengubahnya.`, 'success');
    $('new-name').focus();
  }

  function deleteUser(id) {
    const user = state.users.find((u) => u.id === id);
    if (!user) return;
    if (user.username === 'owner') {
      setFeedback('add-user-feedback', 'Akun owner demo tidak dapat dihapus.', 'error');
      return;
    }
    state.users = state.users.filter((u) => u.id !== id);
    if (editingUserId === id) {
      editingUserId = null;
      $('add-user-form').reset();
      document.querySelector('.btn-add-user span').textContent = 'Tambah User';
    }
    setFeedback('add-user-feedback', `User ${user.username} dihapus dari data sintetis.`, 'success');
    renderAll();
  }

  function downloadSyntheticCsv() {
    const header = ['WAKTU', 'USERNAME', 'METHOD', 'STATUS', 'MESSAGE'];
    const rows = state.logs.map((l) => [l.time, l.username, l.method, l.status, l.message]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'doorlink-access-logs-synthetic.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handleLogAction(action) {
    if (action === 'export-csv') {
      downloadSyntheticCsv();
      setFeedback('logs-feedback', 'Ekspor CSV sintetis dibuat secara lokal (tanpa jaringan).', 'success');
      return;
    }
    if (action === 'export-excel') {
      downloadSyntheticCsv();
      setFeedback('logs-feedback', 'Simulasi ekspor Excel: file CSV sintetis lokal diunduh untuk demo.', 'success');
      return;
    }
    if (action === 'older-7d') {
      state.logFilter = '7d';
      renderLogs();
      setFeedback('logs-feedback', 'Filter simulasi: tidak ada log sintetis yang lebih lama dari 7 hari.', 'error');
      return;
    }
    if (action === 'older-30d') {
      state.logFilter = '30d';
      renderLogs();
      setFeedback('logs-feedback', 'Filter simulasi: tidak ada log sintetis yang lebih lama dari 30 hari.', 'error');
      return;
    }
  }

  function clearLogs() {
    state.logs = [];
    state.logFilter = 'all';
    setFeedback('logs-feedback', 'Semua log sintetis dibersihkan secara lokal.', 'success');
    renderAll();
  }

  function bindEvents() {
    $('login-form').addEventListener('submit', handleLogin);
    $('reset-demo-btn').addEventListener('click', resetDemo);

    qsa('.demo-fill').forEach((btn) => {
      btn.addEventListener('click', () => {
        $('login-username').value = btn.dataset.user || '';
        $('login-password').value = btn.dataset.pass || '';
        setFeedback('login-error', 'Kredensial demo sintetis terisi. Klik "Masuk ke DoorLink".', 'success');
        $('login-username').focus();
      });
    });

    $('open-hotspot-view').addEventListener('click', () => {
      clearFeedback();
      showView('hotspot');
    });
    $('hotspot-back-btn').addEventListener('click', () => {
      clearFeedback();
      showView('login');
    });
    $('hotspot-submit').addEventListener('click', () => {
      setFeedback('hotspot-feedback', 'Simulasi lokal: halaman hotspot ini hanya dokumentasi UI, tidak terhubung ke jaringan.', 'error');
    });

    qsa('[data-action="logout"]').forEach((btn) => btn.addEventListener('click', handleLogout));
    $('guest-open-btn').addEventListener('click', handleGuestOpen);
    $('door-open-btn').addEventListener('click', handleDoorOpen);

    document.addEventListener('click', (e) => {
      const adminNav = e.target.closest('[data-admin-view]');
      if (adminNav) {
        const view = adminNav.dataset.adminView;
        if (view) {
          clearFeedback();
          if (view === 'logs') state.logFilter = 'all';
          showAdminPanel(view);
          if (view === 'logs') renderLogs();
        }
      }

      const editBtn = e.target.closest('[data-edit-user]');
      if (editBtn) startEditUser(editBtn.dataset.editUser);

      const delBtn = e.target.closest('[data-delete-user]');
      if (delBtn) deleteUser(delBtn.dataset.deleteUser);

      const demoAction = e.target.closest('[data-demo-action]');
      if (demoAction) handleLogAction(demoAction.dataset.demoAction);
    });

    $('add-user-form').addEventListener('submit', handleAddOrUpdateUser);
    $('clear-logs-btn').addEventListener('click', clearLogs);

    $('mobile-menu-btn').addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar.classList.contains('open')) closeSidebar();
      else openSidebar();
    });
    $('sidebar-overlay').addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 860) closeSidebar();
    });
  }

  bindEvents();
  renderAll();
})();
