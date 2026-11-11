// Render pipeline: HDR scene (MSAA) -> N8AO -> volumetric sun shafts -> bloom -> grade/tonemap -> SMAA
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { N8AOPostPass } from 'n8ao';

const VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const VOL_FS = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tDepth; uniform highp sampler2D tSunDepth; uniform sampler2D tCookie; uniform highp sampler3D uNoise3;
uniform mat4 uInvProj, uCamWorld, uSunVP;
uniform vec3 uCamPos, uSunDir, uSunColor;
uniform float uDensity, uTime, uFrame, uCookieOn;
float ign(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(0.06711056,0.00583715)))); }
void main(){
  float d = texture2D(tDepth, vUv).r;
  vec4 vp = uInvProj * vec4(vUv*2.-1., d*2.-1., 1.); vp /= vp.w;
  vec3 wp = (uCamWorld * vec4(vp.xyz, 1.)).xyz;
  vec3 ray = wp - uCamPos; float len = min(length(ray), 110.); vec3 dir = normalize(ray);
  const int N = 44;
  float dt = len / float(N);
  float j = ign(gl_FragCoord.xy + uFrame*5.588238);
  float ct = dot(dir, uSunDir);
  float g = .62;
  float phase = mix((1.-g*g)/(4.*3.14159*pow(1.+g*g-2.*g*ct, 1.5)), 1./(4.*3.14159), .35);
  vec3 acc = vec3(0.); float T = 1.;
  for(int i=0;i<N;i++){
    vec3 p = uCamPos + dir * (float(i)+j) * dt;
    vec4 sc = uSunVP * vec4(p, 1.);
    vec3 s = sc.xyz*.5+.5;
    float sd = texture2D(tSunDepth, s.xy).r;
    float lit = step(s.z - .0012, sd);
    float dn = uDensity * (.55 + .9*texture(uNoise3, p*.045 + vec3(uTime*.006, -uTime*.004, uTime*.003)).r) * (1. + .5*smoothstep(8., 0., p.y));
    vec3 ck = mix(vec3(1.), pow(texture2D(tCookie, s.xy).rgb, vec3(1.5))*1.15, uCookieOn*.5);
    acc += lit * ck * dn * T * dt;
    T *= exp(-dn*dt*.6);
  }
  gl_FragColor = vec4(acc * phase * uSunColor, T);
}`;

const BLUR_FS = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uDir;
void main(){
  vec4 c = texture2D(tDiffuse, vUv)*.227;
  c += (texture2D(tDiffuse, vUv+uDir*1.385)+texture2D(tDiffuse, vUv-uDir*1.385))*.316;
  c += (texture2D(tDiffuse, vUv+uDir*3.231)+texture2D(tDiffuse, vUv-uDir*3.231))*.0703;
  gl_FragColor = c;
}`;

const COMBINE_FS = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D tScene, tVol; uniform float uVol;
void main(){
  vec3 c = texture2D(tScene, vUv).rgb;
  vec4 v = texture2D(tVol, vUv);
  c = c * mix(1., v.a, .5) + v.rgb * uVol;
  gl_FragColor = vec4(max(c, 0.), 1.);
}`;

const FINAL_FS = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uExposure, uTime; uniform vec2 uRes;
vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v+.0245786)-.000090537; vec3 b = v*(.983729*v+.4329510)+.238081; return a/b; }
vec3 aces(vec3 c){
  const mat3 I = mat3(.59719,.07600,.02840, .35458,.90834,.13383, .04823,.01566,.83777);
  const mat3 O = mat3(1.60475,-.10208,-.00327, -.53108,1.10813,-.07276, -.07367,-.00605,1.07602);
  c = I*c; c = RRTAndODTFit(c); return clamp(O*c, 0., 1.);
}
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
void main(){
  vec2 q = vUv - .5;
  float r2 = dot(q,q);
  vec2 ca = q * r2 * .006;
  vec3 c = vec3(texture2D(tDiffuse, vUv - ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + ca).b);
  c *= uExposure;
  c *= 1. - .5*smoothstep(.12, .8, r2);           // vignette
  c = aces(c*1.05);
  // grade: warm highlights, cool-neutral shadows, gentle S-curve, a touch of saturation
  float l = dot(c, vec3(.2126,.7152,.0722));
  c = mix(c, c*vec3(1.05,1.0,.9), smoothstep(.2,.95,l));
  c = mix(c, c*vec3(.97,.99,1.04), 1.-smoothstep(0.,.35,l));
  c = mix(vec3(l), c, 1.1);
  c = mix(c, c*c*(3.-2.*c), .22);
  c = pow(max(c,0.), vec3(1./2.2));
  c += (hash(vUv*uRes + fract(uTime)*91.7) - .5) * .012;
  gl_FragColor = vec4(c, 1.);
}`;

const mat = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });

export class Pipeline {
  constructor(renderer, scene, camera, sun) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.sun = sun;
    this.frame = 0;
    this.opts = { ao: true, vol: true, bloom: true, smaa: true };
    const hf = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.sceneRT = new THREE.WebGLRenderTarget(4, 4, { ...hf, samples: 4 });
    this.sceneRT.depthTexture = new THREE.DepthTexture(4, 4, THREE.UnsignedIntType);
    this.aoRT = new THREE.WebGLRenderTarget(4, 4, hf);
    this.hdrRT = new THREE.WebGLRenderTarget(4, 4, hf);
    this.volA = new THREE.WebGLRenderTarget(4, 4, hf);
    this.volB = new THREE.WebGLRenderTarget(4, 4, hf);
    this.ldrRT = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

    this.ao = new N8AOPostPass(scene, camera, 4, 4);
    this.ao.setDepthTexture(this.sceneRT.depthTexture);
    Object.assign(this.ao.configuration, { aoRadius: 4.0, distanceFalloff: 1.0, intensity: 8.0, aoSamples: 12, denoiseSamples: 6, denoiseRadius: 12, halfRes: false, depthAwareUpsampling: false, gammaCorrection: false });
    this.ao.configuration.color = new THREE.Color(0.05, 0.035, 0.03);

    this.volMat = mat(VOL_FS, {
      tDepth: { value: this.sceneRT.depthTexture }, tSunDepth: { value: sun.depthRT.depthTexture }, tCookie: { value: sun.cookieRT.texture },
      uNoise3: { value: sun.noise }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uSunVP: { value: sun.matrix },
      uCamPos: { value: new THREE.Vector3() }, uSunDir: { value: sun.dir }, uSunColor: { value: new THREE.Color(1, 0.91, 0.76).multiplyScalar(80) },
      uDensity: { value: 0.008 }, uTime: { value: 0 }, uFrame: { value: 0 }, uCookieOn: { value: 1 },
    });
    this.blurMat = mat(BLUR_FS, { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.combineMat = mat(COMBINE_FS, { tScene: { value: null }, tVol: { value: null }, uVol: { value: 1 } });
    this.finalMat = mat(FINAL_FS, { tDiffuse: { value: null }, uExposure: { value: 1 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2() } });
    this.quad = new FullScreenQuad(this.volMat);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.3, 0.7, 1.3);
    this.smaa = new SMAAPass();
    this.smaa.renderToScreen = true;
  }
  setSize(w, h) {
    this.w = w; this.h = h;
    for (const rt of [this.sceneRT, this.aoRT, this.hdrRT, this.ldrRT]) rt.setSize(w, h);
    const vw = Math.ceil(w / 2), vh = Math.ceil(h / 2);
    this.volA.setSize(vw, vh); this.volB.setSize(vw, vh);
    this.ao.setSize(w, h); this.bloom.setSize(w, h); this.smaa.setSize(w, h);
    this.finalMat.uniforms.uRes.value.set(w, h);
  }
  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }
  render(time) {
    const r = this.renderer, cam = this.camera, o = this.opts;
    this.frame++;
    r.setRenderTarget(this.sceneRT); r.clear(); r.render(this.scene, cam);
    let src = this.sceneRT;
    if (o.ao) { this.ao.render(r, this.sceneRT, this.aoRT); src = this.aoRT; }
    const u = this.volMat.uniforms;
    if (o.vol) {
      u.uInvProj.value.copy(cam.projectionMatrixInverse); u.uCamWorld.value.copy(cam.matrixWorld);
      u.uCamPos.value.setFromMatrixPosition(cam.matrixWorld); u.uTime.value = time; u.uFrame.value = this.frame % 8;
      this.pass(this.volMat, this.volA);
      const b = this.blurMat.uniforms;
      b.tDiffuse.value = this.volA.texture; b.uDir.value.set(1 / this.volA.width, 0); this.pass(this.blurMat, this.volB);
      b.tDiffuse.value = this.volB.texture; b.uDir.value.set(0, 1 / this.volA.height); this.pass(this.blurMat, this.volA);
    }
    const c = this.combineMat.uniforms;
    c.tScene.value = src.texture; c.tVol.value = this.volA.texture; c.uVol.value = o.vol ? 1 : 0;
    if (!o.vol) { r.setRenderTarget(this.volA); r.setClearColor(0x000000, 1); r.clear(); }
    this.pass(this.combineMat, this.hdrRT);
    if (o.bloom) this.bloom.render(r, null, this.hdrRT, 0, false);
    const f = this.finalMat.uniforms;
    f.tDiffuse.value = this.hdrRT.texture; f.uTime.value = time;
    if (o.smaa) { this.pass(this.finalMat, this.ldrRT); this.smaa.render(r, null, this.ldrRT, 0, false); }
    else this.pass(this.finalMat, null);
    r.setRenderTarget(null);
  }
}
