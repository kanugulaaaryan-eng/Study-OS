import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  cleanExtractedText,
  extractDocumentText,
  extractTextFromDocx,
  extractTextFromPdf,
  extractTextFromPptx,
  inferFileType,
  extractYouTubeVideoId,
  DocumentParseError,
} from "./documentParser";

describe("cleanExtractedText", () => {
  it("collapses excessive blank lines and trailing whitespace", () => {
    const raw = "Line one   \r\n\r\n\r\n\r\nLine two\t\t\n   Line three  ";
    expect(cleanExtractedText(raw)).toBe("Line one\n\nLine two\nLine three");
  });
});

describe("inferFileType", () => {
  it("detects supported extensions case-insensitively", () => {
    expect(inferFileType("Notes.PDF")).toBe("pdf");
    expect(inferFileType("chapter-1.docx")).toBe("docx");
    expect(inferFileType("slides.pptx")).toBe("pptx");
  });

  it("returns null for unsupported extensions", () => {
    expect(inferFileType("photo.png")).toBeNull();
    expect(inferFileType("no-extension")).toBeNull();
  });
});

// Build a minimal, valid .docx package in-memory so we can test the real
// mammoth extraction path without any fixture files on disk.
async function buildMinimalDocx(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship
    Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"
  />
</Relationships>`,
  );

  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
    .join("");

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`,
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

async function buildMinimalPptx(slideTexts: string[]): Promise<Buffer> {
  const zip = new JSZip();

  slideTexts.forEach((text, i) => {
    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:r>
              <a:t>${text}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`,
    );
  });

  return zip.generateAsync({ type: "nodebuffer" });
}

describe("extractYouTubeVideoId", () => {
  it("supports watch, short, embed, live, and short-link URLs", () => {
    const id = "dQw4w9WgXcQ";

    expect(
      extractYouTubeVideoId(
        `https://www.youtube.com/watch?v=${id}&t=20`,
      ),
    ).toBe(id);

    expect(
      extractYouTubeVideoId(`https://youtu.be/${id}?t=20`),
    ).toBe(id);

    expect(
      extractYouTubeVideoId(
        `https://www.youtube.com/shorts/${id}`,
      ),
    ).toBe(id);

    expect(
      extractYouTubeVideoId(
        `https://www.youtube.com/embed/${id}`,
      ),
    ).toBe(id);

    expect(
      extractYouTubeVideoId(
        `https://www.youtube.com/live/${id}`,
      ),
    ).toBe(id);
  });

  it("rejects non-YouTube URLs and malformed ids", () => {
    expect(
      extractYouTubeVideoId(
        "https://example.com/watch?v=dQw4w9WgXcQ",
      ),
    ).toBeNull();

    expect(
      extractYouTubeVideoId(
        "https://www.youtube.com/watch?v=short",
      ),
    ).toBeNull();
  });
});

describe("extractTextFromDocx", () => {
  it(
    "extracts paragraph text from a valid docx",
    async () => {
      const buffer = await buildMinimalDocx([
        "Photosynthesis converts light into energy.",
        "Chlorophyll absorbs light.",
      ]);

      const text = await extractTextFromDocx(buffer);

      expect(text).toContain(
        "Photosynthesis converts light into energy.",
      );
      expect(text).toContain(
        "Chlorophyll absorbs light.",
      );
    },
    20_000,
  );

  it("throws a DocumentParseError for garbage input", async () => {
    const buffer = Buffer.from(
      "this is not a real docx file",
    );

    await expect(
      extractTextFromDocx(buffer),
    ).rejects.toThrow(DocumentParseError);
  });
});

describe("extractTextFromPptx", () => {
  it("extracts text from each slide in order", async () => {
    const buffer = await buildMinimalPptx([
      "Cell structure overview",
      "Mitochondria is the powerhouse",
    ]);

    const text = await extractTextFromPptx(buffer);

    expect(text).toContain(
      "Slide 1: Cell structure overview",
    );

    expect(text).toContain(
      "Slide 2: Mitochondria is the powerhouse",
    );

    expect(text.indexOf("Slide 1")).toBeLessThan(
      text.indexOf("Slide 2"),
    );
  });

  it("throws a DocumentParseError when there are no slides", async () => {
    const zip = new JSZip();

    zip.file(
      "ppt/presentation.xml",
      "<empty/>",
    );

    const buffer = await zip.generateAsync({
      type: "nodebuffer",
    });

    await expect(
      extractTextFromPptx(buffer),
    ).rejects.toThrow(DocumentParseError);
  });

  it("throws a DocumentParseError for a non-zip buffer", async () => {
    const buffer = Buffer.from(
      "not a zip at all",
    );

    await expect(
      extractTextFromPptx(buffer),
    ).rejects.toThrow(DocumentParseError);
  });
});

describe("extractTextFromPdf", () => {
  it("throws a DocumentParseError for an invalid PDF buffer", async () => {
    const buffer = Buffer.from(
      "%PDF-1.4 this is not a real pdf stream",
    );

    await expect(
      extractTextFromPdf(buffer),
    ).rejects.toThrow(DocumentParseError);
  });
});

describe("extractDocumentText dispatcher", () => {
  it("routes docx buffers through the docx extractor", async () => {
    const buffer = await buildMinimalDocx([
      "Routing check",
    ]);

    const text = await extractDocumentText(
      buffer,
      "docx",
    );

    expect(text).toContain("Routing check");
  });

  it("routes pptx buffers through the pptx extractor", async () => {
    const buffer = await buildMinimalPptx([
      "Routing check",
    ]);

    const text = await extractDocumentText(
      buffer,
      "pptx",
    );

    expect(text).toContain("Routing check");
  });
});