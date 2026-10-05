import { describe, expect, it } from "vitest";
import { encrypt, validateKey } from "./cipher";

describe("encrypt", () => {
  it("caesar forskyver over 29 bokstaver og bevarer store/små", () => {
    expect(encrypt("Abc", "caesar", "3")).toBe("Def");
    expect(encrypt("XYZ", "caesar", "3")).toBe("ÆØÅ");
    expect(encrypt("Å", "caesar", "1")).toBe("A");
    expect(encrypt("ø", "caesar", "-1")).toBe("æ");
  });

  it("lar polske bokstaver, tall og tegnsetting stå urørt", () => {
    expect(encrypt("Gdańsk 1980!", "caesar", "1")).toBe("Hebńtl 1980!");
    expect(encrypt("ł", "atbash")).toBe("ł");
  });

  it("atbash speiler alfabetet", () => {
    expect(encrypt("ABCÅ", "atbash")).toBe("ÅØÆA");
    expect(encrypt(encrypt("Hei på deg", "atbash"), "atbash")).toBe("Hei på deg");
  });

  it("vigenère bruker nøkkelordet bokstav for bokstav, og hopper over mellomrom", () => {
    expect(encrypt("AA AA", "vigenere", "BC")).toBe("BC BC");
    expect(encrypt("hei", "vigenere", "a")).toBe("hei");
  });

  it("a1z26 nummererer bokstaver med Æ=27, Ø=28, Å=29", () => {
    expect(encrypt("Tørst?", "a1z26")).toBe("20-28-18-19-20?");
    expect(encrypt("ab å", "a1z26")).toBe("1-2 / 29");
  });

  it("morse har norske tegn", () => {
    expect(encrypt("SOS", "morse")).toBe("... --- ...");
    expect(encrypt("Æ Ø Å", "morse")).toBe(".-.- / ---. / .--.-");
  });

  it("baklengs", () => {
    expect(encrypt("Gdańsk", "reverse")).toBe("ksńadG");
  });
});

describe("validateKey", () => {
  it("krever heltall for caesar og bokstaver for vigenère", () => {
    expect(validateKey("caesar", "3")).toBeNull();
    expect(validateKey("caesar", "tre")).not.toBeNull();
    expect(validateKey("vigenere", "123")).not.toBeNull();
    expect(validateKey("vigenere", "Gdańsk")).toBeNull();
    expect(validateKey("none", "")).toBeNull();
  });
});
