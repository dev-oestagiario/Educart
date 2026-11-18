// Offline release-artifact validation. No uploads, credentials, network, or deployments.
import {readFile,lstat,realpath} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const shaPattern=/^[a-f0-9]{40}$/;
const refPattern=/^[A-Za-z0-9][A-Za-z0-9/_-]{0,127}$/;
const assetPattern=/^\.\/assets\/[A-Za-z0-9_-]+\.(?:js|css)$/;
function requireCondition(condition,message){if(!condition)throw new Error(message);}
async function readSafe(root,name,max){
 const full=resolve(root,name),rel=relative(root,full);
 requireCondition(rel&&!rel.startsWith('..'+sep)&&rel!=='..','Caminho fora do artefato.');
 const st=await lstat(full);
 requireCondition(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=max,'Arquivo ausente, inválido ou fora do limite.');
 requireCondition(await realpath(full)===full,'Link simbólico não permitido.');
 return readFile(full,'utf8');
}
export async function verifyArtifact(directory,expectedSha,expectedRef){
 requireCondition(shaPattern.test(expectedSha),'SHA esperado inválido.');
 requireCondition(typeof expectedRef==='string'&&refPattern.test(expectedRef),'Referência esperada inválida.');
 const root=await realpath(directory);
 const version=JSON.parse(await readSafe(root,'version.json',8192));
 requireCondition(version.commit===expectedSha&&version.ref===expectedRef,'Metadados divergentes do candidato.');
 requireCondition(typeof version.build==='string'&&Number.isFinite(Date.parse(version.build)),'Data de build inválida.');
 requireCondition(Object.keys(version).sort().join(',')==='build,commit,ref','Metadados inesperados.');
 const html=await readSafe(root,'index.html',512*1024);
 requireCondition(/<title>[^<]*Educart/i.test(html)&&/<div\s+id=["']root["']/i.test(html),'Entrada Educart inválida.');
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(x=>x[1]);
 const styles=[...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css[^"']*)["'][^>]*>/gi)].map(x=>x[1]);
 requireCondition(scripts.length>0&&scripts.every(x=>x.endsWith('.js')),'Entrada JavaScript não encontrada.');
 requireCondition(styles.length>0,'Folha de estilo não encontrada.');
 const assets=[...new Set([...scripts,...styles])];
 for(const asset of assets){
  requireCondition(assetPattern.test(asset),'Asset não relativo, externo ou inválido.');
  const text=await readSafe(root,asset,10*1024*1024);
  requireCondition(!/<html\b|<!doctype html/i.test(text.slice(0,200)),'HTML servido como asset.');
  // Feature flags must not leak into a production entry bundle. This is not an authorization test.
  if(asset.endsWith('.js'))requireCondition(!text.includes('environment3d')&&!text.includes('spatial3d'),'Flags experimentais presentes na entrada.');
 }
 return {ok:true,commit:expectedSha,ref:expectedRef,entryAssets:assets.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{requireCondition(process.argv.length===5,'Uso: node scripts/verificar-artefato-release.mjs DIST SHA REF');console.log(JSON.stringify(await verifyArtifact(...process.argv.slice(2))));}
 catch{console.error('Artefato não aprovado: confira versão, entrada e assets relativos.');process.exitCode=1;}
}
