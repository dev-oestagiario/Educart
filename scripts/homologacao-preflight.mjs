import assert from 'node:assert/strict';
export const apiSuites=['homologacao-auth','homologacao-cadastros-reservas','homologacao-concorrencia','homologacao-localizacoes','homologacao-manutencao','homologacao-movimentacoes','homologacao-recorrencia-espacial'];
export const browserSuites=['homologacao-browser','homologacao-professores','homologacao-relatorios','homologacao-mobile'];
export function validateLocalConfig(config,env){
 assert.equal(env.EDUCART_DISPOSABLE_HOMOLOGACAO,'educart-homologacao','Exige autorização explícita para stack local descartável.');
 for(const name of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY'])assert.ok(!env[name],'Não aceitar credenciais externas no ambiente.');
 assert.ok(config&&typeof config==='object','Status local inválido');
 assert.match(config.API_URL??'',/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/,'Somente API loopback 54321');
 assert.match(config.DB_URL??'',/^postgres(?:ql)?:\/\/[^/?#]+@(127\.0\.0\.1|localhost):54322\/postgres$/,'Somente banco local 54322');
 for(const name of ['ANON_KEY','SERVICE_ROLE_KEY'])assert.ok(typeof config[name]==='string'&&config[name].length>0,'Chaves locais ausentes');
 assert.notEqual(config.ANON_KEY,config.SERVICE_ROLE_KEY,'Chaves devem ter papéis distintos');
 return 'http://127.0.0.1:54321';
}
export function suitePlan(mode){
 assert.ok(mode==='full'||mode==='api-only','Modo não reconhecido');
 return mode==='full'?[browserSuites[0],...apiSuites,...browserSuites.slice(1)]:[...apiSuites];
}
export function classifySuite(result){
 if(result.error||result.signal||result.status!==0)return 'FAIL';
 if(String(result.stdout??'').split(/\r?\n/).some(line=>/^SKIP\b/.test(line)))return 'SKIP';
 return String(result.stdout??'').split(/\r?\n/).some(line=>/^PASS\b/.test(line))?'PASS':'FAIL';
}

// Only emit a source line number, never the raw child error, selectors or data.
export function suiteFailureLocation(result,suite){
 if(![...apiSuites,...browserSuites].includes(suite))return null;
 const pattern=new RegExp('/scripts/'+suite+'\\.mjs:(\\d+):(\\d+)');
 const match=String(result.stderr??'').match(pattern);
 return match?{line:Number(match[1]),column:Number(match[2])}:null;
}
