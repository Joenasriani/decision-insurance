const {test} = require("node:test");
const assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");
require("tsx/cjs");
const {POST} = require("../app/api/ingest/route.ts");
function makePDF(pageCount=1){
 const streams=Array.from({length:pageCount},(_,i)=>`BT /F1 12 Tf 30 100 Td (Page ${i+1} Fixture) Tj ET`);
 const objects=[
 "<< /Type /Catalog /Pages 2 0 R >>",
 `<< /Type /Pages /Kids [${streams.map((_,i)=>`${3+i*3} 0 R`).join(" ")}] /Count ${pageCount} >>`,
 ...streams.flatMap((stream,i)=>[
 `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 ${4+i*3} 0 R >> >> /Contents ${5+i*3} 0 R >>`,
 "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
 "<< /Length "+Buffer.byteLength(stream)+" >>\nstream\n"+stream+"\nendstream"
 ])
 ];
 let pdf="%PDF-1.4\n",offsets=[0];
 objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+" 0 obj\n"+o+"\nendobj\n";});
 const xref=Buffer.byteLength(pdf);
 pdf+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
 offsets.slice(1).forEach(n=>pdf+=String(n).padStart(10,"0")+" 00000 n \n");
 pdf+="trailer\n<< /Size "+(objects.length+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";
 return Buffer.from(pdf);
}
function makeDOCX(){
 const py=`import io,zipfile,base64
b=io.BytesIO()
with zipfile.ZipFile(b,"w") as z:
 z.writestr("[Content_Types].xml",'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
 z.writestr("_rels/.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
 z.writestr("word/document.xml",'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX Fixture Content</w:t></w:r></w:p></w:body></w:document>')
print(base64.b64encode(b.getvalue()).decode())
`;
 const p=spawnSync("python3",["-c",py],{encoding:"utf8"});
 if(p.status!==0)throw Error(p.stderr);
 return Buffer.from(p.stdout.trim(),"base64");
}
async function ingest(name,mime,bytes){
 const form=new FormData();
 form.set("file",new File([bytes],name,{type:mime}));
 return POST(new Request("http://localhost/api/ingest",{method:"POST",body:form}));
}
test("real single-page PDF fixture extracts text but never certifies completeness",async()=>{
 const response=await ingest("fixture.pdf","application/pdf",makePDF());
 assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 const data=await response.json();
 assert.match(data.text,/Page 1 Fixture/);
 assert.equal(data.kind,"PDF");
 assert.equal(data.pageCount,1);
 assert.equal(data.extractionStatus,"PARTIAL");
 assert.ok(data.notes.length);
});
test("real DOCX fixture extracts text but never certifies layout completeness",async()=>{
 const response=await ingest("fixture.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document",makeDOCX());
 assert.equal(response.status,200);
 const data=await response.json();
 assert.match(data.text,/DOCX Fixture Content/);
 assert.equal(data.kind,"DOCX");
 assert.equal(data.extractionStatus,"PARTIAL");
});

test("real multi-page PDF ingestion preserves page text without certifying visual completeness",async()=>{
 const response=await ingest("multipage.pdf","application/pdf",makePDF(3));
 assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 const data=await response.json();
 assert.equal(data.pageCount,3);
 for(let i=1;i<=3;i++)assert.match(data.text,new RegExp("Page "+i+" Fixture"));
 assert.equal(data.extractionStatus,"PARTIAL");
 assert.ok(data.notes.some(note=>/visual page content/i.test(note)));
});
test("DOCX ingestion with table content remains partial, not visually verified",async()=>{
 const py=`import io,zipfile,base64
b=io.BytesIO()
with zipfile.ZipFile(b,"w") as z:
 z.writestr("[Content_Types].xml",'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
 z.writestr("_rels/.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
 z.writestr("word/document.xml",'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Document Header</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table Evidence Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')
print(base64.b64encode(b.getvalue()).decode())
`;
 const p=spawnSync("python3",["-c",py],{encoding:"utf8"});
 assert.equal(p.status,0,p.stderr);
 const response=await ingest("table.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document",Buffer.from(p.stdout.trim(),"base64"));
 assert.equal(response.status,200);
 const data=await response.json();
 assert.match(data.text,/Document Header/);
 assert.equal(data.extractionStatus,"PARTIAL");
 assert.ok(data.notes.some(note=>/tables|layout/i.test(note)));
});
