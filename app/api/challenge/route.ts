import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { challengeClaim } from "@/lib/engine";
import { challengeWithModel } from "@/lib/aiEngine";
import type { Examination } from "@/types/core";

export const runtime = "nodejs";

const claimStatus = z.enum(["SUPPORTED", "PARTIAL", "UNSUPPORTED", "ASSUMPTION", "CONTRADICTED", "UNKNOWN"]);
const criticality = z.enum(["CRITICAL", "IMPORTANT", "SUPPORTING"]);

const requestSchema = z.object({
  claimId: z.string().min(1),
  examination: z.object({
    id: z.string(),
    version: z.number().int().positive(),
    createdAt: z.string(),
    question: z.string(),
    sources: z.array(z.object({
      id: z.string(),
      label: z.string(),
      canonicalUrl: z.string().optional(),
      kind: z.enum(["TEXT","PDF","DOCX","WEBPAGE","MARKDOWN"]),
      role: z.enum(["PRIMARY_INPUT_REPORT","RESEARCH_SOURCE","SUPPORTING_EVIDENCE","COUNTER_EVIDENCE","USER_REFERENCE","UNKNOWN_ROLE"]),
      extractionMethod: z.enum(["PASTED","NATIVE","OCR","WEB_FETCH"]),
      extractionStatus: z.enum(["COMPLETE","PARTIAL","FAILED"]),
      text: z.string(),
      pageCount: z.number().int().positive().optional()
    }).passthrough()),
    chunks: z.array(z.object({
      id: z.string(),
      sourceId: z.string(),
      order: z.number().int().nonnegative(),
      text: z.string(),
      pageStart: z.number().int().positive().optional(),
      pageEnd: z.number().int().positive().optional()
    }).passthrough()),
    claims: z.array(z.object({
      id: z.string(),
      text: z.string(),
      criticality,
      status: claimStatus,
      evidenceIds: z.array(z.string()),
      assumptionIds: z.array(z.string()),
      contradictionIds: z.array(z.string()),
      unknownIds: z.array(z.string()),
      rationale: z.string(),
      humanOverride: z.boolean()
    }).passthrough()),
    evidence: z.array(z.object({
      id: z.string(),
      sourceId: z.string(),
      chunkId: z.string(),
      excerpt: z.string(),
      normalizedFact: z.string(),
      relevance: z.number(),
      supportsClaimIds: z.array(z.string()),
      contradictsClaimIds: z.array(z.string())
    }).passthrough()),
    assumptions: z.array(z.object({
      id: z.string(),
      text: z.string(),
      claimId: z.string(),
      status: z.enum(["OPEN", "SUPPORTED", "REJECTED"])
    })),
    contradictions: z.array(z.object({
      id: z.string(),
      description: z.string(),
      claimId: z.string(),
      evidenceIds: z.array(z.string()),
      severity: z.enum(["CRITICAL", "MATERIAL", "MINOR"])
    })),
    unknowns: z.array(z.object({
      id: z.string(),
      question: z.string(),
      claimId: z.string(),
      requiredEvidence: z.string()
    })),
    challenges: z.array(z.object({
      id: z.string(), claimId: z.string(),
      result: z.enum(["SURVIVES","WEAKENED","MATERIAL_GAP","CONTRADICTED","UNRESOLVED"]),
      weaknesses: z.array(z.string()), missingEvidence: z.array(z.string()), alternativeExplanations: z.array(z.string())
    })),
    readiness: z.object({
      label: z.enum(["STRONG_EVIDENCE_COVERAGE","MATERIAL_GAPS_REMAIN","INSUFFICIENT_EVIDENCE","CRITICAL_CONTRADICTION_PRESENT"]),
      criticalClaimIds: z.array(z.string())
    }),
    limitations: z.array(z.string()),
  }).passthrough()
});

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.parse(await request.json());
    const examination = parsed.examination as Examination;
    if (!examination.claims.some(claim => claim.id === parsed.claimId)) throw new Error("Claim not found.");
    const gatewayReady = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);

    if (gatewayReady) {
      try {
        const challenge = await challengeWithModel(examination, parsed.claimId);
        return NextResponse.json({ challenge, mode: "model" });
      } catch (modelError) {
        const challenge = challengeClaim(examination, parsed.claimId);
        return NextResponse.json({
          challenge,
          mode: "deterministic_fallback",
          limitation: modelError instanceof Error ? modelError.message : "Model challenge unavailable."
        });
      }
    }

    return NextResponse.json({ challenge: challengeClaim(examination, parsed.claimId), mode: "deterministic" });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "This statement could not be stress-tested because part of the saved review is incomplete."
      : "The stress-test could not be completed. Try the evidence check again, then retry this statement.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
