// Explicit, unauthenticated, read-only smoke probe. Does not contact Supabase or collect content.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
export function validatedTarget(value){
 const url=new URL(value);
 if(url.username||url.password||url.search||url.hash||!url.pathname.endsWith('/'))throw Error('Use a URL base sem credenciais, query ou fragmento, terminada em /.');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Somente HTTPS ou HTTP loopback.');
 return url;
}
async function check(url,expected,maxBytes,fetcher){
 const start=performance.now();
 try{
  const response=await fetcher(url,{method:'GET',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(10_000)});
  if(!response.ok||!expected.test(response.headers.get('content-type')??'')){await response.body?.cancel();return {ok:false,kind:'http-or-content-type',ms:Math.round(performance.now()-start)};}
  if(!response.body)return {ok:false,kind:'empty',ms:Math.round(performance.now()-start)};
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();return {ok:false,kind:'size-limit',ms:Math.round(performance.now()-start)};}chunks.push(value);}}finally{reader.releaseLock();}
  if(!size)return {ok:false,kind:'empty',ms:Math.round(performance.now()-start)};
  return {ok:true,kind:'ok',ms:Math.round(performance.now()-start),text:Buffer.concat(chunks).toString('utf8')};
 }catch{return {ok:false,kind:'network-timeout-or-redirect',ms:Math.round(performance.now()-start)};}
}
export async function probeDeploy(value,fetcher=fetch){
 const target=validatedTarget(value),html=await check(target,/^text\/html\b/i,512*1024,fetcher);
 const {text,...entry}=html;if(!entry.ok)return {ok:false,entry,asset:null};
 if(!/<title>[^<]*educart/i.test(text??'')||!/<div\s+id=["']root["']/i.test(text??''))return {ok:false,entry:{...entry,ok:false,kind:'unexpected-app'},asset:null};
 // Only an expected Vite build entry file under the same configured base.
 const source=(text??'').match(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i)?.[1];
 if(!source||!/^\.?\/?assets\/[A-Za-z0-9_-]+\.js$/.test(source))return {ok:false,entry:{...entry,ok:false,kind:'missing-build-entry'},asset:null};
 const assetUrl=new URL(source,target);
 if(assetUrl.origin!==target.origin||!assetUrl.pathname.startsWith(target.pathname+'assets/'))return {ok:false,entry:{...entry,ok:false,kind:'invalid-build-entry'},asset:null};
 const asset=await check(assetUrl,/^(?:text|application)\/(?:java|ecma)script\b/i,5*1024*1024,fetcher);
 const {text:discard,...assetResult}=asset;
 return {ok:assetResult.ok,entry,asset:assetResult};
}
export async function probeVersion(value,expectedSha,fetcher=fetch){
 if(typeof expectedSha!=='string'||!(/^[a-f0-9]{40}$/).test(expectedSha))throw Error('SHA esperado inválido');
 const target=validatedTarget(value);
 const {text,...result}=await check(new URL('version.json',target),/^application\/json\b/i,8192,fetcher);
 if(!result.ok)return {ok:false,kind:result.kind,ms:result.ms};
 try{
  const v=JSON.parse(text);
  if(Object.keys(v).sort().join(',')!=='build,commit,ref'||v.commit!==expectedSha||!(/^[A-Za-z0-9][A-Za-z0-9/_-]{0,127}$/).test(v.ref)||typeof v.build!=='string'||!Number.isFinite(Date.parse(v.build)))throw Error('Versão inesperada');
  return {ok:true,kind:'ok',ms:result.ms};
 }catch{return {ok:false,kind:'unexpected-version',ms:result.ms};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{if(process.argv.length!==3)throw Error('Uso: node scripts/verificar-saude-deploy.mjs URL_BASE');const report=await probeDeploy(process.argv[2]);console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1;}
 catch{console.error('Falha de configuração do probe; informe a URL base autorizada, sem dados sensíveis.');process.exitCode=2;}
}
