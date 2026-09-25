"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { saveExamination } from "@/lib/storage";
import type { ClaimStatus, Examination, SourceRecord, SourceRole } from "@/types/core";

const roleLabels: Record<SourceRole, string> = {
  PRIMARY_INPUT_REPORT: "Main report or recommendation",
  RESEARCH_SOURCE: "Research or background",
  SUPPORTING_EVIDENCE: "Evidence that supports it",
  COUNTER_EVIDENCE: "Evidence that challenges it",
  USER_REFERENCE: "Reference material",
  UNKNOWN_ROLE: "Not classified yet"
};

const statusLabels: Record<ClaimStatus, string> = {
  SUPPORTED: "Supported",
  PARTIAL: "Partly supported",
  UNSUPPORTED: "Not supported",
  ASSUMPTION: "Assumption",
  CONTRADICTED: "Conflicting evidence",
  UNKNOWN: "Not enough information"
};

const readinessLabels: Record<Examination["readiness"]["label"], string> = {
  STRONG_EVIDENCE_COVERAGE: "Well supported",
  MATERIAL_GAPS_REMAIN: "Important gaps remain",
  INSUFFICIENT_EVIDENCE: "Not enough evidence yet",
  CRITICAL_CONTRADICTION_PRESENT: "Major conflict found"
};

const criticalityLabels: Record<Examination["claims"][number]["criticality"], string> = {
  CRITICAL: "Must verify",
  IMPORTANT: "Important",
  SUPPORTING: "Supporting detail"
};

const challengeLabels: Record<Examination["challenges"][number]["result"], string> = {
  SURVIVES: "Still holds up",
  WEAKENED: "Weakened",
  MATERIAL_GAP: "Important gap found",
  CONTRADICTED: "Conflicting evidence found",
  UNRESOLVED: "Needs more evidence"
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
      label: role === "PRIMARY_INPUT_REPORT" ? "Pasted report or recommendation" : "Pasted source",
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
      setNotice("Tell us what decision you are trying to make.");
      return;
    }
    if (!sources.length) {
      setNotice("Add at least one report, recommendation, or source first.");
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
      if (!response.ok) throw new Error(data.error || "The evidence check could not be completed.");
      setExamination(data.examination);
      setSelectedClaimId(data.examination.claims[0]?.id ?? null);
      await saveExamination(data.examination);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The evidence check could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  async function applyChallenge() {
    if (!examination || !selectedClaim) return;
    setBusy("challenge");
    setNotice(null);
    try {
      const response = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examination, claimId: selectedClaim.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The claim test did not complete.");
      const next = {
        ...examination,
        version: examination.version + 1,
        challenges: [...examination.challenges.filter(item => item.claimId !== selectedClaim.id), data.challenge]
      };
      setExamination(next);
      if (data.limitation) setNotice("The deeper AI stress-test was unavailable, so a basic consistency check was used instead.");
      await saveExamination(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The claim test did not complete.");
    } finally {
      setBusy(null);
    }
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
          <div className="brandPhrase">Check what holds up before you act</div>
        </div>
        <div className="mastState">
          <span>{sources.length} {sources.length === 1 ? "source" : "sources"}</span>
          <span>{examination ? `review ${examination.version}` : "not checked yet"}</span>
        </div>
      </header>

      <section className="materialRail" aria-label="Case material">
        <div className="railHeading">
          <span className="indexMark">01</span>
          <h2>ADD YOUR MATERIAL</h2>
        </div>

        <div className="firstRunGuide">
          <strong>Start here</strong>
          <p>Add the report or recommendation you want to check. Then add research or sources that may support or challenge it.</p>
        </div>

        <div className="rolePrompt">What are you adding?</div>
        <div className="roleMatrix" aria-label="What kind of material are you adding?">
          {(["PRIMARY_INPUT_REPORT", "RESEARCH_SOURCE", "COUNTER_EVIDENCE"] as SourceRole[]).map(item => (
            <button key={item} type="button" className={role === item ? "roleChoice active" : "roleChoice"} onClick={() => setRole(item)}>
              {roleLabels[item]}
            </button>
          ))}
        </div>

        <div className="intakeBand">
          <label htmlFor="paste-source">PASTE TEXT</label>
          <textarea id="paste-source" value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder="Paste the report, recommendation, research, or evidence here" />
          <button className="lineAction" type="button" onClick={registerText}>Add this text</button>
        </div>

        <div className="intakeBand">
          <label htmlFor="web-source">WEBPAGE</label>
          <input id="web-source" value={webAddress} onChange={event => setWebAddress(event.target.value)} placeholder="https://" inputMode="url" />
          <button className="lineAction" type="button" onClick={readWebSource} disabled={busy === "web"}>{busy === "web" ? "Reading webpage" : "Add webpage"}</button>
        </div>

        <div className="intakeBand fileBand">
          <span className="bandLabel">UPLOAD FILES</span>
          <input ref={fileRef} className="hiddenInput" type="file" multiple accept=".pdf,.docx,.txt,.md,.markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={importFiles} />
          <button className="lineAction" type="button" onClick={() => fileRef.current?.click()} disabled={busy === "files"}>{busy === "files" ? "Reading files" : "Choose files"}</button>
          <p>PDF, DOCX, TXT, or Markdown</p>
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
          {sources.length === 0 ? <p className="railVoid">Nothing added yet. Start with the report or recommendation you want to check.</p> : null}
        </div>
      </section>

      <section className="evidenceField">
        <div className="questionBand">
          <span className="indexMark">02</span>
          <label htmlFor="decision-question">WHAT ARE YOU TRYING TO DECIDE?</label>
          <textarea id="decision-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Example: Should we act on this recommendation based on the evidence?" />
          <button type="button" className="primaryAction" onClick={decomposeCase} disabled={busy === "examine"}>{busy === "examine" ? "Checking the evidence" : "Check the evidence"}</button>
          {notice ? <div className="notice" role="status">{notice}</div> : null}
        </div>

        {examination ? (
          <div className="fieldBody">
            <div className="readinessStrip">
              <span>WHAT THE EVIDENCE SAYS</span>
              <strong>{readinessLabels[examination.readiness.label]}</strong>
              <span>{examination.readiness.criticalClaimIds.length} must-check {examination.readiness.criticalClaimIds.length === 1 ? "item" : "items"} still unresolved</span>
            </div>

            <div className="fieldHeading">
              <span className="indexMark">03</span>
              <h2>KEY STATEMENTS TO CHECK</h2>
              <span>{examination.claims.length} {examination.claims.length === 1 ? "statement" : "statements"}</span>
            </div>

            <div className="claimField">
              {examination.claims.map((claim, index) => (
                <button key={claim.id} type="button" className={selectedClaim?.id === claim.id ? "claimStratum selected" : "claimStratum"} onClick={() => setSelectedClaimId(claim.id)}>
                  <span className="claimOrdinal">C{String(index + 1).padStart(2, "0")}</span>
                  <span className={`statusGlyph status_${claim.status}`} aria-hidden="true" />
                  <span className="claimText">{claim.text}</span>
                  <span className="claimMeasure">{claim.evidenceIds.length} linked {claim.evidenceIds.length === 1 ? "excerpt" : "excerpts"}</span>
                  <span className="claimState">{statusLabels[claim.status]}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="fieldEmpty">
            <div className="fieldEmptyRule" />
            <p>Enter the case material. State the question. Choose “Check the evidence.” The app will break the recommendation into key statements, connect each one to its sources, and show what holds up, what conflicts, and what is still missing.</p>
          </div>
        )}
      </section>

      <aside className="inspectionRail" aria-label="Selected statement details">
        <div className="railHeading">
          <span className="indexMark">04</span>
          <h2>STATEMENT DETAILS</h2>
        </div>

        {selectedClaim && examination ? (
          <div className="claimInspection">
            <div className="inspectionLead">
              <span>{criticalityLabels[selectedClaim.criticality]}</span>
              <strong>{statusLabels[selectedClaim.status]}</strong>
            </div>
            <h3>{selectedClaim.text}</h3>

            <section className="inspectionSection">
              <h4>WHY THIS WAS FLAGGED</h4>
              <p>{selectedClaim.rationale}</p>
            </section>

            <section className="inspectionSection">
              <h4>LINKED SOURCES</h4>
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
                    <span>Source match {Math.round(item.relevance * 100)}%</span>
                  </div>
                );
              }) : <p>No linked source currently supports or challenges this statement.</p>}
            </section>

            <section className="inspectionSection">
              <h4>CHANGE THIS ASSESSMENT</h4>
              <div className="statusMatrix">
                {(Object.keys(statusLabels) as ClaimStatus[]).map(item => (
                  <button type="button" key={item} className={selectedClaim.status === item ? "statusChoice active" : "statusChoice"} onClick={() => setManualStatus(item)}>
                    {statusLabels[item]}
                  </button>
                ))}
              </div>
              {selectedClaim.humanOverride ? <p className="overrideMark">Your assessment is saved.</p> : null}
            </section>

            <section className="inspectionSection challengeSection">
              <button type="button" className="challengeAction" onClick={applyChallenge} disabled={busy === "challenge"}>{busy === "challenge" ? "Stress-testing" : "Stress-test this statement"}</button>
              {challenge ? (
                <div className="challengeResult">
                  <strong>{challengeLabels[challenge.result]}</strong>
                  {challenge.weaknesses.map(item => <p key={item}>{item}</p>)}
                  {challenge.missingEvidence.map(item => <p key={item}>Still needed: {item}</p>)}
                  {challenge.alternativeExplanations.map(item => <p key={item}>Another explanation: {item}</p>)}
                </div>
              ) : null}
            </section>
          </div>
        ) : (
          <p className="railVoid">Select a statement to see why it was assessed that way and which sources are linked to it.</p>
        )}
      </aside>
    </main>
  );
}
