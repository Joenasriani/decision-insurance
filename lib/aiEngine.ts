import { generateText, Output } from "ai";
import { z } from "zod";
import { chunkSources, stableId } from "@/lib/engine";
import type {
  AssumptionRecord,
  ChallengeRecord,
  ClaimRecord,
  ContradictionRecord,
  EvidenceRecord,
  Examination,
  SourceChunk,
  SourceRecord,
  UnknownRecord
} from "@/types/core";

const STOP = new Set(["the","a","an","and","or","but","of","to","in","on","for","with","as","at","by","from","is","are","was","were","be","been","being","that","this","these","those","it","its","their","they","we","our","you","your","can","could","should","would","may","might","will","has","have","had","not","than","then"]);

function tokens(text: string) {
  return [...new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9%]+/g) ?? [])].filter(word => word.length > 2 && !STOP.has(word));
}

function score(query: string, text: string) {
  const q = tokens(query);
  const d = new Set(tokens(text));
  if (!q.length || !d.size) return 0;
  const hit = q.filter(word => d.has(word)).length;
  return hit / Math.sqrt(q.length * d.size);
}

function retrieve(claim: string, chunks: SourceChunk[], primaryId: string, count = 5) {
  return chunks
    .filter(chunk => chunk.sourceId !== primaryId)
    .map(chunk => ({ chunk, score: score(claim, chunk.text) }))
    .filter(item => item.score > 0.06)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

const extractedClaimsSchema = z.object({
  claims: z.array(z.object({
    text: z.string(),
    criticality: z.enum(["CRITICAL", "IMPORTANT", "SUPPORTING"])
  })).max(18)
});

const evaluatedClaimsSchema = z.object({
  claims: z.array(z.object({
    claimId: z.string(),
    status: z.enum(["SUPPORTED", "PARTIAL", "UNSUPPORTED", "ASSUMPTION", "CONTRADICTED", "UNKNOWN"]),
    rationale: z.string(),
    supportEvidenceIds: z.array(z.string()),
    contradictionEvidenceIds: z.array(z.string()),
    assumptions: z.array(z.string()),
    unknowns: z.array(z.string())
  }))
});


const challengeSchema = z.object({
  result: z.enum(["SURVIVES", "WEAKENED", "MATERIAL_GAP", "CONTRADICTED", "UNRESOLVED"]),
  weaknesses: z.array(z.string()).max(8),
  missingEvidence: z.array(z.string()).max(8),
  alternativeExplanations: z.array(z.string()).max(8)
});

const challengeSystem = `You are the adversarial claim test inside Decision Insurance.
You receive one claim and only the evidence already registered in its examination.
Try to falsify or narrow the claim without inventing objections.
Use no outside facts.
Do not invent evidence, sources, dates, quotations, pages, URLs, or evidence IDs.
Distinguish missing evidence from contradictory evidence.
A polished source is not proof by itself.
If the claim survives the available challenge, return SURVIVES.
If the evidence only supports a narrower formulation, return WEAKENED.
If a required evidential dimension is absent, return MATERIAL_GAP.
If linked evidence materially conflicts with the claim, return CONTRADICTED.
If the supplied structure does not permit a justified result, return UNRESOLVED.
Do not expose private chain of thought.
Return concise observable findings only.`;

const extractionSystem = `You are the claim decomposition stage inside Decision Insurance.
Follow these rules strictly.
Extract only atomic propositions that materially affect the stated decision.
Separate factual, causal, predictive, and evaluative propositions.
Do not treat the report itself as evidence.
Do not add outside facts.
Do not resolve uncertainty.
Do not expose private chain of thought.
Return only the structured output requested by the schema.`;

const evaluationSystem = `You are the evidence evaluation stage inside Decision Insurance.
You receive claims plus retrieved source passages carrying fixed evidence IDs.
Follow these rules strictly.
A claim is not evidence.
An inference is not a source fact.
Absence of contradiction is not support.
Use only evidence IDs provided for that claim.
Never invent an evidence ID, source, date, quotation, fact, page, or URL.
SUPPORTED requires direct or adequately establishing evidence.
PARTIAL means the evidence establishes only a weaker or incomplete proposition.
ASSUMPTION means the proposition is needed but not established.
CONTRADICTED requires source linked evidence materially conflicting with the claim.
UNKNOWN means available information is insufficient or ambiguous.
Preserve unknowns.
Do not make the business decision.
Do not expose private chain of thought.
Rationale must be a short observable justification summary.`;

export async function examineWithModel(question: string, sources: SourceRecord[]): Promise<Examination> {
  const model = process.env.AI_MODEL || "openai/gpt-5.4";
  const primary = sources.find(source => source.role === "PRIMARY_INPUT_REPORT") ?? sources[0];
  if (!primary) throw new Error("No report under examination is registered.");

  const extraction = await generateText({
    model,
    system: extractionSystem,
    output: Output.object({ schema: extractedClaimsSchema, name: "DecisionInsuranceClaims" }),
    prompt: `Decision question:\n${question}\n\nReport under examination:\n${primary.text.slice(0, 60000)}`
  });

  const extracted = extraction.output.claims.filter(claim => claim.text.trim().length > 5);
  if (!extracted.length) throw new Error("No material claims were extracted from the report.");

  const chunks = chunkSources(sources);
  const evidence: EvidenceRecord[] = [];
  const retrievalBundles = extracted.map((claim, index) => {
    const claimId = stableId("C", claim.text, index);
    const retrieved = retrieve(claim.text, chunks, primary.id);
    const bundle = retrieved.map((item, evidenceIndex) => {
      const evidenceId = stableId("E", `${claimId}:${item.chunk.id}`, evidenceIndex);
      evidence.push({
        id: evidenceId,
        sourceId: item.chunk.sourceId,
        chunkId: item.chunk.id,
        excerpt: item.chunk.text.slice(0, 900),
        normalizedFact: item.chunk.text.slice(0, 320),
        relevance: Number(item.score.toFixed(3)),
        supportsClaimIds: [],
        contradictsClaimIds: []
      });
      return {
        evidenceId,
        sourceId: item.chunk.sourceId,
        page: item.chunk.pageStart ?? null,
        text: item.chunk.text.slice(0, 1800)
      };
    });
    return { claimId, text: claim.text, criticality: claim.criticality, retrieved: bundle };
  });

  const evaluation = await generateText({
    model,
    system: evaluationSystem,
    output: Output.object({ schema: evaluatedClaimsSchema, name: "DecisionInsuranceEvaluation" }),
    prompt: `Decision question:\n${question}\n\nEvaluate each claim using only its retrieved material.\n\n${JSON.stringify(retrievalBundles)}`
  });

  const evalMap = new Map(evaluation.output.claims.map(item => [item.claimId, item]));
  const claims: ClaimRecord[] = [];
  const assumptions: AssumptionRecord[] = [];
  const contradictions: ContradictionRecord[] = [];
  const unknowns: UnknownRecord[] = [];

  retrievalBundles.forEach((bundle, index) => {
    const output = evalMap.get(bundle.claimId);
    const allowed = new Set(bundle.retrieved.map(item => item.evidenceId));
    const supportIds = (output?.supportEvidenceIds ?? []).filter(id => allowed.has(id));
    const contradictionEvidenceIds = (output?.contradictionEvidenceIds ?? []).filter(id => allowed.has(id));

    for (const evidenceId of supportIds) {
      const item = evidence.find(record => record.id === evidenceId);
      if (item) item.supportsClaimIds.push(bundle.claimId);
    }
    for (const evidenceId of contradictionEvidenceIds) {
      const item = evidence.find(record => record.id === evidenceId);
      if (item) item.contradictsClaimIds.push(bundle.claimId);
    }

    const assumptionIds: string[] = [];
    for (const [assumptionIndex, text] of (output?.assumptions ?? []).entries()) {
      const id = stableId("A", `${bundle.claimId}:${text}`, assumptionIndex);
      assumptions.push({ id, text, claimId: bundle.claimId, status: "OPEN" });
      assumptionIds.push(id);
    }

    const contradictionIds: string[] = [];
    if (contradictionEvidenceIds.length) {
      const id = stableId("X", `${bundle.claimId}:${contradictionEvidenceIds.join(":")}`);
      contradictions.push({
        id,
        description: "Retrieved source material materially conflicts with the claim.",
        claimId: bundle.claimId,
        evidenceIds: contradictionEvidenceIds,
        severity: bundle.criticality === "CRITICAL" ? "CRITICAL" : "MATERIAL"
      });
      contradictionIds.push(id);
    }

    const unknownIds: string[] = [];
    for (const [unknownIndex, text] of (output?.unknowns ?? []).entries()) {
      const id = stableId("U", `${bundle.claimId}:${text}`, unknownIndex);
      unknowns.push({ id, question: text, claimId: bundle.claimId, requiredEvidence: text });
      unknownIds.push(id);
    }

    let status = output?.status ?? "UNKNOWN";
    if (status === "SUPPORTED" && supportIds.length === 0) status = "UNKNOWN";
    if (status === "CONTRADICTED" && contradictionEvidenceIds.length === 0) status = "UNKNOWN";

    claims.push({
      id: bundle.claimId,
      text: bundle.text,
      criticality: bundle.criticality,
      status,
      sourceId: primary.id,
      evidenceIds: [...new Set([...supportIds, ...contradictionEvidenceIds])],
      assumptionIds,
      contradictionIds,
      unknownIds,
      rationale: output?.rationale || "No validated model evaluation was returned for this claim.",
      humanOverride: false
    });
  });

  const criticalContradiction = claims.some(claim => claim.criticality === "CRITICAL" && claim.status === "CONTRADICTED");
  const criticalGap = claims.some(claim => claim.criticality === "CRITICAL" && ["UNSUPPORTED", "UNKNOWN", "ASSUMPTION"].includes(claim.status));
  const importantGap = claims.some(claim => claim.criticality === "IMPORTANT" && claim.status !== "SUPPORTED");

  return {
    id: stableId("EX", `${question}:${Date.now()}`),
    version: 1,
    question,
    createdAt: new Date().toISOString(),
    sources,
    chunks,
    claims,
    evidence,
    assumptions,
    contradictions,
    unknowns,
    challenges: [],
    readiness: {
      label: criticalContradiction ? "CRITICAL_CONTRADICTION_PRESENT" : criticalGap ? "INSUFFICIENT_EVIDENCE" : importantGap ? "MATERIAL_GAPS_REMAIN" : "STRONG_EVIDENCE_COVERAGE",
      criticalClaimIds: claims.filter(claim => claim.criticality === "CRITICAL" && claim.status !== "SUPPORTED").map(claim => claim.id)
    },
    limitations: []
  };
}


export async function challengeWithModel(examination: Examination, claimId: string): Promise<ChallengeRecord> {
  const claim = examination.claims.find(item => item.id === claimId);
  if (!claim) throw new Error("Claim not found.");

  const evidence = examination.evidence
    .filter(item => claim.evidenceIds.includes(item.id))
    .map(item => {
      const source = examination.sources.find(sourceItem => sourceItem.id === item.sourceId);
      const chunk = examination.chunks.find(chunkItem => chunkItem.id === item.chunkId);
      return {
        evidenceId: item.id,
        sourceId: item.sourceId,
        sourceLabel: source?.label ?? item.sourceId,
        canonicalUrl: source?.canonicalUrl ?? null,
        page: chunk?.pageStart ?? null,
        excerpt: item.excerpt,
        normalizedFact: item.normalizedFact,
        supportsClaim: item.supportsClaimIds.includes(claimId),
        contradictsClaim: item.contradictsClaimIds.includes(claimId)
      };
    });

  const assumptions = examination.assumptions
    .filter(item => claim.assumptionIds.includes(item.id))
    .map(item => ({ id: item.id, text: item.text, status: item.status }));
  const contradictions = examination.contradictions
    .filter(item => claim.contradictionIds.includes(item.id))
    .map(item => ({ id: item.id, description: item.description, evidenceIds: item.evidenceIds, severity: item.severity }));
  const unknowns = examination.unknowns
    .filter(item => claim.unknownIds.includes(item.id))
    .map(item => ({ id: item.id, question: item.question, requiredEvidence: item.requiredEvidence }));

  const model = process.env.AI_MODEL || "openai/gpt-5.4";
  const response = await generateText({
    model,
    system: challengeSystem,
    output: Output.object({ schema: challengeSchema, name: "DecisionInsuranceChallenge" }),
    prompt: JSON.stringify({
      decisionQuestion: examination.question,
      claim: {
        id: claim.id,
        text: claim.text,
        status: claim.status,
        criticality: claim.criticality,
        rationale: claim.rationale
      },
      evidence,
      assumptions,
      contradictions,
      unknowns
    })
  });

  const output = response.output;
  if (output.result === "CONTRADICTED" && !evidence.some(item => item.contradictsClaim)) {
    output.result = "UNRESOLVED";
  }

  return {
    id: stableId("CH", `${examination.id}:${claimId}:${examination.version}`),
    claimId,
    result: output.result,
    weaknesses: output.weaknesses,
    missingEvidence: output.missingEvidence,
    alternativeExplanations: output.alternativeExplanations
  };
}
