import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export const runtime = "nodejs";

// These response-size safeguards do not replace parser CPU, memory, or decompression limits.
const MAX_EXTRACTED_TEXT_CHARS = 2_000_000;
const MAX_PDF_PAGES = 200;

function enforceTextLimit(text: string) {
  if (text.length > MAX_EXTRACTED_TEXT_CHARS) throw new Error("Extracted text exceeds the current 2,000,000 character limit.");
  return text;
}

function clean(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("No source file was received.");
    if (file.size > 20 * 1024 * 1024) throw new Error("This source is larger than the current 20 MB limit.");

    const name = file.name || "Research source";
    const lower = name.toLowerCase();
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
      const parser = new PDFParse({ data: bytes });
      try {
        const textResult = await parser.getText({ pageJoiner: "\n\n[[PAGE page_number OF total_number]]\n\n" });
        const infoResult = await parser.getInfo({ parsePageInfo: true });
        const text = enforceTextLimit(clean(textResult.text));
        const markers = [...text.matchAll(/\[\[PAGE (\d+) OF (\d+)\]\]/g)];
        const total = infoResult.total;
        if (Number.isInteger(total) && total > MAX_PDF_PAGES) throw new Error("This PDF exceeds the current 200-page limit.");
        const markersValid = Number.isInteger(total) && total > 0 &&
          markers.length === total &&
          markers.every((m, i) => Number(m[1]) === i + 1 && Number(m[2]) === total);
        const readable = text.replace(/\[\[PAGE \d+ OF \d+\]\]/g, "").trim();
        const notes: string[] = [];
        if (!markersValid) notes.push("Page attribution could not be verified; page references must not be trusted.");
        if (readable.length <= 100) notes.push("This PDF contains very little selectable text. Try another copy or paste the relevant text manually.");
        notes.push("Extraction is not independently checked against visual page content, tables or figures.");
        return NextResponse.json({
          label: name,
          kind: "PDF",
          text,
          pageCount: total,
          extractionStatus: "PARTIAL",
          notes
        });
      } finally {
        await parser.destroy();
      }
    }

    if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || lower.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return NextResponse.json({
        label: name,
        kind: "DOCX",
        text: enforceTextLimit(clean(result.value)),
        extractionStatus: "PARTIAL",
        notes: ["Raw-text DOCX extraction does not verify figures, tables, or layout completeness.", ...result.messages.map(message => message.message).slice(0, 7)]
      });
    }

    if (file.type.startsWith("text/") || /\.(txt|md|markdown|csv)$/i.test(name)) {
      return NextResponse.json({
        label: name,
        kind: lower.endsWith(".md") || lower.endsWith(".markdown") ? "MARKDOWN" : "TEXT",
        text: enforceTextLimit(clean(new TextDecoder().decode(bytes))),
        extractionStatus: "COMPLETE",
        notes: []
      });
    }

    throw new Error("This file type is not supported yet. Use PDF, DOCX, TXT, or Markdown.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "The file could not be read.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
