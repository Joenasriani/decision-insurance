import {
  AssumptionRecord,
  ClaimRecord,
  ContradictionRecord,
  EvidenceRecord,
  Examination,
  SourceChunk,
  SourceRecord,
  UnknownRecord
} from "@/types/core";

const STOP = new Set([
  "the","a","an","and","or","but","of","to","in","on","for","with","as","at","by","from","is","are","was","were","be","been","being","that","this","these","those","it","its","their","they","we","our","you","your","can","could","should","would","may","might","will","has","have","had","not","than","then"
]);

export function stableId(prefix: string, seed: string, index = 0) {
  let hash = 2166136261;
  const value = `${seed}:${index}`;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}${(hash >>> 0).toString(36)}`;
}

export function chunkSources(sources: SourceRecord[]): SourceChunk[] {
  const out: SourceChunk[] = [];
  for (const source of sources) {
    const segments: Array<{ text: string; page?: number }> = [];
    if (source.kind === "PDF") {
      const marker = /([\s\S]*?)\[\[PAGE (\d+) OF \d+\]\]/g;
      let match: RegExpExecArray | null;
      let lastIndex = 0;
      while ((match = marker.exec(source.text)) !== null) {
        const text = match[1].trim();
        const page = Number(match[2]);
        if (text) segments.push({ text, page });
        lastIndex = marker.lastIndex;
      }
      const tail = source.text.slice(lastIndex).trim();
      if (tail) {
        const page = segments.length ? (segments[segments.length - 1].page ?? 0) + 1 : 1;
        segments.push({ text: tail, page });
      }
      if (!segments.length && source.text.trim()) segments.push({ text: source.text.trim() });
    } else {
      segments.push({ text: source.text });
    }

    let order = 0;
    for (const segment of segments) {
      const paragraphs = segment.text
        .replace(/\r/g, "")
        .split(/\n{2,}/)
        .map(v => v.trim())
        .filter(Boolean);
      let buffer = "";
      for (const paragraph of paragraphs) {
        const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
        if (next.length > 1500 && buffer) {
          out.push({
            id: stableId("K", source.id, order),
            sourceId: source.id,
            order,
            text: buffer,
            pageStart: segment.page,
            pageEnd: segment.page
          });
          order += 1;
          buffer = paragraph;
        } else {
          buffer = next;
        }
      }
      if (buffer) {
        out.push({
          id: stableId("K", source.id, order),
          sourceId: source.id,
          order,
          text: buffer,
          pageStart: segment.page,
          pageEnd: segment.page
        });
        order += 1;
      }
    }
  }
  return out;
}

function sentenceCandidates(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(s => s.trim())
    .filter(s => s.length >= 45 && s.length <= 420)
    .filter(s => /\b(is|are|was|were|will|can|has|have|shows|indicates|suggests|increased|decreased|requires|should|because|therefore|likely|risk|recommend)\b/i.test(s));
}

function words(text: string) {
  return [...new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9%]+/g) ?? [])]
    .filter(w => w.length > 2 && !STOP.has(w));
}

function overlap(a: string, b: string) {
  const wa = words(a);
  const wb = new Set(words(b));
  if (!wa.length) return 0;
  const hit = wa.filter(w => wb.has(w)).length;
  return hit / Math.sqrt(wa.length * Math.max(wb.size, 1));
}

function isAssumptionText(text: string) {
  return /\b(assume|assuming|likely|probably|expected|presume|should remain|will continue|implies)\b/i.test(text);
}

function looksContradictory(claim: string, evidence: string) {
  const neg = /\b(no|not|never|decline|decrease|failed|failure|risk|contrary|however|despite|but)\b/i.test(evidence);
  return neg && overlap(claim, evidence) > 0.16;
}

export function examineLocally(question: string, sources: SourceRecord[]): Examination {
  const chunks = chunkSources(sources);
  const primary = sources.find(s => s.role === "PRIMARY_INPUT_REPORT") ?? sources[0];
  const candidates = sentenceCandidates(primary?.text ?? "").slice(0, 18);
  const claims: ClaimRecord[] = [];
  const evidence: EvidenceRecord[] = [];
  const assumptions: AssumptionRecord[] = [];
  const contradictions: ContradictionRecord[] = [];
  const unknowns: UnknownRecord[] = [];

  const selected = candidates.length ? candidates : [question].filter(Boolean);

  selected.forEach((text, i) => {
    const claimId = stableId("C", text, i);
    const ranked = chunks
      .filter(c => c.sourceId !== primary?.id || c.text !== text)
      .map(chunk => ({ chunk, score: overlap(text, chunk.text) }))
      .filter(x => x.score > 0.08)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const evidenceIds: string[] = [];
    const contradictionIds: string[] = [];
    const assumptionIds: string[] = [];
    const unknownIds: string[] = [];

    ranked.forEach((item, rIndex) => {
      const evidenceId = stableId("E", `${claimId}:${item.chunk.id}`, rIndex);
      const contradicts = looksContradictory(text, item.chunk.text);
      const record: EvidenceRecord = {
        id: evidenceId,
        sourceId: item.chunk.sourceId,
        chunkId: item.chunk.id,
        excerpt: item.chunk.text.slice(0, 520),
        normalizedFact: item.chunk.text.slice(0, 240),
        relevance: Number(item.score.toFixed(3)),
        supportsClaimIds: contradicts ? [] : [claimId],
        contradictsClaimIds: contradicts ? [claimId] : []
      };
      evidence.push(record);
      evidenceIds.push(evidenceId);
      if (contradicts) {
        const contradictionId = stableId("X", evidenceId);
        contradictions.push({
          id: contradictionId,
          description: "Retrieved material conflicts with the claim wording or direction.",
          claimId,
          evidenceIds: [evidenceId],
          severity: i < 3 ? "MATERIAL" : "MINOR"
        });
        contradictionIds.push(contradictionId);
      }
    });

    if (isAssumptionText(text)) {
      const assumptionId = stableId("A", text);
      assumptions.push({ id: assumptionId, text, claimId, status: "OPEN" });
      assumptionIds.push(assumptionId);
    }

    let status: ClaimRecord["status"] = "UNKNOWN";
    if (contradictionIds.length) status = "CONTRADICTED";
    else if (assumptionIds.length && evidenceIds.length < 2) status = "ASSUMPTION";
    else if (ranked[0]?.score >= 0.34 && ranked.length >= 2) status = "SUPPORTED";
    else if (ranked[0]?.score >= 0.18) status = "PARTIAL";
    else if (ranked.length) status = "UNSUPPORTED";

    if (status === "UNKNOWN" || status === "UNSUPPORTED" || status === "PARTIAL") {
      const unknownId = stableId("U", text);
      unknowns.push({
        id: unknownId,
        question: `What source evidence directly establishes: ${text}`,
        claimId,
        requiredEvidence: "Direct, source traceable evidence that establishes the material proposition."
      });
      unknownIds.push(unknownId);
    }

    claims.push({
      id: claimId,
      text,
      criticality: i < 3 ? "CRITICAL" : i < 8 ? "IMPORTANT" : "SUPPORTING",
      status,
      sourceId: primary?.id,
      evidenceIds,
      assumptionIds,
      contradictionIds,
      unknownIds,
      rationale: status === "SUPPORTED"
        ? "Multiple retrieved passages materially overlap the claim."
        : status === "CONTRADICTED"
          ? "At least one retrieved passage materially conflicts with the claim."
          : status === "ASSUMPTION"
            ? "The claim uses predictive or inferential language without enough direct support."
            : "The available corpus does not directly establish the full claim.",
      humanOverride: false
    });
  });

  const criticalContradiction = claims.some(c => c.criticality === "CRITICAL" && c.status === "CONTRADICTED");
  const criticalGap = claims.some(c => c.criticality === "CRITICAL" && ["UNSUPPORTED", "UNKNOWN", "ASSUMPTION"].includes(c.status));
  const importantGap = claims.some(c => c.criticality === "IMPORTANT" && c.status !== "SUPPORTED");

  const readiness: Examination["readiness"] = {
    label: criticalContradiction
      ? "CRITICAL_CONTRADICTION_PRESENT"
      : criticalGap
        ? "INSUFFICIENT_EVIDENCE"
        : importantGap
          ? "MATERIAL_GAPS_REMAIN"
          : "STRONG_EVIDENCE_COVERAGE",
    criticalClaimIds: claims.filter(c => c.criticality === "CRITICAL" && c.status !== "SUPPORTED").map(c => c.id)
  };

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
    readiness,
    limitations: [
      "This first build uses deterministic local decomposition and lexical retrieval when no model adapter is configured.",
      "Retrieved overlap is evidence discovery, not proof. Human inspection remains authoritative."
    ]
  };
}

export function challengeClaim(examination: Examination, claimId: string) {
  const claim = examination.claims.find(c => c.id === claimId);
  if (!claim) throw new Error("Claim not found");
  const evidence = examination.evidence.filter(e => claim.evidenceIds.includes(e.id));
  const weaknesses: string[] = [];
  const missingEvidence: string[] = [];
  const alternatives: string[] = [];

  if (evidence.length === 0) weaknesses.push("No source linked evidence currently supports this claim.");
  if (claim.status === "PARTIAL") weaknesses.push("The retrieved material establishes only part of the proposition.");
  if (claim.assumptionIds.length) weaknesses.push("The claim depends on an unresolved assumption.");
  if (claim.contradictionIds.length) weaknesses.push("At least one source linked passage conflicts with this claim.");
  if (claim.unknownIds.length) missingEvidence.push("Direct evidence for the unresolved material proposition.");
  alternatives.push("The same observations may support a narrower conclusion than the current claim.");

  const result = claim.contradictionIds.length
    ? "CONTRADICTED"
    : claim.status === "SUPPORTED" && weaknesses.length === 0
      ? "SURVIVES"
      : missingEvidence.length || claim.status === "UNSUPPORTED"
        ? "MATERIAL_GAP"
        : "WEAKENED";

  return {
    id: stableId("CH", `${examination.id}:${claimId}:${examination.version}`),
    claimId,
    result: result as "SURVIVES" | "WEAKENED" | "MATERIAL_GAP" | "CONTRADICTED" | "UNRESOLVED",
    weaknesses,
    missingEvidence,
    alternativeExplanations: alternatives
  };
}
