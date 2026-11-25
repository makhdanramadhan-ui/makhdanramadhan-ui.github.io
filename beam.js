(() => {
  const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const FRAGMENT = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 uViewport;
uniform float uPixelRatio;
uniform float uUnit;
uniform float uClock;
uniform float uColumnX;
uniform vec4 uSourceRect;
uniform vec3 uSourceWrap;
uniform float uFallStretch;
uniform vec4 uSurfaceRect;
uniform float uSurfaceRadius;
uniform vec3 uImpact;
uniform vec4 uPour;
uniform vec2 uRun;
uniform vec4 uLens;
uniform float uAtmosphere;
uniform vec4 uAmount;
uniform vec4 uShape;
uniform vec4 uExtra;
uniform vec4 uSmoke;
uniform float uSmokeDrift;
uniform vec3 uPalette[16];

#define CORE uPalette[0]
#define LEFT uPalette[1]
#define RIGHT uPalette[2]
#define CYAN uPalette[3]
#define PINK uPalette[4]
#define LILAC uPalette[5]
#define SKY uPalette[6]
#define PURPLE uPalette[7]
#define DEEP uPalette[8]
#define MIST uPalette[9]
#define NAVY uPalette[10]
#define WARM uPalette[11]
#define EMBER uPalette[12]
#define WHITE uPalette[13]
#define HAZE uPalette[14]
#define LAVENDER uPalette[15]

const mat2 OCTAVE = mat2(1.6, 1.2, -1.2, 1.6);

float sq(float x) {
  return x * x;
}

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

float softFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise(p);
    p = OCTAVE * p;
    amplitude *= 0.5;
  }
  return value / 0.875;
}

float smokeFbm(vec2 p, float detail) {
  float value = softFbm(p);
  if (detail < 0.01) return value;
  p = OCTAVE * OCTAVE * OCTAVE * p;
  float fine = 0.0625 * noise(p) + 0.03125 * noise(OCTAVE * p);
  return (value * 0.875 + detail * fine) / (0.875 + detail * 0.09375);
}

float roundBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

vec3 tonemapAdd(vec3 light, float amount) {
  return -log(max(1.0 - amount * (1.0 - exp(-light)), vec3(0.0001)));
}

vec3 pourLight(float edge, float fallY, float strength, float front, float time, out vec3 glow) {
  glow = vec3(0.0);
  if (strength < 0.0005) return vec3(0.0);
  float fallen = max(fallY, 0.0);
  float depth = fallen / uFallStretch;
  float away = max(edge, 0.0);
  float band = away / (6.0 + 0.28 * depth);
  float start = smoothstep(-12.0, 18.0, fallY);
  float fade = max(
    exp(-sq(max(depth - 125.0, 0.0) / 40.0)),
    0.14 * smoothstep(60.0, 125.0, depth) * exp(-sq(max(depth - 170.0, 0.0) / 80.0))
  );
  float streak = 0.55 + 0.9 * noise(vec2(band * 5.0, depth / 18.0 - time * 2.4));
  float bright = pow(min(strength, 1.0), 1.5);
  float soft = sqrt(min(strength, 1.0));
  float warmth = smoothstep(90.0, 130.0, depth);
  vec3 coreTint = mix(WHITE, WARM, warmth * exp(-away / 9.0));
  float core = mix(1.6, 0.8, warmth) * exp(-sq(away / (3.5 + 0.03 * depth))) * exp(-sq(max(depth - 130.0, 0.0) / 38.0));
  float wall = 3.0 * exp(-sq(away / 1.6)) * exp(-sq(max(depth - 100.0, 0.0) / 30.0));

  float bandCenter = 0.7 - 0.3 * smoothstep(30.0, 110.0, depth) - 0.3 * smoothstep(110.0, 190.0, depth);
  float offset = band - bandCenter;
  float decay = (1.05 - bandCenter) / 1.31;
  float profile = offset < 0.0 ? exp(-sq(offset / 0.3)) : exp(-offset / decay);
  profile *= 1.0 - smoothstep(1.0, 1.4, band);

  vec3 inner = mix(CYAN, PINK, smoothstep(50.0, 75.0, depth));
  inner = mix(inner, LILAC, smoothstep(100.0, 125.0, depth));
  vec3 outer = mix(SKY, PURPLE, smoothstep(50.0, 75.0, depth));
  vec3 fan = mix(inner, outer, smoothstep(0.06, 0.18, offset));
  fan = mix(fan, DEEP, smoothstep(0.22, 0.42, offset));

  vec3 thread = (WHITE * wall + coreTint * core) * streak * bright;
  glow += fan * 2.2 * profile * fade * streak * bright;
  glow += MIST * 0.7 * exp(-max(band - 1.0, 0.0) / 0.9) * smoothstep(0.7, 1.2, band) * fade * soft;
  glow += EMBER * 0.35 * exp(-sq((depth - 165.0) / 22.0)) * exp(-away / 25.0) * bright;

  float lag = band * (6.0 + 0.28 * depth) * 0.35;
  float reveal = 1.0 - smoothstep(front - 70.0, front + 8.0, fallen + lag);
  glow *= start * reveal;
  return thread * start * reveal;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uViewport.y * uPixelRatio - gl_FragCoord.y) / uPixelRatio;
  vec2 p = px / uUnit;
  float t = uClock;
  float columnX = uColumnX / uUnit;
  vec4 rect = uSurfaceRect / uUnit;
  float corner = uSurfaceRadius / uUnit;
  float dx = p.x - columnX;
  float ax = abs(dx);
  float h = rect.y - p.y;
  float rise = max(h, 0.0);
  float above = smoothstep(-0.5, 0.5, h);
  float side = smoothstep(-24.0, 24.0, dx);
  vec3 sideTint = mix(mix(LAVENDER, LEFT, smoothstep(40.0, 140.0, ax)), RIGHT, side);

  float beamWidth = uShape.x;
  float flare = uShape.y;
  float spread = 250.0 * uShape.z;
  float reachLeft = max(columnX - rect.x, 1.0);
  float reachRight = max(rect.z - columnX, 1.0);
  bool onLeft = dx < 0.0;
  float layerLength = clamp(0.29 * (onLeft ? reachLeft : reachRight), 20.0, 100.0) * sqrt(uShape.z);
  float run = uRun.x;
  float bead = exp(-sq((ax - run + 16.0) / (18.0 + 0.04 * run))) * uRun.y;
  float spillsRight = step(reachRight, reachLeft);
  float farSide = onLeft ? spillsRight : 1.0 - spillsRight;
  float reachHere = spread * mix(1.0, 0.7, farSide);
  float bloom = uImpact.y;
  float bloomOn = min(bloom, 1.0);

  vec2 center = (rect.xy + rect.zw) * 0.5;
  float sd = roundBox(p - center, (rect.zw - rect.xy) * 0.5, corner);
  if (sd * uUnit < -0.75) {
    fragColor = vec4(0.0);
    return;
  }
  float outline = max(sd, 0.0);

  float runSoft = 60.0 + 1.5 * outline;
  float runMask = 1.0 - smoothstep(run - runSoft, run + 0.25 * runSoft, ax + 0.5 * outline);
  float flowMask = (1.0 - smoothstep(0.75 * reachHere, 1.1 * reachHere, ax)) * runMask;
  float edgeMask = (1.0 - smoothstep(0.8 * reachHere, 1.25 * reachHere, ax)) * runMask;
  float below = max(p.y - rect.y - corner, 0.0);
  float outside = smoothstep(-0.5, 0.5, sd);
  float hug = outside * exp(-sq(below / 14.0));
  float hugWide = outside * exp(-sq(below / 40.0));
  float overTop = smoothstep(rect.x - 10.0, rect.x + 90.0, p.x) * (1.0 - smoothstep(rect.z - 90.0, rect.z + 10.0, p.x));

  vec3 col = vec3(0.0);
  float breathe = 1.0 + uExtra.x * (0.12 * sin(t * 1.5708) + 0.08 * (noise(vec2(t * 0.5, 3.0)) - 0.5));

  float front = uImpact.x / uUnit;
  float lit = smoothstep(front + 10.0, front - 110.0, p.y);
  float falling = 1.0 - smoothstep(rect.y - 24.0, rect.y, front);
  float sourced = uSourceWrap.z;
  float topFade = mix(mix(0.3, 0.6, sourced), 1.0, smoothstep(0.0, 0.3 * rect.y, p.y));
  float fadeBelow = exp(-sq(max(-h, 0.0) / 70.0));
  float column = topFade * fadeBelow * lit;

  float core = 24.0 * exp(-ax / (2.0 * min(beamWidth, 1.9)));
  float halo = 1.3 * exp(-ax / (6.0 * min(beamWidth, 2.1))) + 0.3 * exp(-ax / (22.0 * beamWidth));
  col += (CORE * core + mix(CORE, sideTint, exp(-rise / 80.0)) * halo) * column;
  col += sideTint * 0.16 * exp(-ax / (45.0 * beamWidth)) * column;

  if (sourced > 0.5) {
    vec4 source = uSourceRect / uUnit;
    float sourceSd = roundBox(p - (source.xy + source.zw) * 0.5, (source.zw - source.xy) * 0.5, uSourceWrap.x / uUnit);
    float sourceOut = max(sourceSd, 0.0);
    float struck = smoothstep(source.y - 4.0, source.y + 12.0, front);
    float around = 1.0 - smoothstep(uSourceWrap.y / uUnit - 24.0, uSourceWrap.y / uUnit, ax);
    float near = 0.4 + 0.6 * exp(-ax / 28.0);
    float rim = 1.4 * exp(-sourceOut / 3.0) * near;
    float rimGlow = (exp(-sourceOut / 7.0) + 0.35 * exp(-sourceOut / 22.0)) * 1.1 * near;
    col += (mix(sideTint, WHITE, 0.6) * rim + sideTint * rimGlow) * struck * around * breathe * smoothstep(-3.0, -1.0, sourceSd);
    float mouth = exp(-length(vec2(dx / 2.2, max(p.y - source.w, 0.0))) / 9.0) * smoothstep(source.w - 3.0, source.w + 6.0, p.y);
    col += mix(WHITE, CORE, 0.3) * mouth * 7.0 * lit;
  }

  float tip = exp(-sq((p.y - front) / 24.0)) * falling;
  float tipWidth = min(beamWidth, 1.9);
  col += mix(WHITE, CORE, 0.35) * tip * (7.0 * exp(-ax / (2.6 * tipWidth)) + 0.3 * exp(-ax / (6.0 * tipWidth)));

  float psi = ax * (outline + 1.0);
  float lifted = max(rise - 17.9 * flare, 0.0);
  float skirtAmp = 16.6 * (exp(-sq(lifted / (11.8 * flare))) + 0.3 * exp(-lifted / (60.0 * flare)));
  float skirtSpread = mix(134.0, 155.0, side) * breathe * flare * flare * mix(0.35, 1.0, bloomOn) * max(bloom, 1.0);
  float skirt = skirtAmp * exp(-psi / skirtSpread) * exp(-sq(ax / (max(layerLength, 60.0 * sqrt(uShape.z)) * 1.48))) * hug;
  col += sideTint * skirt * flowMask * overTop * bloomOn;

  float layer = 12.0 * exp(-ax / layerLength) * exp(-outline / (0.19 * layerLength)) * (1.0 + 0.4 * bead);
  col += sideTint * layer * hug * flowMask * overTop * bloomOn;
  float washMask = smoothstep(rect.x - 60.0, rect.x + 6.0, p.x) * (1.0 - smoothstep(rect.z - 6.0, rect.z + 45.0, p.x));
  float wash = 1.4 * exp(-ax / 100.0) * exp(-outline / 30.0);
  col += mix(CORE, sideTint, 0.25) * wash * hugWide * washMask * flowMask * overTop * bloomOn;
  float highWash = 0.7 * exp(-ax / 140.0) * exp(-outline / 60.0);
  col += mix(CORE, NAVY, 0.5) * highWash * hugWide * washMask * runMask * overTop * bloomOn;

  float sideId = onLeft ? 0.0 : 1.0;
  float along = 0.5 * log((rise + 1.0) / (ax + 1.0));
  float flareArea = 120.0 * flare * flare;
  float lineCoord = log(max(psi, 1.0) / flareArea) * 6.0;
  float lineId = floor(lineCoord) + sideId * 97.0;
  float wobble = 0.22 * (noise(vec2(lineId * 3.7, t * 0.4 + along)) - 0.5);
  float lineOffset = fract(lineCoord + wobble) - 0.5;
  float gradient = 6.0 * length(vec2(rise + 1.0, ax)) / max(psi, 1.0) / uUnit;
  float halfWidth = max(0.35 * gradient, 0.0001);
  float drawWidth = max(halfWidth, 0.6 * gradient);
  float lineShape = exp(-sq(lineOffset / drawWidth)) * (halfWidth / drawWidth);
  float lineOn = step(0.3, hash(vec2(lineId, 1.3)));
  float lineFlow = smoothstep(0.25, 0.85, noise(vec2(lineId * 5.3 + 2.0, along * 3.0 + t * 1.1)));
  float lineEnvelope = smoothstep(0.85 * flareArea, 1.4 * flareArea, psi) * (1.0 - smoothstep(3.2 * flareArea, 7.5 * flareArea, psi));
  lineEnvelope *= exp(-ax / (layerLength * 1.5)) * hug * flowMask * overTop * (1.0 - smoothstep(35.0 * flare, 80.0 * flare, rise));
  float lineBright = mix(0.35, 1.0, hash(vec2(lineId, 4.0)));
  col += mix(sideTint, WHITE, 0.6) * lineShape * lineOn * lineFlow * lineEnvelope * lineBright * 2.6 * uAmount.w * bloomOn;

  float edgeGlow = 22.8 * exp(-sq(ax / (0.6 * reachHere))) * edgeMask * (1.0 + 0.9 * bead);
  float onTop = exp(-sq(below / 50.0));
  float edgeLine = (0.5 * exp(-sq(outline / 3.0)) + 0.25 * exp(-outline / 10.0)) * edgeGlow * onTop;
  col += mix(sideTint, WHITE, 0.6) * edgeLine * bloomOn;

  float baseline = exp(-sq(130.0 / 150.0));
  float pourWidth = 150.0 * uShape.z;
  float strengthRight = exp(-sq(reachRight / pourWidth)) * (1.0 - smoothstep(0.8 * spread, 1.25 * spread, reachRight)) / baseline * uShape.w * spillsRight;
  float strengthLeft = exp(-sq(reachLeft / pourWidth)) * (1.0 - smoothstep(0.8 * spread, 1.25 * spread, reachLeft)) / baseline * uShape.w * (1.0 - spillsRight);
  float fallY = p.y - rect.y - 0.3 * corner;
  float rightHalf = smoothstep(center.x - 4.0, center.x + 4.0, p.x);
  float cornerHaloRight = exp(-length(p - vec2(rect.z - 0.3 * corner, rect.y + 0.3 * corner)) / 40.0) * sqrt(strengthRight);
  float cornerHaloLeft = exp(-length(p - vec2(rect.x + 0.3 * corner, rect.y + 0.3 * corner)) / 40.0) * sqrt(strengthLeft);
  float surfaceHeight = rect.w - rect.y;
  float spillMask = runMask * exp(-sq(max(fallY - 0.05 * surfaceHeight, 0.0) / (0.28 * surfaceHeight)));
  vec3 glowRight;
  vec3 glowLeft;
  col += pourLight(sd, fallY, strengthRight, uPour.y, t, glowRight) * rightHalf * spillMask;
  col += pourLight(sd, fallY, strengthLeft, uPour.x, t, glowLeft) * (1.0 - rightHalf) * spillMask;
  col += tonemapAdd((glowRight * rightHalf + NAVY * 0.9 * cornerHaloRight) * spillMask, uPour.w);
  col += tonemapAdd((glowLeft * (1.0 - rightHalf) + NAVY * 0.9 * cornerHaloLeft) * spillMask, uPour.z);

  vec2 toLens = px - uLens.xy;
  float lens = exp(-dot(toLens, toLens) / sq(uLens.z)) * uLens.w;
  col *= 1.0 + 0.35 * lens * hug;

  float fogAmount = uAmount.y * uAtmosphere;
  float envelope = exp(-ax / 150.0) * (0.3 + 0.4 * exp(-rise / 50.0) + 1.2 * exp(-p.y / 120.0));
  if (fogAmount > 0.001 && h > -160.0 && envelope * max(0.25, 6.0 * exp(-ax / 50.0)) > 0.002) {
    float drift = t * uSmokeDrift;
    vec2 q = vec2(dx / 1.7, h) / (120.0 * uSmoke.x) + vec2(drift * 0.012, -drift * 0.03) + uExtra.zw;
    vec2 warp = vec2(softFbm(q + vec2(1.7, 9.2) + drift * 0.03), softFbm(q + vec2(8.3, 2.8) - drift * 0.025));
    float cloud = smokeFbm(q + uSmoke.w * warp, uSmoke.y);
    float density = smoothstep(mix(0.4, 0.52, uSmoke.z), mix(0.95, 0.66, uSmoke.z), cloud);
    float reached = smoothstep(front + 80.0, front - 40.0, p.y);
    vec3 fog = (HAZE * 0.45 + CORE * 6.0 * exp(-ax / 50.0) * reached) * density * envelope * fadeBelow;
    float surfaceLit = exp(-ax / (layerLength * 1.3)) * exp(-outline / 28.0) * hugWide * flowMask * washMask * bloomOn;
    fog += sideTint * 2.2 * surfaceLit * (smoothstep(0.3, 0.85, cloud) - 0.35) * fadeBelow;
    fog += CORE * 0.35 * exp(-ax / (22.0 * beamWidth)) * (0.35 + 0.9 * smoothstep(0.2, 0.9, cloud)) * column;
    col += fog * fogAmount * (1.0 + 1.2 * lens);
  }

  float haze = col.b;
  float dotGrid = 1.0 - smoothstep(0.16, 0.32, length(fract(px / 3.0) - 0.5));
  col += CORE * dotGrid * clamp(haze, 0.0, 1.5) * (1.0 - smoothstep(1.5, 4.0, haze)) * (0.18 + 0.3 * lens) * uExtra.y;

  if (lens > 0.002) {
    vec2 drift = px - vec2(0.0, t * 14.0);
    vec2 cell = floor(drift / 7.0);
    vec2 spot = (cell + 0.2 + 0.6 * vec2(hash(cell + 5.1), hash(cell + 2.3))) * 7.0;
    float distance = length(drift - spot);
    float on = step(0.8, hash(cell + 8.8));
    float twinkle = 0.5 + 0.5 * sin(t * 5.0 + hash(cell + 3.7) * 6.283);
    col += WHITE * exp(-distance * distance / 0.35) * on * twinkle * lens * clamp(haze * 1.5, 0.0, 1.0) * 1.6 * uAmount.z;
  }

  float dust = uAmount.z;
  if (dust > 0.001) {
    vec2 flowCell = vec2(log(max(psi, 1.0) / flareArea) * 2.2 / 1.1, (along + t * 0.22) / 0.06);
    vec2 cell = floor(flowCell) + vec2(sideId * 131.0, 0.0);
    vec2 jitter = vec2(hash(cell + 1.7), hash(cell + 8.3));
    vec2 flowSpot = (floor(flowCell) + 0.1 + jitter * 0.8) * vec2(1.1, 0.06);
    float spotPsi = flareArea * exp(flowSpot.x / 2.2);
    float spotAlong = flowSpot.y - t * 0.22;
    vec2 spot = vec2(sqrt(spotPsi * exp(-2.0 * spotAlong)) - 1.0, sqrt(spotPsi * exp(2.0 * spotAlong)) - 1.0);
    float distance = length(vec2(ax, rise) - spot) * uUnit;
    float on = step(0.62, hash(cell + 3.1));
    float twinkle = 0.5 + 0.5 * sin(t * 5.0 + hash(cell + 9.2) * 6.283);
    float zone = exp(-sq(log(max(psi, 1.0) / (200.0 * flare * flare)) / 0.55)) * hug * flowMask * smoothstep(0.0, 6.0, outline);
    col += WHITE * exp(-distance * distance / 0.3) * on * twinkle * zone * 3.0 * dust * bloomOn;

    vec2 glitterSpace = vec2(dx, p.y - t * 26.0);
    vec2 glitterCell = floor(glitterSpace / vec2(3.0, 9.0));
    vec2 glitterJitter = vec2(hash(glitterCell + 4.4), hash(glitterCell + 2.9));
    vec2 glitterSpot = (glitterCell + 0.15 + glitterJitter * 0.7) * vec2(3.0, 9.0);
    float glitterDistance = length(glitterSpace - glitterSpot) * uUnit;
    float glitterOn = step(0.7, hash(glitterCell + 6.6));
    float glitterTwinkle = 0.5 + 0.5 * sin(t * 6.0 + hash(glitterCell + 1.1) * 6.283);
    float glitterZone = exp(-ax / (5.0 * beamWidth)) * smoothstep(1.5, 4.0, ax / beamWidth) * above * smoothstep(25.0, 70.0, rise) * topFade * lit;
    col += WHITE * exp(-glitterDistance * glitterDistance / 0.25) * glitterOn * glitterTwinkle * glitterZone * 2.2 * dust * uAtmosphere;
  }

  col *= uAmount.x * (1.0 + uImpact.z * 0.9 * exp(-length(vec2(dx, h * 1.6)) / 70.0));
  col *= smoothstep(-0.75, 0.25, sd * uUnit);

  vec3 emit = 1.0 - exp(-col);
  float dither = (hash(gl_FragCoord.xy) + hash(gl_FragCoord.xy + 17.31) - 1.0) / 255.0;
  emit = clamp(emit + dither * clamp(max(emit.r, max(emit.g, emit.b)) * 255.0, 0.0, 1.0), 0.0, 1.0);
  fragColor = vec4(emit, max(emit.r, max(emit.g, emit.b)));
}`;

  const BASE_LOOK = {
    intensity: 1.6, beamWidth: 3.2, flare: 2.5, spread: 3.8, spill: 1, fall: 2.2, fog: 0.3,
    dust: 1.4, streaks: 0.8, dots: 0.8, pulse: 1.4, speed: 1.8, seed: 3,
    smokeSize: 1, smokeDetail: 0, smokeEdge: 0, smokeSwirl: 0.8, smokeDrift: 1,
  };
  const PRESETS = {
    soft: { ...BASE_LOOK, intensity: 1.3, beamWidth: 4.2, flare: 3, spread: 4.2, fall: 1.6, fog: 0.5, dust: 0.6, streaks: 0.4, dots: 0.5, pulse: 0.8, speed: 1.2 },
    laser: { ...BASE_LOOK, intensity: 1.8, beamWidth: 1.2, flare: 1.5, spread: 3.2, fall: 2.6, fog: 0.15, dust: 1, streaks: 1.6, dots: 1, pulse: 1.6, speed: 2.2, color: "#6f8cff" },
    haze: { ...BASE_LOOK, intensity: 1.5, beamWidth: 3, flare: 2.8, spread: 4, fall: 2, fog: 0.6, dust: 1.9, streaks: 1, dots: 1.2, pulse: 1.2, speed: 1.6, seed: 16, color: "#d46cf5" },
    blue: { ...BASE_LOOK, color: "#3847ff" },
  };
  const BLENDED_RANGES = {
    intensity: [1.2, 2], beamWidth: [0.9, 5.5], flare: [1.2, 3.6], spread: [2.4, 6.5], spill: [0.7, 1.4],
    fall: [1.4, 2.8], fog: [0.1, 1], dust: [0.4, 2.2], streaks: [0.3, 1.8], dots: [0.4, 1.4],
    pulse: [0.7, 1.8], speed: [1.1, 2.4],
  };
  const SMOKE_RANGES = {
    smokeSize: [0.45, 2.2], smokeDetail: [0, 1], smokeEdge: [0, 1], smokeSwirl: [0.3, 2], smokeDrift: [0.5, 2.4],
  };
  const BASE_COLORS = ["#3847ff", "#5b5bff", "#2f8bff", "#38a8ff", "#6f8cff", "#7b3dff", "#a46cf5", "#c03cff", "#d46cf5", "#ff3df2", "#ff4fa3", "#ff4d6d"];
  const PALETTE_STEPS = [
    [0, 1], [-11.5, 0.77], [9.5, 0.95], [-53.5, 0.79], [39.5, 0.77], [16, 0.81], [-16.3, 0.92], [13.3, 0.96],
    [3, 1.01], [1, 0.68], [1, 1.15], [142.5, 0.51], [113.6, 0.28], [-7.5, 0.13], [-2.7, 0.32], [7.5, 0.81],
  ];
  const PALETTE_SATURATION = 0.78;
  const HUE_GAP = [30, 200];

  const FALL_SECONDS = 1.4;
  const SETTLE_SECONDS = 7.6;
  const WRAP_SPEED = 420;
  const RUN_RATE = 1.15;
  const POUR_SPEED_CAP = 320;
  const POUR_ACCELERATION = 240;
  const MAX_DEVICE_RATIO = 1.5;
  const MAX_CANVAS_SIDE = 1600;
  const SLOW_FRAME_MS = 40;
  const MIN_QUALITY = 0.35;
  const AVOID_GAP = 56;

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const easeOutCubic = (x) => 1 - (1 - clamp(x, 0, 1)) ** 3;
  const smootherStep = (x) => x * x * x * (x * (x * 6 - 15) + 10);
  const dampedSpring = (time) => {
    const damping = 0.62;
    const frequency = 8 * Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-4.96 * time) * (Math.cos(frequency * time) + ((damping * 8) / frequency) * Math.sin(frequency * time));
  };

  const hexToRgb = (hex) => {
    const value = Number.parseInt(hex.replace("#", ""), 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
  };
  const hueSaturation = ([r, g, b]) => {
    const max = Math.max(r, g, b);
    const chroma = max - Math.min(r, g, b);
    let sector = 0;
    if (chroma > 0) sector = max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
    return [(sector * 60 + 360) % 360, max > 0 ? chroma / max : 0];
  };
  const brightColor = (hue, saturation) => {
    const sector = (((hue % 360) + 360) % 360) / 60;
    const second = saturation * (1 - Math.abs((sector % 2) - 1));
    const floor = 1 - saturation;
    const order = [
      [saturation, second, 0], [second, saturation, 0], [0, saturation, second],
      [0, second, saturation], [second, 0, saturation], [saturation, 0, second],
    ][Math.min(5, Math.floor(sector))];
    return order.map((channel) => channel + floor);
  };
  const foldHue = (hue) => {
    const wrapped = ((hue % 360) + 360) % 360;
    const [from, to] = HUE_GAP;
    if (wrapped <= from || wrapped >= to) return wrapped;
    return wrapped - from < to - wrapped ? from : to;
  };
  const buildPalette = (rgb, hueSpread) => {
    const [hue, saturation] = hueSaturation(rgb);
    const gain = saturation / PALETTE_SATURATION;
    const palette = new Float32Array(PALETTE_STEPS.length * 3);
    PALETTE_STEPS.forEach(([hueShift, saturationScale], index) => {
      palette.set(brightColor(foldHue(hue + hueShift * hueSpread), clamp(PALETTE_SATURATION * saturationScale * gain, 0, 1)), index * 3);
    });
    return palette;
  };

  const seededRandom = (seed) => {
    let state = seed | 0;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
      mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  };

  const rollLook = (seed) => {
    const next = seededRandom(seed);
    const sources = [BASE_LOOK, ...Object.values(PRESETS)];
    const weights = sources.map((_, index) => (-Math.log(1 - next())) ** 3 * (index === 0 ? 1.5 : 1));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const look = { ...BASE_LOOK };
    for (const [key, [low, high]] of Object.entries(BLENDED_RANGES)) {
      const blended = sources.reduce((sum, source, index) => sum + (source[key] * weights[index]) / total, 0);
      look[key] = clamp(blended * 1.7 ** (next() * 2 - 1), low, high);
    }
    look.seed = next() * 20;
    const [hue, saturation] = hueSaturation(hexToRgb(BASE_COLORS[Math.floor(next() * BASE_COLORS.length)]));
    const color = brightColor(foldHue(hue + (next() - 0.5) * 12), clamp(saturation * (0.9 + next() * 0.2), 0, 1));
    const hueSpread = 1 + next() * 2.5;
    for (const [key, [low, high]] of Object.entries(SMOKE_RANGES)) look[key] = low + next() * (high - low);
    return { look, color, hueSpread };
  };

  const chooseLook = (fallbackColor) => {
    const requested = new URLSearchParams(location.search).get("beam") ?? "";
    const named = requested === "default" ? BASE_LOOK : PRESETS[requested];
    if (named) return { look: named, color: hexToRgb(named.color ?? fallbackColor), hueSpread: 1, seed: requested };
    const seed = /^\d+$/.test(requested) ? Number(requested) : Math.floor(Math.random() * 1e6);
    return { ...rollLook(seed), seed: String(seed) };
  };

  const compileProgram = (gl) => {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
      gl.deleteShader(shader);
      return null;
    };
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
    gl.deleteProgram(program);
    return null;
  };

  const holder = document.querySelector(".beam[data-surface]");
  const canvas = holder?.querySelector("canvas");
  const touchDevice = matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (!holder || !canvas || touchDevice) return;
  const surface = document.querySelector(holder.dataset.surface);
  const source = holder.dataset.source ? document.querySelector(holder.dataset.source) : null;
  const anchor = Number(holder.dataset.beamX ?? 0.78);
  const avoided = holder.dataset.avoid ? [...document.querySelectorAll(holder.dataset.avoid)] : [];
  const contentRange = document.createRange();
  const contentRight = (element) => {
    contentRange.selectNodeContents(element);
    return contentRange.getBoundingClientRect().right;
  };
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: true });
  if (!surface || !gl) return;
  const program = compileProgram(gl);
  if (!program) return;

  const uniform = {};
  const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let index = 0; index < uniformCount; index += 1) {
    const name = gl.getActiveUniform(program, index).name.replace("[0]", "");
    uniform[name] = gl.getUniformLocation(program, name);
  }
  const vertexArray = gl.createVertexArray();
  gl.bindVertexArray(vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const { look, color, hueSpread, seed } = chooseLook(holder.dataset.beamColor ?? "#a46cf5");
  const palette = buildPalette(color, hueSpread);
  const rim = Array.from(palette.subarray(0, 3), (channel) => Math.round(channel * 255)).join(" ");
  holder.dataset.beam = seed;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const view = { width: 1, height: 1, ratio: 1 };
  const pointer = { x: 0, y: 0, inside: false };
  const lens = { x: 0, y: 0, vx: 0, vy: 0, strength: 0, placed: false };
  const frameSamples = [];
  let clock = 0;
  let introTime = reduceMotion ? SETTLE_SECONDS : 0;
  let quality = 1;
  let frozen = false;
  let frame = 0;
  let lastNow = 0;
  let onScreen = true;
  let alive = true;

  const markSource = (active) => {
    if (!source) return;
    if (active) {
      source.setAttribute("data-beam-source", "");
      source.style.setProperty("--beam-rim", rim);
    } else {
      source.removeAttribute("data-beam-source");
      source.removeAttribute("data-beam-struck");
      source.style.removeProperty("--beam-rim");
    }
    holder.toggleAttribute("data-sourced", active);
  };

  const measureSurface = (box) => {
    const rect = surface.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const style = getComputedStyle(surface);
    const radius = Math.max(Number.parseFloat(style.borderTopLeftRadius) || 0, Number.parseFloat(style.borderTopRightRadius) || 0);
    return {
      left: rect.left - box.left,
      top: rect.top - box.top,
      right: rect.right - box.left,
      bottom: rect.bottom - box.top,
      radius: Math.min(radius, rect.width / 2, rect.height / 2),
      real: true,
    };
  };

  const offscreenSurface = () => ({
    left: -view.width * 2, top: view.height, right: view.width * 3, bottom: view.height * 3, radius: 0, real: false,
  });

  const layout = () => {
    const box = holder.getBoundingClientRect();
    const unit = clamp(Math.min(view.width / 585, view.height / 507), 0.2, 1.25);
    let target = measureSurface(box) ?? offscreenSurface();
    const clearX = avoided.reduce((right, element) => Math.max(right, contentRight(element) - box.left + AVOID_GAP), 0);
    let columnX = Math.max(anchor * view.width, clearX);
    const inset = target.radius + 6;
    let sourceRect = null;
    const sourceBox = source?.getBoundingClientRect();
    if (sourceBox && sourceBox.width > 0) {
      const center = (sourceBox.left + sourceBox.right) / 2 - box.left;
      if (target.real && center >= clearX && center >= target.left + inset && center <= target.right - inset) {
        const sourceRadius = Number.parseFloat(getComputedStyle(source).borderTopLeftRadius) || 0;
        sourceRect = {
          left: sourceBox.left - box.left,
          top: sourceBox.top - box.top,
          right: sourceBox.right - box.left,
          bottom: sourceBox.bottom - box.top,
          radius: Math.min(sourceRadius, sourceBox.width / 2, sourceBox.height / 2),
        };
        columnX = center;
      }
    }
    markSource(Boolean(sourceRect));
    if (target.real) {
      if (columnX > target.right - inset) return null;
      if (columnX >= target.left) columnX = clamp(columnX, target.left + inset, target.right - inset);
      else target = offscreenSurface();
    }
    return { unit, columnX, target, sourceRect };
  };

  const introState = ({ unit, columnX, target, sourceRect }) => {
    const settled = introTime >= SETTLE_SECONDS;
    const startY = -0.15 * view.height;
    const span = target.top - startY + 0.3 * view.height;
    const front = settled ? target.top + 0.3 * view.height : startY + span * clamp(introTime / FALL_SECONDS, 0, 1) ** 1.3;
    const sinceImpact = introTime - FALL_SECONDS * (Math.max(0, target.top - startY) / span) ** (1 / 1.3);
    const before = sinceImpact <= 0;
    const maxRun = look.spread * 250 * 1.3 + 80;
    const run = settled ? 1e5 : before ? -40 : maxRun * (1 - Math.exp(-RUN_RATE * sinceImpact));
    const pour = (distance) => {
      if (settled) return [1000, 1];
      if (before) return [-distance, 0];
      const reach = Math.min(distance, maxRun * 0.97);
      const since = sinceImpact + Math.log(1 - reach / maxRun) / RUN_RATE;
      const ease = smootherStep(clamp((since + 0.15) / 0.8, 0, 1));
      if (since <= 0) return [run - reach, ease];
      return [Math.min(RUN_RATE * (maxRun - reach), POUR_SPEED_CAP) * since + POUR_ACCELERATION * since * since, ease];
    };
    const [leftFront, leftEase] = pour((columnX - target.left) / unit);
    const [rightFront, rightEase] = pour((target.right - columnX) / unit);
    const sourceHit = sourceRect ? FALL_SECONDS * clamp((sourceRect.top - startY) / span, 0, 1) ** (1 / 1.3) : 0;
    return {
      front,
      bloom: settled ? 1 : before ? 0 : dampedSpring(sinceImpact),
      flash: settled || before ? 0 : Math.exp(-sinceImpact / 0.35) * (1 - Math.exp(-sinceImpact / 0.05)),
      run,
      bead: settled || before ? 0 : Math.exp(-RUN_RATE * sinceImpact) * (1 - Math.exp(-sinceImpact / 0.08)),
      pour: [leftFront, rightFront, leftEase, rightEase],
      wrap: settled ? 1e5 : Math.max(0, introTime - sourceHit) * WRAP_SPEED,
      struck: settled || introTime >= sourceHit,
      atmosphere: settled ? 1 : before ? 0.3 * easeOutCubic(introTime / FALL_SECONDS) : 0.3 + 0.7 * (1 - Math.exp(-1.3 * sinceImpact)),
    };
  };

  const render = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const scene = layout();
    if (!scene) return false;
    const state = introState(scene);
    const { unit, columnX, target, sourceRect } = scene;
    source?.toggleAttribute("data-beam-struck", Boolean(sourceRect) && state.struck);

    gl.useProgram(program);
    gl.uniform2f(uniform.uViewport, view.width, view.height);
    gl.uniform1f(uniform.uPixelRatio, view.ratio);
    gl.uniform1f(uniform.uUnit, unit);
    gl.uniform1f(uniform.uClock, clock);
    gl.uniform1f(uniform.uColumnX, columnX);
    gl.uniform4f(uniform.uSourceRect, sourceRect?.left ?? 0, sourceRect?.top ?? 0, sourceRect?.right ?? 0, sourceRect?.bottom ?? 0);
    gl.uniform3f(uniform.uSourceWrap, sourceRect?.radius ?? 0, state.wrap, sourceRect ? 1 : 0);
    gl.uniform1f(uniform.uFallStretch, look.fall);
    gl.uniform4f(uniform.uSurfaceRect, target.left, target.top, target.right, target.bottom);
    gl.uniform1f(uniform.uSurfaceRadius, target.radius);
    gl.uniform3f(uniform.uImpact, state.front, state.bloom, state.flash);
    gl.uniform4f(uniform.uPour, ...state.pour);
    gl.uniform2f(uniform.uRun, state.run, state.bead);
    gl.uniform4f(uniform.uLens, lens.x, lens.y, 95 * unit, lens.strength);
    gl.uniform1f(uniform.uAtmosphere, state.atmosphere);
    gl.uniform4f(uniform.uAmount, look.intensity, look.fog, look.dust, look.streaks);
    gl.uniform4f(uniform.uShape, look.beamWidth, look.flare, look.spread, look.spill);
    gl.uniform4f(uniform.uExtra, look.pulse, look.dots, 34.34 + look.seed * 7.31, 11.58 + look.seed * 3.17);
    gl.uniform4f(uniform.uSmoke, look.smokeSize, look.smokeDetail, look.smokeEdge, look.smokeSwirl);
    gl.uniform1f(uniform.uSmokeDrift, look.smokeDrift);
    gl.uniform3fv(uniform.uPalette, palette);
    gl.bindVertexArray(vertexArray);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    return true;
  };

  const resize = () => {
    const width = Math.max(1, holder.clientWidth);
    const height = Math.max(1, holder.clientHeight);
    const deviceRatio = Math.min(devicePixelRatio || 1, MAX_DEVICE_RATIO);
    const longest = Math.max(width, height) * deviceRatio;
    const ratio = (longest > MAX_CANVAS_SIDE ? (deviceRatio * MAX_CANVAS_SIDE) / longest : deviceRatio) * quality;
    const pixelWidth = Math.max(1, Math.round(width * ratio));
    const pixelHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    Object.assign(view, { width, height, ratio: canvas.width / width });
  };

  const watchFrameTime = (delta) => {
    frameSamples.push(delta);
    if (frameSamples.length < 20) return;
    frameSamples.sort((a, b) => a - b);
    const median = frameSamples[10];
    frameSamples.length = 0;
    if (median <= SLOW_FRAME_MS) return;
    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality * 0.7);
      resize();
    } else {
      frozen = true;
    }
  };

  const followPointer = (dt) => {
    const active = pointer.inside && !reduceMotion;
    if (active && !lens.placed) Object.assign(lens, { x: pointer.x, y: pointer.y, vx: 0, vy: 0, placed: true });
    lens.vx += (120 * (pointer.x - lens.x) - 19 * lens.vx) * dt;
    lens.vy += (120 * (pointer.y - lens.y) - 19 * lens.vy) * dt;
    lens.x += lens.vx * dt;
    lens.y += lens.vy * dt;
    const goal = active ? 1 : 0;
    lens.strength += (goal - lens.strength) * (1 - Math.exp(-dt / (goal > lens.strength ? 0.3 : 0.55)));
    if (lens.strength < 0.001 && !active) lens.placed = false;
    return Math.abs(lens.strength - goal) > 0.002 || Math.hypot(lens.vx, lens.vy) > 0.5;
  };

  const tick = (now) => {
    frame = 0;
    if (!alive || !onScreen || document.hidden) return;
    if (lastNow && !frozen) watchFrameTime(now - lastNow);
    const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 1 / 60;
    lastNow = now;
    const animating = !reduceMotion && !frozen;
    if (animating) clock += dt * look.speed;
    const introducing = introTime < SETTLE_SECONDS;
    if (introducing) introTime = Math.min(SETTLE_SECONDS, introTime + dt);
    const lensMoving = followPointer(dt);
    if (render() && (animating || introducing || lensMoving)) frame = requestAnimationFrame(tick);
    else lastNow = 0;
  };

  const wake = () => {
    if (!frame && alive && onScreen && !document.hidden) frame = requestAnimationFrame(tick);
  };

  const relayout = () => {
    resize();
    render();
    wake();
  };

  const resizeObserver = new ResizeObserver(relayout);
  resizeObserver.observe(holder);
  resizeObserver.observe(surface);
  new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
    if (onScreen) {
      lastNow = 0;
      wake();
    }
  }).observe(holder);
  addEventListener(
    "pointermove",
    (event) => {
      const box = holder.getBoundingClientRect();
      pointer.x = event.clientX - box.left;
      pointer.y = event.clientY - box.top;
      pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= box.width && pointer.y <= box.height;
      wake();
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", () => {
    pointer.inside = false;
    wake();
  });
  document.addEventListener("visibilitychange", () => {
    lastNow = 0;
    wake();
  });
  canvas.addEventListener("webglcontextlost", () => {
    alive = false;
    cancelAnimationFrame(frame);
    markSource(false);
  });

  relayout();
})();
