import {Feedback} from '../components/Feedback';
import {lazy,Suspense,useMemo,useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {CalendarDays,ClipboardList,LogOut,Send,ShieldCheck,Bell,Settings,Wrench} from 'lucide-react';
import {supabase,type Cart} from '../lib/supabase';
import {addCalendarDays,expandReservationDates,isWeekday,SHIFTS,shiftLabel,showDate,todayInSaoPaulo,type Shift} from '../lib/reservations';
import {requestStatusLabel,validateTeacherRequest,type TeacherRequest} from '../lib/teacherRequests';
import NotificationBell from '../components/NotificationBell';
import BrandLogo from '../components/BrandLogo';
import ThemeToggle from '../components/ThemeToggle';
import {collectPages} from '../lib/queryRefresh';
import {fetchCatalogRows} from '../lib/catalog';
import RecordsHeader from '../components/RecordsHeader';
import DateRangeFields from '../components/DateRangeFields';
import WeeklyRecurrence from '../components/WeeklyRecurrence';
import {defaultWeeklyPattern,expandWeeklyPattern} from '../lib/recurrence';
import TeacherAvailabilityPreview from '../components/TeacherAvailabilityPreview';
const NotificationsPage = lazy(()=>import('./NotificationsPage'));
const TeacherCalendar=lazy(()=>import('./PublicCartAvailabilityPage'));
const SettingsPage=lazy(()=>import('./SettingsPage'));
const TeacherMaintenance=lazy(()=>import('./TeacherMaintenancePage'));


type Props={requesterId:string;userId:string;email:string;onLogout:()=>void};
function firstWeekday(today:string){
  let day=today;
  while(!isWeekday(day))day=addCalendarDays(day,1);
  return day;
}

const explain=(error:unknown)=>{
  if(error instanceof Error)return error.message;
  if(error && typeof error==='object' && 'message' in error && typeof error.message==='string')return error.message;
  return 'Não foi possível concluir a operação.';
};

export default function TeacherPortal({requesterId,userId,email,onLogout}:Props){
  const qc=useQueryClient();
  const today=todayInSaoPaulo(),firstDay=firstWeekday(today);
  const [limit,setLimit]=useState(50);
  const [page,setPage]=useState<'requests'|'calendar'|'maintenance'|'notifications'|'settings'>('requests');
  const [screen,setScreen]=useState<'list'|'form'>('list');
  const [cartId,setCartId]=useState('');
  const [mode,setMode]=useState<'PARCIAL'|'COMPLETA'>('PARCIAL');
  const [quantity,setQuantity]=useState('1');
  const [dateMode,setDateMode]=useState<'intervalo'|'avulsas'|'weekly'>('intervalo');
  const [pattern,setPattern]=useState(()=>defaultWeeklyPattern(firstDay));
  const [start,setStart]=useState(firstDay),[end,setEnd]=useState('');
  const [individualDate,setIndividualDate]=useState(firstDay);
  const [individualDates,setIndividualDates]=useState<string[]>([]);
  const [shifts,setShifts]=useState<Shift[]>(['MATUTINO']);
  const [needsMouse,setNeedsMouse]=useState(false);
  const [notes,setNotes]=useState('');
  const [message,setMessage]=useState<{kind:'success'|'error';text:string}|null>(null);
  const [withdrawId,setWithdrawId]=useState<string|null>(null);
  const carts=useQuery({
    queryKey:['teacher-active-carts'],queryFn:async()=>{
      return fetchCatalogRows<Cart>('carts',true);
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
      return collectPages<TeacherRequest>((a,b)=>supabase.from('reservation_requests')
        .select('id,requester_id,requested_by,cart_id,mode,quantity,dates,shifts,needs_mouse,notes,status,review_notes,reservation_id,created_at,reviewed_at')
        .order('created_at',{ascending:false}).order('id').range(a,b));
    }
  });
  const cart=carts.data?.find(x=>x.id===cartId);
  const requestedQuantity=mode==='COMPLETA'?(cart?.capacity??0):Number(quantity);
  const days=useMemo(()=>{
    try {return dateMode==='weekly'?expandWeeklyPattern(pattern,todayInSaoPaulo()):expandReservationDates(dateMode,start,end||start,individualDates,todayInSaoPaulo());}
    catch{return [];}
  },[dateMode,pattern,start,end,individualDates,today]);
  const create=useMutation({
    mutationFn:async()=>{
      const selected=dateMode==='weekly'?expandWeeklyPattern(pattern,todayInSaoPaulo()):expandReservationDates(dateMode,start,end||start,individualDates,todayInSaoPaulo());
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
      setNotes('');setNeedsMouse(false);setIndividualDates([]);setScreen('list');
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
  function newRequest(){
    setCartId('');setMode('PARCIAL');setQuantity('1');
    setDateMode('intervalo');setPattern(defaultWeeklyPattern(firstDay));setStart(firstDay);setEnd('');
    setIndividualDate(firstDay);setIndividualDates([]);setShifts(['MATUTINO']);
    setNeedsMouse(false);setNotes('');setMessage(null);setScreen('form');
  }
  function returnToList(){if(create.isPending)return;setScreen('list');setMessage(null);}
  function send(e:FormEvent){e.preventDefault();if(create.isPending)return;setMessage(null);create.mutate();}
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
    <a href="#teacher-main" className="skip-link" onClick={e=>{e.preventDefault();document.getElementById("teacher-main")?.focus();}}>Ir ao conteúdo</a>
    <header className="teacher-topbar">
      <BrandLogo tone="light"/>
      <div className="teacher-account"><ThemeToggle/><span title={email}>{teacher.data?.name??'Portal do professor'}</span>
        <NotificationBell userId={userId} onOpen={()=>setPage('notifications')}/>
        <button type="button" className="ghost" onClick={onLogout}><LogOut size={17} aria-hidden="true"/> Sair</button>
      </div>
    </header>
    <main id="teacher-main" tabIndex={-1} className="teacher-main">
      <nav aria-label="Menu do professor" className="teacher-portal-nav">{([['requests','Solicitações',ClipboardList],['calendar','Calendário',CalendarDays],['maintenance','Manutenções',Wrench],['notifications','Notificações',Bell],['settings','Configurações',Settings]] as const).map(([id,label,Icon])=><button key={id} type="button" className={page===id?'primary':'ghost'} aria-current={page===id?'page':undefined} onClick={()=>setPage(id)}><Icon size={17} aria-hidden="true"/>{label}</button>)}</nav>
      {page==='calendar'?<Suspense fallback={<p role="status">Carregando calendário…</p>}><TeacherCalendar embedded/></Suspense>:page==='maintenance'?<Suspense fallback={<p role="status">Carregando manutenções…</p>}><TeacherMaintenance/></Suspense>:page==='settings'?<Suspense fallback={<p role="status">Carregando configurações…</p>}><SettingsPage userId={userId}/></Suspense>:page==='notifications'?<Suspense fallback={<p role="status">Carregando notificações…</p>}>
        <NotificationsPage userId={userId} audience="teacher" onReturn={()=>setPage('requests')} onViewRequests={()=>setPage('requests')}/>
      </Suspense>:<>

      {screen==='list'?<>
        <RecordsHeader title="Pedidos de reserva"
          description="Consulte suas solicitações e acompanhe as decisões da equipe de TI."
          actionLabel="Nova solicitação" onAction={newRequest}/>
        {message&&<Feedback kind={message.kind}>{message.text}</Feedback>}
        <section className="panel teacher-portal-list" aria-labelledby="teacher-requests-heading">
          <h2 id="teacher-requests-heading"><ClipboardList size={19} aria-hidden="true"/> Minhas solicitações</h2>
          {requests.isLoading?<p role="status">Carregando solicitações…</p>:
            requests.error?<Feedback kind="error">Não foi possível consultar suas solicitações.</Feedback>:
            !requests.data?.length?<p className="empty">Você ainda não enviou solicitações.</p>:
            <div className="teacher-request-list">{requests.data.slice(0,limit).map(req=>
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
          {(requests.data?.length??0)>limit&&<button className="secondary" onClick={()=>setLimit(n=>n+50)}>Carregar mais solicitações</button>}
        </section>

        <p className="teacher-footer"><CalendarDays size={17} aria-hidden="true"/> Para alterações em reservas já confirmadas, procure a equipe de TI.</p>
      </>:<>
        <RecordsHeader editing title="Solicitar laboratório móvel"
          description="Informe o carrinho, as datas e os turnos. A TI confirmará a reserva após verificar a disponibilidade."
          actionLabel="Voltar para solicitações" busy={create.isPending} onAction={returnToList}/>
        <div className="panel muted-panel teacher-portal-note"><ShieldCheck size={20} aria-hidden="true"/>
          <p><strong>Solicitação não é reserva.</strong> Pedidos pendentes não ocupam notebooks; a TI revalida a disponibilidade antes de aprovar.</p>
        </div>
        {message&&<Feedback kind={message.kind}>{message.text}</Feedback>}
        <section className="panel teacher-portal-form" aria-labelledby="request-form-heading">
          <h2 id="request-form-heading"><Send size={19} aria-hidden="true"/> Nova solicitação</h2>
          <form className="form-stack" onSubmit={send}>
            <label className="field" htmlFor="teacher-cart"><span>Carrinho</span>
              <select id="teacher-cart" required value={cartId} onChange={e=>setCartId(e.target.value)}>
                <option value="">Selecione um carrinho</option>
                {(carts.data??[]).map(c=><option key={c.id} value={c.id}>{c.name} — {c.capacity} notebooks</option>)}
              </select>
            </label>
            {carts.error&&<Feedback kind="error">Não foi possível consultar os carrinhos.</Feedback>}
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
            <fieldset className="ds-fieldset"><legend>Datas da solicitação</legend>
              <div className="ds-choice-group" role="group" aria-label="Opções de datas">{([['intervalo','Início e fim'],['avulsas','Dias avulsos'],['weekly','Recorrência semanal']] as const).map(([id,label])=><button key={id} type="button" className={dateMode===id?'primary':'ghost'} aria-pressed={dateMode===id} onClick={()=>setDateMode(id)}>{label}</button>)}</div>
            </fieldset>
            {dateMode==='weekly'?<WeeklyRecurrence id="teacher-weekly" value={pattern} today={todayInSaoPaulo()} shifts={shifts.length} disabled={create.isPending} onChange={setPattern}/>:
            dateMode==='intervalo'?
              <DateRangeFields id="teacher-period" min={today} start={start} end={end} disabled={create.isPending} onChange={(a,b)=>{setStart(a);setEnd(b);}}/>
:
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
            <TeacherAvailabilityPreview cartId={cartId} dates={days} shifts={shifts} quantity={requestedQuantity}/>
            <label className="reservation-check"><input type="checkbox" checked={needsMouse} onChange={e=>setNeedsMouse(e.target.checked)}/> Preciso de mouse</label>
            <label className="field" htmlFor="teacher-notes"><span>Observações (opcional)</span>
              <textarea id="teacher-notes" rows={3} maxLength={1000} value={notes}
                onChange={e=>setNotes(e.target.value)} placeholder="Informações para a equipe de TI"/>
            </label>
            <button className="primary" type="submit" disabled={create.isPending||!!carts.error||!cart||!days.length||!shifts.length||!Number.isInteger(requestedQuantity)||requestedQuantity<1||requestedQuantity>cart.capacity}>
              {create.isPending?'Enviando…':'Enviar solicitação para aprovação'}</button>
          </form>
        </section>

      </>}
      </>}
    </main>
  </div>;
}
