import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

// Read only CLI output, never .env, VITE_* or a remote project key.
const config=JSON.parse(readFileSync(process.argv[2]??'.env.homologacao.status.local','utf8'));
assert.match(config.API_URL??'',/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/,'Homologação exige o Supabase local.');
assert.ok(config.ANON_KEY&&config.SERVICE_ROLE_KEY,'Chaves locais ausentes.');
const url='http://127.0.0.1:54321';
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const root=createClient(url,config.SERVICE_ROLE_KEY,options);
const anon=createClient(url,config.ANON_KEY,options);
const suffix=randomUUID().slice(0,12);
function ok(result,label){
  assert.equal(result.error,null,label+': '+(result.error?.code??result.error?.name??''));
  return result.data;
}
function denied(result,label){assert.ok(result.error,label);}
async function account(role){
  const email=role+'-'+suffix+'@educart.example';
  const password=randomBytes(24).toString('hex');
  const {user}=ok(await root.auth.admin.createUser({email,password,email_confirm:true}),'Criar conta '+role);
  const client=createClient(url,config.ANON_KEY,options);
  const login=ok(await client.auth.signInWithPassword({email,password}),'Login '+role);
  assert.equal(login.user.id,user.id);
  assert.ok(login.session?.access_token);
  return {client,id:user.id,email};
}
let date=new Date(Date.now()+3*86400000);
while([0,6].includes(date.getUTCDay()))date.setUTCDate(date.getUTCDate()+1);
const day=date.toISOString().slice(0,10);
const ti=await account('ti'), a=await account('prof-a'), b=await account('prof-b'), unlinked=await account('sem-vinculo');
ok(await root.from('admin_users').insert({user_id:ti.id,display_name:'TI homologação'}),'Provisionar TI local');
assert.equal(ok(await ti.client.from('admin_users').select('user_id').eq('user_id',ti.id).single(),'Identidade TI').user_id,ti.id);
assert.deepEqual(ok(await unlinked.client.from('admin_users').select('user_id'),'Conta sem vínculo'),[]);
denied(await unlinked.client.from('admin_users').insert({user_id:unlinked.id,display_name:'Inválido'}),'Autoelevação deve falhar');
const cart=ok(await ti.client.from('carts').insert({code:'H-'+suffix,name:'Carrinho sintético',capacity:8}).select('id').single(),'Cadastrar carrinho');
const teachers=ok(await ti.client.from('requesters').insert([{name:'Professor A '+suffix},{name:'Professor B '+suffix}]).select('id'),'Cadastrar professores');
assert.equal(teachers.length,2);
ok(await ti.client.rpc('link_teacher_account',{p_requester_id:teachers[0].id,p_email:a.email}),'Vincular A');
ok(await ti.client.rpc('link_teacher_account',{p_requester_id:teachers[1].id,p_email:b.email}),'Vincular B');
assert.deepEqual(ok(await a.client.from('requesters').select('id').in('id',teachers.map(x=>x.id)),'Isolamento cadastros A').map(x=>x.id),[teachers[0].id]);
assert.deepEqual(ok(await b.client.from('requesters').select('id').in('id',teachers.map(x=>x.id)),'Isolamento cadastros B').map(x=>x.id),[teachers[1].id]);
denied(await a.client.rpc('list_teacher_accounts'),'Professor não lista contas');
denied(await anon.from('carts').select('id'),'Anon não lê tabelas');
assert.deepEqual(ok(await unlinked.client.from('carts').select('id').eq('id',cart.id),'Sem vínculo não lê carrinho'),[]);
let args={p_cart_id:cart.id,p_mode:'PARCIAL',p_quantity:2,p_dates:[day],p_shifts:['MATUTINO'],p_needs_mouse:false,p_notes:null};
denied(await unlinked.client.rpc('submit_teacher_request',args),'Sem vínculo não solicita');
const requestA=ok(await a.client.rpc('submit_teacher_request',args),'Solicitação A');
const requestB=ok(await b.client.rpc('submit_teacher_request',args),'Solicitação B');
const own=async account=>ok(await account.client.from('reservation_requests').select('id').in('id',[requestA,requestB]),'Consultar solicitações');
assert.deepEqual((await own(a)).map(x=>x.id),[requestA]);
assert.deepEqual((await own(b)).map(x=>x.id),[requestB]);
denied(await b.client.rpc('withdraw_teacher_request',{p_request_id:requestA}),'B não retira solicitação A');
denied(await a.client.rpc('review_teacher_request',{p_request_id:requestA,p_approve:true}),'Professor não aprova');
async function publicRow(){
  const rows=ok(await anon.rpc('public_cart_availability',{p_start:day,p_end:day}),'Disponibilidade pública');
  const row=rows.find(x=>x.cart_id===cart.id&&x.shift==='MATUTINO');
  assert.ok(row);
  assert.deepEqual(Object.keys(row).sort(),['available','capacity','cart_id','cart_name','reserved','shift','usage_date'].sort());
  return row;
}
assert.equal((await publicRow()).available,8,'Solicitação pendente não ocupa saldo');
ok(await ti.client.rpc('review_teacher_request',{p_request_id:requestA,p_approve:true}),'Aprovar A');
assert.equal((await publicRow()).available,6,'Aprovação ocupa saldo');
assert.deepEqual(ok(await a.client.from('reservations').select('id').eq('cart_id',cart.id),'Professor não lê reserva administrativa'),[]);
const alerts=ok(await a.client.from('user_notifications').select('id,recipient_user_id').eq('request_id',requestA),'Notificação A');
assert.ok(alerts.length>0);assert.ok(alerts.every(x=>x.recipient_user_id===a.id));
assert.deepEqual(ok(await b.client.from('user_notifications').select('id').eq('request_id',requestA),'B não lê aviso A'),[]);
assert.equal(ok(await b.client.rpc('mark_notification_read',{p_notification_id:alerts[0].id}),'B não marca aviso A'),false);
ok(await ti.client.rpc('unlink_teacher_account',{p_user_id:a.id}),'Revogar A');
assert.deepEqual(await own(a),[],'JWT anterior não mantém acesso às solicitações');
denied(await a.client.rpc('submit_teacher_request',args),'JWT revogado não solicita');
console.log('PASS: 4 identidades Auth reais, RLS e RPCs, isolamento A/B, consulta anon, aprovação, saldo, notificações e revogação.');
