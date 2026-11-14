import { describe, expect, it } from "vitest";
import { wantsMenuMusic } from "./ui-sounds";

describe("menu music", () => {
  it("plays on the title screen", () => {
    expect(wantsMenuMusic({ title: true, phase: "loading" })).toBe(true);
  });
  it("plays in the main menu", () => {
    expect(wantsMenuMusic({ title: false, phase: "menu" })).toBe(true);
  });
  it("stops while driving", () => {
    expect(wantsMenuMusic({ title: false, phase: "playing" })).toBe(false);
  });
});
