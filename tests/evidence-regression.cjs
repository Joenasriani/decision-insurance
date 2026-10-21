const {test} = require("node:test");
const assert = require("node:assert/strict");
require("tsx/cjs");
const {examineLocally,chunkSources,calculateReadiness} = require("../lib/engine.ts");

const source = (id,role,text,extra={}) => ({id,label:id,kind:"TEXT",role,extractionMethod:"PASTED",extractionStatus:"COMPLETE",text,...extra});
test("lexical similarity never establishes support or contradiction",()=>{
 const report=source("S1","PRIMARY_INPUT_REPORT","The proposed investment will increase revenue by twenty percent next year.");
 const evidence=source("S2","RESEARCH_SOURCE","The proposed investment will not increase revenue by twenty percent next year.");
 const result=examineLocally("Should we invest?",[report,evidence]);
 assert.ok(result.claims.length);
 assert.ok(result.claims.every(c=>c.status!=="SUPPORTED" && c.status!=="CONTRADICTED"));
 assert.equal(result.readiness.label,"INSUFFICIENT_EVIDENCE");
 assert.ok(result.evidence.every(e=>e.supportsClaimIds.length===0 && e.contradictsClaimIds.length===0));
});
test("PDF pages preserve correct attribution with valid page markers",()=>{
 const pdf=source("P1","RESEARCH_SOURCE","First page text. [[PAGE 1 OF 2]] Second page text. [[PAGE 2 OF 2]]",{kind:"PDF",pageCount:2});
 const chunks=chunkSources([pdf]);
 assert.deepEqual(chunks.map(c=>c.pageStart),[1,2]);
});
test("invalid PDF page markers fail closed without invented page numbers",()=>{
 const pdf=source("P2","RESEARCH_SOURCE","First page. [[PAGE 2 OF 2]] Second page.",{kind:"PDF",pageCount:2});
 const chunks=chunkSources([pdf]);
 assert.ok(chunks.every(c=>c.pageStart===undefined));
});
test("source provenance is retained without promotion to verified",()=>{
 const report=source("S1","PRIMARY_INPUT_REPORT","The proposed investment will increase revenue by twenty percent next year.");
 const evidence=source("S2","RESEARCH_SOURCE","The proposed investment will increase revenue by twenty percent next year.",{provenanceStatus:"USER_SUPPLIED",sourceDate:"2026-01-01"});
 const result=examineLocally("Should we invest?",[report,evidence]);
 assert.ok(result.evidence.length);
 assert.ok(result.evidence.every(e=>e.provenanceStatus==="USER_SUPPLIED" && e.strength==="UNASSESSED" && e.sourceDate==="2026-01-01"));
});

test("primary report cannot serve as independent evidence for itself",()=>{
 const report=source("S1","PRIMARY_INPUT_REPORT","The proposed investment will increase revenue by twenty percent next year.");
 const result=examineLocally("Should we invest?",[report]);
 assert.equal(result.evidence.length,0);
 assert.equal(result.readiness.label,"INSUFFICIENT_EVIDENCE");
});
test("incomplete PDF markers cannot imply verified page provenance",()=>{
 const pdf=source("P3","RESEARCH_SOURCE","First page. [[PAGE 1 OF 3]] Second page. [[PAGE 2 OF 3]]",{kind:"PDF",pageCount:3});
 const chunks=chunkSources([pdf]);
 assert.ok(chunks.length);
 assert.ok(chunks.every(c=>c.pageStart===undefined));
});

test("manual criticality changes recompute readiness without falsely certifying gaps",()=>{
 const base={id:"C1",status:"UNKNOWN",criticality:"CRITICAL"};
 assert.equal(calculateReadiness([base]).label,"INSUFFICIENT_EVIDENCE");
 assert.equal(calculateReadiness([{...base,criticality:"IMPORTANT"}]).label,"MATERIAL_GAPS_REMAIN");
 assert.equal(calculateReadiness([{...base,criticality:"SUPPORTING"}]).label,"MATERIAL_GAPS_REMAIN");
 assert.equal(calculateReadiness([{...base,status:"SUPPORTED"}]).label,"STRONG_EVIDENCE_COVERAGE");
 assert.equal(calculateReadiness([{...base,status:"CONTRADICTED"}]).label,"CRITICAL_CONTRADICTION_PRESENT");
});
