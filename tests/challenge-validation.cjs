const {test} = require("node:test");
const assert = require("node:assert/strict");
require("tsx/cjs");
const {POST} = require("../app/api/challenge/route.ts");
test("challenge rejects malformed examination payload",async()=>{
 const response=await POST(new Request("http://localhost/api/challenge",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({claimId:"C1",examination:{id:"EX1",claims:[{id:"C1"}]}})}));
 assert.equal(response.status,400);
});
test("challenge rejects malformed JSON",async()=>{
 const response=await POST(new Request("http://localhost/api/challenge",{method:"POST",headers:{"content-type":"application/json"},body:"{broken"}));
 assert.equal(response.status,400);
});
