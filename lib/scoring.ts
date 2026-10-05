export type ScoreInput = {
  startedAt: Date | null;
  finishedAt: Date | null;
  adjustmentMinutes: number[];
};

export type Score = {
  /** Faktisk tid i sekunder (til mål, eller til nå hvis laget ikke er i mål). */
  elapsedSec: number;
  /** Sum av straff (+) og bonus (−) i minutter. */
  adjustmentMin: number;
  /** Sluttid = faktisk tid + straff − bonus, i sekunder. */
  totalSec: number;
};

export function computeScore({ startedAt, finishedAt, adjustmentMinutes }: ScoreInput, now = new Date()): Score {
  const elapsedSec = startedAt ? Math.max(0, Math.round(((finishedAt ?? now).getTime() - startedAt.getTime()) / 1000)) : 0;
  const adjustmentMin = adjustmentMinutes.reduce((a, b) => a + b, 0);
  return { elapsedSec, adjustmentMin, totalSec: elapsedSec + adjustmentMin * 60 };
}

/** 9123 → «2:32:03». Negative verdier får minustegn. */
export function formatDuration(totalSec: number): string {
  const sign = totalSec < 0 ? "−" : "";
  const s = Math.abs(Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** +15 → «+15 min», −10 → «−10 min». */
export function formatMinutes(min: number): string {
  return `${min > 0 ? "+" : min < 0 ? "−" : ""}${Math.abs(min)} min`;
}
