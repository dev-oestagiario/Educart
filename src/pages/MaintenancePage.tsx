import DateRangeFields from '../components/DateRangeFields';
import {useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Feedback,LoadingState,EmptyState} from '../components/Feedback';
import {RecordTrail,RecordDetail,DetailFields} from '../components/RecordDetail';
import RecordsHeader from '../components/RecordsHeader';
import {supabase,type Cart,type Notebook} from '../lib/supabase';
import {fetchCatalogRows} from '../lib/catalog';
import {SHIFTS,shiftLabel,todayInSaoPaulo,showDate,type Shift} from '../lib/reservations';
import {errorMessage} from '../lib/validation';

type Window={id:string;cart_id:string;notebook_id?:string|null;start_date:string;end_date:string;shifts:Shift[];reason:string;closed_at:string|null;close_reason:string|null};
export default function MaintenancePage(){
 const qc=useQueryClient(), today=todayInSaoPaulo();
 const carts=useQuery({queryKey:['carts'],queryFn:()=>fetchCatalogRows<Cart>('carts')});
 const windows=useQuery({queryKey:['maintenance'],queryFn:async()=>{
   const rows:Window[]=[];
   for(let offset=0;;offset+=250){
     const {data,error}=await supabase.from('maintenance_windows').select('*').order('start_date',{ascending:false}).order('id').range(offset,offset+249);
     if(error)throw error; const page=(data??[]) as Window[];rows.push(...page);if(page.length<250)return rows;
   }
 }});
 const [form,setForm]=useState(false),[cart,setCart]=useState(''),[start,setStart]=useState(today),[end,setEnd]=useState('');
 const [notebook,setNotebook]=useState('');
 const notebooks=useQuery({queryKey:['notebooks','maintenance',cart],enabled:!!cart,queryFn:()=>fetchCatalogRows<Notebook>('notebook_codes',true,cart)});
 const allNotebooks=useQuery({queryKey:['notebooks','maintenance-labels'],queryFn:()=>fetchCatalogRows<Notebook>('notebook_codes')});
 const [shifts,setShifts]=useState<Shift[]>([...SHIFTS]),[reason,setReason]=useState('');
 const [selected,setSelected]=useState<string|null>(null),[search,setSearch]=useState(''),[status,setStatus]=useState('all');
 const [closing,setClosing]=useState<string|null>(null),[closeReason,setCloseReason]=useState('');
 const [notice,setNotice]=useState<{error:boolean;text:string}|null>(null);
 const refresh=()=>{void qc.invalidateQueries();};
 const mutation=useMutation({mutationFn:async(action:'schedule'|'close')=>{
   const result=action==='schedule'
     ?await (notebook?supabase.rpc('schedule_notebook_maintenance',{p_cart_id:cart,p_notebook_id:notebook,p_start:start,p_end:end||start,p_shifts:shifts,p_reason:reason.trim()}):supabase.rpc('schedule_maintenance',{p_cart_id:cart,p_start:start,p_end:end||start,p_shifts:shifts,p_reason:reason.trim()}))
     :await supabase.rpc('close_maintenance',{p_id:closing,p_reason:closeReason.trim()});
   if(result.error)throw result.error;
   return action;
 },onSuccess:async action=>{await qc.invalidateQueries({queryKey:['maintenance']});setForm(false);setClosing(null);setNotice({error:false,text:action==='schedule'?'Manutenção programada.':'Manutenção encerrada; disponibilidade liberada.'});refresh();},onError:e=>setNotice({error:true,text:errorMessage(e)})});
 function open(){setSelected(null);setCart('');setNotebook('');setStart(today);setEnd('');setShifts([...SHIFTS]);setReason('');setNotice(null);setClosing(null);setForm(true);}
 function submit(e:FormEvent){e.preventDefault();if(!mutation.isPending){setNotice(null);mutation.mutate('schedule');}}
 const record=windows.data?.find(m=>m.id===selected);
 const list=()=>{if(!mutation.isPending){setForm(false);setClosing(null);setSelected(null);setNotice(null);}};
 const cartName=(id:string)=>carts.data?.find(c=>c.id===id)?.name??'Carrinho';
 const scope=(m:Window)=>m.notebook_id?'Notebook '+(allNotebooks.data?.find(n=>n.id===m.notebook_id)?.code??'identificado'):'Carrinho completo';
 const label=(m:Window)=>m.closed_at?'Encerrada':m.end_date<today?'Período concluído':m.start_date>today?'Programada':'Em janela de manutenção';
 const filtered=(windows.data??[]).filter(m=>(cartName(m.cart_id)+' '+scope(m)+' '+m.reason).toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))&&(status==='all'||(status==='closed'?!!m.closed_at:status==='current'?!m.closed_at&&m.start_date<=today&&m.end_date>=today:status==='future'?!m.closed_at&&m.start_date>today:!m.closed_at&&m.end_date<today)));
 return <div className="records-page">
  {(form||selected)&&<RecordTrail module="Manutenção" current={form?'Nova manutenção':closing?'Encerrar':'Detalhes'} onBack={list} busy={mutation.isPending}/>}
  <RecordsHeader title={form?'Programar manutenção':closing?'Encerrar manutenção':selected?'Detalhes da manutenção':'Manutenção'} description="Controle as janelas de indisponibilidade dos carrinhos sem cancelar reservas existentes."
    actionLabel={form?'Voltar para manutenção':closing?'Voltar aos detalhes':selected?'Voltar à listagem':'Nova manutenção'} actionKind={form||selected?'back':'add'} busy={mutation.isPending} onAction={()=>closing?setClosing(null):form||selected?list():open()}/>
  {notice&&<Feedback kind={notice.error?'error':'success'}>{notice.text}</Feedback>}
  {form?<section className="panel records-form-panel"><h2>Dados da manutenção</h2><form className="form-stack" onSubmit={submit}>
   <label className="field"><span>Carrinho</span><select value={cart} onChange={e=>{setCart(e.target.value);setNotebook('');}} required><option value="">Selecione um carrinho</option>{(carts.data??[]).filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label className="field"><span>Equipamento em manutenção</span><select value={notebook} onChange={e=>setNotebook(e.target.value)} disabled={!cart||notebooks.isFetching||!!notebooks.error}><option value="">Carrinho completo</option>{(notebooks.data??[]).filter(n=>n.cart_id===cart&&n.active).map(n=><option key={n.id} value={n.id}>{n.code}</option>)}</select></label>
   {notebooks.error&&<Feedback kind="error">Não foi possível consultar os notebooks identificados.</Feedback>}
   <DateRangeFields id="maintenance-period" start={start} end={end} min={today} onChange={(a,b)=>{setStart(a);setEnd(b);}}/>
   <fieldset className="ds-fieldset"><legend>Turnos afetados</legend><div className="ds-check-list">{SHIFTS.map(s=><label key={s}><input type="checkbox" checked={shifts.includes(s)} onChange={e=>setShifts(old=>e.target.checked?[...old,s]:old.filter(x=>x!==s))}/> {shiftLabel[s]}</label>)}</div></fieldset>
   <label className="field"><span>Motivo interno</span><textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <p className="form-hint">O equipamento selecionado ficará indisponível nos turnos escolhidos. Um notebook reduz a capacidade em uma unidade; o carrinho completo bloqueia todas as unidades. Conflitos com reservas confirmadas impedem o cadastro.</p>
   <div className="records-form-actions"><button className="primary" disabled={mutation.isPending||!cart||!shifts.length||!reason.trim()}>Programar manutenção</button><button type="button" className="ghost" disabled={mutation.isPending} onClick={()=>setForm(false)}>Cancelar</button></div>
  </form></section>:selected?record?closing?<section className="panel records-form-panel"><h2>Encerrar janela de manutenção</h2><p>{cartName(record.cart_id)} · {showDate(record.start_date)} a {showDate(record.end_date)}</p><form className="form-stack" onSubmit={e=>{e.preventDefault();if(!mutation.isPending)mutation.mutate('close')}}><label className="field"><span>Motivo do encerramento</span><textarea value={closeReason} maxLength={1000} required onChange={e=>setCloseReason(e.target.value)}/></label><div className="records-form-actions"><button className="primary" disabled={mutation.isPending||!closeReason.trim()}>Confirmar encerramento</button><button type="button" className="ghost" disabled={mutation.isPending} onClick={()=>setClosing(null)}>Cancelar</button></div></form></section>:
 <RecordDetail title={cartName(record.cart_id)} actions={!record.closed_at&&<button className="primary" disabled={mutation.isPending} onClick={()=>{setClosing(record.id);setCloseReason('');setNotice(null)}}>Encerrar</button>}>
  <DetailFields fields={[{label:'Equipamento',value:scope(record)},{label:'Situação',value:label(record)},{label:'Período',value:showDate(record.start_date)+' a '+showDate(record.end_date)},{label:'Turnos',value:record.shifts.map(s=>shiftLabel[s]).join(', ')},{label:'Motivo interno',value:record.reason},...(record.closed_at?[{label:'Encerramento',value:record.close_reason??'Não informado'}]:[])]}/>
 </RecordDetail>:windows.isLoading?<LoadingState>Carregando manutenção…</LoadingState>:<EmptyState>Manutenção não encontrada.</EmptyState>:<section className="panel records-panel"><h2>Janelas de manutenção</h2>
 <div className="record-list-filters"><label className="field"><span>Buscar manutenção</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Carrinho ou motivo"/></label><label className="field"><span>Situação</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todas</option><option value="current">Vigentes</option><option value="future">Programadas</option><option value="past">Período concluído</option><option value="closed">Encerradas</option></select></label></div>
 {windows.isLoading||carts.isLoading?<LoadingState>Carregando manutenção…</LoadingState>:windows.error||carts.error?<Feedback kind="error">{errorMessage(windows.error||carts.error)}</Feedback>:!filtered.length?<EmptyState>{windows.data?.length?'Nenhuma manutenção neste recorte.':'Nenhuma manutenção cadastrada.'}</EmptyState>:<div className="item-list">{filtered.map(m=><article className="item records-item" key={m.id}><div><strong>{cartName(m.cart_id)} · {label(m)}</strong><span>{scope(m)} · {showDate(m.start_date)} até {showDate(m.end_date)} · {m.shifts.map(s=>shiftLabel[s]).join(', ')}</span></div><button type="button" className="secondary" onClick={()=>{setSelected(m.id);setNotice(null)}}>Ver detalhes</button></article>)}</div>}
 </section>}
 </div>;
}
