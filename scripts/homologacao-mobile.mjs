import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';
import {chromium,webkit,expect} from '@playwright/test';

const config=JSON.parse(readFileSync(process.argv[2]??'.env.homologacao.status.local','utf8'));
assert.match(config.API_URL??'',/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/,'Somente stack local');
assert.ok(config.ANON_KEY&&config.SERVICE_ROLE_KEY);
const url='http://127.0.0.1:54321',web='http://127.0.0.1:5173';
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const root=createClient(url,config.SERVICE_ROLE_KEY,options);
const anon=createClient(url,config.ANON_KEY,options);
const tag=randomUUID().slice(0,12);
function ok(r,label){assert.equal(r.error,null,label+': '+(r.error?.code??''));return r.data;}
async function account(role){
  const email=role+'-'+tag+'@educart.example',password=randomBytes(24).toString('hex');
  const {user}=ok(await root.auth.admin.createUser({email,password,email_confirm:true}),'Criar conta');
  const client=createClient(url,config.ANON_KEY,options);
  ok(await client.auth.signInWithPassword({email,password}),'Login real');
  return {id:user.id,email,password,client};
}
const ti=await account('mobile-ti'),teacher=await account('mobile-prof');
ok(await root.from('admin_users').insert({user_id:ti.id,display_name:'TI móvel'}),'Provisionar TI local');
const db=ti.client;
const requester=ok(await db.from('requesters').insert({name:'Professor móvel '+tag}).select('id,name').single(),'Cadastrar professor');
ok(await db.rpc('link_teacher_account',{p_requester_id:requester.id,p_email:teacher.email}),'Vincular professor');
const cart=ok(await db.from('carts').insert({code:'MOB-'+tag,name:'Carrinho móvel '+tag,capacity:10}).select('id,name').single(),'Criar carrinho');
const day=new Date(Date.now()+35*86400000);
while(day.getUTCDay()!==1)day.setUTCDate(day.getUTCDate()+1);
const iso=day.toISOString().slice(0,10);
day.setUTCDate(day.getUTCDate()+4);
const end=day.toISOString().slice(0,10);
const devices=[
  {name:'android-320',engine:chromium,width:320,height:640,mobile:true},
  {name:'android-360',engine:chromium,width:360,height:760,mobile:true},
  {name:'iphone-390',engine:webkit,width:390,height:844,mobile:true},
  {name:'iphone-paisagem',engine:webkit,width:667,height:375,mobile:true},
  {name:'tablet-768',engine:webkit,width:768,height:1024,mobile:true}
];
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--mode','homologacao','--host','127.0.0.1','--port','5173','--strictPort'],{
  env:{...process.env,VITE_SUPABASE_URL:url,VITE_SUPABASE_PUBLISHABLE_KEY:config.ANON_KEY},stdio:'ignore'
});
const screenshots='test-results/mobile-local';
mkdirSync(screenshots,{recursive:true});
async function fit(page,label){
  const values=await page.evaluate(()=>{
    const width=document.documentElement.clientWidth;
    const containers=[...document.querySelectorAll('.content,.teacher-main,.public-agenda,.auth-panel,.calendar-filters')];
    return {overflow:document.documentElement.scrollWidth-width,containerOverflow:containers.filter(x=>x.clientWidth>0).map(x=>x.scrollWidth-x.clientWidth),viewportWidth:width};
  });
  assert.ok(values.overflow<=1,label+' documento excede largura');
  assert.ok(values.containerOverflow.every(x=>x<=2),label+' conteúdo interno cortado '+JSON.stringify(values));
}
async function touch(locator,page,label,min=44){
  await locator.scrollIntoViewIfNeeded();
  const box=await locator.boundingBox(),size=page.viewportSize();
  assert.ok(box&&size,label+' não visível');
  assert.ok(box.width>=min-.5&&box.height>=min-.5,label+' alvo pequeno');
  assert.ok(box.x>=-1&&box.x+box.width<=size.width+1,label+' fora da largura');
}
async function login(page,who){
  await page.goto(web);
  await page.getByLabel('E-mail').fill(who.email);
  await page.getByLabel('Senha',{exact:true}).fill(who.password);
  await page.getByRole('button',{name:'Entrar no Educart'}).tap();
}
async function nav(page,name,width){
  if(width<=690){
    const opener=page.getByRole('button',{name:'Abrir menu lateral'});
    await touch(opener,page,'Menu');
    await opener.tap();
    await expect(page.getByRole('navigation',{name:'Menu principal'})).toBeVisible();
  }
  await page.getByRole('navigation',{name:'Menu principal'}).getByRole('button',{name,exact:true}).tap();
  if(width<=690)await expect(page.getByRole('navigation',{name:'Menu principal'})).toBeHidden();
}
async function shot(page,device,label){
  // Synthetic local accounts only; never include login fields or credentials in artifacts.
  await page.screenshot({path:screenshots+'/'+device+'-'+label+'.png',animations:'disabled'});
}
try{
  let ready=false;
  for(let i=0;i<120;i++){
    if(server.exitCode!==null)throw Error('Servidor encerrado');
    try{if((await fetch(web)).ok){ready=true;break;}}catch{}
    await delay(500);
  }
  assert.ok(ready,'Vite não iniciou');
  for(const device of devices){
    const browser=await device.engine.launch({headless:true});
    try{
      const pageOptions={viewport:{width:device.width,height:device.height},deviceScaleFactor:2,isMobile:device.mobile,hasTouch:true};
      async function page(){
        const p=await browser.newPage(pageOptions);
        await p.route('**/*',r=>[url,web].includes(new URL(r.request().url()).origin)?r.continue():r.abort());
        return p;
      }
      const publicPage=await page();
      await publicPage.goto(web+'/#/consulta-publica');
      await expect(publicPage.getByRole('heading',{name:'Disponibilidade dos carrinhos'})).toBeVisible();
      await expect(publicPage.getByLabel('E-mail')).toHaveCount(0);
      await publicPage.getByLabel('Dia da consulta').fill(iso);
      await publicPage.locator('#public-cart').selectOption(cart.id);
      await expect(publicPage.locator('.calendar-day')).toHaveCount(1);
      await expect(publicPage.locator('.public-agenda-cart').getByText(cart.name,{exact:true})).toBeVisible();
      await publicPage.getByLabel('Data final (opcional)').fill(end);
      await expect(publicPage.locator('.calendar-day')).toHaveCount(5);
      await touch(publicPage.getByRole('button',{name:'Limpar data final'}),publicPage,'Limpar data');
      await touch(publicPage.getByRole('button',{name:'Atualizar disponibilidade'}),publicPage,'Atualizar');
      await fit(publicPage,device.name+' consulta');
      await publicPage.getByRole('button',{name:'Limpar data final'}).tap();
      await expect(publicPage.locator('.calendar-day')).toHaveCount(1);
      await publicPage.getByRole('button',{name:'Ativar modo claro'}).tap();
      await expect(publicPage.locator('html')).toHaveAttribute('data-theme','light');
      await publicPage.reload();
      await expect(publicPage.locator('html')).toHaveAttribute('data-theme','light');
      await publicPage.getByRole('button',{name:'Ativar modo escuro'}).tap();
      await fit(publicPage,device.name+' consulta escura');
      await shot(publicPage,device.name,'consulta');
      await publicPage.getByRole('link',{name:'Acesso ao sistema'}).tap();
      await expect(publicPage.getByRole('heading',{name:'Acesso ao Educart'})).toBeVisible();
      await fit(publicPage,device.name+' login');
      const passwordFont=await publicPage.getByLabel('Senha',{exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
      if(device.width<=690)assert.ok(passwordFont>=16,'Campo de senha abaixo de 16px');
      await publicPage.getByRole('button',{name:'Esqueci minha senha'}).tap();
      await expect(publicPage.getByRole('heading',{name:'Recuperar senha'})).toBeVisible();
      await fit(publicPage,device.name+' recuperação');
      await publicPage.getByRole('button',{name:'Voltar ao login'}).tap();
      await publicPage.close();

      const teacherPage=await page();
      await login(teacherPage,teacher);
      await expect(teacherPage.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible({timeout:15000});
      await touch(teacherPage.locator('.notifications-trigger'),teacherPage,'Sino professor');
      if(device.width<=690)await touch(teacherPage.getByRole('button',{name:'Ativar modo claro'}),teacherPage,'Tema professor');
      await touch(teacherPage.getByRole('button',{name:'Sair',exact:true}),teacherPage,'Sair professor',40);
      await fit(teacherPage,device.name+' portal');
      const teacherNav=teacherPage.getByRole('navigation',{name:'Menu do professor'});
      await teacherNav.getByRole('button',{name:'Calendário',exact:true}).tap();
      await expect(teacherPage.getByRole('heading',{name:'Disponibilidade dos carrinhos'})).toBeVisible();
      await expect(teacherPage.getByRole('button',{name:'Exportar PDF'})).toHaveCount(0);
      await fit(teacherPage,device.name+' calendário docente');
      await teacherNav.getByRole('button',{name:'Manutenções',exact:true}).tap();
      await expect(teacherPage.getByRole('heading',{name:'Manutenções',exact:true})).toBeVisible();
      await expect(teacherPage.getByRole('heading',{name:'Manutenções vigentes e programadas'})).toBeVisible();
      await fit(teacherPage,device.name+' manutenções docente');
      await teacherNav.getByRole('button',{name:'Configurações',exact:true}).tap();
      await expect(teacherPage.getByRole('region',{name:'Preferências de e-mail'})).toBeVisible();
      await fit(teacherPage,device.name+' configurações');
      await teacherNav.getByRole('button',{name:'Solicitações',exact:true}).tap();
      await teacherPage.getByRole('button',{name:'Nova solicitação'}).tap();
      await teacherPage.locator('#teacher-cart').selectOption(cart.id);
      await teacherPage.locator('#teacher-period-start').fill(iso);
      await teacherPage.locator('#teacher-period-end').fill(iso);
      await teacherPage.locator('#teacher-quantity').fill('1');
      await expect(teacherPage.getByRole('heading',{name:'Prévia de disponibilidade'})).toBeVisible();
      await expect(teacherPage.getByText(/Ver saldo por data e turno/)).toBeVisible();
      await teacherPage.getByText(/Ver saldo por data e turno/).tap();
      await expect(teacherPage.locator('.teacher-availability-table-wrap')).toBeVisible();
      await fit(teacherPage,device.name+' formulário professor');
      await shot(teacherPage,device.name,'professor');
      await teacherPage.getByRole('button',{name:'Enviar solicitação para aprovação'}).tap();
      await expect(teacherPage.getByText(/Solicitação enviada à TI/)).toBeVisible();
      const pending=ok(await db.from('reservation_requests').select('id').eq('cart_id',cart.id).eq('status','PENDENTE').single(),'Pedido persistido');

      const admin=await page();
      await login(admin,ti);
      await expect(admin.getByRole('heading',{name:'Visão geral'})).toBeVisible({timeout:15000});
      if(device.width<=690){
        const menu=admin.getByRole('button',{name:'Abrir menu lateral'});
        await touch(menu,admin,'Abrir menu');
        await menu.tap();
        await expect(admin.getByRole('dialog',{name:'Navegação principal'})).toBeVisible();
        await touch(admin.getByRole('button',{name:'Fechar menu lateral'}),admin,'Fechar menu');
        await admin.getByRole('button',{name:'Fechar menu lateral'}).tap();
        await expect(menu).toHaveAttribute('aria-expanded','false');
      }
      for(const [label,heading] of [['Carrinhos','Carrinhos'],['Professores','Professores'],['Notebooks','Notebooks'],['Reservas','Reservas'],['Calendário','Calendário e relatórios']]){
        await nav(admin,label,device.width);
        await expect(admin.getByRole('heading',{name:heading,exact:true})).toBeVisible();
        await fit(admin,device.name+' '+label);
      }
      await nav(admin,'Reservas',device.width);
      await admin.getByRole('button',{name:'Nova reserva'}).tap();
      await admin.getByLabel('Professor solicitante').selectOption(requester.id);
      await admin.locator('#reservation-cart').selectOption(cart.id);
      await admin.locator('#reservation-date-trigger').tap();
      await expect(admin.getByRole('button',{name:'Próximo mês'})).toBeVisible();
      await fit(admin,device.name+' calendário de seleção');
      await shot(admin,device.name,'calendario');
      await nav(admin,'Solicitações',device.width);
      const item=admin.locator('article.booking-item').filter({has:admin.getByText(requester.name,{exact:true})});
      await item.getByRole('button',{name:'Aprovar e confirmar reserva'}).tap();
      await expect(admin.getByText('Solicitação aprovada e reserva confirmada.')).toBeVisible();
      const approved=ok(await db.from('reservation_requests').select('status,reservation_id').eq('id',pending.id).single(),'Aprovação persistida');
      assert.equal(approved.status,'APROVADA');assert.ok(approved.reservation_id);
      await teacherPage.reload();
      await expect(teacherPage.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible();
      await teacherPage.getByRole('button',{name:/Notificações, 1 não lida/}).tap();
      await expect(teacherPage.getByRole('heading',{name:'Notificações'})).toBeVisible();
      await fit(teacherPage,device.name+' avisos');
      await teacherPage.getByRole('button',{name:'Marcar todas como lidas'}).tap();
      await expect(teacherPage.getByText('0 notificação(ões) não lida(s)')).toBeVisible();
      await shot(teacherPage,device.name,'notificacoes');
      const publicRows=ok(await anon.rpc('public_cart_availability',{p_start:iso,p_end:iso}),'Saldo após aprovação');
      const slot=publicRows.find(x=>x.cart_id===cart.id&&x.shift==='MATUTINO');
      assert.ok(slot);assert.equal(slot.reserved,devices.indexOf(device)+1);
      await teacherPage.getByRole('button',{name:'Sair',exact:true}).tap();
      await expect(teacherPage.getByRole('heading',{name:'Acesso ao Educart'})).toBeVisible();
      console.log('PASS F2.5 '+device.name+': consulta, temas, Auth, portal, navegação TI, calendário, aprovação, avisos e logout.');
    }finally{await browser.close();}
  }
  console.log('PASS F2.5: 5 perfis de viewport/touch em Chromium e WebKit com Supabase real local.');
}finally{server.kill();}
