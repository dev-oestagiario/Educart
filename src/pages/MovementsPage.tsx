import {useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Feedback,LoadingState,EmptyState} from '../components/Feedback';
import RecordsHeader from '../components/RecordsHeader';
import {supabase,type Cart,type Requester,type Notebook} from '../lib/supabase';
import {fetchCatalogRows} from '../lib/catalog';
import {todayInSaoPaulo,showDate,shiftLabel,type Shift} from '../lib/reservations';
import {errorMessage} from '../lib/validation';

type Condition='BOA'|'RESSALVA';
type Period={id:string;reservation_id:string;cart_id:string;usage_date:string;shift:Shift;quantity:number;reservations:{requester_id:string;status:string;destination_label:string|null}|null};
type Movement={id:string;period_id:string;reservation_id:string;cart_id:string;requester_id:string;usage_date:string;shift:Shift;quantity:number;notebook_ids:string[];notebook_codes:string[];pickup_at:string;pickup_responsible:string;pickup_condition:Condition;pickup_notes:string|null;return_at:string|null;return_responsible:string|null;return_condition:Condition|null;return_notes:string|null};
type Selection={kind:'pickup';period:Period}|{kind:'return';movement:Movement};
const fmt=(date:string)=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(date));
const conditionLabel=(c:Condition|null)=>c==='BOA'?'Sem ressalvas':c==='RESSALVA'?'Com ressalva':'—';
async function readPages<T>(page:(from:number,to:number)=>PromiseLike<{data:unknown;error:unknown}>):Promise<T[]>{
 const rows:T[]=[];for(let i=0;;i+=250){const {data,error}=await page(i,i+249);if(error)throw error;const list=(data??[]) as T[];rows.push(...list);if(list.length<250)return rows;}
}
const movementFields='id,period_id,reservation_id,cart_id,requester_id,usage_date,shift,quantity,notebook_ids,notebook_codes,pickup_at,pickup_responsible,pickup_condition,pickup_notes,return_at,return_responsible,return_condition,return_notes';
export default function MovementsPage(){
 const today=todayInSaoPaulo(),qc=useQueryClient();
 const [tab,setTab]=useState<'today'|'pending'|'history'>('today'),[date,setDate]=useState(today);
 const [selection,setSelection]=useState<Selection|null>(null),[key,setKey]=useState('');
 const [quantity,setQuantity]=useState(1),[codes,setCodes]=useState<string[]>([]),[responsible,setResponsible]=useState(''),[condition,setCondition]=useState<Condition>('BOA'),[notes,setNotes]=useState('');
 const [notice,setNotice]=useState<{error:boolean;text:string}|null>(null);
 const carts=useQuery({queryKey:['carts'],queryFn:()=>fetchCatalogRows<Cart>('carts')});
 const requesters=useQuery({queryKey:['requesters'],queryFn:()=>fetchCatalogRows<Requester>('requesters')});
 const periods=useQuery({queryKey:['movement-periods',today],queryFn:()=>readPages<Period>((a,b)=>supabase.from('reservation_periods').select('id,reservation_id,cart_id,usage_date,shift,quantity,reservations(requester_id,status,destination_label)').eq('usage_date',today).eq('active',true).order('shift').order('id').range(a,b))});
 const movements=useQuery({queryKey:['movements',tab,tab==='history'?date:today],queryFn:()=>readPages<Movement>((a,b)=>{
  let q=supabase.from('equipment_movements').select(movementFields);
  q=tab==='pending'?q.is('return_at',null):q.eq('usage_date',tab==='history'?date:today);
  return q.order('pickup_at',{ascending:false}).order('id').range(a,b);
 })});
 const cartId=selection?.kind==='pickup'?selection.period.cart_id:'';
 const notebooks=useQuery({queryKey:['movement-notebooks',cartId],enabled:!!cartId,queryFn:()=>readPages<Notebook>((a,b)=>supabase.from('notebook_codes').select('id,code,cart_id,active,created_at').eq('cart_id',cartId).eq('active',true).order('code').order('id').range(a,b))});
 const saved=useMutation({mutationFn:async()=>{
  if(!selection)throw new Error('Selecione uma movimentação.');
  const shared={p_key:key,p_responsible:responsible.trim(),p_condition:condition,p_notes:notes.trim()||null};
  const response=selection.kind==='pickup'
   ?await supabase.rpc('register_equipment_pickup',{...shared,p_period_id:selection.period.id,p_quantity:quantity,p_notebook_ids:codes})
   :await supabase.rpc('register_equipment_return',{...shared,p_movement_id:selection.movement.id});
  if(response.error)throw response.error;return selection.kind;
 },onSuccess:kind=>{setSelection(null);setNotice({error:false,text:kind==='pickup'?'Retirada registrada.':'Devolução registrada.'});void qc.invalidateQueries({queryKey:['movements']});void qc.invalidateQueries({queryKey:['movement-periods']});},onError:e=>setNotice({error:true,text:errorMessage(e)})});
 function open(s:Selection){
  setSelection(s);setKey(crypto.randomUUID());setQuantity(s.kind==='pickup'?s.period.quantity:s.movement.quantity);setCodes([]);
  setResponsible('');setCondition('BOA');setNotes('');setNotice(null);
 }
 function submit(e:FormEvent){e.preventDefault();if(!saved.isPending)saved.mutate();}
 const cartName=(id:string)=>carts.data?.find(c=>c.id===id)?.name??'Carrinho';
 const teacherName=(id:string)=>requesters.data?.find(c=>c.id===id)?.name??'Solicitante';
 const valid=responsible.trim().length>=2&&(condition==='BOA'||!!notes.trim())&&(selection?.kind==='return'||(selection?.kind==='pickup'&&Number.isInteger(quantity)&&quantity>=1&&quantity<=selection.period.quantity&&codes.length<=quantity&&!notebooks.error&&!notebooks.isLoading));
 function movementCard(m:Movement){return <article className="item records-item" key={m.id}>
  <div><strong>{cartName(m.cart_id)} · {m.return_at?'Devolvida':'Pendente de devolução'}</strong>
   <span>{teacherName(m.requester_id)} · {showDate(m.usage_date)} · {shiftLabel[m.shift]} · {m.quantity} notebook(s)</span>
   <span>Retirada: {fmt(m.pickup_at)} · {m.pickup_responsible} · {conditionLabel(m.pickup_condition)}</span>
   {m.notebook_codes.length>0&&<span>Códigos registrados: {m.notebook_codes.join(', ')}</span>}
   {m.quantity>m.notebook_codes.length&&<span>{m.quantity-m.notebook_codes.length} sem código registrado</span>}
   {m.pickup_notes&&<span>Observação da retirada: {m.pickup_notes}</span>}
   {m.return_at&&<span>Devolução: {fmt(m.return_at)} · {m.return_responsible} · {conditionLabel(m.return_condition)}</span>}
   {m.return_notes&&<span>Observação da devolução: {m.return_notes}</span>}
  </div>{!m.return_at&&<button className="secondary" type="button" onClick={()=>open({kind:'return',movement:m})}>Registrar devolução</button>}
 </article>}
 return <div className="records-page">
  <RecordsHeader title="Retirada e devolução" description="Registre a entrega e o retorno efetivamente conferidos. A reserva continua sendo o planejamento, não o local físico atual." actionLabel={selection?'Voltar à listagem':'Atualizar listagem'} actionKind={selection?'back':'refresh'} busy={saved.isPending} onAction={()=>{if(selection){if(!saved.isPending)setSelection(null);}else{void qc.invalidateQueries({queryKey:['movements']});void qc.invalidateQueries({queryKey:['movement-periods']});void qc.invalidateQueries({queryKey:['carts']});void qc.invalidateQueries({queryKey:['requesters']});}}}/>
  {notice&&<Feedback kind={notice.error?'error':'success'}>{notice.text}</Feedback>}
  {selection?<section className="panel records-form-panel"><h2>{selection.kind==='pickup'?'Registrar retirada':'Registrar devolução'}</h2>
   <p>{selection.kind==='pickup'?cartName(selection.period.cart_id):cartName(selection.movement.cart_id)} · {quantity} notebook(s)</p>
   <form className="form-stack" onSubmit={submit}>
    {selection.kind==='pickup'?<>
     <label className="field" htmlFor="movement-quantity"><span>Quantidade entregue</span><input id="movement-quantity" type="number" min={1} max={selection.period.quantity} required value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
     <fieldset className="ds-fieldset"><legend>Códigos conferidos (opcional)</legend>
     {notebooks.isLoading?<p>Carregando códigos…</p>:notebooks.error?<p role="alert">Não foi possível consultar os códigos. Atualize e tente novamente.</p>:notebooks.data?.length?<div className="ds-check-list is-scrollable">{notebooks.data.map(n=><label key={n.id}><input type="checkbox" checked={codes.includes(n.id)} disabled={!codes.includes(n.id)&&codes.length>=quantity} onChange={e=>setCodes(old=>e.target.checked?[...old,n.id]:old.filter(x=>x!==n.id))}/> {n.code}</label>)}</div>:<p>Nenhum código cadastrado.</p>}
     <p className="form-hint">{codes.length} de {quantity} identificado(s). Não informe códigos que não foram conferidos.</p></fieldset>
    </>:<p className="form-hint">Confirme somente após o retorno de todos os {selection.movement.quantity} notebooks retirados. Retorno parcial não é registrado nesta versão.</p>}
    <label className="field" htmlFor="movement-responsible"><span>{selection.kind==='pickup'?'Responsável que recebeu':'Responsável que devolveu'}</span><input id="movement-responsible" required minLength={2} maxLength={160} value={responsible} onChange={e=>setResponsible(e.target.value)}/></label>
    <label className="field" htmlFor="movement-condition"><span>Condição dos equipamentos</span><select id="movement-condition" value={condition} onChange={e=>setCondition(e.target.value as Condition)}><option value="BOA">Sem ressalvas</option><option value="RESSALVA">Com ressalva</option></select></label>
    <label className="field"><span>Observação {condition==='RESSALVA'?'(obrigatória)':'(opcional)'}</span><textarea maxLength={1000} required={condition==='RESSALVA'} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    <div className="records-form-actions"><button className="primary" disabled={!valid||saved.isPending}>{saved.isPending?'Registrando…':selection.kind==='pickup'?'Confirmar retirada':'Confirmar devolução'}</button><button type="button" className="ghost" disabled={saved.isPending} onClick={()=>setSelection(null)}>Cancelar</button></div>
   </form></section>:<>
   <div className="panel ds-choice-group" role="group" aria-label="Recorte das movimentações">{([['today','Hoje'],['pending','Pendentes de devolução'],['history','Histórico']] as const).map(([id,label])=><button key={id} className={tab===id?'primary':'secondary'} aria-pressed={tab===id} onClick={()=>{setTab(id);setNotice(null);}}>{label}</button>)}</div>
   {tab==='history'&&<label className="field"><span>Data da reserva</span><input type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value)}}/></label>}
   <section className="panel records-panel"><h2>{tab==='today'?'Períodos de hoje':tab==='pending'?'Equipamentos pendentes':'Histórico de movimentações'}</h2>
   {movements.error||(tab==='today'&&periods.error)||carts.error||requesters.error?<p role="alert" className="notice error">Não foi possível carregar os registros.</p>:movements.isLoading||(tab==='today'&&periods.isLoading)?<LoadingState>Carregando movimentações…</LoadingState>:
    <div className="item-list">{(movements.data??[]).map(movementCard)}
    {tab==='today'&&(periods.data??[]).filter(p=>p.reservations?.status==='CONFIRMADA'&&!movements.data?.some(m=>m.period_id===p.id)).map(p=><article className="item records-item" key={p.id}><div><strong>{cartName(p.cart_id)} · Aguardando retirada</strong><span>{teacherName(p.reservations!.requester_id)} · {shiftLabel[p.shift]} · {p.quantity} notebook(s) reservados</span></div><button className="secondary" onClick={()=>open({kind:'pickup',period:p})}>Registrar retirada</button></article>)}
    {!movements.data?.length&&(tab!=='today'||!periods.data?.length)&&<EmptyState>Nenhum registro neste recorte.</EmptyState>}</div>}
   </section></>}
 </div>;
}
