import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const config=JSON.parse(readFileSync(process.argv[2]??'.env.homologacao.status.local','utf8'));
assert.match(config.API_URL??'',/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
assert.ok(config.ANON_KEY&&config.SERVICE_ROLE_KEY);
const url='http://127.0.0.1:54321',opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const root=createClient(url,config.SERVICE_ROLE_KEY,opts),anon=createClient(url,config.ANON_KEY,opts);
const tag=randomUUID().slice(0,12);
function ok(r,label){assert.equal(r.error,null,label+': '+(r.error?.code??''));return r.data;}
function fail(r,label){assert.ok(r.error,label);}
async function account(role,admin=false){
 const email=role+'-'+tag+'@educart.example',password=randomBytes(24).toString('hex');
 const {user}=ok(await root.auth.admin.createUser({email,password,email_confirm:true}),'Conta');
 if(admin)ok(await root.from('admin_users').insert({user_id:user.id,display_name:'TI locais'}),'Autorizar');
 const db=createClient(url,config.ANON_KEY,opts);ok(await db.auth.signInWithPassword({email,password}),'Login');
 return {db,email,id:user.id};
}
const ti=await account('ti',true),teacher=await account('prof'),db=ti.db;
async function insert(t,v){return ok(await db.from(t).insert(v).select('*').single(),'Cadastro '+t);}
async function change(t,id,v){return ok(await db.from(t).update(v).eq('id',id).select('*').single(),'Editar '+t);}
const c1=await insert('campuses',{name:'Campus fictício A '+tag}),c2=await insert('campuses',{name:'Campus fictício B '+tag});
const b1=await insert('campus_blocks',{campus_id:c1.id,name:'Bloco A'}),b2=await insert('campus_blocks',{campus_id:c2.id,name:'Bloco A'});
const r1=await insert('campus_rooms',{block_id:b1.id,name:'Sala 1'}),r2=await insert('campus_rooms',{block_id:b2.id,name:'Sala 1'});
fail(await db.from('campuses').insert({name:c1.name.toUpperCase()}),'Campus duplicado');
fail(await db.from('campus_rooms').insert({block_id:b1.id,name:'sala 1'}),'Sala duplicada');
const cart=await insert('carts',{code:'LOC-'+tag,name:'Carrinho fictício',capacity:10});
const requester=await insert('requesters',{name:'Professor fictício '+tag});
ok(await db.rpc('link_teacher_account',{p_requester_id:requester.id,p_email:teacher.email}),'Vincular');
ok(await db.from('cart_storage_locations').upsert({cart_id:cart.id,room_id:r1.id}),'Local guarda');
for(const t of ['campuses','campus_blocks','campus_rooms','cart_storage_locations']){
 fail(await anon.from(t).select('*'),'Anon não acessa '+t);
 assert.deepEqual(ok(await teacher.db.from(t).select('*'),'Professor sem acesso '+t),[]);
}
fail(await teacher.db.from('cart_storage_locations').insert({cart_id:cart.id,room_id:r2.id}),'Professor não altera guarda');
const date=new Date(Date.now()+21*86400000);while([0,6].includes(date.getUTCDay()))date.setUTCDate(date.getUTCDate()+1);
const day=date.toISOString().slice(0,10);
const args={p_requester_id:requester.id,p_cart_id:cart.id,p_mode:'PARCIAL',p_quantity:2,p_dates:[day],p_shifts:['MATUTINO'],p_needs_mouse:false,p_notes:null,p_notebook_ids:[],p_room_id:r2.id};
fail(await teacher.db.rpc('create_reservation_with_room',args),'Professor não chama RPC de TI');
const booking=ok(await db.rpc('create_reservation_with_room',args),'Reserva com sala');
const saved=()=>db.from('reservations').select('destination_room_id,destination_label').eq('id',booking).single().then(x=>ok(x,'Ler destino'));
assert.equal((await saved()).destination_room_id,r2.id);
assert.equal((await saved()).destination_label,c2.name+' / Bloco A / Sala 1');
assert.equal(ok(await db.from('cart_storage_locations').select('room_id').eq('cart_id',cart.id).single(),'Guarda').room_id,r1.id);
await change('campus_rooms',r2.id,{name:'Sala renomeada'});
assert.equal((await saved()).destination_label,c2.name+' / Bloco A / Sala 1','Histórico preservado');
await change('campuses',c2.id,{active:false});
fail(await db.rpc('create_reservation_with_room',args),'Campus inativo impede novo destino');
fail(await db.from('cart_storage_locations').upsert({cart_id:cart.id,room_id:r2.id}),'Guarda inativa rejeitada');
assert.equal(ok(await db.from('reservations').select('id').eq('cart_id',cart.id),'Não gravar parcialmente').length,1);
await change('campuses',c2.id,{active:true});
ok(await db.rpc('update_reservation_with_room',{...args,p_reservation_id:booking,p_room_id:r1.id}),'Editar destino');
assert.equal((await saved()).destination_room_id,r1.id);
const events=ok(await db.from('reservation_events').select('event_type,before_data,after_data').eq('reservation_id',booking),'Auditoria');
assert.equal(events.find(e=>e.event_type==='EDICAO').after_data.destination_room_id,r1.id);
assert.equal(events.find(e=>e.event_type==='EDICAO').before_data.destination_room_id,r2.id);
const request=ok(await teacher.db.rpc('submit_teacher_request',{p_cart_id:cart.id,p_mode:'PARCIAL',p_quantity:1,p_dates:[day],p_shifts:['MATUTINO'],p_needs_mouse:false,p_notes:null}),'Pedido');
const approved=ok(await db.rpc('review_teacher_request_with_room',{p_request_id:request,p_approve:true,p_review_notes:null,p_room_id:r2.id}),'Aprovar com destino');
assert.equal(ok(await db.from('reservations').select('destination_room_id').eq('id',approved).single(),'Destino aprovação').destination_room_id,r2.id);
const publicRows=ok(await anon.rpc('public_cart_availability',{p_start:day,p_end:day}),'Consulta pública');
const slot=publicRows.find(r=>r.cart_id===cart.id&&r.shift==='MATUTINO');
assert.equal(slot.available,7);
assert.deepEqual(Object.keys(slot).sort(),['usage_date','cart_id','cart_name','capacity','shift','reserved','available'].sort());
ok(await db.rpc('update_reservation_with_room',{...args,p_reservation_id:booking,p_room_id:null}),'Limpar destino');
assert.equal((await saved()).destination_room_id,null);
console.log('PASS F3.1: hierarquia, duplicidades, permissões, separação guarda/destino, inativos, histórico, aprovação, saldo e privacidade pública.');
