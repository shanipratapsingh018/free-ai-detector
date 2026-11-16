import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../worker/index.js';
const request = (text, origin = 'https://site.test') => new Request('https://site.test/api/rewrite', { method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({text}) });
const env = { OPENAI_API_KEY:'test-not-a-real-key' };
test('missing configuration fails visibly without calling a provider', async()=>{
 let called=false;const response=await handleApi(request('Please keep the original details intact.'),{},async()=>{called=true;});
 assert.equal(response.status,503);assert.equal(called,false);assert.match((await response.json()).error,/not connected/);
});
test('status returns readiness only, never secrets', async()=>{
 const response=await handleApi(new Request('https://site.test/api/status'),env);
 assert.deepEqual(await response.json(),{rewriteConfigured:true});
});
test('rejects cross-origin requests and invalid input before provider call', async()=>{
 const fail=()=>{throw Error('provider should not be called')};
 assert.equal((await handleApi(request('Please keep my original details intact.','https://other.test'),env,fail)).status,403);
 assert.equal((await handleApi(request('tiny'),env,fail)).status,400);
 assert.equal((await handleApi(request('word '.repeat(1501)),env,fail)).status,400);
});
test('rewrites with server credential and minimum-edit instructions', async()=>{
 const original='I would like this text to sound more natural.';
 let payload;
 const response=await handleApi(request(original),env,async(url, options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses'); assert.equal(options.headers.Authorization,'Bearer test-not-a-real-key');
  payload=JSON.parse(options.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'I’d like this text to sound more natural.'}]}]});
 });
 assert.equal(response.status,200);assert.equal(payload.input,original);assert.equal(payload.store,false);assert.match(payload.instructions,/Do not summarize/);
 const output=await response.json();assert.ok(output.text);assert.ok(!JSON.stringify(output).includes('test-not-a-real-key'));
});
test('rejects incomplete or radically shortened revisions and handles provider errors',async()=>{
 const text='Please preserve every detail and keep the same meaning in this paragraph.';
 const shortened=()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Done.'}]}]});
 assert.equal((await handleApi(request(text),env,shortened)).status,502);
 assert.equal((await handleApi(request(text),env,()=>new Response('',{status:429}))).status,429);
 assert.equal((await handleApi(request(text),env,()=>{throw Error('network')})).status,502);
});
