import { describe, expect, it } from "vitest";
import { referencesStudyMaterial, resolveReferencedDocument } from "./ai";

type Doc = { id: number; filename: string; fileType: string; extractedText: string | null };

const pdfDoc: Doc = { id: 1, filename: "Linear Algebra Notes.pdf", fileType: "pdf", extractedText: "Eigenvalues..." };
const ytDoc: Doc = { id: 2, filename: "3Blue1Brown - Eigenvectors", fileType: "youtube", extractedText: "Transcript text..." };

describe("referencesStudyMaterial", () => {
  it("detects generic references to uploaded material", () => {
    expect(referencesStudyMaterial("Explain this document")).toBe(true);
    expect(referencesStudyMaterial("Teach me what was in that lecture")).toBe(true);
    expect(referencesStudyMaterial("Summarize the transcript")).toBe(true);
  });

  it("does not flag unrelated messages", () => {
    expect(referencesStudyMaterial("What is an eigenvalue?")).toBe(false);
    expect(referencesStudyMaterial("Give me another example")).toBe(false);
  });
});

describe("resolveReferencedDocument", () => {
  it("returns null when there are no documents", () => {
    expect(resolveReferencedDocument("explain this document", [], undefined)).toBeNull();
  });

  it("matches a document named directly in the message", () => {
    const result = resolveReferencedDocument("can you explain Linear Algebra Notes.pdf please", [pdfDoc, ytDoc], undefined);
    expect(result?.id).toBe(1);
  });

  it("uses the single available document for a generic reference", () => {
    const result = resolveReferencedDocument("explain this document", [pdfDoc], undefined);
    expect(result?.id).toBe(1);
  });

  it("prefers the document behind the currently open lesson", () => {
    const result = resolveReferencedDocument("explain this document", [pdfDoc, ytDoc], 2);
    expect(result?.id).toBe(2);
  });

  it("falls back to the most recent document for a generic multi-document reference", () => {
    // docs are expected pre-sorted newest first, matching getSubjectDocuments
    const result = resolveReferencedDocument("teach me what was in that lecture", [ytDoc, pdfDoc], undefined);
    expect(result?.id).toBe(ytDoc.id);
  });

  it("does not guess when the message has no reference and there are multiple documents", () => {
    const result = resolveReferencedDocument("what is an eigenvalue?", [pdfDoc, ytDoc], undefined);
    expect(result).toBeNull();
  });
});
