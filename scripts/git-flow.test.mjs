import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFlow} from './git-flow.mjs';
const allowed=(base,head,sameRepository=true)=>validateFlow({base,head,sameRepository});
test('produção aceita apenas release ou hotfix',()=>{
  for(const head of ['release/1.0.1','hotfix/login'])assert.equal(allowed('main',head),true);
  for(const head of ['develop','main','feature/nova','fix/login','docs/manual','chore/ajuste','release/','hotfix'])assert.equal(allowed('main',head),false);
});
test('develop aceita trabalho isolado e sincronização da main',()=>{
  for(const head of ['feature/nova','fix/login','bugfix/login','hotfix/login','release/1.0.1','docs/guia','chore/git-flow','refactor/ui','test/mobile','main'])assert.equal(allowed('develop',head),true);
  for(const head of ['develop','qualquer','release/'])assert.equal(allowed('develop',head),false);
});
test('prefixos não autorizam PR de fork',()=>{
  assert.equal(allowed('main','release/1.0.1',false),false);
  assert.equal(allowed('develop','feature/nova',false),false);
});
