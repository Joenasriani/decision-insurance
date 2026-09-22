"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { challengeClaim } from "@/lib/engine";
import { saveExamination } from "@/lib/storage";
import type { ClaimStatus, Examination, SourceRecord, SourceRole } from "@/types/core";

const roleLabels: Record<SourceRole, string> = {
  PRIMARY_INPUT_REPORT: "Report under examination",
  RESEARCH_SOURCE: "Research material",
  SUPPORTING_EVIDENCE: "Supporting material",
  COUNTER_EVIDENCE: "Counter material",
  USER_REFERENCE: "Reference material",
  UNKNOWN_ROLE: "Unclassified material"
};

const statusLabels: Record<ClaimStatus, string> = {
  SUPPORTED: "Supported",
  PARTIAL: "Partial",
  UNSUPPORTED: "Unsupported",
  ASSUMPTION: "Assumption",
  CONTRADICTED: "Contradicted",
  UNKNOWN: "Unknown"
};

const readinessLabels: Record<Examination["readiness"]["label"], string> = {
  STRONG_EVIDENCE_COVERAGE: "Strong evidence coverage",
  MATERIAL_GAPS_REMAIN: "Material gaps remain",
  INSUFFICIENT_EVIDENCE: "Insufficient evidence",
  CRITICAL_CONTRADICTION_PRESENT: "Critical contradiction present"
};

function sourceId(seed: string) {
  let hash = 5381;
  for (const ch of seed) hash = (hash * 33) ^ ch.charCodeAt(0);
  return `S${(hash >>> 0).toString(36)}`;
}

export default function DecisionWorkbench() {
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [webAddress, setWebAddress] = useState("");
  const [role, setRole] = useState<SourceRole>("PRIMARY_INPUT_REPORT");
  const [examination, setExamination] = useState<Examination | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedClaim = examination?.claims.find(claim => claim.id === selectedClaimId) ?? examination?.claims[0] ?? null;
  const selectedEvidence = useMemo(() => {
    if (!examination || !selectedClaim) return [];
    const ids = new Set(selectedClaim.evidenceIds);
    return examination.evidence.filter(item => ids.has(item.id));
  }, [examination, selectedClaim]);

  function pushSource(next: SourceRecord) {
    setSources(current => {
      const hasPrimary = current.some(item => item.role === "PRIMARY_INPUT_REPORT");
      if (!hasPrimary && next.role !== "PRIMARY_INPUT_REPORT") next.role = "PRIMARY_INPUT_REPORT";
      return [...current, next];
    });
    setNotice(null);
  }

  function registerText() {
    const text = pasteText.trim();
    if (!text) return;
    const now = new Date().toISOString();
    pushSource({
      id: sourceId(`${text.slice(0, 160)}:${now}`),
      label: role === "PRIMARY_INPUT_REPORT" ? "Pasted report" : "Pasted research",
      kind: "TEXT",
      role,
      extractionMethod: "PASTED",
      extractionStatus: "COMPLETE",
      text
    });
    setPasteText("");
    if (role === "PRIMARY_INPUT_REPORT") setRole("RESEARCH_SOURCE");
  }

  async function readWebSource() {
    if (!webAddress.trim()) return;
    setBusy("web");
    setNotice(null);
    try {
      const response = await fetch("/api/fetch-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webAddress.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The page could not be read.");
      pushSource({
        id: sourceId(`${data.canonicalUrl}:${data.retrievedAt}`),
        label: data.title || new URL(webAddress).hostname,
        title: data.title,
        kind: "WEBPAGE",
        role,
        locator: webAddress.trim(),
        canonicalUrl: data.canonicalUrl,
        retrievedAt: data.retrievedAt,
        extractionMethod: "WEB_FETCH",
        extractionStatus: "COMPLETE",
        text: data.text
      });
      setWebAddress("");
      if (role === "PRIMARY_INPUT_REPORT") setRole("RESEARCH_SOURCE");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The page could not be read.");
    } finally {
      setBusy(null);
    }
  }

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setBusy("files");
    setNotice(null);
    try {
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/ingest", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(`${file.name}: ${data.error || "could not be read"}`);
        pushSource({
          id: sourceId(`${file.name}:${file.size}:${file.lastModified}`),
          label: data.label || file.name,
          kind: data.kind,
          role,
          extractionMethod: "NATIVE",
          extractionStatus: data.extractionStatus,
          text: data.text,
          pageCount: data.pageCount,
          notes: data.notes
        });
        if (role === "PRIMARY_INPUT_REPORT") setRole("RESEARCH_SOURCE");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "A file could not be read.");
    } finally {
      event.target.value = "";
      setBusy(null);
    }
  }

  async function decomposeCase() {
    if (!question.trim()) {
      setNotice("Write the decision question first.");
      return;
    }
    if (!sources.length) {
      setNotice("Register at least one source first.");
      return;
    }
    setBusy("examine");
    setNotice(null);
    try {
      const response = await fetch("/api/examine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), sources })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The case could not be decomposed.");
      setExamination(data.examination);
      setSelectedClaimId(data.examination.claims[0]?.id ?? null);
      await saveExamination(data.examination);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The case could not be decomposed.");
    } finally {
      setBusy(null);
    }
  }

  async function applyChallenge() {
    if (!examination || !selectedClaim) return;
    const challenge = challengeClaim(examination, selectedClaim.id);
    const next = {
      ...examination,
      version: examination.version + 1,
      challenges: [...examination.challenges.filter(item => item.claimId !== selectedClaim.id), challenge]
    };
    setExamination(next);
    await saveExamination(next);
  }

  async function setManualStatus(status: ClaimStatus) {
    if (!examination || !selectedClaim) return;
    const next: Examination = {
      ...examination,
      version: examination.version + 1,
      claims: examination.claims.map(claim => claim.id === selectedClaim.id ? { ...claim, status, humanOverride: true } : claim)
    };
    setExamination(next);
    await saveExamination(next);
  }

  function removeSource(id: string) {
    setSources(current => current.filter(source => source.id !== id));
  }

  const challenge = examination?.challenges.find(item => item.claimId === selectedClaim?.id);

  return (
    <main className="instrument">
      <header className="mast">
        <div className="brandMark">DI</div>
        <div>
          <div className="brandName">DECISION INSURANCE</div>
          <div className="brandPhrase">Evidence before action</div>
        </div>
        <div className="mastState">
          <span>{sources.length.toString().padStart(2, "0")} sources</span>
          <span>v{examination?.version ?? 0}</span>
        </div>
      </header>

      <section className="materialRail" aria-label="Case material">
        <div className="railHeading">
          <span className="indexMark">01</span>
          <h2>CASE MATERIAL</h2>
        </div>

        <div className="roleMatrix" aria-label="Source role">
          {(["PRIMARY_INPUT_REPORT", "RESEARCH_SOURCE", "COUNTER_EVIDENCE"] as SourceRole[]).map(item => (
            <button key={item} type="button" className={role === item ? "roleChoice active" : "roleChoice"} onClick={() => setRole(item)}>
              {roleLabels[item]}
            </button>
          ))}
        </div>

        <div className="intakeBand">
          <label htmlFor="paste-source">PASTE</label>
          <textarea id="paste-source" value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder="Paste a report, research passage, or AI recommendation" />
          <button className="lineAction" type="button" onClick={registerText}>Register text</button>
        </div>

        <div className="intakeBand">
          <label htmlFor="web-source">WEB SOURCE</label>
          <input id="web-source" value={webAddress} onChange={event => setWebAddress(event.target.value)} placeholder="https://" inputMode="url" />
          <button className="lineAction" type="button" onClick={readWebSource} disabled={busy === "web"}>{busy === "web" ? "Reading source" : "Read web source"}</button>
        </div>

        <div className="intakeBand fileBand">
          <span className="bandLabel">FILES</span>
          <input ref={fileRef} className="hiddenInput" type="file" multiple accept=".pdf,.docx,.txt,.md,.markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={importFiles} />
          <button className="lineAction" type="button" onClick={() => fileRef.current?.click()} disabled={busy === "files"}>{busy === "files" ? "Reading files" : "Import research files"}</button>
          <p>PDF DOCX TXT MD</p>
        </div>

        <div className="sourceRegister">
          {sources.map((source, index) => (
            <div className="sourceLine" key={source.id}>
              <div className="sourceOrdinal">{String(index + 1).padStart(2, "0")}</div>
              <div className="sourceMatter">
                <strong>{source.label}</strong>
                <span>{roleLabels[source.role]}</span>
                <span>{source.kind}{source.pageCount ? `  ${source.pageCount} pages` : ""}</span>
              </div>
              <button type="button" className="erase" onClick={() => removeSource(source.id)} aria-label={`Remove ${source.label}`}>×</button>
            </div>
          ))}
          {sources.length === 0 ? <p className="railVoid">Nothing registered yet.</p> : null}
        </div>
      </section>

      <section className="evidenceField">
        <div className="questionBand">
          <span className="indexMark">02</span>
          <label htmlFor="decision-question">QUESTION TO INSURE</label>
          <textarea id="decision-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="What decision is this evidence supposed to support?" />
          <button type="button" className="primaryAction" onClick={decomposeCase} disabled={busy === "examine"}>{busy === "examine" ? "Decomposing" : "Decompose the case"}</button>
          {notice ? <div className="notice" role="status">{notice}</div> : null}
        </div>

        {examination ? (
          <div className="fieldBody">
            <div className="readinessStrip">
              <span>CURRENT EVIDENCE STATE</span>
              <strong>{readinessLabels[examination.readiness.label]}</strong>
              <span>{examination.readiness.criticalClaimIds.length} unresolved critical claims</span>
            </div>

            <div className="fieldHeading">
              <span className="indexMark">03</span>
              <h2>CLAIM FIELD</h2>
              <span>{examination.claims.length} atomic claims</span>
            </div>

            <div className="claimField">
              {examination.claims.map((claim, index) => (
                <button key={claim.id} type="button" className={selectedClaim?.id === claim.id ? "claimStratum selected" : "claimStratum"} onClick={() => setSelectedClaimId(claim.id)}>
                  <span className="claimOrdinal">C{String(index + 1).padStart(2, "0")}</span>
                  <span className={`statusGlyph status_${claim.status}`} aria-hidden="true" />
                  <span className="claimText">{claim.text}</span>
                  <span className="claimMeasure">{claim.evidenceIds.length} evidence</span>
                  <span className="claimState">{statusLabels[claim.status]}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="fieldEmpty">
            <div className="fieldEmptyRule" />
            <p>Register the material. State the decision. The field will separate claims from what actually supports them.</p>
          </div>
        )}
      </section>

      <aside className="inspectionRail" aria-label="Selected claim examination">
        <div className="railHeading">
          <span className="indexMark">04</span>
          <h2>EXAMINATION</h2>
        </div>

        {selectedClaim && examination ? (
          <div className="claimInspection">
            <div className="inspectionLead">
              <span>{selectedClaim.criticality}</span>
              <strong>{statusLabels[selectedClaim.status]}</strong>
            </div>
            <h3>{selectedClaim.text}</h3>

            <section className="inspectionSection">
              <h4>REASON GIVEN</h4>
              <p>{selectedClaim.rationale}</p>
            </section>

            <section className="inspectionSection">
              <h4>EVIDENCE LINKED</h4>
              {selectedEvidence.length ? selectedEvidence.map(item => {
                const source = examination.sources.find(sourceItem => sourceItem.id === item.sourceId);
                const chunk = examination.chunks.find(chunkItem => chunkItem.id === item.chunkId);
                const origin = `${source?.label ?? item.sourceId}${chunk?.pageStart ? `  PAGE ${chunk.pageStart}` : ""}`;
                return (
                  <div className="evidenceExcerpt" key={item.id}>
                    <div className="evidenceOrigin">
                      {source?.canonicalUrl ? <a href={source.canonicalUrl} target="_blank" rel="noreferrer">{origin}</a> : origin}
                    </div>
                    <p>{item.excerpt}</p>
                    <span>retrieval relevance {item.relevance}</span>
                  </div>
                );
              }) : <p>No source linked evidence.</p>}
            </section>

            <section className="inspectionSection">
              <h4>MANUAL CLASSIFICATION</h4>
              <div className="statusMatrix">
                {(Object.keys(statusLabels) as ClaimStatus[]).map(item => (
                  <button type="button" key={item} className={selectedClaim.status === item ? "statusChoice active" : "statusChoice"} onClick={() => setManualStatus(item)}>
                    {statusLabels[item]}
                  </button>
                ))}
              </div>
              {selectedClaim.humanOverride ? <p className="overrideMark">Human override recorded.</p> : null}
            </section>

            <section className="inspectionSection challengeSection">
              <button type="button" className="challengeAction" onClick={applyChallenge}>Challenge this claim</button>
              {challenge ? (
                <div className="challengeResult">
                  <strong>{challenge.result.replaceAll("_", " ")}</strong>
                  {challenge.weaknesses.map(item => <p key={item}>{item}</p>)}
                  {challenge.missingEvidence.map(item => <p key={item}>Missing: {item}</p>)}
                  {challenge.alternativeExplanations.map(item => <p key={item}>Alternative: {item}</p>)}
                </div>
              ) : null}
            </section>
          </div>
        ) : (
          <p className="railVoid">Select a claim after decomposition.</p>
        )}
      </aside>
    </main>
  );
}
