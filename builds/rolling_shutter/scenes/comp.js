// scenes/comp.js -- the composite pass: captured photo + live view (ghost) + scan line -> display (ACES, sRGB).
// Everything here is in "view" pixels (a full 1080 x 1920 frame of one camera). A display transform (scale about a
// centre, plus an offset) lets a whole view be shrunk or moved on screen like a photo.
import * as THREE from 'three';
import { W, H, AMBER } from './engine.js';

const vert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const frag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tBg, tProp, tCap, tPrev;
uniform vec2 uView;            // view size in px (1080, 1920)
uniform vec4 uCapRect;         // capture rect in view px: x, y(top), w, h
uniform float uRows;           // sensor rows (= uCapRect.w or .h depending on dir)
uniform float uScan;           // rows captured so far (0..uRows); the scan line sits here
uniform float uDir;            // 0: rows run down; 1: rows run left -> right (phone sideways)
uniform float uHasCap, uHasPrev, uShowLine;
uniform float uBelowGain;      // brightness of the not-yet-captured part
uniform float uGhost;          // opacity of the live propeller drawn as a pale ghost
uniform float uLive;           // opacity of the live propeller drawn normally (below the line)
uniform float uAmberLen;       // rows behind the line over which the capture fades from amber to neutral (big = stays amber)
uniform float uAmberAmt;       // how much amber at the line (0..1)
uniform float uExposure;
uniform vec3 uAmber;
uniform vec4 uDisp;            // display: centre x, centre y (screen px), scale, alpha
uniform vec2 uDispView;        // view point that sits at the display centre
uniform float uLineW;          // scan line thickness in screen px
uniform float uFadeTop;        // fade the whole view (0..1)
uniform float uOutGain;        // final multiply (0..1) for this layer
uniform float uPrevAmber;      // amber on the earlier photo (0..1)
uniform float uTrack;          // tint the tracked blade (live mask 1.0 vs 0.5) in the ghost
uniform float uCapGain;        // 1 = photo, 0 = back to the unexposed view
uniform vec2 uScreen;

vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
vec3 amberOf(vec3 c){ float l = lum(c); return uAmber * l * 1.75 + vec3(smoothstep(1.0, 3.5, l)) * 0.35; }

void main(){
  vec2 sp = vec2(vUv.x, 1.0 - vUv.y) * uScreen;                 // screen px, y down
  vec2 q = uDispView + (sp - uDisp.xy) / uDisp.z;                // view px, y down
  if (q.x < 0.0 || q.y < 0.0 || q.x > uView.x || q.y > uView.y) discard;
  vec2 uv = vec2(q.x / uView.x, 1.0 - q.y / uView.y);
  vec3 bg = texture2D(tBg, uv).rgb;
  vec4 pr = texture2D(tProp, uv);
  vec3 col = bg * uBelowGain * (1.0 - clamp(pr.a, 0.0, 1.0) * uLive) + pr.rgb * uLive;   // the view before capture
  // where is this pixel in the sensor, and has the line passed it?
  vec2 c = (q - uCapRect.xy) / uCapRect.zw;
  bool inCap = c.x >= 0.0 && c.y >= 0.0 && c.x <= 1.0 && c.y <= 1.0;
  float row = (uDir < 0.5 ? c.y : c.x) * uRows;
  if (inCap && uHasPrev > 0.5 && row >= uScan) {                // an earlier photo still showing below the line
    vec4 pv = texture2D(tPrev, vec2(c.x, 1.0 - c.y));
    col = mix(pv.rgb, amberOf(pv.rgb), uPrevAmber * smoothstep(0.55, 1.0, pv.a));
  }
  if (inCap && uHasCap > 0.5 && row < uScan) {
    vec4 cp = texture2D(tCap, vec2(c.x, 1.0 - c.y));            // bilinear at the 2x2 centre = box filter
    float behind = uScan - row;
    float a = uAmberAmt * smoothstep(0.55, 1.0, cp.a) * exp(-behind / max(uAmberLen, 1e-3));
    col = mix(col, mix(cp.rgb, amberOf(cp.rgb), a), uCapGain);
  }
  // the live propeller as a pale ghost (desaturated, light)
  float gl = lum(pr.rgb / max(pr.a, 1e-3));
  vec3 pale = vec3(0.16 + 0.45 * clamp(gl, 0.0, 1.5));
  float tr = uTrack * smoothstep(0.7, 0.95, pr.a);
  pale = mix(pale, uAmber * (0.25 + 0.6 * clamp(gl, 0.0, 1.5)), tr);
  col = mix(col, pale, clamp(pr.a * (1.0 + uTrack), 0.0, 1.0) * uGhost);
  col = toSRGB(aces(col * uExposure));
  // the scan line: a thin, crisp, bright amber line across the sensor at the current row
  if (uShowLine > 0.5) {
    float d; float span;
    if (uDir < 0.5) { d = abs(q.y - (uCapRect.y + uScan / uRows * uCapRect.w)); span = step(uCapRect.x, q.x) * step(q.x, uCapRect.x + uCapRect.z); }
    else { d = abs(q.x - (uCapRect.x + uScan / uRows * uCapRect.z)); span = step(uCapRect.y, q.y) * step(q.y, uCapRect.y + uCapRect.w); }
    float dpx = d * uDisp.z;                                     // in screen px
    float core = 1.0 - smoothstep(uLineW * 0.5 - 0.5, uLineW * 0.5 + 0.5, dpx);
    vec3 lineCol = mix(vec3(1.0, 0.86, 0.62), toSRGB(uAmber), 0.35);
    col = mix(col, lineCol, core * span * uShowLine);
  }
  gl_FragColor = vec4(col * uOutGain, uDisp.w);
}`;

export class Compositor {
  constructor(renderer) {
    this.r = renderer;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        tBg: { value: null }, tProp: { value: null }, tCap: { value: null }, tPrev: { value: null },
        uView: { value: new THREE.Vector2(W, H) }, uCapRect: { value: new THREE.Vector4(0, 240, 1080, 1440) },
        uRows: { value: 1440 }, uScan: { value: 0 }, uDir: { value: 0 }, uHasCap: { value: 0 }, uHasPrev: { value: 0 }, uShowLine: { value: 1 },
        uBelowGain: { value: 1 }, uGhost: { value: 0 }, uLive: { value: 0 }, uAmberLen: { value: 300 }, uAmberAmt: { value: 1 },
        uExposure: { value: 1 }, uAmber: { value: AMBER.clone() }, uDisp: { value: new THREE.Vector4(540, 960, 1, 1) },
        uDispView: { value: new THREE.Vector2(540, 960) }, uLineW: { value: 3 }, uFadeTop: { value: 0 }, uOutGain: { value: 1 },
        uScreen: { value: new THREE.Vector2(W, H) },
        uPrevAmber: { value: 1 }, uTrack: { value: 0 }, uCapGain: { value: 1 },
      },
    });
    this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  // draw one layer; p = uniform values. target null = canvas
  draw(p, target = null, clear = false) {
    const u = this.mat.uniforms;
    const d = {
      tBg: null, tProp: null, tCap: null, tPrev: null, capRect: [0, 240, 1080, 1440], rows: 1440, scan: 0, dir: 0, showLine: 1,
      belowGain: 1, ghost: 0, live: 0, amberLen: 300, amberAmt: 1, exposure: 1, disp: [540, 960, 1, 1], dispView: [540, 960],
      lineW: 3, outGain: 1, screen: [W, H], prevAmber: 1, track: 0, capGain: 1, ...p,
    };
    u.tBg.value = d.tBg; u.tProp.value = d.tProp; u.tCap.value = d.tCap; u.tPrev.value = d.tPrev;
    u.uHasCap.value = d.tCap ? 1 : 0; u.uHasPrev.value = d.tPrev ? 1 : 0;
    u.uCapRect.value.set(...d.capRect); u.uRows.value = d.rows; u.uScan.value = d.scan; u.uDir.value = d.dir;
    u.uShowLine.value = d.showLine; u.uBelowGain.value = d.belowGain; u.uGhost.value = d.ghost; u.uLive.value = d.live;
    u.uAmberLen.value = d.amberLen; u.uAmberAmt.value = d.amberAmt; u.uExposure.value = d.exposure;
    u.uDisp.value.set(...d.disp); u.uDispView.value.set(...d.dispView); u.uLineW.value = d.lineW; u.uOutGain.value = d.outGain;
    u.uScreen.value.set(...d.screen);
    u.uPrevAmber.value = d.prevAmber; u.uTrack.value = d.track; u.uCapGain.value = d.capGain;
    const r = this.r;
    r.setRenderTarget(target);
    const ac = r.autoClear;
    if (clear) { r.setClearColor(0x0b0b0c, 1); r.clear(); }
    r.autoClear = false;
    r.render(this.scene, this.cam);
    r.autoClear = ac;
  }
}
