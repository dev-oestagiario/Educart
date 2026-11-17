import {useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import RecordsHeader from '../components/RecordsHeader';
import {supabase,type Cart} from '../lib/supabase';
import {fetchCatalogRows} from '../lib/catalog';
import {SHIFTS,shiftLabel,todayInSaoPaulo,showDate,type Shift} from '../lib/reservations';
import {errorMessage} from '../lib/validation';

type Window={id:string;cart_id:string;start_date:string;end_date:string;shifts:Shift[];reason:string;closed_at:string|null;close_reason:string|null};
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
 const [form,setForm]=useState(false),[cart,setCart]=useState(''),[start,setStart]=useState(today),[end,setEnd]=useState(today);
 const [shifts,setShifts]=useState<Shift[]>([...SHIFTS]),[reason,setReason]=useState('');
 const [closing,setClosing]=useState<string|null>(null),[closeReason,setCloseReason]=useState('');
 const [notice,setNotice]=useState<{error:boolean;text:string}|null>(null);
 const refresh=()=>{void qc.invalidateQueries();};
 const mutation=useMutation({mutationFn:async(action:'schedule'|'close')=>{
   const result=action==='schedule'
     ?await supabase.rpc('schedule_maintenance',{p_cart_id:cart,p_start:start,p_end:end,p_shifts:shifts,p_reason:reason.trim()})
     :await supabase.rpc('close_maintenance',{p_id:closing,p_reason:closeReason.trim()});
   if(result.error)throw result.error;
   return action;
 },onSuccess:action=>{setForm(false);setClosing(null);setNotice({error:false,text:action==='schedule'?'Manutenção programada.':'Manutenção encerrada; disponibilidade liberada.'});refresh();},onError:e=>setNotice({error:true,text:errorMessage(e)})});
 function open(){setCart('');setStart(today);setEnd(today);setShifts([...SHIFTS]);setReason('');setNotice(null);setClosing(null);setForm(true);}
 function submit(e:FormEvent){e.preventDefault();setNotice(null);mutation.mutate('schedule');}
 const label=(m:Window)=>m.closed_at?'Encerrada':m.end_date<today?'Período concluído':m.start_date>today?'Programada':'Em janela de manutenção';
 return <div className="records-page">
  <RecordsHeader title={form?'Programar manutenção':'Manutenção'} description="Controle as janelas de indisponibilidade dos carrinhos sem cancelar reservas existentes."
    actionLabel={form?'Voltar para manutenção':'Nova manutenção'} onAction={()=>form?setForm(false):open()}/>
  {notice&&<p className={'notice '+(notice.error?'error':'success')} role={notice.error?'alert':'status'}>{notice.text}</p>}
  {form?<section className="panel records-form-panel"><h2>Dados da manutenção</h2><form className="form-stack" onSubmit={submit}>
   <label className="field"><span>Carrinho</span><select value={cart} onChange={e=>setCart(e.target.value)} required><option value="">Selecione um carrinho</option>{(carts.data??[]).filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label className="field"><span>Data inicial</span><input type="date" min={today} value={start} required onChange={e=>{setStart(e.target.value);if(end<e.target.value)setEnd(e.target.value)}}/></label>
   <label className="field"><span>Data final</span><input type="date" min={start} value={end} required onChange={e=>setEnd(e.target.value)}/></label>
   <fieldset><legend>Turnos afetados</legend>{SHIFTS.map(s=><label key={s} style={{display:'block',padding:'6px 0'}}><input type="checkbox" checked={shifts.includes(s)} onChange={e=>setShifts(old=>e.target.checked?[...old,s]:old.filter(x=>x!==s))}/> {shiftLabel[s]}</label>)}</fieldset>
   <label className="field"><span>Motivo interno</span><textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <p className="form-hint">O carrinho inteiro ficará indisponível nos turnos selecionados. Se houver uma reserva confirmada, resolva o conflito antes de continuar.</p>
   <div className="records-form-actions"><button className="primary" disabled={mutation.isPending||!cart||!shifts.length||!reason.trim()}>Programar manutenção</button><button type="button" className="ghost" disabled={mutation.isPending} onClick={()=>setForm(false)}>Cancelar</button></div>
  </form></section>:<section className="panel records-panel"><h2>Janelas de manutenção</h2>
   {windows.isLoading?<p role="status">Carregando manutenção…</p>:windows.error?<p role="alert" className="notice error">{errorMessage(windows.error)}</p>:!windows.data?.length?<p className="empty">Nenhuma manutenção cadastrada.</p>:<div className="item-list">{windows.data.map(m=><article className="item records-item" key={m.id}>
    <div><strong>{carts.data?.find(c=>c.id===m.cart_id)?.name??'Carrinho'} · {label(m)}</strong><span>{showDate(m.start_date)} até {showDate(m.end_date)} · {m.shifts.map(s=>shiftLabel[s]).join(', ')}</span><span>{m.reason}</span>{m.close_reason&&<span>Encerramento: {m.close_reason}</span>}</div>
    {!m.closed_at&&(closing===m.id?<form className="form-stack" onSubmit={e=>{e.preventDefault();mutation.mutate('close')}}><label className="field"><span>Motivo do encerramento</span><input value={closeReason} maxLength={1000} required onChange={e=>setCloseReason(e.target.value)}/></label><button className="primary" disabled={mutation.isPending||!closeReason.trim()}>Confirmar encerramento</button><button type="button" className="ghost" onClick={()=>setClosing(null)}>Voltar</button></form>:<button type="button" className="secondary" disabled={mutation.isPending} onClick={()=>{setClosing(m.id);setCloseReason('');setNotice(null)}}>Encerrar</button>)}
   </article>)}</div>}
  </section>}
 </div>;
}
