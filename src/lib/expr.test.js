import { describe, it, expect } from "vitest";
import { evalExpr, isFormula } from "./expr.js";

describe("evalExpr", () => {
  it("adds a list of amounts, which is what the feature is for", () => {
    expect(evalExpr("45+32+73")).toBe(150);
    expect(evalExpr("12.50+8+6.99")).toBe(27.49);
  });

  it("respects operator precedence and parentheses", () => {
    expect(evalExpr("2+3*4")).toBe(14);
    expect(evalExpr("(120+80)*0.5")).toBe(100);
    expect(evalExpr("(2+3)*4")).toBe(20);
  });

  it("handles subtraction, division and unary minus", () => {
    expect(evalExpr("100-25")).toBe(75);
    expect(evalExpr("10/4")).toBe(2.5);
    expect(evalExpr("-5+8")).toBe(3);
  });

  it("rounds to two decimal places", () => {
    expect(evalExpr("10/3")).toBe(3.33);
    expect(evalExpr("0.1+0.2")).toBe(0.3);
  });

  it("ignores whitespace", () => {
    expect(evalExpr(" 45 + 32 ")).toBe(77);
  });

  it("refuses anything that is not arithmetic", () => {
    expect(evalExpr("alert(1)")).toBe(null);
    expect(evalExpr("2+abc")).toBe(null);
    expect(evalExpr("1e5+1")).toBe(null);
  });

  it("returns null rather than Infinity on divide by zero", () => {
    expect(evalExpr("5/0")).toBe(null);
  });

  it("tolerates an unclosed bracket", () => {
    expect(evalExpr("(2+3")).toBe(5);
  });
});

describe("isFormula", () => {
  it("recognises arithmetic", () => {
    expect(isFormula("45+32")).toBe(true);
    expect(isFormula("2*3")).toBe(true);
    expect(isFormula("(1+2)")).toBe(true);
    expect(isFormula("100-25")).toBe(true);
  });

  it("treats a plain number as a value, not a formula", () => {
    expect(isFormula("1200")).toBe(false);
    expect(isFormula("12.50")).toBe(false);
    expect(isFormula("-50")).toBe(false);
  });

  // P2-05, still open: "1,200" is not a formula, so it falls through to
  // parseFloat and silently becomes 1. Enable this once that is fixed.
  it.todo("rejects thousands separators instead of truncating them to 1");
});
