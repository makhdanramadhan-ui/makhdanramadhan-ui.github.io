(() => {
  const FRAGMENT = `
precision highp float;

uniform vec2 uCanvas;
uniform float uPx;
uniform float uTime;
uniform float uBeamX;
uniform vec4 uSurface;
uniform float uRadius;
uniform vec4 uSource;
uniform float uHasSource;
uniform float uFront;
uniform float uFalling;
uniform float uBloom;
uniform float uFlash;
uniform float uRun;
uniform vec3 uPour;
uniform float uSpillSide;
uniform vec4 uLens;

const vec3 WHITE = vec3(1.0);
const vec3 BEAM = vec3(0.62, 0.7, 1.0);
const vec3 LEFT = vec3(0.2, 0.38, 1.0);
const vec3 RIGHT = vec3(0.6, 0.34, 1.0);
const vec3 LILAC = vec3(0.86, 0.66, 1.0);
const vec3 PINK = vec3(1.0, 0.4, 0.86);
const vec3 PURPLE = vec3(0.42, 0.16, 0.92);
const vec3 NAVY = vec3(0.1, 0.14, 0.48);

float hash(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = mat2(1.7, 1.1, -1.1, 1.7) * p;
    amplitude *= 0.5;
  }
  return value / 0.9375;
}

float boxDistance(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y) * uPx;
  vec2 surfaceCenter = (uSurface.xy + uSurface.zw) * 0.5;
  vec2 surfaceHalf = (uSurface.zw - uSurface.xy) * 0.5;
  float sd = boxDistance(p - surfaceCenter, surfaceHalf, uRadius);
  if (sd < -1.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float t = uTime;
  float dx = p.x - uBeamX;
  float ax = abs(dx);
  float h = uSurface.y - p.y;
  float hp = max(h, 0.0);
  float outside = smoothstep(-1.0, 1.0, sd);
  vec3 sideTint = mix(LEFT, RIGHT, smoothstep(-36.0, 36.0, dx));
  vec3 col = vec3(0.0);

  float lit = smoothstep(uFront + 8.0, uFront - 120.0, p.y);
  float underTop = exp(-pow(max(-h, 0.0) / 50.0, 2.0));
  float fromTop = mix(0.3, 1.0, smoothstep(0.0, 0.45 * uSurface.y, p.y));
  if (uHasSource > 0.5) fromTop = max(fromTop, smoothstep(uSource.y, uSource.w + 40.0, p.y));
  float flicker = 0.82 + 0.36 * noise(vec2(p.y * 0.018 - t * 1.6, 7.3));
  float core = 11.0 * exp(-ax / 1.3);
  float halo = 1.25 * exp(-ax / 6.5) + 0.38 * exp(-ax / 26.0);
  float mist = 0.14 * exp(-ax / 120.0) * (0.55 + 0.9 * fbm(vec2(dx * 0.012, p.y * 0.005 - t * 0.12)));
  float curtainSide = uSpillSide > 0.0 ? smoothstep(4.0, 40.0, dx) : smoothstep(4.0, 40.0, -dx);
  float curtainFolds = 0.45 + 0.9 * fbm(vec2(ax * 0.008 + t * 0.03, p.y * 0.0025 - t * 0.05));
  mist += curtainSide * 0.42 * exp(-ax / 210.0) * curtainFolds * smoothstep(0.0, uSurface.y, p.y);
  col += (mix(WHITE, BEAM, 0.25) * core + mix(BEAM, sideTint, 0.55) * halo * flicker + sideTint * mist) * lit * underTop * fromTop;

  float head = exp(-pow((p.y - uFront) / 26.0, 2.0)) * uFalling;
  col += mix(WHITE, BEAM, 0.3) * head * (8.0 * exp(-ax / 2.2) + 0.6 * exp(-ax / 10.0));

  if (uHasSource > 0.5) {
    vec2 sourceCenter = (uSource.xy + uSource.zw) * 0.5;
    vec2 sourceHalf = (uSource.zw - uSource.xy) * 0.5;
    float sourceDistance = boxDistance(p - sourceCenter, sourceHalf, sourceHalf.y);
    float struck = smoothstep(uSource.y - 2.0, uSource.y + 16.0, uFront);
    float near = 0.3 + 0.7 * exp(-ax / 34.0);
    float rim = 1.6 * exp(-max(sourceDistance, 0.0) / 2.2) + 0.9 * exp(-max(sourceDistance, 0.0) / 11.0);
    col += mix(sideTint, WHITE, 0.45) * rim * near * struck * smoothstep(-2.0, 0.0, sourceDistance) * (0.92 + 0.08 * sin(t * 2.2));
    float exit = exp(-length(vec2(dx / 2.0, max(p.y - uSource.w, 0.0))) / 10.0) * smoothstep(uSource.w - 2.0, uSource.w + 6.0, p.y);
    col += mix(WHITE, BEAM, 0.3) * exit * 5.0 * lit;
  }

  float run = 1.0 - smoothstep(uRun - 90.0, uRun + 12.0, ax);
  float nearTop = exp(-pow(max(p.y - uSurface.y - uRadius, 0.0) / 36.0, 2.0));
  float edgeFade = exp(-ax / 520.0) + 0.25;
  float edge = 1.8 * exp(-pow(max(sd, 0.0) / 1.5, 2.0)) + 0.55 * exp(-max(sd, 0.0) / 8.0);
  col += mix(sideTint, WHITE, 0.55) * edge * edgeFade * run * nearTop * uBloom * 1.6;

  float angle = atan(hp + 2.0, dx);
  float rays = 0.55 + 0.9 * smoothstep(0.35, 0.95, noise(vec2(angle * 26.0, t * 0.25)));
  float crown = 22.0 + 0.11 * ax;
  float skirt = exp(-hp / crown) * exp(-pow(ax / 300.0, 2.0)) * (0.65 + 0.35 * sin(t * 1.3));
  col += sideTint * skirt * rays * run * outside * nearTop * uBloom * 2.6;
  float flare = exp(-length(vec2(dx, hp * 2.4)) / 34.0);
  col += mix(WHITE, sideTint, 0.35) * flare * outside * nearTop * uBloom * (1.4 + 4.0 * uFlash);
  col += mix(BEAM, NAVY, 0.55) * 0.75 * exp(-ax / 340.0) * exp(-hp / 110.0) * outside * nearTop * run * uBloom;

  float down = p.y - uSurface.y;
  float onSpillSide = uSpillSide > 0.0 ? smoothstep(surfaceCenter.x - 2.0, surfaceCenter.x + 2.0, p.x) : 1.0 - smoothstep(surfaceCenter.x - 2.0, surfaceCenter.x + 2.0, p.x);
  if (uPour.y > 0.001 && onSpillSide > 0.0 && down > -uRadius) {
    float d = max(sd, 0.0);
    float reveal = 1.0 - smoothstep(uPour.x - 70.0, uPour.x + 6.0, down);
    float fade = 1.0 - smoothstep(0.3 * uPour.z, uPour.z, down);
    float streak = 0.5 + 0.95 * noise(vec2(d * 0.12, down * 0.035 - t * 2.4));
    float line = (4.5 * exp(-pow(d / 1.7, 2.0)) + 1.2 * exp(-d / 6.0)) * exp(-down / 450.0);
    float fanWidth = 16.0 + 0.2 * max(down, 0.0);
    vec3 fanTint = mix(LILAC, PINK, smoothstep(60.0, 260.0, down));
    fanTint = mix(fanTint, PURPLE, smoothstep(0.25, 1.1, d / fanWidth));
    float fan = 1.7 * exp(-d / fanWidth) * smoothstep(-uRadius, 10.0, down);
    col += (mix(WHITE, LILAC, 0.3) * line + fanTint * fan) * streak * reveal * fade * uPour.y * onSpillSide * outside;
  }

  float smokeReach = exp(-ax / 140.0);
  if (smokeReach > 0.02) {
    vec2 q = vec2(dx / 1.7, h) / 140.0 + vec2(t * 0.012, -t * 0.03);
    float cloud = fbm(q + 0.8 * vec2(fbm(q + vec2(1.7, 9.2) + t * 0.02), fbm(q + vec2(8.3, 2.8) - t * 0.018)));
    float density = smoothstep(0.42, 0.9, cloud);
    float body = 0.35 + 0.9 * exp(-hp / 70.0) + 0.6 * exp(-p.y / 140.0);
    col += (NAVY * 0.6 + BEAM * 2.4 * exp(-ax / 50.0)) * density * smokeReach * body * underTop * lit;
  }

  vec2 toLens = p - uLens.xy;
  float lens = exp(-dot(toLens, toLens) / (uLens.z * uLens.z)) * uLens.w;
  col *= 1.0 + 0.9 * lens;
  col += (sideTint * 0.45 + NAVY * 0.6) * lens * outside * exp(-max(-h, 0.0) / 160.0);

  float glow = col.b;
  float grid = 1.0 - smoothstep(0.18, 0.34, length(fract(p / 3.0) - 0.5));
  col += BEAM * grid * clamp(glow, 0.0, 1.4) * (1.0 - smoothstep(1.4, 3.6, glow)) * (0.16 + 0.4 * lens);

  vec2 rise = vec2(dx / 4.0, (p.y + t * 24.0) / 10.0);
  vec2 cell = floor(rise);
  vec2 spot = (cell + 0.2 + 0.6 * vec2(hash(cell + 4.4), hash(cell + 2.9))) * vec2(4.0, 10.0);
  float spark = exp(-dot(vec2(dx, p.y + t * 24.0) - spot, vec2(dx, p.y + t * 24.0) - spot) / 0.35);
  float sparkOn = step(0.78, hash(cell + 6.6)) * (0.5 + 0.5 * sin(t * 5.5 + hash(cell + 1.1) * 6.283));
  float sparkZone = exp(-ax / 34.0) * smoothstep(5.0, 14.0, ax) * smoothstep(18.0, 60.0, hp) * lit + 0.6 * exp(-ax / 160.0) * exp(-hp / 40.0) * outside * nearTop * run * uBloom;
  col += WHITE * spark * sparkOn * (sparkZone + 1.6 * lens * clamp(glow * 1.5, 0.0, 1.0)) * 1.8;

  col *= smoothstep(-1.0, 0.2, sd);
  vec3 light = 1.0 - exp(-col * 1.05);
  float grain = (hash(gl_FragCoord.xy) + hash(gl_FragCoord.xy + 17.3) - 1.0) / 255.0;
  light = clamp(light + grain * clamp(max(light.r, max(light.g, light.b)) * 255.0, 0.0, 1.0), 0.0, 1.0);
  gl_FragColor = vec4(light, max(light.r, max(light.g, light.b)));
}`;

  const VERTEX = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const FALL_SECONDS = 1.25;
  const MAX_PIXELS = 1.4e6;
  const RENDER_SCALE = 0.75;

  const holder = document.querySelector(".beam[data-surface]");
  const canvas = holder?.querySelector("canvas");
  const surface = holder && document.querySelector(holder.dataset.surface);
  const source = holder?.dataset.source ? document.querySelector(holder.dataset.source) : null;
  const fallbackX = Number(holder?.dataset.beamX ?? 0.78);
  if (!holder || !canvas || !surface) return;

  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
  if (!gl) return;

  const compile = (type, text) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) return;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const attribute = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);

  const uniform = Object.fromEntries(
    ["uCanvas", "uPx", "uTime", "uBeamX", "uSurface", "uRadius", "uSource", "uHasSource", "uFront", "uFalling", "uBloom", "uFlash", "uRun", "uPour", "uSpillSide", "uLens"].map((name) => [
      name,
      gl.getUniformLocation(program, name),
    ]),
  );

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const geometry = { width: 1, height: 1, beamX: 0, surface: [0, 0, 0, 0], radius: 0, source: null, spillSide: 1, edgeDistance: 1, pourLength: 1 };
  const pointer = { x: 0, y: 0, inside: false };
  const lens = { x: 0, y: 0, vx: 0, vy: 0, strength: 0, placed: false };
  let elapsed = reduceMotion ? 60 : 0;
  let last = 0;
  let frame = 0;
  let visible = true;

  const measure = () => {
    const box = holder.getBoundingClientRect();
    const win = surface.getBoundingClientRect();
    const top = win.top - box.top;
    const pourLength = Math.min(560, Math.max(220, win.height * 0.85));
    holder.style.height = `${Math.round(top + pourLength + 160)}px`;
    const width = holder.clientWidth;
    const height = holder.clientHeight;
    const radius = parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 0;
    const left = win.left - box.left;
    const right = win.right - box.left;
    const inset = radius * 0.5 + 10;

    const anchor = width < 640 ? (fallbackX < 0.5 ? 0.06 : 0.94) : fallbackX;
    let beamX = Math.min(right - inset, Math.max(left + inset, width * anchor));
    let sourceRect = null;
    const sourceBox = source?.getBoundingClientRect();
    if (sourceBox && sourceBox.width > 0) {
      const center = (sourceBox.left + sourceBox.right) / 2 - box.left;
      if (center > left + inset && center < right - inset) {
        beamX = center;
        sourceRect = [sourceBox.left - box.left, sourceBox.top - box.top, sourceBox.right - box.left, sourceBox.bottom - box.top];
      }
    }

    const spillSide = right - beamX <= beamX - left ? 1 : -1;
    Object.assign(geometry, {
      width,
      height,
      beamX,
      surface: [left, top, right, win.bottom - box.top],
      radius,
      source: sourceRect,
      spillSide,
      edgeDistance: spillSide > 0 ? right - beamX : beamX - left,
      pourLength,
    });

    const ratio = Math.min(devicePixelRatio || 1, 1.5) * RENDER_SCALE;
    const scale = Math.min(ratio, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)));
    const pixelWidth = Math.max(1, Math.round(width * scale));
    const pixelHeight = Math.max(1, Math.round(height * scale));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      gl.viewport(0, 0, pixelWidth, pixelHeight);
    }
  };

  const spring = (time) => 1 - Math.exp(-5 * time) * (Math.cos(7 * time) + 0.72 * Math.sin(7 * time));

  const intro = () => {
    const start = -0.12 * geometry.height;
    const target = geometry.surface[1];
    const fallProgress = Math.min(1, elapsed / FALL_SECONDS);
    const front = fallProgress < 1 ? start + (target + 30 - start) * fallProgress ** 1.6 : geometry.height * 2;
    const impactAt = FALL_SECONDS * ((target - start) / (target + 30 - start)) ** (1 / 1.6);
    const sinceImpact = elapsed - impactAt;
    const maxRun = geometry.width * 1.2;
    const run = sinceImpact > 0 ? maxRun * (1 - Math.exp(-1.5 * sinceImpact)) : -100;
    const reachAt = -Math.log(1 - Math.min(0.99, geometry.edgeDistance / maxRun)) / 1.5;
    const sincePour = sinceImpact - reachAt;
    const pour = sincePour > 0 ? geometry.pourLength * 1.15 * (1 - Math.exp(-1.1 * sincePour)) : -20;
    return {
      front,
      falling: fallProgress < 1 ? 1 : 0,
      bloom: sinceImpact > 0 ? spring(sinceImpact) : 0,
      flash: sinceImpact > 0 ? Math.exp(-sinceImpact / 0.32) * (1 - Math.exp(-sinceImpact / 0.04)) : 0,
      run,
      pour,
      pourStrength: Math.min(1, 1.35 * Math.exp(-geometry.edgeDistance / 380)),
    };
  };

  const updateLens = (dt) => {
    if (pointer.inside && !lens.placed) {
      Object.assign(lens, { x: pointer.x, y: pointer.y, vx: 0, vy: 0, placed: true });
    }
    const ax = 120 * (pointer.x - lens.x) - 19 * lens.vx;
    const ay = 120 * (pointer.y - lens.y) - 19 * lens.vy;
    lens.vx += ax * dt;
    lens.vy += ay * dt;
    lens.x += lens.vx * dt;
    lens.y += lens.vy * dt;
    const target = pointer.inside ? 1 : 0;
    lens.strength += (target - lens.strength) * (1 - Math.exp(-dt / (target > lens.strength ? 0.25 : 0.5)));
    if (lens.strength < 0.001 && !pointer.inside) lens.placed = false;
  };

  const draw = () => {
    const state = intro();
    const sourceRect = geometry.source;
    source?.toggleAttribute("data-beam-struck", Boolean(sourceRect) && state.front >= sourceRect[1]);
    gl.uniform2f(uniform.uCanvas, canvas.width, canvas.height);
    gl.uniform1f(uniform.uPx, geometry.width / canvas.width);
    gl.uniform1f(uniform.uTime, elapsed * 1.6);
    gl.uniform1f(uniform.uBeamX, geometry.beamX);
    gl.uniform4f(uniform.uSurface, ...geometry.surface);
    gl.uniform1f(uniform.uRadius, geometry.radius);
    gl.uniform4f(uniform.uSource, ...(sourceRect ?? [0, 0, 0, 0]));
    gl.uniform1f(uniform.uHasSource, sourceRect ? 1 : 0);
    gl.uniform1f(uniform.uFront, state.front);
    gl.uniform1f(uniform.uFalling, state.falling);
    gl.uniform1f(uniform.uBloom, state.bloom);
    gl.uniform1f(uniform.uFlash, state.flash);
    gl.uniform1f(uniform.uRun, state.run);
    gl.uniform3f(uniform.uPour, state.pour, state.pourStrength, geometry.pourLength);
    gl.uniform1f(uniform.uSpillSide, geometry.spillSide);
    gl.uniform4f(uniform.uLens, lens.x, lens.y, 110, lens.strength);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const tick = (now) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    elapsed += dt;
    if (elapsed < 3) measure();
    updateLens(dt);
    draw();
    frame = visible && !document.hidden ? requestAnimationFrame(tick) : 0;
    if (!frame) last = 0;
  };

  const resume = () => {
    if (!reduceMotion && !frame && visible && !document.hidden) frame = requestAnimationFrame(tick);
  };

  const relayout = () => {
    measure();
    draw();
  };

  new ResizeObserver(relayout).observe(holder.parentElement);
  new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    resume();
  }).observe(holder);
  document.addEventListener("visibilitychange", resume);
  addEventListener(
    "pointermove",
    (event) => {
      const box = holder.getBoundingClientRect();
      pointer.x = event.clientX - box.left;
      pointer.y = event.clientY - box.top;
      pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= box.width && pointer.y <= box.height;
      resume();
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", () => {
    pointer.inside = false;
  });
  document.fonts?.ready.then(relayout);

  relayout();
  resume();
})();
