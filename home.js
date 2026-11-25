(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function whenVisible(element, onChange, rootMargin = "0px") {
    if (!("IntersectionObserver" in window)) {
      onChange(true);
      return;
    }
    new IntersectionObserver((entries) => onChange(entries[0].isIntersecting), { rootMargin }).observe(element);
  }

  function startShowcase() {
    const showcase = document.querySelector("[data-showcase]");
    if (!showcase) return;
    const tabs = [...showcase.querySelectorAll('[role="tab"]')];
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));
    const interval = 7000;
    let index = 0;
    let timer = 0;
    let autoplay = !reduceMotion.matches;
    let onScreen = false;
    let hovered = false;

    showcase.style.setProperty("--showcase-interval", `${interval}ms`);

    const select = (next, focus) => {
      index = (next + tabs.length) % tabs.length;
      tabs.forEach((tab, i) => {
        const active = i === index;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
      });
      if (focus) tabs[index].focus();
      restartProgress();
    };

    const restartProgress = () => {
      const bar = tabs[index].querySelector(".project-tab-progress");
      bar.style.animation = "none";
      void bar.offsetWidth;
      bar.style.animation = "";
      schedule();
    };

    const running = () => autoplay && onScreen && !hovered && !document.hidden;

    const schedule = () => {
      clearTimeout(timer);
      showcase.classList.toggle("is-autoplay", autoplay);
      showcase.classList.toggle("is-paused", !running());
      if (running()) timer = setTimeout(() => select(index + 1, false), interval);
    };

    const stopAutoplay = () => {
      autoplay = false;
      schedule();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => {
        stopAutoplay();
        select(i, false);
      });
      tab.addEventListener("keydown", (event) => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        let target = null;
        if (event.key in keys) target = index + keys[event.key];
        else if (event.key === "Home") target = 0;
        else if (event.key === "End") target = tabs.length - 1;
        if (target === null) return;
        event.preventDefault();
        stopAutoplay();
        select(target, true);
      });
    });

    showcase.addEventListener("pointerenter", () => {
      hovered = true;
      schedule();
    });
    showcase.addEventListener("pointerleave", () => {
      hovered = false;
      restartProgress();
    });
    showcase.addEventListener("focusin", stopAutoplay);
    document.addEventListener("visibilitychange", restartProgress);
    whenVisible(showcase, (isVisible) => {
      onScreen = isVisible;
      restartProgress();
    }, "-20% 0px");

    select(0, false);
  }

  const NETWORK = {
    hub: { id: "owner", name: "Akhdan (me)", initials: "MA", tone: "var(--lilac)" },
    agents: [
      { id: "tracker", name: "Tracker", avatar: "tracker", tone: "var(--sky)" },
      { id: "worker", name: "Worker", avatar: "worker", tone: "var(--amber)" },
      { id: "researcher", name: "Researcher", avatar: "researcher", tone: "var(--lilac)" },
      { id: "trading", name: "Trading", avatar: "trading", tone: "var(--mint)" },
      { id: "dex", name: "DEX", avatar: "dex", tone: "var(--sky)" },
      { id: "campaign", name: "Campaign", avatar: "campaign", tone: "var(--coral)" },
      { id: "affiliate", name: "Affiliate", avatar: "affiliate", tone: "var(--amber)" },
      { id: "internship", name: "InternshipAgent", avatar: "internship", tone: "var(--lilac)" },
    ],
    script: [
      { from: "owner", to: "*", text: "Morning. Run today’s checks." },
      { from: "tracker", to: "owner", text: "Health check: every service is up." },
      { from: "researcher", to: "trading", text: "Scan sent: 10 Spot, 10 Futures, 10 DEX candidates." },
      { from: "trading", to: "tracker", text: "Reviewed. Still at most 3 entries today." },
      { from: "campaign", to: "tracker", text: "Video rendered. Waiting for audit." },
      { from: "tracker", to: "campaign", text: "Audit passed. Upload approved." },
      { from: "worker", to: "owner", text: "Coding job done. Ready for your review." },
      { from: "owner", to: "worker", text: "Approved. Deploy with a backup." },
      { from: "internship", to: "owner", text: "New listings sent to Telegram." },
    ],
  };

  function startNetwork() {
    const root = document.querySelector("[data-network] .network");
    if (!root) return;
    const stage = root.querySelector(".network-stage");
    const svg = root.querySelector(".network-links");
    const layer = root.querySelector(".network-nodes");
    const svgNS = "http://www.w3.org/2000/svg";
    const nodes = new Map();
    const links = new Map();

    const makeNode = (agent, i, isHub) => {
      const node = document.createElement("div");
      node.className = `network-node${isHub ? " is-hub" : ""}`;
      node.style.setProperty("--i", String(i));
      node.style.setProperty("--tone", agent.tone);
      const face = agent.avatar
        ? `<img src="assets/agents/${agent.avatar}.webp" width="64" height="64" alt="" loading="lazy" decoding="async">`
        : `<span>${agent.initials}</span>`;
      node.innerHTML = `<span class="network-bubble"></span><span class="network-avatar">${face}</span><span class="network-label">${agent.name}</span>`;
      layer.append(node);
      nodes.set(agent.id, { element: node, bubble: node.querySelector(".network-bubble"), x: 0, y: 0 });
    };

    makeNode(NETWORK.hub, 0, true);
    NETWORK.agents.forEach((agent, i) => {
      makeNode(agent, i + 1, false);
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("class", "network-link");
      svg.append(path);
      links.set(agent.id, path);
    });

    const layout = () => {
      const { width, height } = stage.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      const compact = width < 640;
      const cx = width / 2;
      const cy = height * (compact ? 0.5 : 0.52);
      const rx = width * (compact ? 0.38 : 0.37);
      const ry = height * (compact ? 0.4 : 0.36);
      const hub = nodes.get(NETWORK.hub.id);
      hub.x = cx;
      hub.y = cy;
      NETWORK.agents.forEach((agent, i) => {
        const angle = -Math.PI / 2 + (i + (compact ? 0 : 0.5)) * ((Math.PI * 2) / NETWORK.agents.length);
        const node = nodes.get(agent.id);
        node.x = cx + Math.cos(angle) * rx;
        node.y = cy + Math.sin(angle) * ry;
        const bend = 0.18;
        const mx = (cx + node.x) / 2 - (node.y - cy) * bend;
        const my = (cy + node.y) / 2 + (node.x - cx) * bend;
        links.get(agent.id).setAttribute("d", `M${cx} ${cy}Q${mx} ${my} ${node.x} ${node.y}`);
      });
      for (const node of nodes.values()) {
        node.element.style.left = `${node.x}px`;
        node.element.style.top = `${node.y}px`;
        const side = node.x < width * 0.3 ? "left" : node.x > width * 0.7 ? "right" : "center";
        node.bubble.style.left = side === "left" ? "-24px" : side === "right" ? "auto" : "50%";
        node.bubble.style.right = side === "right" ? "-24px" : "auto";
        node.bubble.style.translate = side === "center" ? "0" : "50%";
      }
    };
    new ResizeObserver(layout).observe(stage);
    layout();

    const travel = (fromId, toId, tone) => {
      if (reduceMotion.matches) return;
      const legs = fromId === NETWORK.hub.id ? [[toId, false]] : toId === NETWORK.hub.id ? [[fromId, true]] : [[fromId, true], [toId, false]];
      let delay = 0;
      for (const [agentId, inbound] of legs) {
        const path = links.get(agentId);
        const length = path.getTotalLength();
        const dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("class", "network-packet");
        dot.setAttribute("r", "4");
        dot.style.setProperty("--tone", tone);
        dot.style.opacity = "0";
        svg.append(dot);
        const duration = 900;
        const begin = performance.now() + delay;
        const step = (now) => {
          const t = Math.min(1, Math.max(0, (now - begin) / duration));
          const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          const point = path.getPointAtLength(length * (inbound ? 1 - eased : eased));
          dot.setAttribute("cx", String(point.x));
          dot.setAttribute("cy", String(point.y));
          dot.style.opacity = now < begin ? "0" : String(1 - Math.max(0, t - 0.85) / 0.15);
          if (t < 1) requestAnimationFrame(step);
          else dot.remove();
        };
        requestAnimationFrame(step);
        delay += duration;
      }
    };

    let step = 0;
    let timer = 0;
    let playing = false;
    const toneOf = (id) => (id === NETWORK.hub.id ? NETWORK.hub : NETWORK.agents.find((agent) => agent.id === id)).tone;

    const say = () => {
      const line = NETWORK.script[step % NETWORK.script.length];
      for (const node of nodes.values()) node.element.classList.remove("is-speaking");
      const speaker = nodes.get(line.from);
      speaker.bubble.textContent = line.text;
      speaker.element.classList.add("is-speaking");
      const targets = line.to === "*" ? NETWORK.agents.map((agent) => agent.id) : [line.to];
      for (const target of targets) travel(line.from, target, toneOf(line.from));
      step += 1;
      timer = setTimeout(say, 2800);
    };

    const setPlaying = (next) => {
      if (next === playing) return;
      playing = next;
      root.classList.toggle("is-playing", next || root.classList.contains("is-playing"));
      clearTimeout(timer);
      if (next && !reduceMotion.matches) timer = setTimeout(say, 700);
    };

    if (reduceMotion.matches) root.classList.add("is-playing");
    whenVisible(root, (isVisible) => setPlaying(isVisible && !document.hidden), "-15% 0px");
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) setPlaying(false);
    });
  }

  function startAgentLog() {
    const list = document.querySelector("[data-log]");
    if (!list) return;
    const lines = [...list.children];
    if (reduceMotion.matches) {
      for (const line of lines) line.classList.add("is-shown");
      return;
    }
    let shown = 0;
    let timer = 0;
    const tick = () => {
      if (shown === lines.length) {
        for (const line of lines) line.classList.remove("is-shown");
        shown = 0;
        timer = setTimeout(tick, 700);
        return;
      }
      lines[shown].classList.add("is-shown");
      shown += 1;
      timer = setTimeout(tick, shown === lines.length ? 3600 : 1300);
    };
    whenVisible(list, (isVisible) => {
      clearTimeout(timer);
      if (isVisible) timer = setTimeout(tick, 400);
    });
  }

  function startMarquee() {
    for (const row of document.querySelectorAll(".tool-row")) {
      row.append(...[...row.children].map((chip) => chip.cloneNode(true)));
    }
  }

  function startStackProgress() {
    const section = document.querySelector("[data-stack]");
    if (!section || !("IntersectionObserver" in window)) return;
    const cards = [...section.querySelectorAll(".stack-card")];
    const steps = [...section.querySelectorAll(".stack-progress li")];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const active = cards.indexOf(entry.target);
          steps.forEach((item, i) => item.setAttribute("data-active", String(i === active)));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const card of cards) observer.observe(card);
  }

  startShowcase();
  startNetwork();
  startAgentLog();
  startMarquee();
  startStackProgress();
})();
