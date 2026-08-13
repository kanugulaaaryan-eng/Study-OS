// Plain, direct phrases. No motivational filler, no "you've got this" energy.
// Each list still has a little variety so it doesn't feel robotic on repeat visits,
// but every option is a useful sentence, not a cheerleading line.
const phrases = {
  welcome: [
    "Good to see you, {name}.",
    "Welcome back, {name}.",
    "{name}, here's where things stand.",
  ],
  start: [
    "Ask a question or open a lesson to get started.",
    "Pick a subject and I'll pull up relevant material.",
    "Tell me what you're working on.",
  ],
  struggle: [
    "Let's try a different angle.",
    "Let's slow down and find where it broke.",
    "Let me explain that part again, differently.",
  ],
  correct: [
    "Correct.",
    "That's right.",
    "Yes — that's the idea.",
  ],
  wrong: [
    "Not quite. Let's look at where it went off.",
    "Close, but there's a gap. Let's find it.",
    "That's not it. Here's the part that matters.",
  ],
  finish: [
    "Done. You can revisit this anytime from Subjects.",
    "That's covered. Want to move to the next topic?",
    "Finished. This is saved in your subject.",
  ],
  return: [
    "Welcome back. Picking up where you left off.",
    "You're back. Here's your last session.",
  ],
  quiz: [
    "Starting the quiz. No hints until you answer.",
    "Quiz time. Answer based on what you remember.",
  ],
} as const;

/**
 * Returns a plain, useful phrase. `name` must be passed in explicitly by the
 * caller (e.g. from the authenticated user's profile) rather than read from a
 * global localStorage key here — a shared/global key would leak between
 * accounts on a shared browser, which we never want for a per-user greeting.
 */
export function getStudyOSPhrase(kind: keyof typeof phrases, name?: string | null, fallback?: string) {
  const list = phrases[kind];
  if (!list?.length) return fallback ?? "";
  const phrase = list[Math.floor(Math.random() * list.length)];
  return phrase.replace("{name}", name?.trim() || "there");
}
