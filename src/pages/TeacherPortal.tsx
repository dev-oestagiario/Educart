import {useMemo,useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {CalendarDays,ClipboardList,Laptop,LogOut,Send,ShieldCheck} from 'lucide-react';
import {supabase,type Cart} from '../lib/supabase';
import {addCalendarDays,expandReservationDates,isWeekday,SHIFTS,shiftLabel,showDate,todayInSaoPaulo,type Shift} from '../lib/reservations';
import {requestStatusLabel,validateTeacherRequest,type TeacherRequest} from '../lib/teacherRequests';

type Props={requesterId:string;email:string;onLogout:()=>void};
const today=todayInSaoPaulo();
function firstWeekday(){
  let day=today;
  while(!isWeekday(day))day=addCalendarDays(day,1);
  return day;
}
const firstDay=firstWeekday();
const explain=(error:unknown)=>error instanceof Error?error.message:'Não foi possível concluir a operação.';

export default function TeacherPortal({requesterId,email,onLogout}:Props){
  const qc=useQueryClient();
  const [cartId,setCartId]=useState('');
  const [mode,setMode]=useState<'PARCIAL'|'COMPLETA'>('PARCIAL');
  const [quantity,setQuantity]=useState('1');
  const [dateMode,setDateMode]=useState<'intervalo'|'avulsas'>('intervalo');
  const [start,setStart]=useState(firstDay),[end,setEnd]=useState(firstDay);
  const [individualDate,setIndividualDate]=useState(firstDay);
  const [individualDates,setIndividualDates]=useState<string[]>([]);
  const [shifts,setShifts]=useState<Shift[]>(['MATUTINO']);
  const [needsMouse,setNeedsMouse]=useState(false);
  const [notes,setNotes]=useState('');
  const [message,setMessage]=useState<{kind:'success'|'error';text:string}|null>(null);
  const [withdrawId,setWithdrawId]=useState<string|null>(null);
  const carts=useQuery({
    queryKey:['teacher-active-carts'],queryFn:async()=>{
      const {data,error}=await supabase.from('carts').select('id,code,name,capacity,active,created_at')
        .eq('active',true).order('name');
      if(error)throw error;
      return (data??[]) as Cart[];
    }
  });
  const teacher=useQuery({
    queryKey:['teacher-own-requester',requesterId],queryFn:async()=>{
      const {data,error}=await supabase.from('requesters').select('id,name').eq('id',requesterId).maybeSingle();
      if(error)throw error;return data;
    }
  });
  const requests=useQuery({
    queryKey:['teacher-requests'],queryFn:async()=>{
      const {data,error}=await supabase.from('reservation_requests')
        .select('id,requester_id,requested_by,cart_id,mode,quantity,dates,shifts,needs_mouse,notes,status,review_notes,reservation_id,created_at,reviewed_at')
        .order('created_at',{ascending:false}).limit(100);
      if(error)throw error;
      return (data??[]) as TeacherRequest[];
    }
  });
  const cart=carts.data?.find(x=>x.id===cartId);
  const requestedQuantity=mode==='COMPLETA'?(cart?.capacity??0):Number(quantity);
  const days=useMemo(()=>{
    try {return expandReservationDates(dateMode,start,end,individualDates,today);}
    catch{return [];}
  },[dateMode,start,end,individualDates]);
  const create=useMutation({
    mutationFn:async()=>{
      const selected=expandReservationDates(dateMode,start,end,individualDates,today);
      const input=validateTeacherRequest({
        cart_id:cartId,mode,quantity:requestedQuantity,dates:selected,
        shifts,needs_mouse:needsMouse,notes:notes.trim()
      },cart?.capacity??0);
      const {error}=await supabase.rpc('submit_teacher_request',{
        p_cart_id:input.cart_id,p_mode:input.mode,p_quantity:input.quantity,
        p_dates:input.dates,p_shifts:input.shifts,p_needs_mouse:input.needs_mouse,
        p_notes:input.notes||null
      });
      if(error)throw error;
    },
    onSuccess:()=>{
      setMessage({kind:'success',text:'Solicitação enviada à TI. Enquanto estiver pendente, não ocupa a capacidade do carrinho.'});
      setNotes('');setNeedsMouse(false);setIndividualDates([]);
      void qc.invalidateQueries({queryKey:['teacher-requests']});
    },
    onError:e=>setMessage({kind:'error',text:explain(e)})
  });
  const withdraw=useMutation({
    mutationFn:async(id:string)=>{
      const {error}=await supabase.rpc('withdraw_teacher_request',{p_request_id:id});
      if(error)throw error;
    },
    onSuccess:()=>{
      setWithdrawId(null);
      setMessage({kind:'success',text:'Solicitação pendente retirada.'});
      void qc.invalidateQueries({queryKey:['teacher-requests']});
    },
    onError:e=>setMessage({kind:'error',text:explain(e)})
  });
  function send(e:FormEvent){e.preventDefault();setMessage(null);create.mutate();}
  function toggleShift(value:Shift,checked:boolean){
    setShifts(old=>checked?[...new Set([...old,value])]:old.filter(x=>x!==value));
  }
  function addDate(){
    if(!isWeekday(individualDate)||individualDate<today){
      setMessage({kind:'error',text:'Selecione uma data útil de hoje em diante.'});return;
    }
    setIndividualDates(old=>[...new Set([...old,individualDate])].sort());
    setMessage(null);
  }
  return <div className="teacher-shell">
    <a href="#teacher-main" className="skip-link">Ir ao conteúdo</a>
    <header className="teacher-topbar">
      <div className="brand"><span className="brand-mark"><Laptop size={21} aria-hidden="true"/></span><span>educart</span></div>
      <div className="teacher-account"><span title={email}>{teacher.data?.name??'Portal do professor'}</span>
        <button type="button" className="ghost" onClick={onLogout}><LogOut size={17} aria-hidden="true"/> Sair</button>
      </div>
    </header>
    <main id="teacher-main" tabIndex={-1} className="teacher-main">
      <div className="page-header">
        <span className="eyebrow">ACESSO DO PROFESSOR</span>
        <h1>Solicitar laboratório móvel</h1>
        <p>Escolha o carrinho, as datas e os turnos. A TI avaliará sua solicitação antes de confirmar a reserva.</p>
      </div>
      <div className="panel muted-panel"><ShieldCheck size={20} aria-hidden="true"/>
        <p><strong>Solicitação não é reserva.</strong> Pedidos pendentes não ocupam notebooks; a TI verifica a disponibilidade novamente antes de aprovar.</p>
      </div>
      {message&&<p role={message.kind==='error'?'alert':'status'} className={'notice '+message.kind}>{message.text}</p>}
      <div className="teacher-layout">
        <section className="panel" aria-labelledby="request-form-heading">
          <h2 id="request-form-heading"><Send size={19} aria-hidden="true"/> Nova solicitação</h2>
          <form className="form-stack" onSubmit={send}>
            <label className="field" htmlFor="teacher-cart"><span>Carrinho</span>
              <select id="teacher-cart" required value={cartId} onChange={e=>setCartId(e.target.value)}>
                <option value="">Selecione um carrinho</option>
                {(carts.data??[]).map(c=><option key={c.id} value={c.id}>{c.name} — {c.capacity} notebooks</option>)}
              </select>
            </label>
            {carts.error&&<p role="alert" className="notice error">Não foi possível consultar os carrinhos.</p>}
            <fieldset className="reservation-fieldset">
              <legend>Modalidade</legend>
              <label><input type="radio" name="teacher-mode" checked={mode==='PARCIAL'}
                onChange={()=>setMode('PARCIAL')}/> Notebooks avulsos</label>
              <label><input type="radio" name="teacher-mode" checked={mode==='COMPLETA'}
                onChange={()=>setMode('COMPLETA')}/> Carrinho completo</label>
            </fieldset>
            {mode==='PARCIAL'?
              <label className="field" htmlFor="teacher-quantity"><span>Quantidade de notebooks</span>
                <input type="number" id="teacher-quantity" min={1} max={cart?.capacity??1}
                  required value={quantity} onChange={e=>setQuantity(e.target.value)}/>
              </label>:
              <p className="reservation-subtle">Carrinho completo: <strong>{cart?.capacity??'—'} notebooks por turno</strong>.</p>}
            <fieldset className="reservation-fieldset">
              <legend>Turnos</legend>
              <div className="reservation-options">
                {SHIFTS.map(shift=><label key={shift}><input type="checkbox" checked={shifts.includes(shift)}
                  onChange={e=>toggleShift(shift,e.target.checked)}/>{shiftLabel[shift]}</label>)}
              </div>
            </fieldset>
            <label className="field" htmlFor="teacher-date-mode"><span>Datas da solicitação</span>
              <select id="teacher-date-mode" value={dateMode}
                onChange={e=>setDateMode(e.target.value as 'intervalo'|'avulsas')}>
                <option value="intervalo">Período (somente dias úteis)</option>
                <option value="avulsas">Datas avulsas</option>
              </select>
            </label>
            {dateMode==='intervalo'?
              <div className="reservation-dates">
                <label className="field" htmlFor="teacher-start"><span>De</span><input id="teacher-start" type="date" min={today} value={start} onChange={e=>setStart(e.target.value)}/></label>
                <label className="field" htmlFor="teacher-end"><span>Até</span><input id="teacher-end" type="date" min={today} value={end} onChange={e=>setEnd(e.target.value)}/></label>
              </div>:
              <div className="form-stack">
                <div className="request-date-add"><label className="field" htmlFor="teacher-single-date"><span>Escolher data</span>
                  <input type="date" id="teacher-single-date" min={today} value={individualDate} onChange={e=>setIndividualDate(e.target.value)}/></label>
                  <button type="button" className="secondary" onClick={addDate}>Adicionar data</button>
                </div>
                <div className="reservation-pills">{individualDates.map(day=><button className="reservation-pill"
                  type="button" key={day} aria-label={'Remover '+showDate(day)}
                  onClick={()=>setIndividualDates(old=>old.filter(d=>d!==day))}>{showDate(day)} ×</button>)}</div>
              </div>}
            <p className="form-hint">Prévia: <strong>{days.length} dia(s) útil(eis)</strong> × {shifts.length} turno(s) = <strong>{days.length*shifts.length} período(s)</strong>.</p>
            <label className="reservation-check"><input type="checkbox" checked={needsMouse} onChange={e=>setNeedsMouse(e.target.checked)}/> Preciso de mouse</label>
            <label className="field" htmlFor="teacher-notes"><span>Observações (opcional)</span>
              <textarea id="teacher-notes" rows={3} maxLength={1000} value={notes}
                onChange={e=>setNotes(e.target.value)} placeholder="Informações para a equipe de TI"/>
            </label>
            <button className="primary" type="submit" disabled={create.isPending||!!carts.error||!cart||!days.length||!shifts.length}>
              {create.isPending?'Enviando…':'Enviar solicitação para aprovação'}</button>
          </form>
        </section>
        <section className="panel" aria-labelledby="teacher-requests-heading">
          <h2 id="teacher-requests-heading"><ClipboardList size={19} aria-hidden="true"/> Minhas solicitações</h2>
          {requests.isLoading?<p role="status">Carregando solicitações…</p>:
            requests.error?<p role="alert" className="notice error">Não foi possível consultar suas solicitações.</p>:
            !requests.data?.length?<p className="empty">Você ainda não enviou solicitações.</p>:
            <div className="teacher-request-list">{requests.data.map(req=>
              <article className="booking-item" key={req.id}>
                <div className="teacher-request-heading"><strong>{carts.data?.find(c=>c.id===req.cart_id)?.name??'Carrinho'}</strong>
                  <span className={'teacher-status '+req.status.toLowerCase()}>{requestStatusLabel[req.status]}</span></div>
                <p className="reservation-subtle">{req.mode==='COMPLETA'?'Carrinho completo':req.quantity+' notebooks'} · {req.shifts.map(s=>shiftLabel[s as Shift]??s).join(', ')}</p>
                <p className="reservation-subtle">{req.dates.map(showDate).join(', ')}</p>
                <p className="reservation-subtle">Enviado em {new Date(req.created_at).toLocaleString('pt-BR')}</p>
                {req.review_notes&&<p className="form-hint"><strong>Resposta da TI:</strong> {req.review_notes}</p>}
                {req.status==='PENDENTE'&&(withdrawId===req.id?
                  <div className="booking-confirm">
                    <p>Retirar este pedido pendente? Uma reserva já aprovada não é cancelada aqui.</p>
                    <div className="reservation-actions">
                      <button type="button" className="primary" disabled={withdraw.isPending} onClick={()=>withdraw.mutate(req.id)}>Confirmar retirada</button>
                      <button type="button" className="ghost" onClick={()=>setWithdrawId(null)}>Voltar</button>
                    </div>
                  </div>:
                  <button type="button" className="text-button" onClick={()=>setWithdrawId(req.id)}>Retirar pedido pendente</button>)}
              </article>)}</div>}
        </section>
      </div>
      <p className="teacher-footer"><CalendarDays size={17} aria-hidden="true"/> Para alterações em reservas já confirmadas, procure a equipe de TI.</p>
    </main>
  </div>;
}
