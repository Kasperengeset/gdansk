// Chiffer over det norske alfabetet (29 bokstaver). Tegn utenfor alfabetet,
// som polske bokstaver, tall og tegnsetting, beholdes som de er.

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ";

export const CIPHER_TYPES = {
  none: "Ingen (ren gåte)",
  caesar: "Caesar (forskyvning)",
  atbash: "Atbash (speilalfabet)",
  a1z26: "Tall (A=1 … Å=29)",
  morse: "Morse",
  reverse: "Baklengs",
  vigenere: "Vigenère (nøkkelord)",
} as const;

export type CipherType = keyof typeof CIPHER_TYPES;

export function isCipherType(value: string): value is CipherType {
  return Object.hasOwn(CIPHER_TYPES, value);
}

const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..", Æ: ".-.-", Ø: "---.", Å: ".--.-",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
  "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "!": "-.-.--",
};

const mod = (n: number, m: number) => ((n % m) + m) % m;

function mapLetters(text: string, fn: (index: number, letterNo: number) => number): string {
  let letterNo = 0;
  return Array.from(text)
    .map((ch) => {
      const upper = ch.toUpperCase();
      const i = ALPHABET.indexOf(upper);
      if (i === -1 || upper.length !== 1) return ch;
      const out = ALPHABET[mod(fn(i, letterNo++), ALPHABET.length)];
      return ch === upper ? out : out.toLowerCase();
    })
    .join("");
}

/** Returnerer en feilmelding hvis nøkkelen ikke passer til chiffertypen. */
export function validateKey(type: CipherType, key: string): string | null {
  if (type === "caesar" && !/^-?\d+$/.test(key.trim())) {
    return "Caesar trenger et heltall som nøkkel, f.eks. 3.";
  }
  if (type === "vigenere") {
    const k = Array.from(key.toUpperCase()).filter((c) => ALPHABET.includes(c));
    if (k.length === 0) return "Vigenère trenger et nøkkelord med bokstaver.";
  }
  return null;
}

export function encrypt(text: string, type: CipherType, key = ""): string {
  switch (type) {
    case "none":
      return text;
    case "caesar": {
      const shift = parseInt(key, 10) || 0;
      return mapLetters(text, (i) => i + shift);
    }
    case "atbash":
      return mapLetters(text, (i) => ALPHABET.length - 1 - i);
    case "vigenere": {
      const shifts = Array.from(key.toUpperCase())
        .map((c) => ALPHABET.indexOf(c))
        .filter((i) => i >= 0);
      if (shifts.length === 0) return text;
      return mapLetters(text, (i, n) => i + shifts[n % shifts.length]);
    }
    case "reverse":
      return Array.from(text).reverse().join("");
    case "a1z26":
      return text
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => {
          // Bokstaver skilles med bindestrek, annet henges på som det er: «Tørst?» → 20-28-18-19-20?
          let out = "";
          let prevLetter = false;
          for (const ch of word) {
            const i = ALPHABET.indexOf(ch.toUpperCase());
            if (i === -1) {
              out += ch;
              prevLetter = false;
            } else {
              out += (prevLetter ? "-" : "") + (i + 1);
              prevLetter = true;
            }
          }
          return out;
        })
        .join(" / ");
    case "morse":
      return text
        .split(/\s+/)
        .filter(Boolean)
        .map((word) =>
          Array.from(word)
            .map((ch) => MORSE[ch.toUpperCase()] ?? ch)
            .join(" "),
        )
        .join(" / ");
  }
}
