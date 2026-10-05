import { describe, expect, it } from "vitest";
import { computeScore, formatDuration, formatMinutes } from "./scoring";

describe("computeScore", () => {
  const start = new Date("2026-10-10T12:30:00Z");

  it("sluttid = faktisk tid + straff − bonus", () => {
    const s = computeScore({
      startedAt: start,
      finishedAt: new Date("2026-10-10T20:30:00Z"),
      adjustmentMinutes: [15, -10, -2, 5],
    });
    expect(s.elapsedSec).toBe(8 * 3600);
    expect(s.adjustmentMin).toBe(8);
    expect(s.totalSec).toBe(8 * 3600 + 8 * 60);
  });

  it("bruker nå-tid for lag som ikke er i mål, og 0 før start", () => {
    const now = new Date("2026-10-10T13:00:00Z");
    expect(computeScore({ startedAt: start, finishedAt: null, adjustmentMinutes: [] }, now).elapsedSec).toBe(1800);
    expect(computeScore({ startedAt: null, finishedAt: null, adjustmentMinutes: [15] }).totalSec).toBe(900);
  });
});

describe("format", () => {
  it("formaterer varighet og minutter", () => {
    expect(formatDuration(9123)).toBe("2:32:03");
    expect(formatDuration(-60)).toBe("−0:01:00");
    expect(formatMinutes(15)).toBe("+15 min");
    expect(formatMinutes(-10)).toBe("−10 min");
  });
});
