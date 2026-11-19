import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const config=JSON.parse(readFileSync(process.argv[2]??'.env.homologacao.status.local','utf8'));
assert.match(config.API_URL??'',/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/,'Somente stack local');
assert.ok(config.ANON_KEY&&config.SERVICE_ROLE_KEY);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const url='http://127.0.0.1:54321';
const root=createClient(url,config.SERVICE_ROLE_KEY,options);
const admin=createClient(url,config.ANON_KEY,options);
const anon=createClient(url,config.ANON_KEY,options);
const tag=randomUUID().slice(0,12);
const password=randomBytes(24).toString('hex');
const email='cadastros-'+tag+'@educart.example';
function ok(r,label){assert.equal(r.error,null,label+': '+(r.error?.code??''));return r.data;}
function fail(r,label,code){assert.ok(r.error,label);if(code)assert.equal(r.error.code,code,label);}
const {user}=ok(await root.auth.admin.createUser({email,password,email_confirm:true}),'Criar TI sintética');
ok(await root.from('admin_users').insert({user_id:user.id,display_name:'TI F2.1'}),'Autorizar TI local');
ok(await admin.auth.signInWithPassword({email,password}),'Login TI (Auth real)');
const dayOffset=(days)=>{
  const d=new Date(Date.now()+days*86400000);
  while([0,6].includes(d.getUTCDay()))d.setUTCDate(d.getUTCDate()+1);
  return d.toISOString().slice(0,10);
};
const d1=dayOffset(7),d2=dayOffset(14),past=dayOffset(-14);
const saturday=new Date(Date.now()+7*86400000);
while(saturday.getUTCDay()!==6)saturday.setUTCDate(saturday.getUTCDate()+1);
const weekend=saturday.toISOString().slice(0,10);
async function insert(table,values){return ok(await admin.from(table).insert(values).select('*').single(),'Inserir '+table);}
async function change(table,id,values){return ok(await admin.from(table).update(values).eq('id',id).select('*').single(),'Editar '+table);}
async function find(table,id){return ok(await admin.from(table).select('*').eq('id',id).single(),'Consultar '+table);}
async function rows(table,field,id){return ok(await admin.from(table).select('*').eq(field,id),'Consultar '+table);}
async function balance(cart,day,shift='MATUTINO'){
  const data=ok(await anon.rpc('public_cart_availability',{p_start:day,p_end:day}),'Saldo público');
  const row=data.find(x=>x.cart_id===cart&&x.shift===shift);
  assert.ok(row,'Carrinho ativo existe na consulta pública');
  return row.available;
}
const cart=await insert('carts',{code:'F21-'+tag,name:'Carrinho F2.1',capacity:8});
const other=await insert('carts',{code:'OUT-'+tag,name:'Carrinho destino F2.1',capacity:6});
const requester=await insert('requesters',{name:'Professor F2.1',reference_code:'PROF-'+tag});
assert.equal((await change('carts',cart.id,{name:'Carrinho atualizado',capacity:10})).capacity,10);
assert.equal((await change('requesters',requester.id,{name:'Professor atualizado'})).name,'Professor atualizado');
fail(await admin.from('carts').insert({code:cart.code.toLowerCase(),name:'Duplicado',capacity:2}),'Código repetido','23505');
fail(await admin.from('requesters').insert({name:'Duplicado',reference_code:requester.reference_code.toLowerCase()}),'Referência repetida','23505');
fail(await admin.from('carts').insert({code:'ZERO-'+tag,name:'Capacidade inválida',capacity:0}),'Capacidade positiva','23514');
const codes=ok(await admin.from('notebook_codes').insert([1,2,3].map(i=>({cart_id:cart.id,code:'NB-'+tag+'-'+i}))).select('*'),'Lote de notebooks');
assert.equal(codes.length,3);
const foreign=await insert('notebook_codes',{cart_id:other.id,code:'NB-OUT-'+tag});
fail(await admin.from('notebook_codes').insert([{cart_id:cart.id,code:'LOTE-'+tag},{cart_id:cart.id,code:codes[0].code.toLowerCase()}]),'Lote duplicado deve falhar','23505');
assert.equal((await rows('notebook_codes','cart_id',cart.id)).length,3,'Lote inválido não persiste parcialmente');
fail(await admin.from('notebook_codes').insert(Array.from({length:8},(_,i)=>({cart_id:cart.id,code:'MAX-'+tag+'-'+i}))),'Lote acima da capacidade');
assert.equal((await rows('notebook_codes','cart_id',cart.id)).length,3,'Excesso de códigos deve fazer rollback');
fail(await admin.from('carts').update({capacity:2}).eq('id',cart.id),'Redução inferior aos códigos ativos');
assert.equal(await balance(cart.id,d1),10,'Capacidade independe da quantidade de códigos');
console.log('PASS F2.1-CAD: cadastro, edição, duplicidades, capacidade, lote atômico e saldo nominal');

const args={p_requester_id:requester.id,p_cart_id:cart.id,p_mode:'PARCIAL',p_quantity:4,p_dates:[d1,d2],p_shifts:['MATUTINO','VESPERTINO'],p_needs_mouse:true,p_notes:'Teste sintético',p_notebook_ids:[codes[0].id]};
const create=async (patch={})=>admin.rpc('create_reservation',{...args,...patch});
const before=(await rows('reservations','cart_id',cart.id)).length;
for(const [label,patch] of [
  ['Fim de semana',{p_dates:[weekend]}],
  ['Data passada',{p_dates:[past]}],
  ['Datas duplicadas',{p_dates:[d1,d1]}],
  ['Turnos duplicados',{p_shifts:['MATUTINO','MATUTINO']}],
  ['Quantidade acima do limite',{p_quantity:11}],
  ['Reserva completa incoerente',{p_mode:'COMPLETA',p_quantity:9}],
  ['Notebook de outro carrinho',{p_notebook_ids:[foreign.id]}],
  ['Notebook duplicado',{p_notebook_ids:[codes[0].id,codes[0].id]}]
])fail(await create(patch),label);
assert.equal((await rows('reservations','cart_id',cart.id)).length,before,'Nenhum cabeçalho inválido criado');
await change('requesters',requester.id,{active:false});
fail(await create(),'Professor inativo');
await change('requesters',requester.id,{active:true});
await change('carts',cart.id,{active:false});
fail(await create(),'Carrinho inativo');
await change('carts',cart.id,{active:true});
const id=ok(await create(),'Reserva agrupada');
fail(await admin.from('carts').update({active:false}).eq('id',cart.id),'Impedir inativação de carrinho reservado');
fail(await admin.from('requesters').update({active:false}).eq('id',requester.id),'Impedir inativação de professor reservado');
fail(await admin.from('notebook_codes').update({active:false}).eq('id',codes[0].id),'Impedir inativação de notebook reservado');
assert.equal((await find('carts',cart.id)).active,true);
assert.equal((await find('requesters',requester.id)).active,true);
assert.equal((await find('notebook_codes',codes[0].id)).active,true);
const periods=await rows('reservation_periods','reservation_id',id);
assert.equal(periods.length,4);
assert.ok(periods.every(p=>p.active&&p.quantity===4));
assert.equal((await find('reservations',id)).needs_mouse,true);
for(const day of [d1,d2])for(const shift of ['MATUTINO','VESPERTINO'])assert.equal(await balance(cart.id,day,shift),6);
assert.equal(await balance(cart.id,d1,'NOTURNO'),10);
fail(await create({p_quantity:7,p_dates:[d1],p_shifts:['NOTURNO','MATUTINO'],p_notebook_ids:[]}),'Conflito em um turno bloqueia o grupo inteiro');
assert.equal(await balance(cart.id,d1,'NOTURNO'),10);
assert.equal((await rows('reservations','cart_id',cart.id)).length,before+1);
fail(await create({p_quantity:1,p_dates:[d1],p_shifts:['MATUTINO']}),'Mesmo notebook já atribuído');
fail(await admin.from('carts').update({capacity:3}).eq('id',cart.id),'Reduzir abaixo de ocupação existente');
console.log('PASS F2.1-RES: reserva em quatro períodos, conflitos e rollback, entradas inválidas, bloqueios de inativos');

const full=ok(await create({p_mode:'COMPLETA',p_quantity:10,p_dates:[d1],p_shifts:['NOTURNO'],p_notebook_ids:[]}),'Reserva completa sem códigos');
assert.equal(await balance(cart.id,d1,'NOTURNO'),0);
const update=patch=>admin.rpc('update_reservation',{...args,p_reservation_id:id,...patch});
fail(await update({p_quantity:5,p_dates:[d1],p_shifts:['MATUTINO','NOTURNO']}),'Edição com conflito em um turno');
assert.equal((await find('reservations',id)).quantity,4);
assert.equal((await rows('reservation_periods','reservation_id',id)).filter(p=>p.active).length,4);
ok(await update({p_quantity:5,p_dates:[d1,d2],p_shifts:['MATUTINO'],p_notes:'Editado'}),'Editar reserva');
assert.equal((await find('reservations',id)).quantity,5);
assert.equal(await balance(cart.id,d1,'MATUTINO'),5);
assert.equal(await balance(cart.id,d1,'VESPERTINO'),10);
const current=(await rows('reservation_periods','reservation_id',id)).filter(p=>p.active);
assert.equal(current.length,2);
const removed=current.find(p=>p.usage_date===d1);
ok(await admin.rpc('cancel_reservation_period',{p_period_id:removed.id}),'Cancelar um período');
assert.equal(await balance(cart.id,d1),10);
assert.equal(await balance(cart.id,d2),5);
assert.equal((await find('reservations',id)).status,'CONFIRMADA');
fail(await admin.rpc('cancel_reservation_period',{p_period_id:removed.id}),'Período já cancelado');
ok(await admin.rpc('cancel_reservation',{p_reservation_id:id}),'Cancelar restante');
assert.equal((await find('reservations',id)).status,'CANCELADA');
assert.equal(await balance(cart.id,d2),10);
assert.ok((await rows('reservation_periods','reservation_id',id)).every(p=>!p.active));
const audit=await rows('reservation_events','reservation_id',id);
assert.deepEqual(audit.map(x=>x.event_type).sort(),['CANCELAMENTO','CANCELAMENTO','CRIACAO','EDICAO']);
assert.ok(audit.every(x=>x.admin_id===user.id));
assert.ok(audit.find(x=>x.event_type==='EDICAO').before_data);
assert.ok(audit.find(x=>x.event_type==='EDICAO').after_data);
ok(await admin.rpc('cancel_reservation',{p_reservation_id:full}),'Liberar reserva completa');
assert.equal(await balance(cart.id,d1,'NOTURNO'),10);
for(const [table,id] of [['notebook_codes',codes[0].id],['requesters',requester.id],['carts',cart.id]]){
 assert.equal((await change(table,id,{active:false})).active,false);
 assert.equal((await find(table,id)).id,id);
 assert.equal((await change(table,id,{active:true})).active,true);
}
console.log('PASS CATALOGO: bloqueio de inativação com compromisso, inativação lógica e reativação');
console.log('PASS F2.1-EDIT: detalhes, alteração, cancelamento parcial/total, saldo e trilha de auditoria');

// Today rules, only on an institutional weekday. Otherwise explicitly skip.
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
if(![0,6].includes(new Date(today+'T12:00:00Z').getUTCDay())){
  const same=ok(await create({p_dates:[today],p_shifts:['MATUTINO'],p_notebook_ids:[]}),'Reserva no próprio dia');
  fail(await admin.rpc('cancel_reservation',{p_reservation_id:same}),'Cancelamento integral hoje deve falhar');
  const samePeriod=(await rows('reservation_periods','reservation_id',same))[0];
  fail(await admin.rpc('cancel_reservation_period',{p_period_id:samePeriod.id}),'Cancelamento de período hoje deve falhar');
  fail(await update({p_reservation_id:same,p_dates:[d1],p_shifts:['MATUTINO'],p_notebook_ids:[]}),'Edição não pode suprimir a data de hoje');
  ok(await update({p_reservation_id:same,p_quantity:3,p_dates:[today],p_shifts:['MATUTINO'],p_notebook_ids:[]}),'Edição hoje preserva a data');
  assert.equal(await balance(cart.id,today),7);
  console.log('PASS F2.1-HOJE: edição permitida, cancelamento proibido');
}else console.log('SKIP F2.1-HOJE: fim de semana no fuso institucional');
console.log('PASS F2.1: ciclo real de cadastros e reservas no Supabase isolado.');
