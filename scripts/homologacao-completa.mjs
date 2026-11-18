import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {validateLocalConfig,suitePlan,classifySuite} from './homologacao-preflight.mjs';

async function main(){
 const mode=process.argv[2]??'full';
 if(process.argv.length>3)throw Error('Argumentos excedentes');
 const plan=suitePlan(mode);
 if(existsSync('supabase/.temp/project-ref'))throw Error('Worktree vinculado; use clone descartável sem link.');
 const config=JSON.parse(readFileSync('.env.homologacao.status.local','utf8'));
 const url=validateLocalConfig(config,process.env);
 const safestFetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input.url??input);if(u.origin!==url)throw Error('Rede externa proibida');return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(20000)});};
 const root=createClient(url,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:safestFetch}});
 const users=await root.auth.admin.listUsers({page:1,perPage:1});
 if(users.error||!Array.isArray(users.data?.users)||users.data.users.length!==0)throw Error('Auth local inacessível ou não vazio; use stack descartável novo.');
 for(const table of ['admin_users','carts','requesters','reservations','reservation_requests']){
  const column=table==='admin_users'?'user_id':'id';
  const r=await root.from(table).select(column,{count:'exact',head:true});
  if(r.error||r.count!==0)throw Error('Dados de negócio não vazios ou indisponíveis');
 }
 const settings=await root.from('email_delivery_settings').select('enabled').eq('singleton',true).maybeSingle();
 if(settings.error||(settings.data!==null&&settings.data?.enabled!==false))throw Error('Canal externo deve estar desativado');
 console.log('PREFLIGHT OK: Auth local vazio, tabelas vazias e envio desativado');
 const report=[];
 for(const suite of plan){
  const before=Date.now();
  const r=spawnSync(process.execPath,['scripts/'+suite+'.mjs'],{encoding:'utf8',timeout:300000,maxBuffer:4*1024*1024});
  const status=classifySuite(r);
  report.push({suite,status,ms:Date.now()-before});
  // Never print child stdout/stderr: assertion errors can include tokens or fixture details.
  console.log(status+' '+suite+' ('+report.at(-1).ms+' ms)');
  if(status!=='PASS')break;
 }
 const passed=report.filter(r=>r.status==='PASS').length;
 console.log(JSON.stringify({mode,planned:plan.length,passed,results:report,fullApproved:mode==='full'&&passed===plan.length}));
 if(passed!==plan.length)process.exitCode=1;
}
main().catch(()=>{console.error('Homologação interrompida: confira opt-in, arquivo de status, stack vazio, schema e configuração local. Nenhum segredo foi exibido.');process.exitCode=1;});
