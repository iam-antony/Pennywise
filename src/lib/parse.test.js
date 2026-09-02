import { describe, it, expect } from "vitest";
import { parseAmount, parseEntry } from "./expr.js";
import { makeFormatters } from "./money.js";
import { CURRENCIES } from "./currencies.js";

const sepsFor = code => makeFormatters(CURRENCIES.find(c => c.code === code)).separators;

describe("parseAmount", () => {
  const uk = sepsFor("GBP");

  // P2-05: "1,200" used to reach parseFloat intact and come back as 1,
  // silently storing a hundredth of what was typed.
  it("reads grouped thousands as the number they represent", () => {
    expect(parseAmount("1,200", uk)).toBe(1200);
    expect(parseAmount("1,234,567", uk)).toBe(1234567);
    expect(parseAmount("1,200.50", uk)).toBe(1200.5);
  });

  it("reads plain numbers unchanged", () => {
    expect(parseAmount("1200", uk)).toBe(1200);
    expect(parseAmount("12.50", uk)).toBe(12.5);
    expect(parseAmount("-50", uk)).toBe(-50);
    expect(parseAmount(".5", uk)).toBe(0.5);
  });

  it("treats an empty field as zero", () => {
    expect(parseAmount("", uk)).toBe(0);
    expect(parseAmount("   ", uk)).toBe(0);
  });

  it("returns null for anything it cannot read, rather than zero", () => {
    expect(parseAmount("abc", uk)).toBe(null);
    expect(parseAmount("12abc", uk)).toBe(null);
    expect(parseAmount("1.2.3", uk)).toBe(null);
    expect(parseAmount("£1200", uk)).toBe(null);
  });

  it("follows the selected currency's own conventions", () => {
    const de = sepsFor("EUR");     // 1.234,56
    expect(parseAmount("1.200", de)).toBe(1200);
    expect(parseAmount("1.200,50", de)).toBe(1200.5);
    // the UK spelling is not valid in a German-formatted field
    expect(parseAmount("1,200.50", de)).toBe(null);
  });

  it("copes with spaces used as grouping", () => {
    expect(parseAmount("1 200", uk)).toBe(1200);
    expect(parseAmount("1 200", uk)).toBe(1200);
  });
});

describe("parseEntry", () => {
  const uk = sepsFor("GBP");

  it("evaluates a formula", () => {
    expect(parseEntry("12.50+8+6.99", uk)).toBe(27.49);
    expect(parseEntry("(120+80)*0.5", uk)).toBe(100);
  });

  it("reads a grouped plain amount", () => {
    expect(parseEntry("1,200", uk)).toBe(1200);
  });

  it("rejects nonsense so the caller can refuse it", () => {
    expect(parseEntry("abc", uk)).toBe(null);
    expect(parseEntry("1.2.3", uk)).toBe(null);
  });

  it("treats an empty entry as clearing the cell", () => {
    expect(parseEntry("", uk)).toBe(0);
  });
});

describe("fmtAxis", () => {
  const axisFor = code => makeFormatters(CURRENCIES.find(c => c.code === code)).fmtAxis;

  // P2-03: dividing everything by 1000 gave axes reading "£0k £0k £1k £1k £1k"
  // for the hundreds that monthly figures actually are.
  it("keeps monthly-sized figures readable", () => {
    const axis = axisFor("GBP");
    expect(axis(0)).toBe("£0");
    expect(axis(250)).toBe("£250");
    expect(axis(1500)).toBe("£1,500");
    expect(axis(9999)).toBe("£9,999");
  });

  it("switches to thousands only once the numbers are large", () => {
    const axis = axisFor("GBP");
    expect(axis(10000)).toBe("£10k");
    expect(axis(26736)).toBe("£26.7k");
    expect(axis(1200000)).toBe("£1.2M");
  });

  // P2-02: the axes were hardcoded to £ regardless of the chosen currency.
  it("uses the selected currency's symbol", () => {
    expect(axisFor("USD")(12000)).toBe("$12k");
    expect(axisFor("JPY")(500)).toBe("¥500");
    expect(axisFor("EUR")(1500)).toBe("€1.500");
  });

  it("keeps the sign on negative ticks", () => {
    expect(axisFor("GBP")(-2500)).toBe("−£2,500");
  });

  it("returns an empty label for non-numbers", () => {
    expect(axisFor("GBP")(NaN)).toBe("");
    expect(axisFor("GBP")(undefined)).toBe("");
  });
});

describe("separators", () => {
  it("reports the marks each locale actually uses", () => {
    expect(sepsFor("GBP")).toEqual({ group: ",", decimal: "." });
    expect(sepsFor("EUR")).toEqual({ group: ".", decimal: "," });
  });
});
