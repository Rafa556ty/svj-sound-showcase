import { describe, expect, it, vi } from "vitest";
vi.mock("./models3d", () => ({ loadCar: vi.fn() }));
vi.mock("@/assets/title/title-sky.jpg", () => ({ default: "" }));
vi.mock("@/assets/title/title-dirt.jpg", () => ({ default: "" }));
import { titleLineup } from "./title-scene";

describe("title screen line-up", () => {
  it("weak phones show the Pagani Huayra instead of the Chiron, and skip the LaFerrari", () => {
    const keys = titleLineup(true).map((s) => s.key);
    expect(keys).toEqual(["revuelto", "svj", "huayra"]);
  });
  it("other devices keep the Chiron and the LaFerrari", () => {
    const keys = titleLineup(false).map((s) => s.key);
    expect(keys).toEqual(["revuelto", "svj", "chiron", "laferrari"]);
  });
});
