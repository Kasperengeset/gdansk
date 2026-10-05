import { describe, expect, it } from "vitest";
import { distanceM, isAtPost, isValidPosition } from "./geo";

// Omtrentlige punkter i Gdańsk.
const NEPTUN = { lat: 54.3485, lng: 18.6533 }; // Neptunfontenen, Długi Targ
const GLOWNY = { lat: 54.3556, lng: 18.6437 }; // Gdańsk Główny

describe("distanceM", () => {
  it("gir omtrent riktig avstand mellom kjente steder", () => {
    const d = distanceM(NEPTUN, GLOWNY);
    expect(d).toBeGreaterThan(950);
    expect(d).toBeLessThan(1060);
  });

  it("er 0 for samme punkt", () => {
    expect(distanceM(NEPTUN, NEPTUN)).toBe(0);
  });
});

describe("isAtPost", () => {
  const post = { ...NEPTUN, radius_m: 75 };
  const metersNorth = (m: number) => ({ lat: NEPTUN.lat + m / 111_195, lng: NEPTUN.lng });

  it("godtar innenfor radius", () => {
    expect(isAtPost({ ...metersNorth(60), accuracy: 5 }, post)).toBe(true);
  });

  it("gir slack for unøyaktighet, men maks 50 m", () => {
    expect(isAtPost({ ...metersNorth(110), accuracy: 40 }, post)).toBe(true);
    expect(isAtPost({ ...metersNorth(140), accuracy: 150 }, post)).toBe(false);
  });

  it("avviser 200 m unna", () => {
    expect(isAtPost({ ...metersNorth(200), accuracy: 10 }, post)).toBe(false);
  });
});

describe("isValidPosition", () => {
  it("validerer input", () => {
    expect(isValidPosition({ lat: 54.3, lng: 18.6, accuracy: 10 })).toBe(true);
    expect(isValidPosition({ lat: "54", lng: 18.6, accuracy: 10 })).toBe(false);
    expect(isValidPosition({ lat: 954, lng: 18.6, accuracy: 10 })).toBe(false);
    expect(isValidPosition(null)).toBe(false);
  });
});
