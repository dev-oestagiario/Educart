import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {verifyArtifact} from './verificar-artefato-release.mjs';
const sha='a'.repeat(40),ref='feat/rc';
const html=(script='./assets/index-123.js')=>`<!doctype html><title>Educart</title><script type="module" src="${script}"></script><link rel="stylesheet" href="./assets/index-123.css"><div id="root"></div>`;
async function fixture(fn){
 const root=await mkdtemp(join(tmpdir(),'educart-artifact-'));
 try{
  await mkdir(join(root,'assets'));await writeFile(join(root,'index.html'),html());await writeFile(join(root,'version.json'),JSON.stringify({commit:sha,ref,build:'2026-11-18T00:00:00.000Z'}));await writeFile(join(root,'assets/index-123.js'),'const ok=1');await writeFile(join(root,'assets/index-123.css'),'body{margin:0}');
  await fn(root);
 }finally{await rm(root,{recursive:true,force:true});}
}
test('valid candidate entry and metadata',()=>fixture(async root=>assert.deepEqual(await verifyArtifact(root,sha,ref),{ok:true,commit:sha,ref,entryAssets:2})));
test('rejects incorrect SHA or ref',()=>fixture(async root=>{await assert.rejects(()=>verifyArtifact(root,'b'.repeat(40),ref));await assert.rejects(()=>verifyArtifact(root,sha,'main'));}));
test('rejects external and nonrelative asset',()=>fixture(async root=>{for(const path of ['https://example.test/assets/index.js','/assets/index.js','../assets/index.js','./assets/index.js?token=x']){await writeFile(join(root,'index.html'),html(path));await assert.rejects(()=>verifyArtifact(root,sha,ref));}}));
test('rejects missing asset and HTML masquerading as JS',()=>fixture(async root=>{const path=join(root,'assets/index-123.js');await writeFile(path,'<!doctype html>');await assert.rejects(()=>verifyArtifact(root,sha,ref));await rm(path);await assert.rejects(()=>verifyArtifact(root,sha,ref));}));
test('rejects symlink and experimental flag',()=>fixture(async root=>{const path=join(root,'assets/index-123.js');await writeFile(path,'const flag="environment3d"');await assert.rejects(()=>verifyArtifact(root,sha,ref));await rm(path);await symlink('../index.html',path);await assert.rejects(()=>verifyArtifact(root,sha,ref));}));
test('rejects version metadata with unexpected fields',()=>fixture(async root=>{await writeFile(join(root,'version.json'),JSON.stringify({commit:sha,ref,build:'2026-11-18T00:00:00.000Z',unexpected:true}));await assert.rejects(()=>verifyArtifact(root,sha,ref));}));
