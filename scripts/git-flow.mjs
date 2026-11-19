import {pathToFileURL} from 'node:url';
export function validateFlow({base,head,sameRepository}){
  if(!sameRepository)return false;
  if(base==='main')return /^(release|hotfix)\/.+/.test(head);
  if(base==='develop')return head==='main'||/^(feature|fix|bugfix|hotfix|release|docs|chore|refactor|test)\/.+/.test(head);
  return true;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const ok=validateFlow({base:process.env.PR_BASE,head:process.env.PR_HEAD,sameRepository:process.env.PR_SAME_REPO==='true'});
  console.log(ok?'Git Flow: origem/destino aprovados.':'Git Flow: origem não autorizada para este destino.');
  if(!ok)process.exitCode=1;
}
