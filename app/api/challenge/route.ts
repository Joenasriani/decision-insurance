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
    version: z.number(),
    question: z.string(),
    sources: z.array(z.object({
      id: z.string(),
      label: z.string(),
      canonicalUrl: z.string().optional()
    }).passthrough()),
    chunks: z.array(z.object({
      id: z.string(),
      sourceId: z.string(),
      pageStart: z.number().optional()
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
    challenges: z.array(z.any()),
    readiness: z.any(),
    limitations: z.array(z.string()),
    createdAt: z.string().optional()
  }).passthrough()
});

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.parse(await request.json());
    const examination = parsed.examination as Examination;
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
    const message = error instanceof Error ? error.message : "The claim could not be challenged.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
