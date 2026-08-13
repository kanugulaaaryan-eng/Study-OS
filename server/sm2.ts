// Pure SM-2 spaced-repetition calculation, extracted out of db.ts so it can
// be unit tested without a live database connection.

export type SM2Input = {
  interval: number;
  easeFactor: number;
  repetitions: number;
};

export type SM2Result = {
  interval: number;
  easeFactor: number;
  repetitions: number;
  nextReviewDate: Date;
};

const MIN_EASE_FACTOR = 1.3;

/**
 * quality: 0-5, where 0 = completely forgot, 5 = perfect recall.
 * now: injected for deterministic testing; defaults to the real clock.
 */
export function computeSM2(current: SM2Input, quality: number, now: Date = new Date()): SM2Result {
  if (quality < 0 || quality > 5 || !Number.isFinite(quality)) {
    throw new RangeError("SM-2 quality must be a number between 0 and 5");
  }

  let interval = current.interval;
  let repetitions = current.repetitions;
  let easeFactor = current.easeFactor;

  if (quality < 3) {
    interval = 1;
    repetitions = 0;
  } else {
    repetitions = current.repetitions + 1;

    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 3;
    } else {
      interval = Math.round(current.interval * easeFactor);
    }
  }

  easeFactor = Math.max(
    MIN_EASE_FACTOR,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return { interval, easeFactor, repetitions, nextReviewDate };
}
