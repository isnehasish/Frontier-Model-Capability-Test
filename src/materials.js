// Materials: procedural veined marble, gold, glass; shader patches for the
// stained-glass sun cookie and the planar floor reflection.
import * as THREE from 'three';
import { noise3D, stainedGlass, filigree, floorInlay } from './textures.js';

export const shared = {
  uNoise3: { value: null },
  uSunCookie: { value: null },
  uSunMatrix: { value: new THREE.Matrix4() },
  uCookieOn: { value: 0 },
  uRefl: { value: null },
  uReflMatrix: { value: new THREE.Matrix4() },
  uReflOn: { value: 0 },
  uReflTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
};

const MARBLE_GLSL = /* glsl */`
uniform highp sampler3D uNoise3;
float n3(vec3 p){ vec3 q=p*64.; vec3 i=floor(q), f=fract(q); f=f*f*(3.-2.*f); return texture(uNoise3, (i+f+.5)/64.).r; }
float fbm3(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*n3(p); p=p*2.03+vec3(.31,.17,.53); a*=.5; } return s/.9375; }
// returns (vein, cloud)
vec2 marbleVeins(vec3 wp, float sc){
  vec3 p = wp*sc;
  vec3 w = vec3(fbm3(p*.55), fbm3(p*.55+vec3(7.3,1.1,3.7)), fbm3(p*.55+vec3(2.9,5.7,9.1)))-.5;
  float f = fbm3(p*.3 + w*.05);
  float f2 = fbm3(p*.5 + w.zxy*.06 + 3.3);
  float v = 1.-smoothstep(0.,.022,abs(f-.5));
  float vb = 1.-smoothstep(0.,.1,abs(f-.5));
  float v2 = 1.-smoothstep(0.,.014,abs(f2-.55));
  float cloud = fbm3(p*.21+w*.02);
  float mask = smoothstep(.38,.62, fbm3(p*.1+vec3(9.1,3.3,5.7)));
  return vec2(clamp(v*.8 + vb*.2 + v2*.35*mask, 0., 1.)*(.35+.65*mask), cloud);
}
`;

function patch(mat, opt = {}) {
  const { marble = 0, scale = 0.11, vein = 0.55, veinColor = [0.36, 0.34, 0.35], floor = false } = opt;
  mat.onBeforeCompile = (sh) => {
    for (const k of Object.keys(shared)) sh.uniforms[k] = shared[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp_ = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp_ = instanceMatrix * wp_;
        #endif
        vWPos = (modelMatrix * wp_).xyz;`);
    let fs = sh.fragmentShader;
    fs = fs.replace('#include <common>', `#include <common>
      varying vec3 vWPos;
      uniform sampler2D uSunCookie; uniform mat4 uSunMatrix; uniform float uCookieOn;
      uniform sampler2D uRefl; uniform mat4 uReflMatrix; uniform float uReflOn; uniform vec2 uReflTexel;
      ${marble ? MARBLE_GLSL : ''}
      float mVein = 0.;`);
    if (marble) {
      fs = fs.replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 mv = marbleVeins(vWPos, ${scale.toFixed(4)});
          mVein = mv.x;
          vec3 base = diffuseColor.rgb * mix(vec3(.93,.915,.9), vec3(1.0,.985,.96), smoothstep(.3,.7,mv.y));
          float lum = dot(diffuseColor.rgb, vec3(.333));
          vec3 vc = mix(vec3(${veinColor.map(v => v.toFixed(3)).join(',')}), vec3(.62,.55,.43), smoothstep(.45,.75,mv.y));
          vc = mix(vec3(.75,.72,.68), vc, smoothstep(.15,.6,lum)); // light veins in dark stone
          diffuseColor.rgb = mix(base, vc*max(lum,.5), mVein*${vein.toFixed(3)});
        }`);
      fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + mVein*.12, .03, 1.);`);
    }
    const chunk = THREE.ShaderChunk.lights_fragment_begin;
    const key = 'getDirectionalLightInfo( directionalLight, directLight );';
    if (!chunk.includes(key)) console.warn('sun cookie patch: light chunk changed');
    fs = fs.replace('#include <lights_fragment_begin>', chunk.replace(key, key + `
      {
        vec4 sc_ = uSunMatrix * vec4(vWPos, 1.0);
        vec3 ck_ = texture2D(uSunCookie, sc_.xy*.5+.5).rgb;
        ck_ = pow(ck_, vec3(1.5))*1.15;
        directLight.color *= mix(vec3(1.), ck_, uCookieOn);
      }`));
    if (floor) {
      fs = fs.replace('#include <opaque_fragment>', `
        {
          vec4 rc_ = uReflMatrix * vec4(vWPos, 1.0);
          vec2 ruv = rc_.xy / rc_.w;
          vec3 Vv = normalize(cameraPosition - vWPos);
          float ndv = clamp(Vv.y, 0., 1.);
          float dist = length(cameraPosition - vWPos);
          vec2 bl = uReflTexel * (1.2 + roughnessFactor*14.);
          vec3 rf = texture2D(uRefl, ruv).rgb*.28;
          rf += texture2D(uRefl, ruv+vec2(bl.x,0.)).rgb*.12 + texture2D(uRefl, ruv-vec2(bl.x,0.)).rgb*.12;
          rf += texture2D(uRefl, ruv+vec2(0.,bl.y*1.6)).rgb*.12 + texture2D(uRefl, ruv-vec2(0.,bl.y*1.6)).rgb*.12;
          rf += texture2D(uRefl, ruv+vec2(0.,bl.y*3.6)).rgb*.12 + texture2D(uRefl, ruv-vec2(0.,bl.y*3.6)).rgb*.12;
          rf = min(rf, vec3(24.));
          float fr = .055 + .945*pow(1.-ndv, 4.6);
          fr *= 1. - mVein*.25;
          vec3 F = mix(vec3(fr), diffuseColor.rgb + (1.-diffuseColor.rgb)*pow(1.-ndv,5.), metalnessFactor);
          outgoingLight += (rf*F - reflectedLight.indirectSpecular) * uReflOn;
        }
        #include <opaque_fragment>`);
    }
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `p|${marble}|${scale}|${vein}|${veinColor}|${floor}`;
  return mat;
}

export function makeMaterials(renderer) {
  shared.uNoise3.value = noise3D(64);
  const white1 = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white1.needsUpdate = true;
  shared.uSunCookie.value = white1; shared.uRefl.value = white1;
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const fil = filigree(1024, 5, false);
  const filG = filigree(1024, 9, true);
  for (const t of [fil.bump, fil.color, filG.bump, filG.color]) t.anisotropy = aniso;
  const flr = floorInlay(4096);
  flr.color.anisotropy = flr.orm.anisotropy = aniso;

  const gTall = stainedGlass(768, 2048, 11);
  const gLow = stainedGlass(1024, 1024, 23);
  const gThrone = stainedGlass(768, 1536, 37, 1);
  for (const t of [gTall, gLow, gThrone]) t.anisotropy = aniso;

  const S = THREE.DoubleSide;
  const M = {};
  M.marble = patch(new THREE.MeshStandardMaterial({ color: 0xf3efe8, roughness: 0.3, metalness: 0, side: S }), { marble: 1, scale: 0.075, vein: 0.36 });
  M.vault = patch(new THREE.MeshStandardMaterial({ color: 0xf6f1e8, roughness: 0.55, metalness: 0, side: S, map: fil.color, bumpMap: fil.bump, bumpScale: 0.5 }), { marble: 1, scale: 0.09, vein: 0.14 });
  M.floor = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 1, map: flr.color, roughnessMap: flr.orm, metalnessMap: flr.orm }), { marble: 1, scale: 0.06, vein: 0.5, floor: true });
  M.gold = patch(new THREE.MeshStandardMaterial({ color: 0xf7cf86, roughness: 0.3, metalness: 1, side: S }));
  M.goldRelief = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.34, metalness: 1, side: S, map: filG.color, bumpMap: filG.bump, bumpScale: 0.8 }));
  M.tracery = patch(new THREE.MeshStandardMaterial({ color: 0xf1e6cf, roughness: 0.4, metalness: 0.0, side: S }), { marble: 1, scale: 0.2, vein: 0.12 });
  M.bronze = patch(new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.45, metalness: 0.9, side: S, map: filG.color, bumpMap: filG.bump, bumpScale: 3 }));
  M.cloth = patch(new THREE.MeshStandardMaterial({ color: 0x4a3f3a, roughness: 0.9, metalness: 0, side: S }));
  M.stem = patch(new THREE.MeshStandardMaterial({ color: 0x3c3a22, roughness: 0.85, metalness: 0, side: S }));
  M.leaf = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, side: S }));

  const glass = (map, r, g, b) => new THREE.MeshBasicMaterial({ map, color: new THREE.Color(r, g, b), side: S });
  M.glassSunTall = glass(gTall, 1.75, 1.75, 1.7);
  M.glassSunLow = glass(gLow, 1.6, 1.6, 1.55);
  M.glassShadeTall = glass(gTall, 1.0, 1.04, 1.12);
  M.glassShadeLow = glass(gLow, 0.9, 0.94, 1.02);
  M.glassSky = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.3, 2.5, 2.9), side: S });
  M.glassThrone = glass(gThrone, 1.5, 1.28, 0.9);
  M.glassDome = glass(gLow, 1.7, 1.85, 2.1);
  M.lanternGlass = new THREE.MeshBasicMaterial({ color: new THREE.Color(6.0, 3.3, 1.2), side: S });
  M._floorInfo = flr;
  return M;
}
