import { describe, expect, it } from "vitest";
import { parseGeneratedLessonContent } from "./routers/lessons";

describe("parseGeneratedLessonContent", () => {
  it("parses clean JSON returned by the model", () => {
    const result = parseGeneratedLessonContent(JSON.stringify({
      excerpt: "A short summary",
      beginnerExplanation: "Simple explanation",
      collegeExplanation: "Detailed explanation",
      keyTerms: ["matrix", "vector"],
      analogies: [{ title: "Bookshelf", body: "A simple analogy" }],
      takeaways: ["Understand the structure"],
      examples: ["Search ranking"],
      misconceptions: ["Rows and columns are not interchangeable"],
    }), "Linear Algebra");

    expect(result.excerpt).toBe("A short summary");
    expect(result.keyTerms).toEqual(["matrix", "vector"]);
    expect(result.analogies?.[0]?.title).toBe("Bookshelf");
  });

  it("handles fenced JSON", () => {
    const result = parseGeneratedLessonContent("```json\n{\"excerpt\":\"Hello\",\"beginnerExplanation\":\"World\"}\n```", "Fallback");
    expect(result.excerpt).toBe("Hello");
    expect(result.beginnerExplanation).toBe("World");
  });

  it("falls back to plain text instead of failing the lesson", () => {
    const result = parseGeneratedLessonContent("Here is the explanation.", "Fallback title");
    expect(result.excerpt).toBe("Fallback title");
    expect(result.beginnerExplanation).toContain("Here is the explanation.");
  });
});
