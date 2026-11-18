import {pathToFileURL} from 'node:url';
export const requiredWorkflows=['verify.yml','homologacao.yml','recuperacao.yml'];
export function successfulRun(r,sha){
 return r?.head_sha===sha&&r?.head_branch==='main'&&r?.event==='push'&&r?.status==='completed'&&r?.conclusion==='success';
}
async function main(){
 const sha=process.env.GITHUB_SHA,repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
 if(!/^[a-f0-9]{40}$/.test(sha??'')||!repo||!token||process.env.GITHUB_REF!=='refs/heads/main')throw Error('Contexto de promoção inválido.');
 for(const workflow of requiredWorkflows){
  const url=new URL('https://api.github.com/repos/'+repo+'/actions/workflows/'+workflow+'/runs');
  url.search=new URLSearchParams({head_sha:sha,branch:'main',event:'push',per_page:'100'}).toString();
  const res=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw Error('Consulta de CI indisponível: '+workflow+' HTTP '+res.status);
  const body=await res.json();
  // GitHub returns latest runs first: a failed/incomplete newest attempt must not be masked by an older success.
  const latest=body.workflow_runs?.find(r=>r.head_sha===sha&&r.head_branch==='main'&&r.event==='push');
  if(!successfulRun(latest,sha))throw Error('CI do SHA ainda não aprovada: '+workflow);
  console.log('CI aprovada: '+workflow+' #'+latest.id);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
