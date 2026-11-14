// Aventador SVJ (SDC model): give the lamp lenses and paint named materials the
// renderer recognises. Head = white DRL/LED strip, tail = red Y lenses, brake =
// the thin inner strip inside each tail cluster (lit only while braking).
import * as THREE from "three";

export const SVJ_HEAD_LENS = "svj_glow_pos";
export const SVJ_TAIL_LENS = "svj_glow_back";
export const SVJ_BRAKE_LENS = "svj_glow_brake";

/** Our material name for an SVJ part, from the model's own material name. */
export function svjPartMaterial(name: string): string | null {
  switch (name) {
    case "LightEmissiveWhite": return SVJ_HEAD_LENS;
    case "GlassRedLights": return SVJ_TAIL_LENS;
    case "GlassOrangeLights": return SVJ_BRAKE_LENS;
    case "CARROSSERIE": return "svj_paint";
    case "WheelTireBump": return "svj_tyre";
    case "WheelMetalBlack": return "svj_rim";
    // Disc and centre lock turn with the wheel; calipers stay bolted to the car.
    case "Material.005": return "svj_rotor";
    case "Material.006": return "svj_wheel_hub";
    case "Material.004":
    case "MetalRedEngine": return "svj_caliper";
    default: return null;
  }
}

export function fixSvj(root: THREE.Object3D) {
  const made = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    const src = m.material as THREE.MeshStandardMaterial;
    const name = svjPartMaterial(src.name);
    if (!name) return;
    let mat = made.get(src);
    if (!mat) {
      const c = src.clone();
      c.name = name;
      // Lamps start dark; the renderer lights them in tunnels / when braking.
      if (name.startsWith("svj_glow")) { c.emissive?.set(0); c.emissiveIntensity = 0; }
      if (name === SVJ_BRAKE_LENS) c.color.set(0x3a0404);
      mat = c;
      made.set(src, mat);
    }
    m.material = mat;
  });
}
