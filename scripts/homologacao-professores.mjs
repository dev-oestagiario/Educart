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
const url='http://127.0.0.1:54321',web='http://127.0.0.1:5173';
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const root=createClient(url,config.SERVICE_ROLE_KEY,options);
const anon=createClient(url,config.ANON_KEY,options);
const tag=randomUUID().slice(0,12);
function ok(r,label){assert.equal(r.error,null,label+': '+(r.error?.code??''));return r.data;}
function denied(r,label){assert.ok(r.error,label);}
async function account(role,confirmed=true){
  const email=role+'-'+tag+'@educart.example',password=randomBytes(24).toString('hex');
  const {user}=ok(await root.auth.admin.createUser({email,password,email_confirm:confirmed}),'Criar '+role);
  const client=createClient(url,config.ANON_KEY,options);
  if(confirmed)ok(await client.auth.signInWithPassword({email,password}),'Sessão '+role);
  return {id:user.id,email,password,client};
}
const ti=await account('ti-f23'),a=await account('prof-a-f23'),b=await account('prof-b-f23'),pending=await account('nao-confirmado-f23',false);
ok(await root.from('admin_users').insert({user_id:ti.id,display_name:'TI F2.3'}),'Autorizar TI');
const db=ti.client;
const teachers=ok(await db.from('requesters').insert([{name:'Professor A '+tag},{name:'Professor B '+tag},{name:'Professor não confirmado '+tag}]).select('id,name'),'Cadastros docentes');
const cartName='F23 principal '+tag, otherName='F23 retirada '+tag, inactiveName='F23 inativo '+tag;
async function cart(code,name,active=true){
  return ok(await db.from('carts').insert({code:code+'-'+tag,name,capacity:10,active}).select('id').single(),'Criar carrinho');
}
const cartA=await cart('F23A',cartName),cartB=await cart('F23B',otherName),inactive=await cart('F23I',inactiveName,false);
const d=new Date(Date.now()+14*86400000);
while([0,6].includes(d.getUTCDay()))d.setUTCDate(d.getUTCDate()+1);
const day=d.toISOString().slice(0,10);
const previewArgs={p_cart_id:cartA.id,p_dates:[day],p_shifts:['MATUTINO']};
denied(await a.client.rpc('preview_teacher_availability',previewArgs),'Sem vínculo não consulta prévia privada');
denied(await anon.rpc('preview_teacher_availability',previewArgs),'Anon não consulta prévia privada');
denied(await db.rpc('link_teacher_account',{p_requester_id:teachers[2].id,p_email:pending.email}),'Conta não confirmada não é vinculada');
async function requests(who,cartId){
  return ok(await who.client.from('reservation_requests').select('*').eq('cart_id',cartId),'Solicitações');
}
async function preview(who,cartId=cartA.id){
  const result=ok(await who.client.rpc('preview_teacher_availability',{...previewArgs,p_cart_id:cartId}),'Prévia');
  assert.equal(result.length,1);
  assert.deepEqual(Object.keys(result[0]).sort(),['capacity','remaining','reserved','shift','usage_date'].sort());
  return result[0];
}
async function publicBalance(cartId){
  const rows=ok(await anon.rpc('public_cart_availability',{p_start:day,p_end:day}),'Saldo público');
  const row=rows.find(x=>x.cart_id===cartId&&x.shift==='MATUTINO');
  assert.ok(row);return row.available;
}
async function notices(who,requestId){
  return ok(await who.client.from('user_notifications').select('*').eq('request_id',requestId),'Avisos próprios');
}
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--mode','homologacao','--host','127.0.0.1','--port','5173','--strictPort'],{
  env:{...process.env,VITE_SUPABASE_URL:url,VITE_SUPABASE_PUBLISHABLE_KEY:config.ANON_KEY},stdio:'ignore'
});
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
  async function pageFor(who,width=1440){
    const page=await browser.newPage({viewport:{width,height:900}});
    await page.route('**/*',route=>[url,web].includes(new URL(route.request().url()).origin)?route.continue():route.abort());
    await page.goto(web);
    await page.getByLabel('E-mail').fill(who.email);
    await page.getByLabel('Senha',{exact:true}).fill(who.password);
    await page.getByRole('button',{name:'Entrar no Educart'}).click();
    return page;
  }
  const admin=await pageFor(ti),pa=await pageFor(a,390),pb=await pageFor(b,390);
  await expect(admin.getByRole('heading',{name:'Visão geral'})).toBeVisible({timeout:15000});
  for(const page of [pa,pb])await expect(page.getByRole('heading',{name:'Conta criada, aguardando autorização'})).toBeVisible({timeout:15000});
  await admin.getByRole('button',{name:'Solicitações',exact:true}).click();
  for(const [who,teacher] of [[a,teachers[0]],[b,teachers[1]]]){
    await admin.getByRole('button',{name:'Vincular conta'}).click();
    await admin.locator('#teacher-link-requester').selectOption(teacher.id);
    await admin.locator('#teacher-link-email').fill(who.email);
    await admin.getByRole('button',{name:'Vincular professor'}).click();
    await expect(admin.getByText('Conta vinculada. O professor já pode enviar solicitações.')).toBeVisible();
  }
  for(const page of [pa,pb]){
    await page.reload();
    await expect(page.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible({timeout:15000});
    await expect(page.getByRole('navigation',{name:'Menu principal'})).toHaveCount(0);
     await expect(page.getByRole('navigation',{name:'Menu do professor'}).getByRole('button',{name:'Solicitações',exact:true})).toBeVisible();
  }
  denied(await a.client.rpc('link_teacher_account',{p_requester_id:teachers[2].id,p_email:pending.email}),'Professor não autoriza contas');
  denied(await a.client.rpc('preview_teacher_availability',{...previewArgs,p_cart_id:inactive.id}),'Carrinho inativo sem prévia');
  async function submit(page,cartId,quantity,mouse=false){
    await page.getByRole('button',{name:'Nova solicitação'}).click();
    await expect(page.locator('#teacher-cart')).toBeVisible();
    await expect(page.locator('#teacher-cart').locator('option').filter({hasText:inactiveName})).toHaveCount(0);
    await page.locator('#teacher-cart').selectOption(cartId);
    await page.locator('#teacher-quantity').fill(String(quantity));
    await page.locator('#teacher-period-start').fill(day);
    await page.locator('#teacher-period-end').fill(day);
    if(mouse){
      await page.getByLabel('Preciso de mouse').check();
      await page.locator('#teacher-notes').fill('Material sintético para aula');
    }
    await expect(page.getByRole('heading',{name:'Prévia de disponibilidade'})).toBeVisible();
    await expect(page.getByText(/Ver saldo por data e turno/)).toBeVisible();
    await page.getByRole('button',{name:'Enviar solicitação para aprovação'}).click();
    await expect(page.getByText(/Solicitação enviada à TI/)).toBeVisible();
  }
  await submit(pa,cartA.id,6,true);
  await submit(pb,cartA.id,7);
  const [ra]=await requests(a,cartA.id),[rb]=await requests(b,cartA.id);
  assert.ok(ra&&rb&&ra.id!==rb.id);
  assert.equal(ra.needs_mouse,true);assert.equal(ra.notes,'Material sintético para aula');
  for(const who of [a,b])assert.equal((await preview(who)).remaining,10);
  assert.equal(await publicBalance(cartA.id),10);
  assert.equal((await notices(ti,ra.id)).filter(x=>x.kind==='NOVO_PEDIDO').length,1);
  assert.equal((await notices(ti,rb.id)).filter(x=>x.kind==='NOVO_PEDIDO').length,1);
  assert.deepEqual(await requests(a,cartA.id).then(x=>x.map(y=>y.id)),[ra.id]);
  assert.deepEqual(await requests(b,cartA.id).then(x=>x.map(y=>y.id)),[rb.id]);
  for(const [who,own,other] of [[a,ra,rb],[b,rb,ra]]){
    const events=ok(await who.client.from('reservation_request_events').select('request_id,event_type').in('request_id',[own.id,other.id]),'Eventos próprios');
    assert.deepEqual(events,[{request_id:own.id,event_type:'CRIACAO'}]);
  }
  denied(await b.client.rpc('withdraw_teacher_request',{p_request_id:ra.id}),'B não retira pedido de A');
  denied(await a.client.rpc('review_teacher_request',{p_request_id:ra.id,p_approve:true}),'Professor não aprova');
  console.log('PASS F2.3-VINCULO: contas confirmadas, vínculo pela TI, portal próprio, prévia e pedidos pendentes.');

  await admin.reload();
  await expect(admin.getByRole('heading',{name:'Visão geral'})).toBeVisible();
  await admin.getByRole('button',{name:/Notificações, 2 não lidas/}).click();
  await expect(admin.getByRole('heading',{name:'Notificações'})).toBeVisible();
  await expect(admin.getByText('2 notificação(ões) não lida(s)')).toBeVisible();
  await admin.getByRole('button',{name:'Marcar como lida',exact:true}).first().click();
  await expect(admin.getByText('1 notificação(ões) não lida(s)')).toBeVisible();
  await admin.getByRole('button',{name:'Marcar todas como lidas'}).click();
  await expect(admin.getByText('0 notificação(ões) não lida(s)')).toBeVisible();
  await admin.getByRole('button',{name:'Abrir solicitações'}).first().click();
  const itemA=admin.locator('article.booking-item').filter({has:admin.getByText(teachers[0].name,{exact:true})});
  const itemB=admin.locator('article.booking-item').filter({has:admin.getByText(teachers[1].name,{exact:true})});
  await itemA.getByLabel('Resposta ou justificativa (opcional)').fill('Aprovado para aula');
  await itemA.getByRole('button',{name:'Aprovar e confirmar reserva'}).click();
  await expect(admin.getByText('Solicitação aprovada e reserva confirmada.')).toBeVisible();
  assert.equal((await preview(b)).remaining,4);
  assert.equal(await publicBalance(cartA.id),4);
  await itemB.getByRole('button',{name:'Aprovar e confirmar reserva'}).click();
  await expect(admin.getByRole('alert')).toContainText('O pedido permanece pendente.');
  const [stillPending]=await requests(b,cartA.id);
  assert.equal(stillPending.status,'PENDENTE');assert.equal(stillPending.reservation_id,null);
  await itemB.getByLabel('Resposta ou justificativa (opcional)').fill('Saldo insuficiente no turno');
  await itemB.getByRole('button',{name:'Rejeitar solicitação'}).click();
  await expect(admin.getByText('Solicitação rejeitada; disponibilidade inalterada.')).toBeVisible();
  assert.equal(await publicBalance(cartA.id),4);
  const [approved]=await requests(a,cartA.id),[rejected]=await requests(b,cartA.id);
  assert.equal(approved.status,'APROVADA');assert.ok(approved.reservation_id);
  assert.equal(rejected.status,'REJEITADA');assert.equal(rejected.reservation_id,null);
  const reservation=ok(await db.from('reservations').select('quantity,needs_mouse,notes').eq('id',approved.reservation_id).single(),'Reserva aprovada');
  assert.deepEqual(reservation,{quantity:6,needs_mouse:true,notes:'Material sintético para aula'});
  console.log('PASS F2.3-DECISAO: aprovação, conflito mantido pendente, rejeição com justificativa e saldo coerente.');

  for(const [page,title,otherTitle,status,reply] of [[pa,'Solicitação aprovada','Solicitação rejeitada','Aprovada','Aprovado para aula'],[pb,'Solicitação rejeitada','Solicitação aprovada','Rejeitada','Saldo insuficiente no turno']]){
    await page.reload();
    await expect(page.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible();
    await expect(page.locator('.teacher-status')).toHaveText(status);
    await expect(page.getByText(reply,{exact:false})).toBeVisible();
    await page.getByRole('button',{name:/Notificações, 1 não lida/}).click();
    await expect(page.getByText(title,{exact:true})).toBeVisible();
    await expect(page.getByText(otherTitle,{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Marcar todas como lidas'}).click();
    await expect(page.getByText('0 notificação(ões) não lida(s)')).toBeVisible();
    await page.getByRole('button',{name:'Voltar ao portal'}).click();
    await expect(page.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
  }
  const aa=await notices(a,ra.id),bb=await notices(b,rb.id);
  assert.equal(aa.length,1);assert.equal(bb.length,1);
  assert.equal(aa[0].kind,'PEDIDO_APROVADO');assert.equal(bb[0].kind,'PEDIDO_REJEITADO');
  assert.ok(aa[0].read_at&&bb[0].read_at);
  assert.deepEqual(await notices(b,ra.id),[]);
  assert.equal(ok(await b.client.rpc('mark_notification_read',{p_notification_id:aa[0].id}),'Bloqueio de aviso alheio'),false);
  await submit(pb,cartB.id,2);
  const [withdrawn]=await requests(b,cartB.id);
  const withdrawal=pb.locator('article.booking-item').filter({hasText:otherName});
  await withdrawal.getByRole('button',{name:'Retirar pedido pendente'}).click();
  await withdrawal.getByRole('button',{name:'Confirmar retirada'}).click();
  await expect(withdrawal.locator('.teacher-status')).toHaveText('Retirada pelo professor');
  assert.equal((await requests(b,cartB.id))[0].status,'DESISTENCIA');
  assert.equal(await publicBalance(cartB.id),10);
  assert.equal((await notices(ti,withdrawn.id)).filter(x=>x.kind==='PEDIDO_RETIRADO').length,1);
  assert.deepEqual(await requests(a,cartB.id),[]);
  await pa.reload();
  await expect(pa.locator('.teacher-status')).toHaveText('Aprovada');
  await expect(pa.getByText(otherName,{exact:true})).toHaveCount(0);
  await admin.reload();
  await expect(admin.getByRole('heading',{name:'Visão geral'})).toBeVisible();
  await admin.getByRole('button',{name:'Solicitações',exact:true}).click();
  const linkB=admin.locator('#links-heading').locator('..').locator('..').locator('.item').filter({hasText:b.email});
  await linkB.getByRole('button',{name:'Revogar',exact:true}).click();
  await linkB.getByRole('button',{name:'Confirmar revogação'}).click();
  await expect(admin.getByText(/Vínculo desativado/)).toBeVisible();
  assert.deepEqual(await requests(b,cartA.id),[]);
  denied(await b.client.rpc('submit_teacher_request',{p_cart_id:cartA.id,p_mode:'PARCIAL',p_quantity:1,p_dates:[day],p_shifts:['MATUTINO']}),'Sessão anterior revogada não solicita');
  await pb.reload();
  await expect(pb.getByRole('heading',{name:'Conta criada, aguardando autorização'})).toBeVisible();
  await expect(pb.getByRole('button',{name:'Nova solicitação'})).toHaveCount(0);
  console.log('PASS F2.3-AVISOS: notificações individuais, leitura, retirada e revogação efetiva.');
  console.log('PASS F2.3: fluxo real multiusuário em Chromium e Supabase isolado.');
}finally{
  await browser?.close();
  server.kill();
}
