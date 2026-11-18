import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';

const config=JSON.parse(readFileSync(process.argv[2]??'.env.homologacao.status.local','utf8'));
assert.match(config.API_URL??'',/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/,'Somente stack local');
assert.ok(config.ANON_KEY&&config.SERVICE_ROLE_KEY);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const url='http://127.0.0.1:54321', web='http://127.0.0.1:5173';
const root=createClient(url,config.SERVICE_ROLE_KEY,options);
const admin=createClient(url,config.ANON_KEY,options);
const tag=randomUUID().slice(0,12), email='browser-'+tag+'@educart.example', password=randomBytes(24).toString('hex');
function ok(r,label){assert.equal(r.error,null,label+': '+(r.error?.code??''));return r.data;}
const {user}=ok(await root.auth.admin.createUser({email,password,email_confirm:true}),'Criar TI browser');
ok(await root.from('admin_users').insert({user_id:user.id,display_name:'TI browser'}),'Autorizar TI browser');
ok(await admin.auth.signInWithPassword({email,password}),'Login API para verificação');
const cartCode='WEB-'+tag, cartName='Carrinho interface '+tag, professor='Professor interface '+tag;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--mode','homologacao','--host','127.0.0.1','--port','5173','--strictPort'],{
  env:{...process.env,VITE_SUPABASE_URL:url,VITE_SUPABASE_PUBLISHABLE_KEY:config.ANON_KEY},stdio:'ignore'
});
let browser;
try{
  let ready=false;
  for(let i=0;i<120;i++){
    if(server.exitCode!==null)throw Error('Servidor Vite encerrado');
    try{if((await fetch(web)).ok){ready=true;break;}}catch{}
    await delay(500);
  }
  assert.ok(ready,'Servidor Vite não iniciou');
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  // Only the local stack and app may receive browser requests.
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    return [url,web].includes(u.origin)?route.continue():route.abort();
  });
  await page.goto(web);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Entrar no Educart'}).click();
  await expect(page.getByRole('heading',{name:'Visão geral'})).toBeVisible({timeout:15000});
  await page.getByRole('button',{name:'Carrinhos',exact:true}).click();
  await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
  await page.getByLabel('Código do carrinho').fill(cartCode);
  await page.getByLabel('Nome do laboratório móvel').fill(cartName);
  await page.getByLabel('Capacidade de notebooks').fill('10');
  await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
  await expect(page.getByText(cartCode+' · 10 notebooks de capacidade')).toBeVisible();
  const cart=ok(await admin.from('carts').select('id').eq('code',cartCode).single(),'Carrinho persistido');
  await page.getByRole('button',{name:'Professores',exact:true}).click();
  await page.getByRole('button',{name:'Cadastrar professor'}).click();
  await page.getByLabel('Nome completo').fill(professor);
  await page.getByRole('button',{name:'Salvar professor'}).click();
  await expect(page.getByText(professor,{exact:true})).toBeVisible();
  const teacher=ok(await admin.from('requesters').select('id').eq('name',professor).single(),'Professor persistido');
  await page.getByRole('button',{name:'Notebooks',exact:true}).click();
  await page.getByLabel('Laboratório móvel').selectOption({label:cartName+' ('+cartCode+')'});
  await page.getByRole('button',{name:'Cadastrar notebooks'}).click();
  const csvCodes=['CSV-'+tag+'-1','CSV-'+tag+'-2'];
  await page.locator('#csv-import').setInputFiles({name:'codigos.csv',mimeType:'text/csv',buffer:Buffer.from('codigo;descricao\n'+csvCodes.map(c=>c+';teste').join('\n'))});
  await expect(page.getByText(/Prévia: 2 código/)).toBeVisible();
  await page.getByRole('button',{name:'Salvar códigos revisados'}).click();
  for(const code of csvCodes)await expect(page.getByText(code,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cadastrar notebooks'}).click();
  // Reuse existing synthetic XLSX; edit preview to avoid duplicates on local reruns.
  const fixture=readFileSync('e2e/fixtures/workbook.ts','utf8').match(/XLSX_FIXTURE_BASE64\s*=\s*'([^']+)'/);
  assert.ok(fixture);
  await page.locator('#csv-import').setInputFiles({name:'notebooks.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(fixture[1],'base64')});
  await expect(page.getByLabel('Códigos (um por linha)')).toHaveValue('NT-XLSX-01\nNT-XLSX-02');
  const xlsxCodes=['XLSX-'+tag+'-1','XLSX-'+tag+'-2'];
  await page.getByLabel('Códigos (um por linha)').fill(xlsxCodes.join('\n'));
  await page.getByRole('button',{name:'Salvar códigos revisados'}).click();
  for(const code of xlsxCodes)await expect(page.getByText(code,{exact:true})).toBeVisible();
  const notebooks=ok(await admin.from('notebook_codes').select('code').eq('cart_id',cart.id),'Códigos persistidos');
  assert.deepEqual(notebooks.map(x=>x.code).sort(),[...csvCodes,...xlsxCodes].sort());
  console.log('PASS F2.1-UI-IMPORT: cadastro real e importações CSV/XLSX persistidas.');

  await page.getByRole('button',{name:'Reservas',exact:true}).click();
  await page.getByRole('button',{name:'Nova reserva'}).click();
  await page.getByLabel('Professor solicitante').selectOption(teacher.id);
  await page.locator('#reservation-cart').selectOption(cart.id);
  const next=new Date(Date.now()+14*86400000);
  while(next.getUTCDay()!==1)next.setUTCDate(next.getUTCDate()+1);
  const day=next.toISOString().slice(0,10);
  const dateLabel=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(day+'T12:00:00Z'));
  await page.locator('#reservation-date-trigger').click();
  const dayButton=page.getByRole('button',{name:'Selecionar '+dateLabel});
  for(let i=0;i<14&&!await dayButton.isVisible();i++)await page.getByRole('button',{name:'Próximo mês'}).click();
  await dayButton.click();
  await page.getByRole('radio',{name:'Notebooks avulsos'}).check();
  await page.getByLabel('Quantidade de notebooks').fill('4');
  await page.getByRole('button',{name:'Confirmar reserva'}).click();
  await expect(page.getByText('Reserva confirmada para todos os períodos selecionados.')).toBeVisible();
  const booking=ok(await admin.from('reservations').select('id,quantity').eq('cart_id',cart.id).single(),'Reserva persistida');
  assert.equal(booking.quantity,4);
  const period=ok(await admin.from('reservation_periods').select('usage_date,quantity,active').eq('reservation_id',booking.id).single(),'Período persistido');
  assert.equal(period.usage_date,day);assert.equal(period.quantity,4);assert.equal(period.active,true);
  // Scope actions to the unique synthetic reservation, even with other fixtures.
  await page.getByLabel('Buscar reserva').fill(professor);
  const ownBooking=page.locator('.booking-item').filter({has:page.getByText(professor,{exact:true})});
  await expect(ownBooking).toHaveCount(1);
  await ownBooking.getByRole('button',{name:'Editar',exact:true}).click();
  await page.getByLabel('Quantidade de notebooks').fill('3');
  await page.getByRole('button',{name:'Salvar alterações'}).click();
  await expect(page.getByText('Reserva editada e alteração registrada no histórico.')).toBeVisible();
  assert.equal(ok(await admin.from('reservations').select('quantity').eq('id',booking.id).single(),'Edição persistida').quantity,3);
  await page.getByLabel('Buscar reserva').fill(professor);
  await expect(ownBooking).toHaveCount(1);
  await ownBooking.getByRole('button',{name:'Cancelar reserva'}).click();
  await ownBooking.getByRole('button',{name:'Confirmar cancelamento'}).click();
  await expect(page.getByText(/Cancelamento registrado/)).toBeVisible();
  assert.equal(ok(await admin.from('reservations').select('status').eq('id',booking.id).single(),'Cancelamento persistido').status,'CANCELADA');
  const events=ok(await admin.from('reservation_events').select('event_type').eq('reservation_id',booking.id),'Histórico persistido');
  assert.deepEqual(events.map(x=>x.event_type).sort(),['CANCELAMENTO','CRIACAO','EDICAO']);
  await page.getByRole('button',{name:'Ver histórico'}).click();
  await expect(page.getByRole('heading',{name:'Auditoria de reservas'})).toBeVisible();
  console.log('PASS F2.1-UI-RES: login real, cadastro, reserva, edição, cancelamento e auditoria via navegador.');
}finally{
  await browser?.close();
  server.kill();
}
