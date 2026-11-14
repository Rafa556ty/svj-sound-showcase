// Cinematic title screen: the game's cars parked on a dirt overlook at golden
// hour, with slow camera moves that cut between shots. Browser only.
import * as THREE from "three";
import skyUrl from "@/assets/title/title-sky.jpg";
import dirtUrl from "@/assets/title/title-dirt.jpg";
import { loadCar, type ModelKey } from "./models3d";
import { AdaptiveResolution, phoneProfile } from "./quality";

type Shot = { from: THREE.Vector3; to: THREE.Vector3; lookFrom: THREE.Vector3; lookTo: THREE.Vector3; fov: number; dur: number };
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

type Spot = { key: ModelKey; x: number; z: number; yaw: number; heavy?: boolean; lowKey?: ModelKey };
/** Where each car is parked (metres) and which way it points (yaw, radians). */
const PARKED: Spot[] = [
  { key: "revuelto", x: 0, z: 0, yaw: Math.PI + 0.35 },
  { key: "svj", x: -3.6, z: -1.6, yaw: Math.PI + 0.75 },
  // weak phones park the texture-free Pagani Huayra here instead of the Chiron
  { key: "chiron", x: 3.7, z: -1.2, yaw: Math.PI - 0.2, lowKey: "huayra" },
  { key: "laferrari", x: -0.6, z: -5.2, yaw: Math.PI + 1.25, heavy: true },
];

/** Cars parked on the title screen for this device class. */
export function titleLineup(low: boolean): Spot[] {
  return PARKED.filter((s) => !(low && s.heavy)).map((s) => (low && s.lowKey ? { ...s, key: s.lowKey } : s));
}

/** Weak phones draw the title at 30 fps: steady pacing reads smoother than a jittery 40. */
export const LOW_FRAME_MS = 1000 / 30 - 4;

// The sun in the panorama sits ~60% across the image, just above the horizon.
const SUN_DIR = v(0.8, 0.12, 0.58).normalize();

const SHOTS: Shot[] = [
  // low sideways dolly in front of the line-up
  { from: v(-7.5, 0.55, 6.5), to: v(6.5, 0.7, 7.2), lookFrom: v(-1, 0.6, -1), lookTo: v(1, 0.6, -1), fov: 32, dur: 9 },
  // slow push on the hero car's front three-quarter
  { from: v(5.2, 1.0, 7.2), to: v(3.9, 0.85, 5.8), lookFrom: v(0, 0.6, 0), lookTo: v(0, 0.55, 0), fov: 28, dur: 8 },
  // high crane, sweeping over the overlook
  { from: v(-9.5, 2.8, 8.5), to: v(-4.5, 2.1, 10.8), lookFrom: v(0, 1.0, -2), lookTo: v(0.5, 0.9, -2), fov: 38, dur: 9 },
  // into the sun: silhouettes and rim light
  { from: v(-6.5, 0.45, -8.5), to: v(-8.5, 0.6, -5.5), lookFrom: v(0.5, 0.7, -1), lookTo: v(0, 0.7, -1.5), fov: 34, dur: 8 },
  // ground-level detail past the Chiron
  { from: v(7.5, 0.35, 2.5), to: v(6.2, 0.45, 0.2), lookFrom: v(2.5, 0.5, -1), lookTo: v(0, 0.55, -2), fov: 30, dur: 8 },
];

const ease = (t: number) => t * t * (3 - 2 * t);

function radialTexture(stops: [number, string][], size = 256) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export class TitleScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 600);
  private raf = 0;
  private disposed = false;
  private shot = 0;
  private shotStart = 0;
  private dust!: THREE.Points;
  private own: { dispose(): void }[] = [];
  private readyFired = false;
  private carsReady = false;
  private low: boolean;
  private quality = new AdaptiveResolution();
  private baseDpr = 1;
  private lastRender = 0;
  private w = 1;
  private h = 1;
  private fadeVal = "";
  private skyReady: Promise<void> = Promise.resolve();

  constructor(
    private canvas: HTMLCanvasElement,
    private fade: HTMLElement | null,
    private onReady: () => void,
  ) {
    this.low = phoneProfile({
      userAgent: navigator.userAgent,
      memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      cores: navigator.hardwareConcurrency || 4,
      touch: navigator.maxTouchPoints > 0,
    });
    const r = new THREE.WebGLRenderer({ canvas, antialias: !this.low, powerPreference: "high-performance", stencil: false });
    this.baseDpr = Math.min(window.devicePixelRatio || 1, this.low ? 1 : 2);
    r.setPixelRatio(this.baseDpr);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    // Phones: the blob contact shadows ground the cars; no sun shadow pass.
    r.shadowMap.enabled = !this.low;
    r.shadowMap.type = THREE.PCFShadowMap;
    // Nothing that casts a shadow moves, so the shadow map is drawn once.
    r.shadowMap.autoUpdate = false;
    this.renderer = r;
    this.scene.fog = new THREE.FogExp2(0xd9a670, 0.0085);
    this.build();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  private build() {
    const s = this.scene;
    const loader = new THREE.TextureLoader();

    // Golden-hour panorama: background and reflections on the paint.
    this.skyReady = new Promise<void>((done) => loader.load(skyUrl, (sky) => {
      done();
      if (this.disposed) { sky.dispose(); return; }
      sky.colorSpace = THREE.SRGBColorSpace;
      sky.mapping = THREE.EquirectangularReflectionMapping;
      s.background = sky;
      s.backgroundIntensity = 1;
      const pm = new THREE.PMREMGenerator(this.renderer);
      const env = pm.fromEquirectangular(sky).texture;
      pm.dispose();
      s.environment = env;
      s.environmentIntensity = 0.85;
      this.own.push(sky, env);
    }, undefined, () => done()));

    // Sun + sky fill.
    const sun = new THREE.DirectionalLight(0xffc98a, 3.2);
    sun.position.copy(SUN_DIR).multiplyScalar(40);
    sun.castShadow = !this.low;
    const sz = 2048;
    sun.shadow.mapSize.set(sz, sz);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 90 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    s.add(sun, sun.target);
    s.add(new THREE.HemisphereLight(0xa9c2e8, 0x7a5532, 0.55));
    const bounce = new THREE.DirectionalLight(0xff9d5c, 0.6);
    bounce.position.set(-20, 6, -12); s.add(bounce);

    // Dirt overlook that fades out into the panorama's hills.
    const dirt = loader.load(dirtUrl);
    dirt.colorSpace = THREE.SRGBColorSpace;
    dirt.wrapS = dirt.wrapT = THREE.RepeatWrapping; dirt.repeat.set(26, 26);
    dirt.anisotropy = Math.min(this.low ? 4 : 16, this.renderer.capabilities.getMaxAnisotropy());
    const bump = this.low ? null : loader.load(dirtUrl);
    if (bump) { bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(26, 26); }
    const fadeTex = radialTexture([[0, "#fff"], [0.55, "#fff"], [1, "#000"]]);
    const groundMat = new THREE.MeshStandardMaterial({
      map: dirt, bumpMap: bump, bumpScale: 1.4, roughness: 0.97, metalness: 0,
      color: 0xe6c49a, alphaMap: fadeTex, transparent: true, depthWrite: true,
    });
    const groundGeo = new THREE.CircleGeometry(120, this.low ? 48 : 96);
    // gentle undulation so it reads as terrain, flat where the cars park
    const pos = groundGeo.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), d = Math.hypot(x, y);
      const lift = Math.max(0, d - 14) / 40;
      pos.setZ(i, (Math.sin(x * 0.11) * Math.cos(y * 0.09) * 0.8 + Math.sin(x * 0.031 + 1.3) * 1.6) * Math.min(1, lift));
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    s.add(ground);
    this.own.push(dirt, fadeTex, groundMat, groundGeo);
    if (bump) this.own.push(bump);

    // Rocks.
    const rockGeo = new THREE.IcosahedronGeometry(1, this.low ? 1 : 3);
    const rp = rockGeo.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < rp.count; i++) { const k = 0.88 + Math.random() * 0.24; rp.setXYZ(i, rp.getX(i) * k, rp.getY(i) * k * 0.45, rp.getZ(i) * k); }
    rockGeo.computeVertexNormals();
    const rockMat = new THREE.MeshStandardMaterial({ map: dirt, color: 0xb7a58e, roughness: 0.92 });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 22);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < rocks.count; i++) {
      const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 26;
      p.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      const size = 0.15 + Math.random() * 0.6;
      sc.set(size, size, size); p.y = -size * 0.25;
      q.setFromEuler(e.set(Math.random(), Math.random() * 6, Math.random()));
      rocks.setMatrixAt(i, m.compose(p, q, sc));
    }
    rocks.castShadow = rocks.receiveShadow = !this.low; s.add(rocks);
    this.own.push(rockGeo, rockMat);

    // Floating dust in the sunlight.
    const dustCount = this.low ? 90 : 360;
    const dp = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) { dp[i * 3] = (Math.random() - 0.5) * 26; dp[i * 3 + 1] = Math.random() * 3.5; dp[i * 3 + 2] = (Math.random() - 0.5) * 26; }
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    const sprite = radialTexture([[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,240,210,0.5)"], [1, "rgba(255,230,200,0)"]], 64);
    const dustMat = new THREE.PointsMaterial({ map: sprite, color: 0xffd9a0, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    this.dust = new THREE.Points(dustGeo, dustMat); s.add(this.dust);
    this.own.push(dustGeo, sprite, dustMat);

    // Soft contact shadow under each car (grounds them on the dirt).
    const blob = radialTexture([[0, "rgba(0,0,0,0.75)"], [0.6, "rgba(0,0,0,0.35)"], [1, "rgba(0,0,0,0)"]], 128);
    const blobMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, opacity: 0.9 });
    const blobGeo = new THREE.PlaneGeometry(2.6, 5.4);
    this.own.push(blob, blobMat, blobGeo);

    // The game's cars, parked. Shared cached templates: never dispose them here.
    // All of them are loaded, added and uploaded to the GPU before the first shot
    // fades in, so nothing pops in or hitches while the camera moves.
    void this.loadCars(blobGeo, blobMat);
  }

  private async loadCars(blobGeo: THREE.BufferGeometry, blobMat: THREE.Material) {
    const lineup = titleLineup(this.low);
    const loaded = await Promise.all(
      lineup.map((spot) => loadCar(spot.key).catch((err) => { console.warn("title car", spot.key, err); return null; })),
    );
    if (this.disposed) return;
    const lite = new Map<THREE.Material, THREE.Material>();
    const group = new THREE.Group();
    lineup.forEach((spot, i) => {
      const tpl = loaded[i];
      if (!tpl) return;
      const car = tpl.clone(true);
      car.position.set(spot.x, 0, spot.z);
      car.rotation.y = spot.yaw;
      car.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = !this.low;
        m.receiveShadow = !this.low;
        if (this.low) m.material = this.liteMaterial(m.material, lite);
      });
      const sh = new THREE.Mesh(blobGeo, blobMat);
      sh.rotation.x = -Math.PI / 2; sh.rotation.z = -spot.yaw; sh.position.set(spot.x, 0.02, spot.z);
      group.add(sh, car);
    });
    for (const m of lite.values()) this.own.push(m);
    this.scene.add(group);
    await this.skyReady; // the environment map changes every car shader
    if (this.disposed) return;
    // Compile every shader and upload every texture now, not when a car first
    // enters the frame mid-shot.
    try { await this.renderer.compileAsync(this.scene, this.camera); } catch { /* falls back to lazy compile */ }
    if (this.disposed) return;
    const culled: THREE.Object3D[] = [];
    this.scene.traverse((o) => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    for (const o of culled) o.frustumCulled = true;
    this.carsReady = true;
  }

  /** Phones: clearcoat/specular lobes double fragment cost; a standard PBR copy looks the same here. */
  private liteMaterial(mat: THREE.Material | THREE.Material[], cache: Map<THREE.Material, THREE.Material>): THREE.Material | THREE.Material[] {
    if (Array.isArray(mat)) return mat.map((x) => this.liteMaterial(x, cache) as THREE.Material);
    if (!(mat instanceof THREE.MeshPhysicalMaterial)) return mat;
    let next = cache.get(mat);
    if (!next) {
      const std = new THREE.MeshStandardMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(std, mat);
      std.roughness = Math.max(0.12, mat.roughness * (1 - 0.35 * mat.clearcoat));
      std.name = mat.name;
      std.forceSinglePass = true;
      cache.set(mat, (next = std));
    }
    return next;
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = Math.max(1, w) / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /** Dev/test: hold one camera shot at progress t (0..1); null resumes. */
  hold: { shot: number; t: number } | null = null;
  get shotCount() { return SHOTS.length; }

  private lookTmp = new THREE.Vector3();
  private loop(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.low && this.lastRender && now - this.lastRender < LOW_FRAME_MS) return;
    if (this.low && this.lastRender && this.quality.sample((now - this.lastRender) / 1000, document.hidden)) {
      this.renderer.setPixelRatio(this.baseDpr * this.quality.scale);
      this.renderer.setSize(this.w, this.h, false);
    }
    this.lastRender = now;
    // Hold on black until every car is on the GPU; the first shot then starts fresh.
    if (!this.carsReady) {
      if (this.fade && this.fadeVal !== "1") { this.fadeVal = "1"; this.fade.style.opacity = "1"; }
      return;
    }
    if (!this.shotStart) this.shotStart = now;
    let shot = SHOTS[this.shot]!;
    let t = (now - this.shotStart) / 1000 / shot.dur;
    if (t >= 1) { this.shot = (this.shot + 1) % SHOTS.length; this.shotStart = now; shot = SHOTS[this.shot]!; t = 0; }
    if (this.hold) { shot = SHOTS[this.hold.shot % SHOTS.length]!; t = this.hold.t; }
    // fade to black around each cut
    if (this.fade) {
      const secs = t * shot.dur, left = shot.dur - secs;
      const o = Math.max(0, 1 - Math.min(secs, left) / 0.7).toFixed(2);
      if (o !== this.fadeVal) { this.fadeVal = o; this.fade.style.opacity = o; }
    }
    const k = ease(t);
    const breathe = now / 1000;
    this.camera.position.lerpVectors(shot.from, shot.to, k);
    this.camera.position.y += Math.sin(breathe * 0.7) * 0.025;
    this.camera.position.x += Math.sin(breathe * 0.43) * 0.03;
    this.lookTmp.lerpVectors(shot.lookFrom, shot.lookTo, k);
    this.camera.lookAt(this.lookTmp);
    if (this.camera.fov !== shot.fov) { this.camera.fov = shot.fov; this.camera.updateProjectionMatrix(); }
    // slow drifting dust
    this.dust.rotation.y = breathe * 0.012;
    this.dust.position.y = Math.sin(breathe * 0.2) * 0.15;
    this.renderer.render(this.scene, this.camera);
    if (!this.readyFired) { this.readyFired = true; this.onReady(); }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const o of this.own) o.dispose();
    this.scene.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
    this.renderer.dispose();
  }
}
