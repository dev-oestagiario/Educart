import {reportFailure} from './sentry';
/** Local aggregate diagnostics. No identifiers, messages, URLs, payloads or persistence. */
export const SERVICES=['auth','rest','rpc','functions','frontend','operation'] as const;
export type Service=typeof SERVICES[number];
export const OUTCOMES=['ok','rejected','limited','server','network','cancelled','failure'] as const;
export type Outcome=typeof OUTCOMES[number];
type Sample={service:Service;outcome:Outcome;ms:number;at:number};
export const WINDOW_MS=15*60_000;
export const MAX_SAMPLES=1000;
const allowedService=(v:unknown):v is Service=>SERVICES.includes(v as Service);
const allowedOutcome=(v:unknown):v is Outcome=>OUTCOMES.includes(v as Outcome);
export function createDiagnostics(clock=()=>Date.now(),limit=MAX_SAMPLES){
 const capacity=Number.isSafeInteger(limit)&&limit>0?Math.min(limit,MAX_SAMPLES):MAX_SAMPLES;
 let samples:Sample[]=[],generation=0,omittedUntil=0,version=0;
 const listeners=new Set<()=>void>();
 function changed(){version++;for(const listener of listeners){try{listener();}catch{/* diagnostics cannot break app */}}}
 function prune(now:number){samples=samples.filter(s=>now>=s.at&&now-s.at<WINDOW_MS);}
 return {
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  version:()=>version,
  generation:()=>generation,
  reset(){generation++;samples=[];omittedUntil=0;changed();},
  record(service:Service,outcome:Outcome,ms:number,epoch=generation){
   if(epoch!==generation||!allowedService(service)||!allowedOutcome(outcome)||!Number.isFinite(ms)||ms<0)return;
   const at=clock();if(!Number.isFinite(at))return;prune(at);
   samples.push({service,outcome,ms:Math.min(120_000,Math.round(ms)),at});
   while(samples.length>capacity){const removed=samples.shift()!;omittedUntil=Math.max(omittedUntil,removed.at+WINDOW_MS);}
   changed();
  },
  summary(){
   const now=clock();prune(now);
   const rows=SERVICES.map(service=>{
    const subset=samples.filter(s=>s.service===service),transport=subset.filter(s=>s.outcome!=='cancelled');
    const successful=transport.filter(s=>s.outcome==='ok').map(s=>s.ms).sort((a,b)=>a-b);
    const count=(o:Outcome)=>subset.filter(s=>s.outcome===o).length;
    const failures=count('network')+count('server')+count('limited');
    const p95=successful.length?successful[Math.ceil(successful.length*.95)-1]!:null;
    const transportService=['auth','rest','rpc','functions'].includes(service);
    const alert=transportService&&(failures>=3&&failures/Math.max(1,transport.length)>=.2||successful.length>=5&&p95!==null&&p95>=2000);
    return {service,total:subset.length,ok:count('ok'),rejected:count('rejected'),cancelled:count('cancelled'),limited:count('limited'),server:count('server'),network:count('network'),failure:count('failure'),p95,alert};
   });
   return {windowMinutes:15,truncated:now<omittedUntil,rows,frontendIssues:rows.find(r=>r.service==='frontend')!.failure,operationFailures:rows.find(r=>r.service==='operation')!.failure};
  }
 };
}
export const diagnostics=createDiagnostics();
export function serviceForRequest(input:RequestInfo|URL,origin:string):Service|null{
 try{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.origin!==origin)return null;
  const path=url.pathname;
  if(path.startsWith('/rest/v1/rpc/'))return 'rpc';
  if(path.startsWith('/rest/v1/'))return 'rest';
  if(path.startsWith('/auth/v1/'))return 'auth';
  if(path.startsWith('/functions/v1/'))return 'functions';
 }catch{/* no raw errors */}
 return null;
}
export function outcomeForStatus(status:number):Outcome{
 if(status>=200&&status<300)return 'ok';
 if(status===429)return 'limited';
 if(status>=500)return 'server';
 return 'rejected';
}
/** Wrapper preserves native Response/rejection/signal. Never reads request or response bodies. */
export function observedFetch(delegate:typeof fetch,baseUrl:string,store=diagnostics,monotonic=()=>performance.now()):typeof fetch{
 const origin=new URL(baseUrl).origin;
 return async(input,init)=>{
  const service=serviceForRequest(input,origin),epoch=store.generation(),start=monotonic();
  const record=(outcome:Outcome)=>{if(service)try{store.record(service,outcome,monotonic()-start,epoch);if((service==='auth'||service==='rest'||service==='rpc'||service==='functions')&&(outcome==='network'||outcome==='server'||outcome==='limited'))reportFailure(service);}catch{/* fail open */}};
  try{const response=await delegate(input,init);record(outcomeForStatus(response.status));return response;}
  catch(error){const signal=init?.signal??(typeof Request!=='undefined'&&input instanceof Request?input.signal:null);
   record(signal?.aborted||(error instanceof DOMException&&error.name==='AbortError')?'cancelled':'network');throw error;}
 };
}
export function observeBrowserFailures(target:Window,store=diagnostics){
 const reportError=()=>{store.record('frontend','failure',0);reportFailure('browser');};
 const reportRejection=()=>{store.record('frontend','failure',0);reportFailure('rejection');};
 target.addEventListener('error',reportError);target.addEventListener('unhandledrejection',reportRejection);
 return()=>{target.removeEventListener('error',reportError);target.removeEventListener('unhandledrejection',reportRejection);};
}
