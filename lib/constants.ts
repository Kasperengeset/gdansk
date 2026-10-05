// Konstanter som brukes både på server og i nettleseren.

export const COSTUME_THEMES = ["Sjøfolk", "Neptun og havfruer", "Hansakjøpmenn", "80-talls verftsarbeidere"];

export const PROOF_TYPES = {
  photo: "Bilde",
  text: "Skriftlig svar",
  photo_text: "Bilde + skriftlig svar",
  none: "Ingen (bare «Fullført»)",
} as const;

export type ProofType = keyof typeof PROOF_TYPES;
