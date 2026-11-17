import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const config=JSON.parse(readFileSync(process.argv[2]??'.env.homologacao.status.local','utf8'));
assert.match(config.API_URL??'',/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/);
assert.ok(config.ANON_KEY&&config.SERVICE_ROLE_KEY);
const url='http://127.0.0.1:54321',opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const root=createClient(url,config.SERVICE_ROLE_KEY,opts),anon=createClient(url,config.ANON_KEY,opts);
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
if([0,6].includes(new Date(day+'T12:00Z').getUTCDay())){console.log('SKIP F3.3: retirada somente em dia útil');process.exit(0);}
const tag=randomUUID().slice(0,12);
function ok(r,label){assert.equal(r.error,null,label+': '+(r.error?.code??''));return r.data;}
function fail(r,label){assert.ok(r.error,label);}
async function account(role,admin=false){
 const email=role+'-'+tag+'@educart.example',password=randomBytes(24).toString('hex');
 const {user}=ok(await root.auth.admin.createUser({email,password,email_confirm:true}),'Conta sintética');
 if(admin)ok(await root.from('admin_users').insert({user_id:user.id,display_name:'TI movimentações'}),'Vínculo TI');
 const db=createClient(url,config.ANON_KEY,opts);ok(await db.auth.signInWithPassword({email,password}),'Auth');
 return {db,id:user.id,email};
}
const a=await account('ti-a',true),b=await account('ti-b',true),t=await account('prof'),db=a.db;
async function add(table,values){return ok(await db.from(table).insert(values).select('id').single(),'Cadastro '+table);}
const cart=await add('carts',{code:'MOV-'+tag,name:'Movimentação sintética',capacity:10});
const requester=await add('requesters',{name:'Professor sintético '+tag});
const code=await add('notebook_codes',{cart_id:cart.id,code:'NB-MOV-'+tag});
ok(await db.rpc('link_teacher_account',{p_requester_id:requester.id,p_email:t.email}),'Vínculo');
async function period(shift){
 const res=ok(await db.rpc('create_reservation',{p_requester_id:requester.id,p_cart_id:cart.id,p_mode:'PARCIAL',p_quantity:6,p_dates:[day],p_shifts:[shift],p_needs_mouse:false,p_notes:null,p_notebook_ids:[]}),'Reserva');
 return ok(await db.from('reservation_periods').select('id').eq('reservation_id',res).single(),'Período').id;
}
const pa=await period('MATUTINO'),pb=await period('VESPERTINO');
const pickup=(id,key=randomUUID())=>({p_period_id:id,p_key:key,p_quantity:6,p_notebook_ids:[code.id],p_responsible:'Responsável sintético',p_condition:'BOA',p_notes:null});
const x=pickup(pa),y=pickup(pb);
fail(await t.db.rpc('register_equipment_pickup',x),'Professor não retira pela RPC');
const results=await Promise.all([a.db.rpc('register_equipment_pickup',x),b.db.rpc('register_equipment_pickup',y)]);
assert.equal(results.filter(r=>!r.error).length,1,'Disputa interturnos por capacidade/código');
const winner=results[0].error?1:0,winningArgs=winner?y:x,winningDb=winner?b.db:a.db;
const id=results[winner].data;
assert.equal(ok(await winningDb.rpc('register_equipment_pickup',winningArgs),'Retry retirada'),id);
assert.equal(ok(await db.from('equipment_movements').select('id').eq('cart_id',cart.id),'Único registro').length,1);
const returns={p_movement_id:id,p_key:randomUUID(),p_responsible:'Responsável retorno',p_condition:'RESSALVA',p_notes:'Conferência sintética'};
const duplicate=await Promise.all([a.db.rpc('register_equipment_return',returns),b.db.rpc('register_equipment_return',returns)]);
assert.ok(duplicate.every(r=>!r.error&&r.data===id),'Mesmo pedido de devolução é idempotente');
fail(await db.rpc('register_equipment_return',{...returns,p_key:randomUUID()}),'Nova devolução não duplica');
const loserArgs=winner?x:y;
ok(await db.rpc('register_equipment_pickup',loserArgs),'Código e capacidade liberados após retorno');
assert.deepEqual(ok(await t.db.from('equipment_movements').select('id'),'RLS professor'),[]);
fail(await anon.from('equipment_movements').select('*'),'RLS público');
const rows=ok(await anon.rpc('public_cart_availability',{p_start:day,p_end:day}),'Saldo planejado');
assert.equal(rows.find(r=>r.cart_id===cart.id&&r.shift==='MATUTINO').available,4);
console.log('PASS F3.3 real: concorrência, idempotência, devolução, nova retirada, Auth e disponibilidade planejada.');
