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
 if(admin)ok(await root.from('admin_users').insert({user_id:user.id,display_name:'TI manutenção'}),'Autorizar');
 const db=createClient(url,config.ANON_KEY,opts);ok(await db.auth.signInWithPassword({email,password}),'Login');
 return {db,email,id:user.id};
}
const a=await account('ti-a',true),b=await account('ti-b',true),teacher=await account('prof');
const db=a.db;
async function add(t,v){return ok(await db.from(t).insert(v).select('*').single(),'Cadastrar '+t);}
const cart=await add('carts',{code:'MAN-'+tag,name:'Carrinho de teste',capacity:10});
const requester=await add('requesters',{name:'Professor manutenção '+tag});
ok(await db.rpc('link_teacher_account',{p_requester_id:requester.id,p_email:teacher.email}),'Vincular');
const d=new Date(Date.now()+14*86400000);while(d.getUTCDay()!==1)d.setUTCDate(d.getUTCDate()+1);
const day=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+1);const next=d.toISOString().slice(0,10);
const maintenance={p_cart_id:cart.id,p_start:day,p_end:day,p_shifts:['MATUTINO'],p_reason:'Teste interno'};
const reserve={p_requester_id:requester.id,p_cart_id:cart.id,p_mode:'PARCIAL',p_quantity:2,p_dates:[day],p_shifts:['MATUTINO'],p_needs_mouse:false,p_notes:null,p_notebook_ids:[]};
const balance=async (shift='MATUTINO')=>ok(await anon.rpc('public_cart_availability',{p_start:day,p_end:day}),'Saldo').find(p=>p.cart_id===cart.id&&p.shift===shift);
fail(await teacher.db.rpc('schedule_maintenance',maintenance),'Professor sem permissão');
fail(await anon.from('maintenance_windows').select('*'),'Anon sem acesso');
const first=ok(await db.rpc('create_reservation',reserve),'Reserva');
fail(await db.rpc('schedule_maintenance',maintenance),'Não sobrepor reserva existente');
ok(await db.rpc('cancel_reservation',{p_reservation_id:first}),'Cancelar');
const id=ok(await db.rpc('schedule_maintenance',maintenance),'Programar');
assert.equal((await balance()).available,0);assert.equal((await balance()).capacity,0);
assert.equal((await balance('VESPERTINO')).available,10);
assert.deepEqual(ok(await teacher.db.from('maintenance_windows').select('*'),'RLS professor'),[]);
const preview=ok(await teacher.db.rpc('preview_teacher_availability',{p_cart_id:cart.id,p_dates:[day],p_shifts:['MATUTINO']}),'Prévia');
assert.equal(preview[0].remaining,0);
fail(await db.rpc('create_reservation',reserve),'Criação bloqueada');
fail(await db.rpc('create_reservation',{...reserve,p_dates:[day,next]}),'Grupo inteiro bloqueado');
const unaffected=ok(await db.rpc('create_reservation',{...reserve,p_dates:[next]}),'Reserva fora da janela');
fail(await db.rpc('update_reservation',{...reserve,p_reservation_id:unaffected}),'Edição bloqueada');
const pending=ok(await teacher.db.rpc('submit_teacher_request',{p_cart_id:cart.id,p_mode:'PARCIAL',p_quantity:2,p_dates:[day],p_shifts:['MATUTINO'],p_needs_mouse:false,p_notes:null}),'Pedido pendente');
fail(await db.rpc('review_teacher_request',{p_request_id:pending,p_approve:true}),'Aprovação bloqueada');
assert.equal(ok(await db.from('reservation_requests').select('status').eq('id',pending).single(),'Estado').status,'PENDENTE');
ok(await db.rpc('close_maintenance',{p_id:id,p_reason:'Resolvido'}),'Encerrar');
assert.equal((await balance()).available,10);
fail(await db.rpc('close_maintenance',{p_id:id,p_reason:'Duplicado'}),'Encerramento duplicado');
const history=ok(await db.from('maintenance_windows').select('*').eq('id',id).single(),'Histórico');
assert.equal(history.created_by,a.id);assert.equal(history.closed_by,a.id);
for(let i=0;i<3;i++){
 const c=await add('carts',{code:'RACE-MAN-'+tag+'-'+i,name:'Concorrência manutenção '+i,capacity:10});
 const [m,r]=await Promise.all([a.db.rpc('schedule_maintenance',{...maintenance,p_cart_id:c.id}),b.db.rpc('create_reservation',{...reserve,p_cart_id:c.id})]);
 assert.equal(Number(!m.error)+Number(!r.error),1,'Somente uma operação concorrente deve confirmar');
 const rows=ok(await anon.rpc('public_cart_availability',{p_start:day,p_end:day}),'Saldo concorrente');
 const slot=rows.find(x=>x.cart_id===c.id&&x.shift==='MATUTINO');
 assert.equal(slot.available,m.error?8:0);
}
console.log('PASS F3.2: RLS, conflitos, atomicidade, prévias, encerramento, auditoria e concorrência.');

const nb=await add('notebook_codes',{cart_id:cart.id,code:'IND-'+tag});
const individual={...maintenance,p_notebook_id:nb.id};
fail(await teacher.db.rpc('schedule_notebook_maintenance',individual),'Professor sem permissão de manutenção individual');
const partial=ok(await db.rpc('schedule_notebook_maintenance',individual),'Programar notebook');
assert.equal((await balance()).capacity,9);
assert.equal((await balance()).available,9);
assert.equal((await balance('VESPERTINO')).available,10);
const teacherSchedule=ok(await teacher.db.rpc('teacher_maintenance_schedule',{p_start:day,p_end:day}),'Consulta docente de manutenção');
const own=teacherSchedule.find(x=>x.id===partial);
assert.equal(own.notebook_count,1);
assert.ok(!('reason' in own)&&!('notebook_id' in own)&&!('created_by' in own));
fail(await anon.rpc('teacher_maintenance_schedule',{p_start:day,p_end:day}),'Anon sem acesso ao calendário de manutenção');
fail(await db.rpc('schedule_notebook_maintenance',individual),'Duplicidade de manutenção');
fail(await db.rpc('create_reservation',{...reserve,p_quantity:10}),'Reserva maior que capacidade efetiva');
fail(await db.rpc('create_reservation',{...reserve,p_notebook_ids:[nb.id]}),'Notebook em manutenção não pode ser atribuído');
const availableReservation=ok(await db.rpc('create_reservation',{...reserve,p_quantity:9}),'Reserva parcial usa saldo efetivo');
assert.equal((await balance()).available,0);
ok(await db.rpc('close_maintenance',{p_id:partial,p_reason:'Resolvido'}),'Encerrar notebook');
assert.equal((await balance()).available,1);
ok(await db.rpc('cancel_reservation',{p_reservation_id:availableReservation}),'Cancelar reserva de teste');
assert.equal((await balance()).capacity,10);
console.log('PASS MANUTENCAO INDIVIDUAL: capacidade efetiva, conflito, isolamento docente, encerramento.');
