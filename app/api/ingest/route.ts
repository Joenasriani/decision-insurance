import { NextRequest, NextResponse } from "next/server";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";

export const runtime = "nodejs";

// These response-size safeguards do not replace parser CPU, memory, or decompression limits.
const MAX_EXTRACTED_TEXT_CHARS = 2_000_000;
const MAX_PDF_PAGES = 200;

function enforceTextLimit(text: string) {
  if (text.length > MAX_EXTRACTED_TEXT_CHARS) throw new Error("Extracted text exceeds the current 2,000,000 character limit.");
  return text;
}

type ParseResult = { text: string; total?: number; messages?: string[] };
const PARSE_TIMEOUT_MS = 15_000;
function parseInWorker(kind: "PDF" | "DOCX", bytes: Uint8Array): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(new URL("../../../lib/document-parser-worker.ts", import.meta.url)), {
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 },
      execArgv: process.execArgv.filter(arg => !arg.startsWith("--inspect"))
    });
    let settled = false;
    const finish = (error?: Error, result?: ParseResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else resolve(result!);
    };
    const timer = setTimeout(() => finish(new Error("Document extraction exceeded the 15-second execution limit.")), PARSE_TIMEOUT_MS);
    worker.once("message", (message: { ok: boolean; error?: string } & ParseResult) => {
      if (!message.ok) finish(new Error(message.error ?? "Document extraction failed."));
      else finish(undefined, { text: message.text, total: message.total, messages: message.messages });
    });
    worker.once("error", error => finish(error instanceof Error ? error : new Error(String(error))));
    worker.once("exit", code => finish(new Error("Document parser worker exited before completing extraction (code " + code + ").")));
    worker.postMessage({ kind, bytes });
  });
}

function clean(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

type ParserResult = {
  kind: "PDF" | "DOCX";
  text: string;
  pageCount?: number;
  extractionStatus: "PARTIAL";
  notes: string[];
};

// Workers enforce a deadline and a V8 heap constraint. These do not constitute
// an OS-level memory limit or a full sandbox for native allocations.
function parseInWorker(kind: "PDF" | "DOCX", bytes: Uint8Array): Promise<ParserResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(process.cwd(), "lib", "document-parser-worker.cjs"), {
      workerData: { kind, bytes },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 }
    });
    let settled = false;
    const finish = (error?: Error, value?: ParserResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      void worker.terminate();
      if (error) reject(error);
      else if (value) resolve(value);
      else reject(new Error("Document parser returned no result."));
    };
    const timeout = setTimeout(() => finish(new Error("Document parsing exceeded the 10-second time limit.")), 10_000);
    worker.on("message", (response: { ok: boolean; error?: string; value?: ParserResult }) => {
      if (response.ok && response.value) finish(undefined, response.value);
      else finish(new Error(response.error || "Document parser failed."));
    });
    worker.on("error", (error: Error) => finish(new Error("Document parser worker failed: " + error.message)));
    worker.on("exit", (code: number) => finish(new Error("Document parser exited before producing a result (code " + code + ").")));
  });
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

    if (file.type === "application/pdf" || lower.endsWith(".pdf") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || lower.endsWith(".docx")) {
      const kind = file.type === "application/pdf" || lower.endsWith(".pdf") ? "PDF" : "DOCX";
      const extracted = await parseInWorker(kind, bytes);
      return NextResponse.json({ label: name, ...extracted });
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
