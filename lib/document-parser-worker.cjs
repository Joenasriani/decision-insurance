"use strict";
const {parentPort,workerData}=require("node:worker_threads");
const MAX_CHARS=2_000_000;
const MAX_PAGES=200;
function clean(text){return text.replace(/\r/g,"").replace(/[ \t]+\n/g,"\n").replace(/\n{4,}/g,"\n\n\n").trim();}
function bounded(text){const result=clean(text);if(result.length>MAX_CHARS)throw Error("Extracted text exceeds the current 2,000,000 character limit.");return result;}
async function run(){
 const {kind,bytes}=workerData;
 if(kind==="PDF"){
  const {PDFParse}=require("pdf-parse");
  const parser=new PDFParse({data:new Uint8Array(bytes)});
  try{
   // Inspect metadata first; reject excessive-page documents before text extraction.
   const info=await parser.getInfo({parsePageInfo:true});
   const total=info.total;
   if(!Number.isInteger(total)||total<1)throw Error("PDF page count could not be established.");
   if(total>MAX_PAGES)throw Error("This PDF exceeds the current 200-page limit.");
   const extracted=await parser.getText({pageJoiner:"\n\n[[PAGE page_number OF total_number]]\n\n"});
   const text=bounded(extracted.text);
   const markers=[...text.matchAll(/\[\[PAGE (\d+) OF (\d+)\]\]/g)];
   const valid=markers.length===total&&markers.every((m,i)=>Number(m[1])===i+1&&Number(m[2])===total);
   const readable=text.replace(/\[\[PAGE \d+ OF \d+\]\]/g,"").trim();
   const notes=[];
   if(!valid)notes.push("Page attribution could not be verified; page references must not be trusted.");
   if(readable.length<=100)notes.push("This PDF contains very little selectable text. Try another copy or paste the relevant text manually.");
   notes.push("Extraction is not independently checked against visual page content, tables or figures.");
   return {kind:"PDF",text,pageCount:total,extractionStatus:"PARTIAL",notes};
  }finally{await parser.destroy();}
 }
 if(kind==="DOCX"){
  const mammoth=require("mammoth");
  const result=await mammoth.extractRawText({buffer:Buffer.from(bytes)});
  return {kind:"DOCX",text:bounded(result.value),extractionStatus:"PARTIAL",notes:["Raw-text DOCX extraction does not verify figures, tables, or layout completeness.",...result.messages.map(m=>m.message).slice(0,7)]};
 }
 throw Error("Unsupported parser type.");
}
run().then(value=>parentPort.postMessage({ok:true,value}),error=>parentPort.postMessage({ok:false,error:error instanceof Error?error.message:"Document parser failed."}));
