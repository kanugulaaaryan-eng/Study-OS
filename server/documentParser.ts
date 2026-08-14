// Document text extraction for uploaded study material.
//
 // Kept deliberately dependency-light and side-effect free (pure functions
 // taking a Buffer, returning a string) so it can be unit tested without a
 // database, network, or the Manus runtime — see documentParser.test.ts.

import JSZip from "jszip";
import { YoutubeTranscript } from "youtube-transcript";

export type SupportedFileType = "pdf" | "docx" | "pptx" | "youtube";

export const SUPPORTED_FILE_TYPES: SupportedFileType[] = ["pdf", "docx", "pptx", "youtube"];

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentParseError";
  }
}

/** Collapse excessive whitespace so downstream LLM prompts stay compact. */
export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map(line => line.trim())
    .join("\n")
    .trim();
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return cleanExtractedText(result.text ?? "");
  } catch (error) {
    throw new DocumentParseError(
      `Could not read this PDF. It may be corrupted, password-protected, or scanned without selectable text. (${(error as Error).message})`
    );
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  try {
    const result = await mammoth.extractRawText({ buffer });
    return cleanExtractedText(result.value ?? "");
  } catch (error) {
    throw new DocumentParseError(
      `Could not read this Word document. It may be corrupted or in an unsupported format. (${(error as Error).message})`
    );
  }
}

// PPTX files are a zip of XML "slides". We don't need a full OOXML parser —
// just pull the plain text runs (<a:t>...</a:t>) out of each slide in order.
export async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
        const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
        return numA - numB;
      });

    if (slideFiles.length === 0) {
      throw new DocumentParseError("No slides were found in this PPTX file.");
    }

    const slideTexts: string[] = [];
    for (const filename of slideFiles) {
      const xml = await zip.files[filename].async("text");
      const texts: string[] = [];
      const textRunRegex = /<a:t>([^<]*)<\/a:t>/g;
      let match: RegExpExecArray | null;
      while ((match = textRunRegex.exec(xml)) !== null) {
        texts.push(decodeXmlEntities(match[1]));
      }
      if (texts.length > 0) {
        slideTexts.push(texts.join(" "));
      }
    }

    return cleanExtractedText(
      slideTexts.map((text, i) => `Slide ${i + 1}: ${text}`).join("\n\n")
    );
  } catch (error) {
    if (error instanceof DocumentParseError) throw error;
    throw new DocumentParseError(
      `Could not read this PowerPoint file. It may be corrupted or in an unsupported format. (${(error as Error).message})`
    );
  }
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function extractDocumentText(
  buffer: Buffer,
  fileType: SupportedFileType,
  youtubeUrl?: string
): Promise<string> {
  switch (fileType) {
    case "pdf":
      return extractTextFromPdf(buffer);
    case "docx":
      return extractTextFromDocx(buffer);
    case "pptx":
      return extractTextFromPptx(buffer);
    case "youtube":
      if (!youtubeUrl) throw new DocumentParseError("YouTube URL required for youtube file type");
      return extractTextFromYouTube(youtubeUrl);
    default:
      throw new DocumentParseError(`Unsupported file type: ${fileType}`);
  }
}

export function inferFileType(filename: string): SupportedFileType | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "pptx") return "pptx";
  return null;
}

export function extractYouTubeVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname !== "youtube.com" && hostname !== "m.youtube.com" && hostname !== "youtu.be") {
      return null;
    }

    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    const queryId = url.searchParams.get("v");
    if (queryId && /^[a-zA-Z0-9_-]{11}$/.test(queryId)) return queryId;

    const parts = url.pathname.split("/").filter(Boolean);
    const markerIndex = parts.findIndex((part) => ["embed", "shorts", "v", "live"].includes(part));
    if (markerIndex >= 0) {
      const id = parts[markerIndex + 1];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    return null;
  } catch {
    return null;
  }
}

export async function extractTextFromYouTube(url: string): Promise<string> {
  try {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new DocumentParseError("Invalid YouTube URL. Please provide a valid YouTube video link.");
    }

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (!transcript || transcript.length === 0) {
      throw new DocumentParseError("No transcript available for this video. It may not have captions enabled.");
    }

    const fullText = cleanExtractedText(transcript.map(t => t.text).join(" "));
    if (!fullText) {
      throw new DocumentParseError("The transcript was empty. Try another video with captions enabled.");
    }
    return fullText;
  } catch (error) {
    if (error instanceof DocumentParseError) throw error;
    const msg = (error as Error).message || "";
    // YouTube rate-limiting / CAPTCHA challenge from the server IP.
    if (/captcha|too many requests|rate\s*limit/i.test(msg) || /\b(429|403)\b/.test(msg)) {
      throw new DocumentParseError(
        "StudyOS couldn't fetch this video's transcript automatically right now. YouTube is temporarily limiting transcript requests from our server. You can try again later or paste the transcript manually."
      );
    }
    throw new DocumentParseError(
      `Could not fetch YouTube transcript. The video may be private, deleted, or have transcripts disabled. (${msg})`
    );
  }
}

export async function fetchYouTubeTitle(url: string): Promise<string> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      headers: { "user-agent": "StudyOS/1.0" },
    });
    if (!response.ok) throw new Error("oEmbed unavailable");
    const data = await response.json() as { title?: string };
    return data.title?.trim() || `YouTube video ${extractYouTubeVideoId(url) ?? ""}`.trim();
  } catch {
    const videoId = extractYouTubeVideoId(url);
    return videoId ? `YouTube video ${videoId}` : "YouTube study video";
  }
}

export async function extractYouTubePlaylistVideoIds(rawUrl: string): Promise<string[]> {
  try {
    const url = new URL(rawUrl.trim());
    const playlistId = url.searchParams.get("list");
    if (!playlistId) return [];
    const response = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`, {
      headers: { "user-agent": "StudyOS/1.0" },
    });
    if (!response.ok) throw new Error("Playlist unavailable");
    const html = await response.text();
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const match of html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)) {
      const id = match[1];
      if (!seen.has(id)) { seen.add(id); ids.push(id); }
      if (ids.length >= 20) break;
    }
    return ids;
  } catch {
    return [];
  }
}

export function isLikelyEducationalVideo(title: string, transcript = "") {
  const text = `${title} ${transcript.slice(0, 5000)}`.toLowerCase();
  const positive = /\b(lecture|lesson|tutorial|course|class|chapter|mathematics|math|physics|chemistry|biology|engineering|programming|coding|python|javascript|data science|machine learning|linear algebra|calculus|statistics|economics|accounting|marketing|history|geography|exam|study|education|university|college|school|btech|bsc|mba|law|medical|research|how to|explained|explainer|learn)\b/i;
  const negative = /\b(mr\.?beast|lazarbeam|gaming|gameplay|vlog|prank|challenge|reaction|mukbang|music video|official music|fortnite|minecraft|stream highlights|entertainment)\b/i;
  return positive.test(text) && !negative.test(text);
}
