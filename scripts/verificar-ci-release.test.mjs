import test from 'node:test';
import assert from 'node:assert/strict';
import {requiredWorkflows,successfulRun} from './verificar-ci-release.mjs';
const sha='a'.repeat(40),run={head_sha:sha,head_branch:'main',event:'push',status:'completed',conclusion:'success'};
test('release exige os três pipelines',()=>assert.deepEqual(requiredWorkflows,['verify.yml','homologacao.yml','recuperacao.yml']));
test('aceita somente sucesso completo do SHA em main',()=>{
 assert.equal(successfulRun(run,sha),true);
 for(const change of [{head_sha:'b'.repeat(40)},{head_branch:'develop'},{event:'pull_request'},{status:'in_progress'},{conclusion:'failure'},{conclusion:'skipped'},{conclusion:null}])assert.equal(successfulRun({...run,...change},sha),false);
 assert.equal(successfulRun(null,sha),false);
});
