import { describe, expect, it } from "vitest";
import { computeSM2 } from "./sm2";

const FRESH_CARD = { interval: 1, easeFactor: 2.5, repetitions: 0 };
const NOW = new Date("2026-08-04T00:00:00Z");

describe("computeSM2", () => {
  it("resets interval and repetitions when the user forgets (quality < 3)", () => {
    const result = computeSM2({ interval: 10, easeFactor: 2.5, repetitions: 4 }, 0, NOW);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.nextReviewDate.toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });

  it("schedules a 1-day interval after the first successful review", () => {
    const result = computeSM2(FRESH_CARD, 4, NOW);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
  });

  it("schedules a 3-day interval after the second successful review", () => {
    const afterFirst = computeSM2(FRESH_CARD, 4, NOW);
    const afterSecond = computeSM2(afterFirst, 4, NOW);
    expect(afterSecond.repetitions).toBe(2);
    expect(afterSecond.interval).toBe(3);
  });

  it("grows the interval by the ease factor from the third review onward", () => {
    const afterFirst = computeSM2(FRESH_CARD, 4, NOW);
    const afterSecond = computeSM2(afterFirst, 4, NOW);
    const afterThird = computeSM2(afterSecond, 4, NOW);
    expect(afterThird.repetitions).toBe(3);
    expect(afterThird.interval).toBe(Math.round(afterSecond.interval * afterSecond.easeFactor));
  });

  it("never lets the ease factor drop below 1.3", () => {
    let card = FRESH_CARD;
    for (let i = 0; i < 20; i++) {
      card = computeSM2(card, 0, NOW);
    }
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("increases the ease factor for a perfect recall (quality 5)", () => {
    const result = computeSM2(FRESH_CARD, 5, NOW);
    expect(result.easeFactor).toBeGreaterThan(FRESH_CARD.easeFactor);
  });

  it("rejects out-of-range quality values", () => {
    expect(() => computeSM2(FRESH_CARD, 6, NOW)).toThrow(RangeError);
    expect(() => computeSM2(FRESH_CARD, -1, NOW)).toThrow(RangeError);
  });
});
