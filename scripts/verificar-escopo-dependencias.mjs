// Diagnostic of the current advisory's dependency scope, not a replacement for npm audit.
import { readFile } from 'node:fs/promises';
import { build, resolveConfig } from 'vite';

const affected = new Set(['picomatch','fdir','tinyglobby','vite','vitest']);
const packageOf = id => [...id.replaceAll('\\','/').matchAll(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)(?=\/|$)/g)].at(-1)?.[1];
const lock = JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
const installed = Object.entries(lock.packages ?? {}).filter(([path]) => affected.has(packageOf(path)));
const runtime = installed.filter(([,entry]) => entry.dev !== true).map(([path])=>packageOf(path));
const configs = await Promise.all([resolveConfig({},'serve','development'),resolveConfig({},'serve','production')]);
if(configs.some(c=>c.server.host!=='127.0.0.1'||c.preview.host!=='127.0.0.1')){
 throw new Error('Os servidores locais devem usar loopback por padrão.');
}
const modules = new Set();
const found = new Set();
await build({
 plugins:[{name:'educart-audit-scope',generateBundle(_options,bundle){
  for(const chunk of Object.values(bundle)) if(chunk.type==='chunk'){
   for(const id of Object.keys(chunk.modules)){modules.add(id);const pkg=packageOf(id);if(affected.has(pkg))found.add(pkg);}
  }
 }}],
 build:{write:false},
 logLevel:'warn'
});
if(!modules.size)throw new Error('Nenhum módulo inspecionado; diagnóstico inconclusivo.');
console.log(JSON.stringify({lockScope:installed.map(([path,entry])=>({package:packageOf(path),version:entry.version,devOnly:entry.dev===true})),runtimeMatches:[...new Set(runtime)],bundleMatches:[...found].sort(),inspectedModules:modules.size,loopbackDefaults:true},null,2));
if(runtime.length||found.size)process.exitCode=1;
else console.log('Escopo: nenhuma dependência afetada identificada no runtime/bundle inspecionado. Auditoria completa continua obrigatória.');
