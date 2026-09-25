import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export const runtime = "nodejs";

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
        const [textResult, infoResult] = await Promise.all([
          parser.getText({ pageJoiner: "\n\n[[PAGE page_number OF total_number]]\n\n" }),
          parser.getInfo({ parsePageInfo: true })
        ]);
        const text = clean(textResult.text);
        return NextResponse.json({
          label: name,
          kind: "PDF",
          text,
          pageCount: infoResult.total,
          extractionStatus: text.length > 100 ? "COMPLETE" : "PARTIAL",
          notes: text.length > 100 ? [] : ["This PDF contains very little selectable text. Try another copy or paste the relevant text manually."]
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
        text: clean(result.value),
        extractionStatus: "COMPLETE",
        notes: result.messages.map(message => message.message).slice(0, 8)
      });
    }

    if (file.type.startsWith("text/") || /\.(txt|md|markdown|csv)$/i.test(name)) {
      return NextResponse.json({
        label: name,
        kind: lower.endsWith(".md") || lower.endsWith(".markdown") ? "MARKDOWN" : "TEXT",
        text: clean(new TextDecoder().decode(bytes)),
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
