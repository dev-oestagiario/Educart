import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const config=JSON.parse(readFileSync(process.argv[2]??'.env.homologacao.status.local','utf8'));
assert.match(config.API_URL??'',/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/,'Somente stack local');
assert.ok(config.ANON_KEY&&config.SERVICE_ROLE_KEY);
const url='http://127.0.0.1:54321';
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const root=createClient(url,config.SERVICE_ROLE_KEY,options);
const anon=createClient(url,config.ANON_KEY,options);
const tag=randomUUID().slice(0,12);
function ok(r,label){assert.equal(r.error,null,label+': '+(r.error?.code??''));return r.data;}
async function account(role,admin=false){
  const email=role+'-'+tag+'@educart.example',password=randomBytes(24).toString('hex');
  const {user}=ok(await root.auth.admin.createUser({email,password,email_confirm:true}),'Criar '+role);
  if(admin)ok(await root.from('admin_users').insert({user_id:user.id,display_name:'TI concorrência '+role}),'Autorizar TI');
  const client=createClient(url,config.ANON_KEY,options);
  const session=ok(await client.auth.signInWithPassword({email,password}),'Login '+role);
  assert.equal(session.user.id,user.id);assert.ok(session.session?.access_token);
  return {client,id:user.id,email};
}
const A=await account('ti-a',true),B=await account('ti-b',true);
const P=await account('prof-a'),Q=await account('prof-b');
assert.notEqual(A.id,B.id);
const db=A.client;
const teachers=ok(await db.from('requesters').insert([{name:'Professor A concorrência '+tag},{name:'Professor B concorrência '+tag}]).select('id'),'Criar professores');
ok(await db.rpc('link_teacher_account',{p_requester_id:teachers[0].id,p_email:P.email}),'Vincular A');
ok(await db.rpc('link_teacher_account',{p_requester_id:teachers[1].id,p_email:Q.email}),'Vincular B');
const next=new Date(Date.now()+14*86400000);
while(next.getUTCDay()!==1)next.setUTCDate(next.getUTCDate()+1);
const d1=next.toISOString().slice(0,10);
next.setUTCDate(next.getUTCDate()+1);
const d2=next.toISOString().slice(0,10);
async function cart(label,capacity=10){
  return ok(await db.from('carts').insert({code:'RACE-'+tag+'-'+label,name:'Sintético '+label,capacity}).select('id,capacity').single(),'Criar carrinho');
}
function args(c,quantity,patch={}){
  return {p_requester_id:teachers[0].id,p_cart_id:c.id,p_mode:'PARCIAL',p_quantity:quantity,p_dates:[d1],p_shifts:['MATUTINO'],p_needs_mouse:false,p_notes:null,p_notebook_ids:[],...patch};
}
async function create(c,quantity,patch={}){return ok(await db.rpc('create_reservation',args(c,quantity,patch)),'Reserva base');}
async function rows(table,key,value){return ok(await db.from(table).select('*').eq(key,value),'Ler '+table);}
async function readCart(c){return ok(await db.from('carts').select('capacity').eq('id',c.id).single(),'Capacidade');}
async function state(c){
  const periods=await rows('reservation_periods','cart_id',c.id);
  const bookings=await rows('reservations','cart_id',c.id);
  const {capacity}=await readCart(c);
  const totals=new Map();
  for(const p of periods.filter(x=>x.active)){
    assert.ok(bookings.some(b=>b.id===p.reservation_id&&b.status==='CONFIRMADA'),'Período órfão ou cancelado');
    const key=p.usage_date+'|'+p.shift;
    totals.set(key,(totals.get(key)??0)+p.quantity);
  }
  for(const value of totals.values())assert.ok(value<=capacity,'Sobre-reserva confirmada');
  const pub=ok(await anon.rpc('public_cart_availability',{p_start:d1,p_end:d2}),'Saldo público');
  const summary=pub.filter(x=>x.cart_id===c.id);
  assert.equal(summary.length,6);
  for(const p of summary){
    const occupied=totals.get(p.usage_date+'|'+p.shift)??0;
    assert.equal(p.reserved,occupied);assert.equal(p.available,capacity-occupied);
  }
  return {periods,bookings,capacity,totals};
}
async function eventCount(id,event){
  return (await rows('reservation_events','reservation_id',id)).filter(x=>x.event_type===event).length;
}
// Two independent Auth clients enqueue concurrent requests. This checks
// outcomes/invariants, not exact lock order or wall-clock overlap on server.
async function race(first,second,expected,label){
  const result=await Promise.all([first(),second()]);
  const winners=result.map((r,i)=>({r,i})).filter(x=>!x.r.error);
  const losers=result.filter(r=>r.error);
  assert.equal(winners.length,expected,label+' quantidade de sucessos');
  for(const r of losers){
    assert.ok(['P0001','23505'].includes(r.error.code),label+' falha de negócio esperada: '+r.error.code);
  }
  return winners;
}
const repetitions=3;
for(let i=0;i<repetitions;i++){
  let c=await cart('ocupa-'+i);
  let winners=await race(()=>A.client.rpc('create_reservation',args(c,6)),()=>B.client.rpc('create_reservation',args(c,6)),1,'Duas reservas excedentes');
  let s=await state(c);
  assert.equal(s.bookings.length,1);assert.equal(s.periods.length,1);assert.equal(s.totals.get(d1+'|MATUTINO'),6);
  assert.equal(await eventCount(winners[0].r.data,'CRIACAO'),1);

  c=await cart('turnos-'+i);
  await race(()=>A.client.rpc('create_reservation',args(c,10)),()=>B.client.rpc('create_reservation',args(c,10,{p_shifts:['VESPERTINO']})),2,'Turnos independentes');
  s=await state(c);assert.equal(s.bookings.length,2);assert.equal(s.periods.length,2);

  c=await cart('grupo-'+i);
  winners=await race(()=>A.client.rpc('create_reservation',args(c,7,{p_dates:[d1,d2]})),()=>B.client.rpc('create_reservation',args(c,7,{p_dates:[d2]})),1,'Grupo atômico com conflito');
  s=await state(c);assert.equal(s.bookings.length,1);
  assert.equal(s.periods.length,winners[0].i===0?2:1,'Nenhum período parcial do perdedor');
  assert.equal(s.totals.get(d2+'|MATUTINO'),7);

  c=await cart('edicao-'+i);
  const one=await create(c,3),two=await create(c,3);
  winners=await race(()=>A.client.rpc('update_reservation',{...args(c,7),p_reservation_id:one}),()=>B.client.rpc('update_reservation',{...args(c,7),p_reservation_id:two}),1,'Duas edições concorrentes');
  s=await state(c);assert.equal(s.bookings.length,2);
  assert.deepEqual(s.bookings.map(x=>x.quantity).sort((x,y)=>x-y),[3,7]);
  assert.equal(s.totals.get(d1+'|MATUTINO'),10);
  assert.equal(await eventCount(one,'EDICAO')+await eventCount(two,'EDICAO'),1);

  c=await cart('update-create-'+i);
  const base=await create(c,4);
  winners=await race(()=>A.client.rpc('update_reservation',{...args(c,7),p_reservation_id:base}),()=>B.client.rpc('create_reservation',args(c,4)),1,'Edição versus criação');
  s=await state(c);assert.equal(s.bookings.length,winners[0].i===0?1:2);
  assert.equal(s.totals.get(d1+'|MATUTINO'),winners[0].i===0?7:8);
  assert.equal(await eventCount(base,'EDICAO'),winners[0].i===0?1:0);

  c=await cart('capacidade-'+i);
  winners=await race(()=>A.client.from('carts').update({capacity:5}).eq('id',c.id).select('id').single(),()=>B.client.rpc('create_reservation',args(c,6)),1,'Redução de capacidade versus reserva');
  s=await state(c);
  assert.equal(s.capacity,winners[0].i===0?5:10);
  assert.equal(s.bookings.length,winners[0].i===0?0:1);

  c=await cart('codigo-'+i);
  const code='NB-RACE-'+tag+'-'+i;
  await race(()=>A.client.from('notebook_codes').insert({cart_id:c.id,code}),()=>B.client.from('notebook_codes').insert({cart_id:c.id,code:code.toLowerCase()}),1,'Código duplicado');
  assert.equal((await rows('notebook_codes','cart_id',c.id)).length,1);
  c=await cart('limite-codigo-'+i,1);
  await race(()=>A.client.from('notebook_codes').insert({cart_id:c.id,code:'NB-A-'+tag+'-'+i}),()=>B.client.from('notebook_codes').insert({cart_id:c.id,code:'NB-B-'+tag+'-'+i}),1,'Capacidade de códigos concorrentes');
  assert.equal((await rows('notebook_codes','cart_id',c.id)).length,1);

  c=await cart('mesmo-notebook-'+i);
  const notebook=ok(await db.from('notebook_codes').insert({cart_id:c.id,code:'NB-SAME-'+tag+'-'+i}).select('id').single(),'Notebook identificado');
  await race(()=>A.client.rpc('create_reservation',args(c,1,{p_notebook_ids:[notebook.id]})),()=>B.client.rpc('create_reservation',args(c,1,{p_notebook_ids:[notebook.id]})),1,'Notebook disputado com saldo restante');
  s=await state(c);assert.equal(s.bookings.length,1);
  assert.equal((await rows('reservation_notebooks','notebook_id',notebook.id)).filter(x=>x.active).length,1);
  console.log('PASS F2.2 ciclo '+(i+1)+': 9 disputas de criação, edição, capacidade e códigos.');
}
async function request(who,c){
  return ok(await who.client.rpc('submit_teacher_request',{p_cart_id:c.id,p_mode:'PARCIAL',p_quantity:6,p_dates:[d1],p_shifts:['MATUTINO'],p_needs_mouse:false,p_notes:null}),'Solicitação docente');
}
function approve(who,id){return who.client.rpc('review_teacher_request',{p_request_id:id,p_approve:true});}
for(let i=0;i<repetitions;i++){
  let c=await cart('aprovacao-'+i);
  const ra=await request(P,c),rb=await request(Q,c);
  const winners=await race(()=>approve(A,ra),()=>approve(B,rb),1,'Aprovações de pedidos incompatíveis');
  let s=await state(c);assert.equal(s.bookings.length,1);assert.equal(s.totals.get(d1+'|MATUTINO'),6);
  const requests=await rows('reservation_requests','cart_id',c.id);
  assert.deepEqual(requests.map(x=>x.status).sort(),['APROVADA','PENDENTE']);
  const winner=requests.find(x=>x.status==='APROVADA'),loser=requests.find(x=>x.status==='PENDENTE');
  assert.equal(winner.reservation_id,winners[0].r.data);assert.equal(loser.reservation_id,null);
  assert.equal((await rows('reservation_request_events','request_id',winner.id)).filter(x=>x.event_type==='APROVACAO').length,1);
  assert.equal((await rows('reservation_request_events','request_id',loser.id)).filter(x=>x.event_type==='APROVACAO').length,0);

  c=await cart('dupla-aprovacao-'+i);
  const same=await request(P,c);
  await race(()=>approve(A,same),()=>approve(B,same),1,'Mesmo pedido aprovado duas vezes');
  s=await state(c);assert.equal(s.bookings.length,1);assert.equal(s.periods.length,1);
  assert.equal((await rows('reservation_request_events','request_id',same)).filter(x=>x.event_type==='APROVACAO').length,1);
  const notifications=await rows('user_notifications','request_id',same);
  assert.equal(notifications.filter(x=>x.kind==='PEDIDO_APROVADO'&&x.recipient_user_id===P.id).length,1);
  console.log('PASS F2.2 aprovação '+(i+1)+': pedidos conflitantes e aprovação duplicada.');
}
console.log('PASS F2.2: 33 pares de operações concorrentes, sem sobre-reserva ou gravação parcial.');
