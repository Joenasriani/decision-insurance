export type SourceRole =
  | "PRIMARY_INPUT_REPORT"
  | "RESEARCH_SOURCE"
  | "SUPPORTING_EVIDENCE"
  | "COUNTER_EVIDENCE"
  | "USER_REFERENCE"
  | "UNKNOWN_ROLE";

export type SourceKind = "TEXT" | "PDF" | "DOCX" | "WEBPAGE" | "MARKDOWN";

export type ClaimStatus =
  | "SUPPORTED"
  | "PARTIAL"
  | "UNSUPPORTED"
  | "ASSUMPTION"
  | "CONTRADICTED"
  | "UNKNOWN";

export type Criticality = "CRITICAL" | "IMPORTANT" | "SUPPORTING";

export interface SourceRecord {
  id: string;
  label: string;
  kind: SourceKind;
  role: SourceRole;
  locator?: string;
  canonicalUrl?: string;
  title?: string;
  retrievedAt?: string;
  extractionMethod: "PASTED" | "NATIVE" | "OCR" | "WEB_FETCH";
  extractionStatus: "COMPLETE" | "PARTIAL" | "FAILED";
  text: string;
  pageCount?: number;
  notes?: string[];
}

export interface SourceChunk {
  id: string;
  sourceId: string;
  order: number;
  text: string;
  pageStart?: number;
  pageEnd?: number;
  heading?: string;
}

export interface EvidenceRecord {
  id: string;
  sourceId: string;
  chunkId: string;
  excerpt: string;
  normalizedFact: string;
  relevance: number;
  supportsClaimIds: string[];
  contradictsClaimIds: string[];
}

export interface AssumptionRecord {
  id: string;
  text: string;
  claimId: string;
  status: "OPEN" | "SUPPORTED" | "REJECTED";
}

export interface UnknownRecord {
  id: string;
  question: string;
  claimId: string;
  requiredEvidence: string;
}

export interface ContradictionRecord {
  id: string;
  description: string;
  claimId: string;
  evidenceIds: string[];
  severity: "CRITICAL" | "MATERIAL" | "MINOR";
}

export interface ClaimRecord {
  id: string;
  text: string;
  criticality: Criticality;
  status: ClaimStatus;
  sourceId?: string;
  evidenceIds: string[];
  assumptionIds: string[];
  contradictionIds: string[];
  unknownIds: string[];
  rationale: string;
  humanOverride: boolean;
}

export interface ChallengeRecord {
  id: string;
  claimId: string;
  result: "SURVIVES" | "WEAKENED" | "MATERIAL_GAP" | "CONTRADICTED" | "UNRESOLVED";
  weaknesses: string[];
  missingEvidence: string[];
  alternativeExplanations: string[];
}

export interface Examination {
  id: string;
  version: number;
  question: string;
  createdAt: string;
  sources: SourceRecord[];
  chunks: SourceChunk[];
  claims: ClaimRecord[];
  evidence: EvidenceRecord[];
  assumptions: AssumptionRecord[];
  contradictions: ContradictionRecord[];
  unknowns: UnknownRecord[];
  challenges: ChallengeRecord[];
  readiness: {
    label:
      | "STRONG_EVIDENCE_COVERAGE"
      | "MATERIAL_GAPS_REMAIN"
      | "INSUFFICIENT_EVIDENCE"
      | "CRITICAL_CONTRADICTION_PRESENT";
    criticalClaimIds: string[];
  };
  limitations: string[];
}
