(() => {
  "use strict";

  const STORAGE_KEY = "wishnotes-demo-v2";
  const ORNAMENTS = [
    { value: "Bola", label: "Bola" },
    { value: "CandyCane", label: "Permen tongkat" },
    { value: "Kado", label: "Kado" },
    { value: "KaosKaki", label: "Kaus kaki" },
    { value: "Lolipop", label: "Lolipop" },
  ];

  const SEED = () => ({
    session: { loggedIn: true, user: { name: "Demo User", initials: "DU" } },
    boards: [
      {
        id: "b1",
        title: "Mading Kelas",
        description: "Catatan dan pengumuman untuk teman sekelas.",
        type: "bulletin",
        visibility: "private",
        owner: "Demo User",
        ownerInitials: "DU",
        messages: [
          {
            id: "m1",
            author: "Rani",
            body: "Jangan lupa bawa hasil praktikum untuk diskusi Jumat.",
            ts: Date.now() - 1000 * 60 * 12,
          },
        ],
      },
      {
        id: "b2",
        title: "Kotak Surat",
        description: "Satu tempat untuk pesan dari teman.",
        type: "mailbox",
        visibility: "private",
        owner: "Demo User",
        ownerInitials: "DU",
        messages: [
          {
            id: "m2",
            author: "Rani",
            body: "Terima kasih sudah bantu menyiapkan presentasi!",
            ts: Date.now() - 1000 * 60 * 11,
          },
        ],
      },
      {
        id: "b3",
        title: "Ucapan Natal",
        description: "Papan ucapan untuk teman dan keluarga.",
        type: "tree",
        visibility: "private",
        owner: "Demo User",
        ownerInitials: "DU",
        messages: [
          {
            id: "m3",
            author: "Rani",
            body: "Selamat Natal! Semoga liburannya menyenangkan.",
            ornament: "Bola",
            x: 50,
            y: 50,
            ts: Date.now() - 1000 * 60 * 10,
          },
        ],
      },
    ],
  });

  let state = loadState();
  let currentView = { name: "dashboard", boardId: null };
  let filter = "all";

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return SEED();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.boards) || !parsed.session || !parsed.session.user) return SEED();
      return parsed;
    } catch {
      return SEED();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* local demo only */
    }
  }

  function resetState() {
    state = SEED();
    saveState();
  }

  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function byId(id) {
    return state.boards.find((b) => b.id === id) || null;
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function typeLabel(type) {
    if (type === "bulletin") return "Mading";
    if (type === "mailbox") return "Kotak surat";
    if (type === "tree") return "Pohon Natal";
    return "Papan";
  }

  function typeIcon(type) {
    if (type === "bulletin") {
      return `<span class="type-icon pink" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3H5a2 2 0 0 0-2 2v14l4-4h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"/><path d="M7 7h6M7 11h4"/></svg></span>`;
    }
    if (type === "mailbox") {
      return `<span class="type-icon yellow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg></span>`;
    }
    return `<span class="type-icon yellow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.8 4 4.2.4-3.2 2.8.9 4.3L12 11.2 8.3 13.5l.9-4.3L6 6.4 10.2 6z"/><path d="M12 13v8M8 21h8"/></svg></span>`;
  }

  const main = document.getElementById("main");
  const topbar = document.getElementById("topbar");

  function setTopbar(mode) {
    if (mode === "board") {
      topbar.innerHTML = `
        <a class="brand" href="#" data-view="dashboard" aria-label="WishNotes beranda">
          <span class="brand-name" style="color:#7c5cbf;font-size:1.9rem;font-weight:800;letter-spacing:-0.02em">WishNotes</span>
        </a>
        <div class="topbar-right">
          <button class="btn-logout" type="button" data-action="logout">Keluar</button>
        </div>`;
      return;
    }
    topbar.innerHTML = `
      <a class="brand" href="#" data-view="dashboard" aria-label="Wishnotes beranda">
        <span class="brand-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M20 7h-2.2A2.9 2.9 0 0 0 18 6a3 3 0 0 0-5.2-2A3 3 0 0 0 7 4a3 3 0 0 0-.2 3H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Zm-8-3a1 1 0 0 1 1 1c0 .4-.1.7-.4 1H11V5a1 1 0 0 1 1-1ZM9 5a1 1 0 0 1 1-1 1 1 0 0 1 1 1v2H9.4A1.5 1.5 0 0 1 9 6V5Zm2 14H7v-8h4v8Zm6 0h-4v-8h4v8Zm2-10H5V9h14v0Z" fill="currentColor"/></svg>
        </span>
        <span class="brand-name">Wishnotes</span>
      </a>
      <div class="topbar-right">
        <a class="nav-link" href="#" data-view="dashboard">Jelajahi</a>
        <div class="user-menu">
          <span class="user-name">${esc(state.session.user.name)}</span>
          <span class="avatar avatar-sm avatar-red">${esc(state.session.user.initials)}</span>
          <span class="caret" aria-hidden="true">▾</span>
        </div>
      </div>`;
  }

  function syncHash(view) {
    const want = view.name === "board" && view.boardId ? "#board=" + encodeURIComponent(view.boardId) : "";
    if (location.hash !== want) {
      history.replaceState(null, "", want || location.pathname + location.search);
    }
  }

  function navigate(view) {
    currentView = view;
    syncHash(view);
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function render() {
    if (!state.session.loggedIn) {
      topbar.style.display = "none";
      renderLogin();
      return;
    }
    topbar.style.display = "";
    if (currentView.name === "board") {
      setTopbar("board");
      renderBoard(currentView.boardId);
    } else {
      setTopbar("dashboard");
      renderDashboard();
    }
  }

  function renderLogin() {
    main.innerHTML = `
      <div class="login-page">
        <div class="login-card" role="region" aria-label="Masuk ke demo Wishnotes">
          <div class="login-brand">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 7h-2.2A2.9 2.9 0 0 0 18 6a3 3 0 0 0-5.2-2A3 3 0 0 0 7 4a3 3 0 0 0-.2 3H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Zm-8-3a1 1 0 0 1 1 1c0 .4-.1.7-.4 1H11V5a1 1 0 0 1 1-1ZM9 5a1 1 0 0 1 1-1 1 1 0 0 1 1 1v2H9.4A1.5 1.5 0 0 1 9 6V5Zm2 14H7v-8h4v8Zm6 0h-4v-8h4v8Zm2-10H5V9h14v0Z" fill="currentColor"/></svg>
            <span>Wishnotes</span>
          </div>
          <p class="login-tagline">Kirim doa &amp; harapanmu di sini!</p>
          <div class="login-form">
            <p class="login-demo-note"><strong>Demo portofolio:</strong> simulasi lokal tanpa akun nyata, tanpa kredensial, dan tanpa jaringan. Data disimpan hanya di browser ini.</p>
            <button class="btn-gradient" type="button" id="login-demo">Masuk ke demo</button>
          </div>
        </div>
      </div>`;

    document.getElementById("login-demo").addEventListener("click", () => {
      state.session.loggedIn = true;
      saveState();
      navigate({ name: "dashboard" });
    });
  }

  function getFilteredBoards() {
    if (filter === "mine") return state.boards.filter((b) => b.owner === state.session.user.name);
    if (filter === "friends") return state.boards.filter((b) => b.owner !== state.session.user.name);
    return state.boards;
  }

  function renderDashboard() {
    const boards = getFilteredBoards();
    const cardsHtml = boards.length
      ? boards.map((b) => boardCardHtml(b)).join("")
      : `<div class="empty-state empty-state-grid">Belum ada papan di filter ini. Coba filter lain atau buat papan baru.</div>`;

    main.innerHTML = `
      <div class="page">
        <section class="hero-banner" aria-labelledby="hero-title">
          <div class="hero-copy">
            <h1 id="hero-title">Selamat Datang, ${esc(state.session.user.name)}</h1>
            <p>Buat wadah harapanmu atau sampaikan doa untuk temanmu.</p>
            <div class="hero-actions">
              <button class="btn-glass" type="button" id="btn-create-board">
                <span aria-hidden="true">+</span> Buat Wishnote Baru
              </button>
            </div>
          </div>
          <div class="hero-art" aria-hidden="true">
            ${heroTreeSvg()}
            ${heroDocSvg()}
          </div>
        </section>

        <div class="filter-tabs" role="tablist" aria-label="Filter papan">
          <button class="filter-tab ${filter === "all" ? "active" : ""}" role="tab" aria-selected="${filter === "all"}" data-filter="all" type="button">Semua</button>
          <button class="filter-tab ${filter === "mine" ? "active" : ""}" role="tab" aria-selected="${filter === "mine"}" data-filter="mine" type="button">Milik Saya</button>
          <button class="filter-tab ${filter === "friends" ? "active" : ""}" role="tab" aria-selected="${filter === "friends"}" data-filter="friends" type="button">Teman</button>
        </div>

        <section aria-label="Daftar papan">
          <div class="boards-grid" id="boards-grid">${cardsHtml}</div>
        </section>
      </div>

      <div class="modal-overlay" id="create-modal" aria-hidden="true">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
          <h2 id="create-title">Buat Wishnote Baru</h2>
          <p class="modal-sub">Papan baru akan tersimpan lokal di browser ini (data sintetis).</p>
          <form id="create-form" novalidate>
            <div class="field">
              <label for="new-title">Judul papan</label>
              <input id="new-title" type="text" maxlength="60" placeholder="Contoh: Ucapan Wisuda" required>
            </div>
            <div class="field">
              <label for="new-desc">Deskripsi</label>
              <input id="new-desc" type="text" maxlength="120" placeholder="Deskripsi singkat papan">
            </div>
            <div class="field">
              <label>Tipe papan</label>
              <div class="radio-row">
                <label class="radio-chip"><input type="radio" name="new-type" value="bulletin" checked><span>Mading</span></label>
                <label class="radio-chip"><input type="radio" name="new-type" value="mailbox"><span>Kotak surat</span></label>
                <label class="radio-chip"><input type="radio" name="new-type" value="tree"><span>Pohon Natal</span></label>
              </div>
            </div>
            <div class="field">
              <label>Visibilitas</label>
              <div class="radio-row">
                <label class="radio-chip"><input type="radio" name="new-vis" value="public" checked><span>Public</span></label>
                <label class="radio-chip"><input type="radio" name="new-vis" value="private"><span>Private</span></label>
              </div>
            </div>
            <div class="form-status" id="create-status" aria-live="polite"></div>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" id="create-cancel">Batal</button>
              <button type="submit" class="btn-primary">Buat papan</button>
            </div>
          </form>
        </div>
      </div>`;

    bindDashboardEvents();
  }

  function boardCardHtml(b) {
    const visClass = b.visibility === "private" ? "pill-private" : "pill-public";
    const visLabel = b.visibility === "private" ? "Private" : "Public";
    return `
      <article class="board-card" data-board-id="${esc(b.id)}">
        <div class="board-card-top">
          <button class="badge-delete" type="button" data-action="delete-board" data-id="${esc(b.id)}">Hapus</button>
          ${typeIcon(b.type)}
        </div>
        <h3>${esc(b.title)}</h3>
        <p class="board-desc">${esc(b.description)}</p>
        <div class="board-id">ID: ${esc(b.id.startsWith("b") && /^b\d+$/.test(b.id) ? b.id.slice(1) : b.id.replace(/^b-/, "").slice(0, 4).toUpperCase())}</div>
        <div class="board-meta">
          <span class="pill ${visClass}">${visLabel}</span>
          <span class="msg-count" aria-label="${b.messages.length} pesan">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>
            ${b.messages.length} Pesan
          </span>
        </div>
        <div class="board-card-divider"></div>
        <div class="board-card-footer">
          <span class="board-author">
            <span class="avatar avatar-blue" aria-hidden="true">${esc(b.ownerInitials || "DU")}</span>
            <span>by ${esc(b.owner)}</span>
          </span>
          <button class="btn-open" type="button" data-action="open-board" data-id="${esc(b.id)}">Buka</button>
        </div>
      </article>`;
  }

  function heroTreeSvg() {
    return `<svg class="art-tree" viewBox="0 0 120 140" fill="none" aria-hidden="true">
      <polygon points="60,8 66,22 80,22 69,30 73,44 60,36 47,44 51,30 40,22 54,22" fill="#F4C542" stroke="#D4A012" stroke-width="1.5"/>
      <path d="M60 30 L85 55 L75 55 L95 78 L82 78 L100 102 L20 102 L38 78 L25 78 L45 55 L35 55 Z" fill="#5BA85A" stroke="#3D8040" stroke-width="2" stroke-linejoin="round"/>
      <path d="M60 30 L75 55 L68 55 L82 78 L74 78 L88 102 L60 102 Z" fill="#4E9B50" opacity="0.3"/>
      <rect x="52" y="102" width="16" height="20" rx="2" fill="#8B5E3C" stroke="#6D4628" stroke-width="1.5"/>
      <circle cx="52" cy="58" r="4" fill="#F06B8A"/><circle cx="70" cy="70" r="4" fill="#6EC0E6"/><circle cx="48" cy="82" r="4" fill="#B07CE0"/><circle cx="74" cy="90" r="4" fill="#F4C542"/><circle cx="58" cy="94" r="3.5" fill="#F06B8A"/>
    </svg>`;
  }

  function heroDocSvg() {
    return `<svg class="art-doc" viewBox="0 0 90 110" fill="none" aria-hidden="true">
      <rect x="10" y="8" width="62" height="82" rx="8" fill="#FFF" stroke="#D8CCE8" stroke-width="2"/>
      <rect x="22" y="28" width="38" height="4" rx="2" fill="#D9CEE8"/>
      <rect x="22" y="40" width="38" height="4" rx="2" fill="#E6DCF0"/>
      <rect x="22" y="52" width="28" height="4" rx="2" fill="#E6DCF0"/>
      <path d="M56 62 L78 84 L72 90 L50 68 L48 58 Z" fill="#F4C542" stroke="#D4A012" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M48 58 L50 68 L56 62 Z" fill="#FDE8A8"/>
      <rect x="70" y="82" width="10" height="5" rx="1" transform="rotate(45 75 84)" fill="#E8A0B8"/>
    </svg>`;
  }

  function bindDashboardEvents() {
    document.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filter = btn.getAttribute("data-filter");
        renderDashboard();
      });
    });

    document.getElementById("btn-create-board").addEventListener("click", openCreateModal);
    document.getElementById("create-cancel").addEventListener("click", closeCreateModal);
    document.getElementById("create-modal").addEventListener("click", (e) => {
      if (e.target.id === "create-modal") closeCreateModal();
    });
    document.getElementById("create-form").addEventListener("submit", onCreateBoard);

    document.getElementById("boards-grid").addEventListener("click", (e) => {
      const del = e.target.closest("[data-action='delete-board']");
      if (del) {
        const id = del.getAttribute("data-id");
        const board = byId(id);
        if (!board) return;
        if (window.confirm(`Hapus papan "${board.title}"? Tindakan ini hanya menghapus data demo lokal.`)) {
          state.boards = state.boards.filter((b) => b.id !== id);
          saveState();
          renderDashboard();
        }
        return;
      }
      const open = e.target.closest("[data-action='open-board']");
      if (open) {
        navigate({ name: "board", boardId: open.getAttribute("data-id") });
        return;
      }
      const card = e.target.closest(".board-card[data-board-id]");
      if (card && !e.target.closest("button")) {
        navigate({ name: "board", boardId: card.getAttribute("data-board-id") });
      }
    });
  }

  function openCreateModal() {
    const modal = document.getElementById("create-modal");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("new-title").focus();
  }

  function closeCreateModal() {
    const modal = document.getElementById("create-modal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function onCreateBoard(e) {
    e.preventDefault();
    const title = document.getElementById("new-title").value.trim();
    const desc = document.getElementById("new-desc").value.trim();
    const type = (document.querySelector("input[name='new-type']:checked") || {}).value || "bulletin";
    const vis = (document.querySelector("input[name='new-vis']:checked") || {}).value || "public";
    const status = document.getElementById("create-status");
    if (!title) {
      status.textContent = "Judul papan wajib diisi.";
      status.className = "form-status visible error";
      return;
    }
    const board = {
      id: uid("b"),
      title,
      description: desc || "Papan baru untuk demo portofolio.",
      type,
      visibility: vis,
      owner: state.session.user.name,
      ownerInitials: state.session.user.initials,
      messages: [],
    };
    state.boards.unshift(board);
    saveState();
    closeCreateModal();
    navigate({ name: "board", boardId: board.id });
  }

  function renderBoard(boardId) {
    const board = byId(boardId);
    if (!board) {
      main.innerHTML = `
        <div class="page page-narrow">
          <div class="empty-state empty-state-plain">
            Papan tidak ditemukan. <a href="#" data-view="dashboard">Kembali ke dashboard</a>
          </div>
        </div>`;
      return;
    }

    const shareBlock = board.visibility === "public"
      ? `
        <label class="share-link-field">Tautan untuk dibagikan
          <input type="text" readonly value="${esc(location.origin + location.pathname + "#board=" + board.id)}" onclick="this.select()" aria-label="Tautan papan">
        </label>`
      : `<p class="hero-privacy">Privat · hanya pemilik yang dapat membuka papan ini.</p>`;

    const hero = `
      <section class="board-hero" aria-labelledby="board-title">
        <h1 id="board-title">${esc(board.title)}</h1>
        <p class="hero-sub">${esc(board.description)}</p>
        ${shareBlock}
      </section>`;

    const deleteBlock = `
      <details class="delete-disclosure">
        <summary>Hapus papan</summary>
        <div class="delete-body">
          <p>Papan dan semua pesannya akan dihapus dari demo lokal browser ini.</p>
          <button type="button" class="btn-danger" data-action="delete-current-board" data-id="${esc(board.id)}">Hapus papan dan pesan</button>
        </div>
      </details>`;

    let content = "";
    if (board.type === "tree") {
      content = renderTreeBoard(board);
    } else if (board.type === "mailbox") {
      content = renderMailboxBoard(board);
    } else {
      content = renderBulletinBoard(board);
    }

    main.innerHTML = `
      <div class="page page-narrow">
        <div class="back-row">
          <a href="#" class="btn-back" data-view="dashboard">← Kembali ke dashboard</a>
          <button type="button" class="btn-secondary btn-reset-inline" data-action="reset-demo">Reset data demo</button>
        </div>
        ${hero}
        ${content}
        ${deleteBlock}
      </div>`;

    bindBoardEvents(board);
  }

  function renderBulletinBoard(board) {
    const msgs = board.messages.slice().sort((a, b) => a.ts - b.ts);
    const list = msgs.length
      ? msgs.map((m) => `
          <article class="message-card">
            <p class="msg-author">${esc(m.author || "Anonim")}</p>
            <p class="msg-body">${esc(m.body)}</p>
          </article>`).join("")
      : `<div class="empty-state">Belum ada pesan. Jadilah yang pertama menulis di mading ini.</div>`;

    return `
      <div class="detail-grid">
        <section class="board-surface" aria-labelledby="mading-title">
          <div class="board-surface-header"><h2 id="mading-title">Mading</h2></div>
          <div class="message-list" id="message-list">${list}</div>
        </section>
        ${composeFormHtml(board, "Tulis pesan")}
      </div>`;
  }

  function renderMailboxBoard(board) {
    const msgs = board.messages.slice().sort((a, b) => a.ts - b.ts);
    const list = msgs.length
      ? msgs.map((m) => `
          <article class="message-card">
            <p class="msg-author">${esc(m.author || "Anonim")}</p>
            <p class="msg-body">${esc(m.body)}</p>
          </article>`).join("")
      : `<div class="empty-state">Kotak surat masih kosong. Kirim pesan pertama.</div>`;

    return `
      <div class="detail-grid">
        <section class="mailbox-surface" aria-labelledby="mailbox-title">
          <div class="board-surface-header"><h2 id="mailbox-title">Kotak surat</h2></div>
          <div class="message-list" id="message-list">${list}</div>
        </section>
        ${composeFormHtml(board, "Tulis pesan")}
      </div>`;
  }

  function composeFormHtml(board, heading) {
    return `
      <section class="panel compose-panel" aria-labelledby="compose-title">
        <div class="panel-header"><h2 id="compose-title">${esc(heading)}</h2></div>
        <div class="panel-body">
          <form id="compose-form" data-board-id="${esc(board.id)}" novalidate>
            <div class="field">
              <label for="msg-name">Nama (opsional)</label>
              <input id="msg-name" type="text" maxlength="60" autocomplete="off">
            </div>
            <div class="field">
              <label for="msg-body">Pesan</label>
              <textarea id="msg-body" maxlength="1000" required></textarea>
            </div>
            <button type="submit" class="btn-primary">Kirim pesan</button>
            <div class="form-status" id="compose-status" aria-live="polite"></div>
          </form>
        </div>
      </section>`;
  }

  function normalizeOrnament(value) {
    const allowed = ORNAMENTS.map((o) => o.value);
    return allowed.includes(value) ? value : "Bola";
  }

  function renderTreeBoard(board) {
    const msgs = board.messages.slice().sort((a, b) => a.ts - b.ts);
    const ornamentsHtml = msgs.map((m, i) => ornamentHtml(m, i + 1)).join("");
    const list = msgs.length
      ? msgs.map((m) => `
          <article class="message-card" id="message-${esc(m.id)}">
            <p class="msg-author">${esc(m.author || "Anonim")}</p>
            <p class="msg-body">${esc(m.body)}</p>
          </article>`).join("")
      : `<div class="empty-state">Belum ada ucapan di pohon ini. Tambahkan pesan pertama.</div>`;

    const options = ORNAMENTS.map((o) => `<option value="${o.value}"${o.value === "Bola" ? " selected" : ""}>${esc(o.label)}</option>`).join("");

    return `
      <div class="detail-grid">
        <section class="tree-surface" aria-labelledby="tree-title">
          <div class="tree-surface-header"><h2 id="tree-title">Pohon Natal</h2></div>
          <div class="tree-canvas-wrap clickable" id="tree-canvas" aria-label="Pohon Natal. Klik untuk memilih posisi ornamen.">
            <img src="./images/pohonNatal/pohonNatalTerang.png" alt="Pohon Natal" class="tree-img">
            <div class="ornaments-layer" id="ornaments-layer">${ornamentsHtml}</div>
          </div>
          <div class="message-list" id="message-list" aria-label="Pesan di papan ini">${list}</div>
        </section>

        <section class="panel compose-panel" aria-labelledby="compose-title">
          <div class="panel-header"><h2 id="compose-title">Tulis pesan</h2></div>
          <div class="panel-body">
            <form id="compose-form" data-board-id="${esc(board.id)}" novalidate>
              <div class="field">
                <label for="msg-name">Nama (opsional)</label>
                <input id="msg-name" type="text" maxlength="60" autocomplete="off">
              </div>
              <div class="field">
                <label for="msg-body">Pesan</label>
                <textarea id="msg-body" maxlength="1000" required></textarea>
              </div>
              <div class="field">
                <label for="msg-ornament">Ornamen</label>
                <select id="msg-ornament">${options}</select>
              </div>
              <p class="field-hint" id="coord-hint">Klik pohon untuk memilih posisi atau masukkan koordinat (0–100%).</p>
              <div class="coord-row">
                <div class="field">
                  <label for="msg-x">Horizontal</label>
                  <input id="msg-x" type="number" min="0" max="100" step="0.01" value="50" inputmode="decimal">
                </div>
                <div class="field">
                  <label for="msg-y">Vertikal</label>
                  <input id="msg-y" type="number" min="0" max="100" step="0.01" value="50" inputmode="decimal">
                </div>
              </div>
              <button type="submit" class="btn-primary">Kirim pesan</button>
              <div class="form-status" id="compose-status" aria-live="polite"></div>
            </form>
          </div>
        </section>
      </div>`;
  }

  function ornamentHtml(m, index) {
    const ornament = normalizeOrnament(m.ornament);
    const x = clampNum(m.x, 0, 100, 50);
    const y = clampNum(m.y, 0, 100, 50);
    const label = "Baca pesan " + index;
    const body = String(m.body || "");
    const author = String(m.author || "Anonim");
    return `<a href="#message-${esc(m.id)}" class="ornament ornament-img" style="left:${x}%;top:${y}%;" aria-label="${esc(label)}" title="${esc(author + ": " + body)}">
      <img src="./images/pohonNatal/ornamen${ornament}.png" alt="">
    </a>`;
  }

  function clampNum(v, min, max, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function bindBoardEvents(board) {
    const form = document.getElementById("compose-form");
    if (form) {
      form.addEventListener("submit", (e) => onCompose(e, board.id));
    }

    const treeCanvas = document.getElementById("tree-canvas");
    if (treeCanvas) {
      treeCanvas.addEventListener("click", (e) => {
        if (e.target.closest(".ornament")) return;
        const rect = treeCanvas.getBoundingClientRect();
        const x = clampNum(((e.clientX - rect.left) / rect.width) * 100, 0, 100, 50);
        const y = clampNum(((e.clientY - rect.top) / rect.height) * 100, 0, 100, 50);
        const xStr = Number(x.toFixed(2)).toString();
        const yStr = Number(y.toFixed(2)).toString();
        const xInput = document.getElementById("msg-x");
        const yInput = document.getElementById("msg-y");
        if (xInput) xInput.value = xStr;
        if (yInput) yInput.value = yStr;
        showStatus("compose-status", `Posisi dipilih: ${xStr}% horizontal, ${yStr}% vertikal.`, "success");
      });
    }

    document.querySelectorAll("[data-action='delete-current-board']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const b = byId(id);
        if (!b) return;
        if (window.confirm(`Hapus papan "${b.title}"? Semua pesan di papan ini akan hilang dari demo lokal.`)) {
          state.boards = state.boards.filter((x) => x.id !== id);
          saveState();
          navigate({ name: "dashboard" });
        }
      });
    });

    document.querySelectorAll("[data-action='reset-demo']").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (window.confirm("Reset semua data demo ke kondisi awal?")) {
          resetState();
          navigate({ name: "dashboard" });
        }
      });
    });
  }

  function showStatus(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = `form-status visible ${type}`;
  }

  function onCompose(e, boardId) {
    e.preventDefault();
    const board = byId(boardId);
    if (!board) return;

    const nameInput = document.getElementById("msg-name");
    const bodyInput = document.getElementById("msg-body");
    const author = (nameInput ? nameInput.value : "").trim() || "Anonim";
    const body = (bodyInput ? bodyInput.value : "").trim();

    if (!body) {
      showStatus("compose-status", "Pesan tidak boleh kosong.", "error");
      if (bodyInput) bodyInput.focus();
      return;
    }

    const message = {
      id: uid("m"),
      author,
      body,
      ts: Date.now(),
    };

    if (board.type === "tree") {
      const ornament = normalizeOrnament((document.getElementById("msg-ornament") || {}).value);
      const x = clampNum((document.getElementById("msg-x") || {}).value, 0, 100, 50);
      const y = clampNum((document.getElementById("msg-y") || {}).value, 0, 100, 50);
      message.ornament = ornament;
      message.x = x;
      message.y = y;
    }

    board.messages.push(message);
    saveState();
    renderBoard(boardId);

    // after re-render, show success and scroll to message list
    showStatus("compose-status", "Pesan berhasil ditambahkan ke papan.", "success");
    const list = document.getElementById("message-list");
    if (list) {
      const last = list.lastElementChild;
      if (last) last.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  // Global navigation
  document.addEventListener("click", (e) => {
    const logout = e.target.closest("[data-action='logout']");
    if (logout) {
      e.preventDefault();
      state.session.loggedIn = false;
      saveState();
      navigate({ name: "dashboard" });
      return;
    }

    const viewLink = e.target.closest("[data-view]");
    if (viewLink) {
      const view = viewLink.getAttribute("data-view");
      if (view === "dashboard") {
        e.preventDefault();
        navigate({ name: "dashboard" });
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCreateModal();
  });

  // Global reset (static banner button)
  const resetGlobal = document.getElementById("reset-demo-global");
  if (resetGlobal) {
    resetGlobal.addEventListener("click", () => {
      if (window.confirm("Reset semua data demo ke kondisi awal?")) {
        resetState();
        filter = "all";
        navigate({ name: "dashboard" });
      }
    });
  }

  // Init
  const hashMatch = location.hash.match(/^#board=(.+)$/);
  if (hashMatch) {
    const boardId = decodeURIComponent(hashMatch[1]);
    if (byId(boardId)) {
      currentView = { name: "board", boardId };
    }
  }
  window.addEventListener("hashchange", () => {
    const m = location.hash.match(/^#board=(.+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (id !== currentView.boardId || currentView.name !== "board") navigate({ name: "board", boardId: id });
      return;
    }
    if (currentView.name !== "dashboard") navigate({ name: "dashboard" });
  });
  render();
})();
