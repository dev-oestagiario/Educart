import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';

const config=JSON.parse(readFileSync(process.argv[2]??'.env.homologacao.status.local','utf8'));
assert.match(config.API_URL??'',/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/,'Somente stack local');
assert.ok(config.ANON_KEY&&config.SERVICE_ROLE_KEY);
const url='http://127.0.0.1:54321',web='http://127.0.0.1:5173';
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const root=createClient(url,config.SERVICE_ROLE_KEY,options);
const db=createClient(url,config.ANON_KEY,options);
const tag=randomUUID().slice(0,12),email='relatorios-'+tag+'@educart.example',password=randomBytes(24).toString('hex');
function ok(r,label){assert.equal(r.error,null,label+': '+(r.error?.code??''));return r.data;}
const {user}=ok(await root.auth.admin.createUser({email,password,email_confirm:true}),'Criar TI');
ok(await root.from('admin_users').insert({user_id:user.id,display_name:'TI Relatórios'}),'Autorizar TI');
ok(await db.auth.signInWithPassword({email,password}),'Login TI');
const teacherName='Professora Júlia '+tag,cartName='Laboratório de Informática '+tag;
const teacher=ok(await db.from('requesters').insert({name:teacherName}).select('id').single(),'Professor');
const otherTeacher=ok(await db.from('requesters').insert({name:'Outro professor '+tag}).select('id').single(),'Outro professor');
const cart=ok(await db.from('carts').insert({code:'REL-'+tag,name:cartName,capacity:30}).select('id').single(),'Carrinho');
const otherCart=ok(await db.from('carts').insert({code:'REL-OUT-'+tag,name:'Outro carrinho '+tag,capacity:30}).select('id').single(),'Outro carrinho');
const now=new Date();
const month=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,1));
const monthIso=month.toISOString().slice(0,7);
const dates=[];
for(let day=new Date(month);day.getUTCMonth()===month.getUTCMonth();day.setUTCDate(day.getUTCDate()+1)){
  if(![0,6].includes(day.getUTCDay()))dates.push(day.toISOString().slice(0,10));
}
const first=dates.find(day=>new Date(day+'T12:00Z').getUTCDay()===1);
assert.ok(first);
const args={p_requester_id:teacher.id,p_cart_id:cart.id,p_mode:'PARCIAL',p_quantity:1,p_dates:dates,p_shifts:['MATUTINO','VESPERTINO','NOTURNO'],p_needs_mouse:false,p_notes:null,p_notebook_ids:[]};
const count=18;
for(let i=0;i<count;i++)ok(await db.rpc('create_reservation',args),'Reserva mensal '+i);
const longNotes=Array.from({length:78},(_,i)=>'Trecho '+String(i+1).padStart(2,'0')).join('\n')+'\nFIM-OBJETIVO';
assert.ok(longNotes.length<=1000);
const special=ok(await db.rpc('create_reservation',{...args,p_dates:[first],p_shifts:['MATUTINO'],p_needs_mouse:true,p_notes:longNotes}),'Reserva de objetivo longo');
const cancelled=ok(await db.rpc('create_reservation',{...args,p_dates:[first],p_shifts:['VESPERTINO'],p_notes:'CANCELAMENTO-SINTETICO'}),'Reserva para cancelar');
ok(await db.rpc('cancel_reservation',{p_reservation_id:cancelled}),'Cancelar');
ok(await db.rpc('create_reservation',{...args,p_requester_id:otherTeacher.id,p_cart_id:otherCart.id,p_dates:[first],p_shifts:['NOTURNO'],p_notes:'OUTRO-RECORTE'}),'Reserva fora do filtro');
const expectedPeriods=count*dates.length*3+1;
assert.ok(expectedPeriods>1000);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--mode','homologacao','--host','127.0.0.1','--port','5173','--strictPort'],{env:{...process.env,VITE_SUPABASE_URL:url,VITE_SUPABASE_PUBLISHABLE_KEY:config.ANON_KEY},stdio:'ignore'});
const temp=mkdtempSync(join(tmpdir(),'educart-f24-'));
let browser;
try{
  let ready=false;
  for(let i=0;i<120;i++){
    if(server.exitCode!==null)throw Error('Vite encerrado');
    try{if((await fetch(web)).ok){ready=true;break;}}catch{}
    await delay(500);
  }
  assert.ok(ready,'Vite não iniciou');
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.route('**/*',route=>[url,web].includes(new URL(route.request().url()).origin)?route.continue():route.abort());
  await page.goto(web);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Entrar no Educart'}).click();
  await expect(page.getByRole('heading',{name:'Visão geral'})).toBeVisible({timeout:15000});
  await page.getByRole('button',{name:'Calendário',exact:true}).click();
  await page.locator('#calendar-mode').selectOption('mes');
  await page.locator('#calendar-focus').fill(monthIso);
  await page.locator('#calendar-cart').selectOption(cart.id);
  await page.locator('#calendar-requester').selectOption(teacher.id);
  const stat=(label)=>page.locator('.calendar-stats').getByText(label,{exact:true}).locator('..').locator('strong');
  await expect(stat('Períodos ocupados')).toHaveText(String(expectedPeriods),{timeout:20000});
  await expect(stat('Reservas agrupadas')).toHaveText(String(count+1));
  await expect(stat('Linhas no relatório')).toHaveText(String(expectedPeriods));
  async function download(label,name){
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:label}).click();
    const file=await pending;
    const path=join(temp,name);await file.saveAs(path);
    return path;
  }
  // Count CSV logical rows (quoted newlines are part of cells).
  function csvRecords(csv){
    let quoted=false,rows=0;
    for(let i=0;i<csv.length;i++){
      if(csv[i]==='"'){
        if(quoted&&csv[i+1]==='"')i++;else quoted=!quoted;
      }else if(csv[i]==='\n'&&!quoted)rows++;
    }
    assert.equal(quoted,false);
    return rows;
  }
  let csv=readFileSync(await download('Planilha CSV','mensal.csv'),'utf8');
  assert.ok(csv.startsWith('\uFEFF'));assert.equal(csvRecords(csv),expectedPeriods+1);
  assert.ok(csv.includes(teacherName)&&csv.includes('FIM-OBJETIVO'));
  assert.ok(!csv.includes('CANCELAMENTO-SINTETICO')&&!csv.includes('OUTRO-RECORTE'));
  await page.getByLabel('Incluir períodos cancelados nos resultados').check();
  await expect(stat('Linhas no relatório')).toHaveText(String(expectedPeriods+1));
  await expect(stat('Períodos ocupados')).toHaveText(String(expectedPeriods));
  csv=readFileSync(await download('Planilha CSV','cancelados.csv'),'utf8');
  assert.equal(csvRecords(csv),expectedPeriods+2);assert.ok(csv.includes('CANCELAMENTO-SINTETICO'));
  console.log('PASS F2.4-PAG: '+expectedPeriods+' períodos ativos, CSV mensal completo e filtros preservados.');

  await page.locator('#calendar-mode').selectOption('semana');
  await page.locator('#calendar-focus').fill(first);
  await expect(stat('Períodos ocupados')).toHaveText(String(count*5*3+1));
  const pdf=await download('Exportar PDF','agenda.pdf');
  const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8'});
  const total=Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  assert.ok(total>2,'PDF deve possuir múltiplas páginas');
  assert.match(info,/Page size:\s+595(?:\.\d+)? x 841(?:\.\d+)? pts/);
  const text=execFileSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8'});
  assert.ok(text.includes(teacherName));assert.ok(text.includes('FIM-OBJETIVO'));
  assert.ok(text.includes('Trecho 01')&&text.includes('Trecho 78'));
  assert.ok(text.includes('Não informada')&&text.includes('Mouses'));
  assert.ok(text.includes('CANCELAMENTO-SINTETICO')&&text.includes('[Cancelada]'));
  assert.ok(!text.includes('OUTRO-RECORTE'));
  assert.ok(text.includes('Resumo Geral da Semana'));
  assert.match(text,new RegExp(String(count*5*3+3)+'\\s+registros'));
  const pages=text.split('\f').filter(x=>x.trim());
  assert.equal(pages.length,total);
  pages.forEach((p,i)=>assert.ok(p.includes('Página '+(i+1)+' de '+total),'Rodapé '+(i+1)));
  assert.ok(text.includes('(continuação)'));
  const bbox=execFileSync('pdftotext',['-bbox',pdf,'-'],{encoding:'utf8'});
  for(const m of bbox.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g)){
    const [,x1,y1,x2,y2]=m.map(Number);
    assert.ok(x1>=20&&x2<=575&&y1>=20&&y2<=827,'Texto fora da área imprimível');
  }
  execFileSync('pdftoppm',['-f','1','-l','1','-scale-to','900','-png',pdf,join(temp,'agenda')]);
  console.log('PASS F2.4-PDF: '+total+' páginas A4, texto e rodapés extraídos, conteúdo longo e área imprimível verificados.');
  // Empty result must remain a valid agenda, not invent reservations.
  await page.locator('#calendar-requester').selectOption(otherTeacher.id);
  await expect(stat('Linhas no relatório')).toHaveText('0');
  const empty=await download('Exportar PDF','vazio.pdf');
  const emptyText=execFileSync('pdftotext',['-layout',empty,'-'],{encoding:'utf8'});
  assert.ok(emptyText.includes('Nenhuma reserva registrada'));
  assert.match(emptyText,/0 registros/);
  console.log('PASS F2.4: exportação real, filtros, relatório vazio e impressão A4 automatizada.');
}finally{
  await browser?.close();server.kill();rmSync(temp,{recursive:true,force:true});
}
