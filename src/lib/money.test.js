import { describe, it, expect } from "vitest";
import { makeFormatters, currencyDecimals } from "./money.js";
import { CURRENCIES, flagEmoji } from "./currencies.js";

const of = code => CURRENCIES.find(c => c.code === code);
const fmtIn = code => makeFormatters(of(code)).fmt;
const fmtSIn = code => makeFormatters(of(code)).fmtS;

describe("fmt", () => {
  const fmt = fmtIn("GBP");

  it("formats a plain amount with the currency symbol", () => {
    expect(fmt(1234.5)).toBe("£1,234.5");
    expect(fmt(0)).toBe("£0");
  });

  // P1-01: fmt() used to wrap every value in Math.abs(), so an overspent month
  // was indistinguishable from a surplus. This is the regression guard.
  it("keeps the minus sign on negative amounts", () => {
    expect(fmt(-2573)).toBe("−£2,573");
    expect(fmt(-0.5)).toBe("−£0.5");
  });

  it("renders an em dash for values that are not numbers", () => {
    expect(fmt(NaN)).toBe("—");
    expect(fmt(undefined)).toBe("—");
    expect(fmt(null)).toBe("—");
    expect(fmt("1200")).toBe("—");
  });

  it("omits trailing zeros rather than padding to 2dp", () => {
    expect(fmt(4200)).toBe("£4,200");
  });
});

describe("fmtS", () => {
  const fmtS = fmtSIn("GBP");

  it("always carries an explicit sign", () => {
    expect(fmtS(45)).toBe("+£45");
    expect(fmtS(-45)).toBe("−£45");
    expect(fmtS(0)).toBe("+£0");
  });
});

describe("currency decimal places", () => {
  it("uses the places each currency actually has", () => {
    expect(currencyDecimals("GBP")).toBe(2);
    expect(currencyDecimals("JPY")).toBe(0);
    expect(currencyDecimals("KWD")).toBe(3);
  });

  it("falls back to 2 for a code Intl does not know", () => {
    expect(currencyDecimals("ZZZ")).toBe(2);
  });

  it("rounds yen to whole units", () => {
    expect(fmtIn("JPY")(999.99)).toBe("¥1,000");
  });

  it("allows three places for the Gulf dinars", () => {
    expect(fmtIn("KWD")(1.234)).toBe("KD1.234");
  });
});

describe("locale handling", () => {
  it("keeps each locale's own grouping and decimal marks", () => {
    expect(fmtIn("EUR")(1234.5)).toBe("€1.234,5");
    expect(fmtIn("USD")(1234.5)).toBe("$1,234.5");
  });

  // Locales like ar-KW and bn-BD would otherwise print ٩٦٠ / ৯৬০ next to the
  // Latin numerals used everywhere else in the interface.
  it("forces Latin digits for non-Latin numbering systems", () => {
    expect(fmtIn("KWD")(1234.5)).toBe("KD1,234.5");
    expect(fmtIn("BDT")(1234.5)).toBe("৳1,234.5");
    expect(fmtIn("AED")(960)).toBe("د.إ960");
  });
});

describe("the currency table", () => {
  it("covers the full ISO set without duplicates", () => {
    expect(CURRENCIES.length).toBe(155);
    const codes = CURRENCIES.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("keeps the common currencies at the top of the picker", () => {
    expect(CURRENCIES.slice(0, 4).map(c => c.code)).toEqual(["GBP", "USD", "EUR", "JPY"]);
  });

  it("gives every currency a code, name, symbol and locale", () => {
    for (const c of CURRENCIES) {
      expect(c.code, c.code).toMatch(/^[A-Z]{3}$/);
      expect(c.name.length, c.code).toBeGreaterThan(0);
      expect(c.symbol.length, c.code).toBeGreaterThan(0);
      expect(c.locale, c.code).toMatch(/^[a-z]{2,3}-[A-Z]{2}$/);
    }
  });

  it("resolves a real flag for every currency", () => {
    const noFlag = CURRENCIES.filter(c => flagEmoji(c.locale) === "🌐").map(c => c.code);
    expect(noFlag).toEqual([]);
  });

  it("excludes metals, IMF units and obsolete currencies", () => {
    const codes = CURRENCIES.map(c => c.code);
    for (const c of ["XAU", "XAG", "XDR", "XXX", "SLL", "ZWL", "CUC"]) {
      expect(codes, c).not.toContain(c);
    }
    // the current replacements are present
    expect(codes).toContain("SLE");
    expect(codes).toContain("ZWG");
  });
});
