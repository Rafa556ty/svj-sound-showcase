import { describe, it, expect } from "vitest";
import { svjPartMaterial } from "./svj-fix";
import { lampLevels, lampRole } from "./player-lights";

describe("SVJ lamps", () => {
  it("maps the model's lenses to head / tail / brake", () => {
    expect(lampRole("svj", svjPartMaterial("LightEmissiveWhite")!)).toBe("lamp");
    expect(lampRole("svj", svjPartMaterial("GlassRedLights")!)).toBe("tail");
    expect(lampRole("svj", svjPartMaterial("GlassOrangeLights")!)).toBe("brake");
  });
  it("is fully dark by day, lit in tunnels, brake strip only when braking", () => {
    expect(lampLevels(false, false, true)).toEqual({ head: 0, tail: 0, brake: 0 });
    expect(lampLevels(true, false, true).head).toBeGreaterThan(0);
    expect(lampLevels(true, false, true).brake).toBe(0);
    expect(lampLevels(false, true, true).brake).toBeGreaterThan(0);
  });
});

import { NEW_CAR_WHEEL } from "./models3d";
describe("SVJ wheels", () => {
  it("disc and hub spin with the wheel, calipers do not", () => {
    const spins = (m: string) => NEW_CAR_WHEEL.test(svjPartMaterial(m)!) && !/call?iper/.test(svjPartMaterial(m)!);
    expect(spins("Material.005")).toBe(true);
    expect(spins("Material.006")).toBe(true);
    expect(spins("WheelTireBump")).toBe(true);
    expect(spins("Material.004")).toBe(false);
    expect(spins("MetalRedEngine")).toBe(false);
  });
});
