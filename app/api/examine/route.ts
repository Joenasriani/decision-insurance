import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { examineLocally } from "@/lib/engine";
import { examineWithModel } from "@/lib/aiEngine";

export const runtime = "nodejs";

const sourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["TEXT", "PDF", "DOCX", "WEBPAGE", "MARKDOWN"]),
  role: z.enum(["PRIMARY_INPUT_REPORT", "RESEARCH_SOURCE", "SUPPORTING_EVIDENCE", "COUNTER_EVIDENCE", "USER_REFERENCE", "UNKNOWN_ROLE"]),
  locator: z.string().optional(),
  canonicalUrl: z.string().optional(),
  title: z.string().optional(),
  retrievedAt: z.string().optional(),
  extractionMethod: z.enum(["PASTED", "NATIVE", "OCR", "WEB_FETCH"]),
  extractionStatus: z.enum(["COMPLETE", "PARTIAL", "FAILED"]),
  text: z.string().min(1),
  pageCount: z.number().optional(),
  notes: z.array(z.string()).optional()
});

const requestSchema = z.object({
  question: z.string().min(3).max(1200),
  sources: z.array(sourceSchema).min(1).max(40)
});

export async function POST(request: NextRequest) {
  try {
    const input = requestSchema.parse(await request.json());
    const gatewayReady = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
    if (gatewayReady) {
      try {
        const examination = await examineWithModel(input.question, input.sources);
        return NextResponse.json({ examination, mode: "model" });
      } catch (modelError) {
        const examination = examineLocally(input.question, input.sources);
        examination.limitations.unshift(modelError instanceof Error ? `Model evaluation unavailable: ${modelError.message}` : "Model evaluation unavailable.");
        return NextResponse.json({ examination, mode: "deterministic_fallback" });
      }
    }
    const examination = examineLocally(input.question, input.sources);
    return NextResponse.json({ examination, mode: "deterministic" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The case could not be decomposed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
