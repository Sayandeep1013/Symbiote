precision highp float;

#define NUM_TENT 14

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform vec3 uTentBase[NUM_TENT];
uniform vec3 uTentTip[NUM_TENT];

varying vec2 vUv;

// ---------- simplex noise (Ashima Arts / Ian McEwan, MIT) ----------
// Used ONLY for the core surface's micro-bump texture (one call per map()
// evaluation) - all per-tentacle motion is precomputed on the CPU and
// uploaded via uTentBase/uTentTip, so this never runs in a per-tentacle loop.
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// ---------- SDF primitives ----------
const float CORE_R = 0.85;
const float BOUND_R = 2.1;

float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

float sdSphere(vec3 p, float r){ return length(p) - r; }

float sdCapsule(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float r = mix(r1, r2, h);
  return length(pa - ba*h) - r;
}

float sphIntersect(vec3 ro, vec3 rd, float r){
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r*r;
  float h = b*b - c;
  if (h < 0.0) return -1.0;
  return -b - sqrt(h);
}

// ---------- scene ----------
float map(vec3 p){
  float coreNoise = snoise(normalize(p + vec3(0.001)) * 2.2 + uTime * 0.05);
  float d = sdSphere(p, CORE_R + 0.022 * coreNoise);

  for (int i = 0; i < NUM_TENT; i++){
    float cap = sdCapsule(p, uTentBase[i], uTentTip[i], 0.095, 0.01);
    d = smin(d, cap, 0.17);
  }

  return d;
}

float raymarch(vec3 ro, vec3 rd, float tStart, float tMax){
  float t = tStart;
  for (int i = 0; i < 64; i++){
    vec3 p = ro + rd*t;
    float d = map(p);
    if (d < 0.0015) return t;
    t += d * 0.9;
    if (t > tMax) break;
  }
  return -1.0;
}

vec3 calcNormal(vec3 p){
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

// cheap iq-style ambient occlusion: darkens creases (tentacle/core joints)
float calcAO(vec3 p, vec3 n){
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 4; i++){
    float h = 0.02 + 0.10 * float(i) / 3.0;
    float d = map(p + n*h);
    occ += (h - d) * sca;
    sca *= 0.7;
  }
  return clamp(1.0 - 2.5*occ, 0.0, 1.0);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uResolution.xy) / uResolution.y;

  vec3 ro = uCamPos;
  vec3 forward = normalize(-uCamPos);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  float fovScale = tan(radians(22.5));
  vec3 rd = normalize(forward + uv.x*right*fovScale + uv.y*up*fovScale);

  vec3 bg = mix(vec3(0.01, 0.01, 0.015), vec3(0.0), smoothstep(0.0, 1.1, length(uv)));
  vec3 col = bg;

  // bounding-sphere pretest: empty-space pixels (most of the screen) skip
  // the raymarch loop entirely instead of paying for 64 wasted steps
  float bEnter = sphIntersect(ro, rd, BOUND_R);

  if (bEnter >= 0.0){
    float bExit = -dot(ro, rd) + sqrt(max(0.0, dot(ro,rd)*dot(ro,rd) - dot(ro,ro) + BOUND_R*BOUND_R));
    float t = raymarch(ro, rd, max(bEnter, 0.0), bExit);

    if (t > 0.0){
      vec3 p = ro + rd*t;
      vec3 n = calcNormal(p);
      vec3 viewDir = normalize(ro - p);
      float ao = calcAO(p, n);

      vec3 lightDir1 = normalize(vec3(0.55, 0.85, 0.4));   // key light, tight hotspot
      vec3 lightDir2 = normalize(vec3(-0.7, 0.3, 0.5));    // secondary glint
      vec3 lightDir3 = normalize(vec3(0.1, -0.6, 0.5));    // faint under-fill

      float diff1 = pow(max(0.0, dot(n, lightDir1)), 1.6);
      float diff2 = pow(max(0.0, dot(n, lightDir2)), 1.6);
      float diff3 = max(0.0, dot(n, lightDir3));

      vec3 halfV1 = normalize(lightDir1 + viewDir);
      vec3 halfV2 = normalize(lightDir2 + viewDir);
      float spec1 = pow(max(0.0, dot(n, halfV1)), 260.0);
      float spec2 = pow(max(0.0, dot(n, halfV2)), 200.0);

      float fresnel = pow(1.0 - max(0.0, dot(n, viewDir)), 4.0);

      // deep near-black base with a faint cold undertone in shadow, so
      // dark areas read as "wet black" rather than crushed/flat
      vec3 shadowTint = vec3(0.012, 0.008, 0.022);
      vec3 base = vec3(0.004);
      col = mix(shadowTint, base, diff1) * ao;
      col += base * (diff1*1.5 + diff2*0.6 + diff3*0.3) * ao;
      col += vec3(1.0, 0.98, 0.95) * spec1 * 1.9 * ao;
      col += vec3(0.8, 0.85, 1.0) * spec2 * 1.0 * ao;
      col += vec3(0.16, 0.2, 0.32) * fresnel;

      float fog = smoothstep(3.0, 13.0, t);
      col = mix(col, bg, fog * 0.65);
    }
  }

  col = pow(max(col, 0.0), vec3(0.4545));
  gl_FragColor = vec4(col, 1.0);
}
