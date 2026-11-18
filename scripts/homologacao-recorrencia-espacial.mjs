import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {validateLocalConfig} from './homologacao-preflight.mjs';
const config=JSON.parse(readFileSync('.env.homologacao.status.local','utf8'));
const url=validateLocalConfig(config,process.env);
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const root=createClient(url,config.SERVICE_ROLE_KEY,opts),anon=createClient(url,config.ANON_KEY,opts);
const tag=randomUUID().slice(0,12);
function ok(r,label){assert.equal(r.error,null,label+': '+(r.error?.code??''));return r.data;}
function deny(r,label){assert.ok(r.error,label);}
function forbidden(r,label){assert.equal(r.error?.code,'42501',label+' deve falhar por permissão, não por RPC ausente.');}
async function account(role,admin=false){
 const email=role+'-'+tag+'@educart.example',password=randomBytes(24).toString('hex');
 const {user}=ok(await root.auth.admin.createUser({email,password,email_confirm:true}),'Conta local');
 if(admin)ok(await root.from('admin_users').insert({user_id:user.id,display_name:'TI sintética'}),'Provisionamento');
 const db=createClient(url,config.ANON_KEY,opts);
 const login=ok(await db.auth.signInWithPassword({email,password}),'Auth');assert.equal(login.user.id,user.id);assert.ok(login.session.access_token);return {db,email,id:user.id};
}
const ti=await account('ti',true),teacher=await account('prof'),unlinked=await account('sem-vinculo'),db=ti.db;
async function add(table,values){return ok(await db.from(table).insert(values).select('id').single(),'Cadastro '+table).id;}
const requester=await add('requesters',{name:'Professor série '+tag});
ok(await db.rpc('link_teacher_account',{p_requester_id:requester,p_email:teacher.email}),'Vínculo');
const cart=await add('carts',{name:'Carrinho série '+tag,code:'SER-'+tag,capacity:10});
const monday=new Date(Date.now()+21*86400000);while(monday.getUTCDay()!==1)monday.setUTCDate(monday.getUTCDate()+1);
const days=[0,7,14].map(n=>new Date(monday.getTime()+n*86400000).toISOString().slice(0,10));
const args=(quantity,dates)=>({p_requester_id:requester,p_cart_id:cart,p_mode:'PARCIAL',p_quantity:quantity,p_dates:dates,p_shifts:['MATUTINO','VESPERTINO'],p_needs_mouse:false,p_notes:null,p_notebook_ids:[]});
const conflict=ok(await db.rpc('create_reservation',args(10,[days[1]])),'Conflito inicial');
deny(await db.rpc('create_reservation',args(2,days)),'Lote inteiro deve falhar');
const reservations=ok(await db.from('reservations').select('id').eq('cart_id',cart),'Cabeçalhos');
assert.equal(reservations.length,1);assert.equal(reservations[0].id,conflict);
const series=ok(await db.rpc('create_reservation',args(2,[days[0],days[2]])),'Série com exceção');
const periods=async id=>ok(await db.from('reservation_periods').select('id,active,quantity').eq('reservation_id',id),'Períodos');
assert.equal((await periods(series)).filter(x=>x.active).length,4);
ok(await db.rpc('update_reservation',{...args(3,[days[0],days[2]]),p_reservation_id:series}),'Editar série');
assert.equal((await periods(series)).filter(x=>x.active&&x.quantity===3).length,4);
const date=days[0],shift='MATUTINO';
const summary=ok(await db.rpc('spatial_cart_summary',{p_date:date,p_shift:shift}),'Resumo espacial').find(x=>x.cart_id===cart);
assert.equal(summary.available,7);assert.equal(summary.reserved,3);assert.equal(summary.availability_status,'PARTIAL');
const detail=ok(await db.rpc('spatial_cart_details',{p_cart_id:cart,p_date:date,p_shift:shift}),'Detalhe espacial');
assert.equal(detail.summary.cart_id,cart);
for(const client of [teacher.db,unlinked.db,anon]){
 forbidden(await client.rpc('spatial_cart_summary',{p_date:date,p_shift:shift}),'Resumo privado');
 forbidden(await client.rpc('spatial_cart_details',{p_cart_id:cart,p_date:date,p_shift:shift}),'Detalhe privado');
}
const publicRow=ok(await anon.rpc('public_cart_availability',{p_start:date,p_end:date}),'Consulta pública').find(x=>x.cart_id===cart&&x.shift===shift);
assert.equal(publicRow.available,summary.available);assert.equal(publicRow.reserved,summary.reserved);
assert.ok(!('requester_id' in publicRow)&&!('scene_id' in publicRow));
const pref=ok(await teacher.db.rpc('get_email_preference'),'Preferência');
assert.equal(pref.channel_enabled,false);
forbidden(await ti.db.rpc('claim_email_batch',{p_limit:10}),'Fila privada');
ok(await db.rpc('cancel_reservation',{p_reservation_id:series}),'Cancelar série');
assert.equal((await periods(series)).filter(x=>x.active).length,0);assert.equal((await periods(conflict)).filter(x=>x.active).length,2);
console.log('PASS F3.5/F5.1: JWT real, série atômica, exceção, edição/cancelamento, resumo/detalhe privado, consistência pública, canal externo desligado.');
