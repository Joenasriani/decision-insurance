import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { parentPort } from "node:worker_threads";

if (!parentPort) throw new Error("Document parser worker requires a parent port.");

parentPort.on("message", async (task: { kind: "PDF" | "DOCX"; bytes: Uint8Array }) => {
  try {
    if (task.kind === "PDF") {
      const parser = new PDFParse({ data: new Uint8Array(task.bytes) });
      try {
        const info = await parser.getInfo({ parsePageInfo: true });
        if (Number.isInteger(info.total) && info.total > 200) {
          throw new Error("This PDF exceeds the current 200-page limit.");
        }
        const text = await parser.getText({ pageJoiner: "\n\n[[PAGE page_number OF total_number]]\n\n" });
        parentPort!.postMessage({ ok: true, text: text.text, total: info.total });
      } finally {
        await parser.destroy();
      }
    } else {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(task.bytes) });
      parentPort!.postMessage({ ok: true, text: result.value, messages: result.messages.map(x => x.message).slice(0, 7) });
    }
  } catch (error) {
    parentPort!.postMessage({ ok: false, error: error instanceof Error ? error.message : "Document extraction failed." });
  }
});
