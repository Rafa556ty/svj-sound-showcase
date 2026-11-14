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
