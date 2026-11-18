import {describe,it,expect,vi} from 'vitest';
import {createDiagnostics,observedFetch,serviceForRequest,outcomeForStatus,WINDOW_MS,observeBrowserFailures,type Outcome,type Service} from './observability';
const base='https://example.test';
const total=(store:ReturnType<typeof createDiagnostics>)=>store.summary().rows.reduce((n,r)=>n+r.total,0);
describe('F6.2 observabilidade local',()=>{
 it('classifica apenas categorias fixas do projeto configurado',()=>{
  for(const [path,kind] of [['/rest/v1/carts?id=eq.secret','rest'],['/rest/v1/rpc/privateFunction','rpc'],['/auth/v1/token?grant_type=password','auth'],['/functions/v1/secret','functions']])expect(serviceForRequest(base+path,base)).toBe(kind);
  for(const url of ['https://evil.test/rest/v1/carts',base+'/storage/v1/secret','not a url'])expect(serviceForRequest(url,base)).toBeNull();
 });
 it('distingue status sem converter recusas de negócio em falhas de transporte',()=>{
  expect([200,204,302,400,401,403,409,429,500,503].map(outcomeForStatus)).toEqual(['ok','ok','rejected','rejected','rejected','rejected','rejected','limited','server','server']);
 });
 it('não coleta payloads, URLs, cabeçalhos, erros nem valores arbitrários',async()=>{
  const store=createDiagnostics();const response=new Response('private-result',{status:200});
  const fake=vi.fn(async()=>response);const f=observedFetch(fake,base,store);
  const body='secret-password';const request=new Request(base+'/rest/v1/rpc/secret-uuid',{method:'POST',headers:{Authorization:'Bearer secret-token'},body});
  expect(await f(request)).toBe(response);expect(fake).toHaveBeenCalledWith(request,undefined);
  expect(response.bodyUsed).toBe(false);
  store.record('secret-service' as Service,'ok',0);store.record('auth','secret-error' as Outcome,0);
  const output=JSON.stringify(store.summary());for(const s of ['secret','private-result','example.test'])expect(output).not.toContain(s);
  expect(total(store)).toBe(1);
 });
 it('respeita a rejeição original, distingue cancelamento de rede',async()=>{
  const store=createDiagnostics(),error=new Error('privado');
  const f=observedFetch(async()=>{throw error},base,store);
  await expect(f(base+'/rest/v1/items')).rejects.toBe(error);
  const abort=new AbortController();abort.abort();
  await expect(f(base+'/rest/v1/items',{signal:abort.signal})).rejects.toBe(error);
  const row=store.summary().rows.find(r=>r.service==='rest')!;
  expect(row.network).toBe(1);expect(row.cancelled).toBe(1);
 });
 it('guarda somente janela móvel, limita amostra, informa truncamento',()=>{
  let now=0;const store=createDiagnostics(()=>now,2);
  for(let i=0;i<3;i++)store.record('rpc','ok',100);
  expect(total(store)).toBe(2);expect(store.summary().truncated).toBe(true);
  now=WINDOW_MS;expect(total(store)).toBe(0);expect(store.summary().truncated).toBe(false);
 });
 it('rejeita limites inválidos e mantém teto absoluto',()=>{
  for(const limit of [-1,0,NaN,Infinity,100000]){const store=createDiagnostics(()=>1,limit);for(let i=0;i<1001;i++)store.record('rpc','ok',1);expect(total(store)).toBe(1000);expect(store.summary().truncated).toBe(true);}
 });
 it('reset invalida requisições em voo da conta anterior',async()=>{
  let complete:(r:Response)=>void=()=>{};
  const store=createDiagnostics();const f=observedFetch(()=>new Promise(resolve=>{complete=resolve}),base,store);
  const pending=f(base+'/auth/v1/user');store.reset();complete(new Response('',{status:200}));await pending;
  expect(total(store)).toBe(0);
 });
 it('alerta com mínimo de amostras e p95 de respostas bem sucedidas',()=>{
  const store=createDiagnostics();
  for(let i=0;i<8;i++)store.record('rpc','rejected',5000);
  expect(store.summary().rows.find(r=>r.service==='rpc')!.alert).toBe(false);
  for(let i=0;i<3;i++)store.record('rpc','server',10);
  expect(store.summary().rows.find(r=>r.service==='rpc')!.alert).toBe(true);
  for(const ms of [10,20,30,40,2000])store.record('rest','ok',ms);
  expect(store.summary().rows.find(r=>r.service==='rest')).toMatchObject({p95:2000,alert:true});
 });
 it('ignora outras origens, preserva resposta e nunca bloqueia listener',async()=>{
  const store=createDiagnostics();store.subscribe(()=>{throw Error('listener')});
  const fake=observedFetch(async()=>new Response('ok'),base,store);
  await fake('https://external.test/rest/v1/items');expect(total(store)).toBe(0);
  await fake(base+'/rest/v1/items');expect(total(store)).toBe(1);
 });
 it('observa erros genéricos e remove listeners sem ler mensagens',()=>{
  const store=createDiagnostics(),target=new EventTarget();
  const off=observeBrowserFailures(target as unknown as Window,store);
  target.dispatchEvent(new Event('error'));target.dispatchEvent(new Event('unhandledrejection'));
  expect(store.summary().frontendIssues).toBe(2);off();target.dispatchEvent(new Event('error'));expect(store.summary().frontendIssues).toBe(2);
 });
});
