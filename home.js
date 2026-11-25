(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function whenVisible(element, onChange, rootMargin = "0px") {
    if (!("IntersectionObserver" in window)) {
      onChange(true);
      return;
    }
    new IntersectionObserver((entries) => onChange(entries[0].isIntersecting), { rootMargin }).observe(element);
  }

  const BEAM_SHADER = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uBeamX;
uniform float uHorizon;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;
  float aspect = uRes.x / uRes.y;
  float dx = (uv.x - uBeamX) * aspect;
  float above = smoothstep(uHorizon + 0.015, uHorizon - 0.01, uv.y);
  float depth = smoothstep(0.0, uHorizon, uv.y);

  float flow = fbm(vec2(dx * 3.0, uv.y * 2.2 - uTime * 0.22));
  float core = exp(-pow(dx * mix(110.0, 38.0, depth), 2.0)) * (0.45 + 0.55 * depth);
  float halo = exp(-abs(dx) * (16.0 - 6.0 * flow)) * (0.25 + 0.75 * depth * depth) + exp(-abs(dx) * 4.0) * 0.07 * depth;
  float wisps = smoothstep(0.45, 0.92, fbm(vec2(dx * 5.0 + uTime * 0.04, uv.y * 3.2 - uTime * 0.35))) * exp(-abs(dx) * 5.5) * depth;
  float pool = exp(-pow((uv.y - uHorizon) * 9.0, 2.0)) * (exp(-abs(dx) * 3.0) + 0.25 * exp(-abs(dx) * 0.9));
  float rim = exp(-pow((uv.y - uHorizon) * 55.0, 2.0)) * exp(-abs(dx) * 0.9);

  vec2 cell = floor(gl_FragCoord.xy / 1.5);
  float twinkle = step(0.998, hash(cell)) * (0.5 + 0.5 * sin(uTime * 2.4 + hash(cell + 7.0) * 40.0));
  float dust = twinkle * exp(-abs(dx) * 3.0) * depth;

  vec3 blue = vec3(0.2, 0.5, 1.0);
  vec3 violet = vec3(0.62, 0.48, 1.0);
  vec3 pink = vec3(0.96, 0.5, 0.86);
  vec3 tint = mix(blue, mix(violet, pink, smoothstep(0.05, 0.35, dx)), smoothstep(-0.05, 0.25, dx));

  vec3 color = vec3(1.0) * core * 1.8 + blue * halo * 1.1 + tint * wisps * 0.8 + dust * vec3(0.85, 0.9, 1.0) * 0.7;
  color *= above;
  color += mix(blue, vec3(1.0), 0.4) * pool * 1.05 + vec3(0.85, 0.92, 1.0) * rim * 0.9;
  color = 1.0 - exp(-color * 1.4);
  gl_FragColor = vec4(color, max(color.r, max(color.g, color.b)));
}`;

  function startBeam() {
    const holder = document.querySelector(".beam");
    const canvas = holder?.querySelector("canvas");
    const showcase = document.querySelector(".showcase");
    if (!holder || !canvas || reduceMotion.matches) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) return;

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vertex = compile(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}");
    const fragment = compile(gl.FRAGMENT_SHADER, BEAM_SHADER);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      res: gl.getUniformLocation(program, "uRes"),
      time: gl.getUniformLocation(program, "uTime"),
      beamX: gl.getUniformLocation(program, "uBeamX"),
      horizon: gl.getUniformLocation(program, "uHorizon"),
    };

    const resize = () => {
      const scale = Math.min(devicePixelRatio || 1, 1.5) * 0.6;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.res, canvas.width, canvas.height);
      const windowTop = showcase ? showcase.getBoundingClientRect().top - rect.top : rect.height * 0.7;
      gl.uniform1f(uniforms.horizon, Math.min(0.95, Math.max(0.3, windowTop / rect.height)));
      gl.uniform1f(uniforms.beamX, innerWidth < 760 ? 0.74 : 0.81);
    };
    new ResizeObserver(resize).observe(canvas);
    resize();

    let visible = true;
    let frame = 0;
    const start = performance.now();
    const draw = (now) => {
      gl.uniform1f(uniforms.time, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frame = visible && !document.hidden ? requestAnimationFrame(draw) : 0;
    };
    const resume = () => {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
    };
    whenVisible(holder, (isVisible) => {
      visible = isVisible;
      resume();
    });
    document.addEventListener("visibilitychange", resume);
    requestAnimationFrame(() => holder.classList.add("is-live"));
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
    hub: { id: "tracker", name: "Tracker", initials: "TR", tone: "var(--lilac)" },
    agents: [
      { id: "worker", name: "Worker", initials: "WK", tone: "var(--mint)", shape: "shape-squircle" },
      { id: "researcher", name: "Researcher", initials: "RS", tone: "var(--sky)", shape: "shape-blob" },
      { id: "trading", name: "Trading", initials: "TD", tone: "var(--amber)", shape: "shape-diamond" },
      { id: "dex", name: "DEX", initials: "DX", tone: "var(--coral)", shape: "shape-squircle" },
      { id: "campaign", name: "Campaign", initials: "CP", tone: "var(--mint)", shape: "shape-blob" },
      { id: "affiliate", name: "Affiliate", initials: "AF", tone: "var(--lilac)", shape: "shape-diamond" },
      { id: "internship", name: "InternshipAgent", initials: "IN", tone: "var(--amber)", shape: "shape-squircle" },
      { id: "dashboard", name: "Dashboard", initials: "UI", tone: "var(--sky)", shape: "shape-blob" },
    ],
    script: [
      { from: "tracker", to: "*", text: "Health check: every service is up." },
      { from: "researcher", to: "trading", text: "Scan sent: 10 Spot, 10 Futures, 10 DEX candidates." },
      { from: "trading", to: "tracker", text: "Reviewed. Still at most 3 entries today." },
      { from: "campaign", to: "tracker", text: "Video rendered. Waiting for audit." },
      { from: "tracker", to: "campaign", text: "Audit passed. Upload approved." },
      { from: "worker", to: "tracker", text: "Coding job done. Ready for review." },
      { from: "internship", to: "dashboard", text: "New listings sent to Telegram." },
      { from: "dashboard", to: "tracker", text: "History updated." },
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
      node.innerHTML = `<span class="network-bubble"></span><span class="network-avatar ${agent.shape ?? ""}"><span>${agent.initials}</span></span><span class="network-label">${agent.name}</span>`;
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

  startBeam();
  startShowcase();
  startNetwork();
  startAgentLog();
  startMarquee();
  startStackProgress();
})();
