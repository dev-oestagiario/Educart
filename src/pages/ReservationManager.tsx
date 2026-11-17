import {useState} from 'react';
import {useInfiniteQuery,useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {ClipboardCheck, History, Pencil, XCircle} from 'lucide-react';
import {supabase, type Cart, type Requester} from '../lib/supabase';
import {showDate,shiftLabel,type Shift} from '../lib/reservations';

export type Booking={
  id:string; requester_id:string;cart_id:string;mode:'COMPLETA'|'PARCIAL';
  quantity:number;needs_mouse:boolean;notes:string|null;status:string;created_at:string;destination_room_id?:string|null;destination_label?:string|null
};
export type BookingPeriod={
  id:string;reservation_id:string;usage_date:string;shift:Shift;quantity:number;active:boolean
};
export type ReservationEdit={
  booking:Booking;dates:string[];shifts:Shift[];notebookIds:string[]
};
type BookingEvent={
  id:string;reservation_id:string;event_type:string;admin_id:string;
  occurred_at:string;before_data:unknown;after_data:unknown
};
type Props={
  carts:Cart[];requesters:Requester[];
  onEdit:(details:ReservationEdit)=>void;
  onChanged:()=>void
};
type CancelSelection={bookingId:string;periodId?:string}|null;
const today=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
const currentDay=[today.find(x=>x.type==='year')?.value,today.find(x=>x.type==='month')?.value,
  today.find(x=>x.type==='day')?.value].join('-');

export default function ReservationManager({carts,requesters,onEdit,onChanged}:Props){
  const qc=useQueryClient();
  const [selectedCancel,setSelectedCancel]=useState<CancelSelection>(null);
  const [notice,setNotice]=useState('');
  const [loadingEdit,setLoadingEdit]=useState<string|null>(null);
  const [showHistory,setShowHistory]=useState(false);
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState<'all'|'CONFIRMADA'|'CANCELADA'>('all');
  const pageSize=50;

  const reservations=useInfiniteQuery({
    queryKey:['reservations','paginated'],
    initialPageParam:0,
    queryFn:async({pageParam}):Promise<Booking[]>=>{
      const from=pageParam*pageSize;
      const {data,error}=await supabase.from('reservations')
        .select('id,requester_id,cart_id,mode,quantity,needs_mouse,notes,status,created_at,destination_room_id,destination_label')
        .order('created_at',{ascending:false}).range(from,from+pageSize-1);
      if(error)throw error;
      return (data??[]) as Booking[];
    },
    getNextPageParam:(lastPage,allPages)=>lastPage.length===pageSize?allPages.length:undefined
  });
  const bookings=reservations.data?.pages.flatMap(page=>page)??[];
  const filter=search.trim().toLocaleLowerCase('pt-BR');
  const filteredBookings=bookings.filter(booking=>{
    if(statusFilter!=='all'&&booking.status!==statusFilter)return false;
    if(!filter)return true;
    const teacher=requesters.find(x=>x.id===booking.requester_id)?.name??'';
    const cart=carts.find(x=>x.id===booking.cart_id)?.name??'';
    return (teacher+' '+cart+' '+booking.status+' '+booking.quantity)
      .toLocaleLowerCase('pt-BR').includes(filter);
  });
  const periods=useQuery({
    queryKey:['booking-periods'],
    queryFn:async()=>{
      const rows:BookingPeriod[]=[];
      for(let offset=0;;offset+=250){
        const {data,error}=await supabase.from('reservation_periods')
          .select('id,reservation_id,usage_date,shift,quantity,active')
          .order('usage_date',{ascending:true}).order('id').range(offset,offset+249);
        if(error)throw error;
        const page=(data??[]) as BookingPeriod[];
        rows.push(...page);if(page.length<250)return rows;
      }
    }
  });
  const events=useQuery({
    queryKey:['reservation-events'],
    enabled:showHistory,
    queryFn:async()=>{
      const {data,error}=await supabase.from('reservation_events')
        .select('id,reservation_id,event_type,admin_id,occurred_at,before_data,after_data')
        .order('occurred_at',{ascending:false}).limit(100);
      if(error)throw error;
      return (data??[]) as BookingEvent[];
    }
  });
  const admins=useQuery({
    queryKey:['admin-users'],
    enabled:showHistory,
    queryFn:async()=>{
      const {data,error}=await supabase.from('admin_users').select('user_id,display_name');
      if(error)throw error;
      return data??[];
    }
  });
  const cancel=useMutation({
    mutationFn:async({bookingId,periodId}:NonNullable<CancelSelection>)=>{
      const {error}=periodId
        ?await supabase.rpc('cancel_reservation_period',{p_period_id:periodId})
        :await supabase.rpc('cancel_reservation',{p_reservation_id:bookingId});
      if(error)throw error;
    },
    onSuccess:()=>{
      setNotice('Cancelamento registrado. O saldo dos períodos afetados foi liberado.');
      setSelectedCancel(null);
      onChanged();
      void qc.invalidateQueries({queryKey:['reservations']});
      void qc.invalidateQueries({queryKey:['booking-periods']});
      void qc.invalidateQueries({queryKey:['reservation-events']});
    },
    onError:error=>setNotice(error instanceof Error?error.message:'Falha ao cancelar.')
  });
  async function startEdit(booking:Booking) {
    const active=(periods.data??[]).filter(p=>p.reservation_id===booking.id&&p.active);
    if(!active.length){setNotice('Esta reserva não possui períodos ativos.');return;}
    if(active.some(p=>p.usage_date<currentDay)){
      setNotice('Reservas com utilização já transcorrida não podem ser editadas nesta versão.');return;
    }
    const dates=[...new Set(active.map(p=>p.usage_date))].sort();
    const shifts=[...new Set(active.map(p=>p.shift))];
    if(active.length!==dates.length*shifts.length){
      setNotice('Este agrupamento possui exceções por turno. A edição conjunta poderia recriar um período cancelado; cancele os períodos desejados ou cadastre uma nova reserva.');return;
    }
    setLoadingEdit(booking.id);setNotice('');
    try {
      const ids=active.map(p=>p.id);
      const notebookIds=new Set<string>();
      for(let i=0;i<ids.length;i+=50){
        for(let offset=0;;offset+=250){
          const {data,error}=await supabase.from('reservation_notebooks')
            .select('notebook_id,period_id').in('period_id',ids.slice(i,i+50)).eq('active',true)
            .order('period_id').order('notebook_id').range(offset,offset+249);
          if(error)throw error;
          const page=data??[];
          for(const row of page)notebookIds.add(row.notebook_id);
          if(page.length<250)break;
        }
      }
      onEdit({booking,dates,shifts,notebookIds:[...notebookIds]});
    } catch(error){
      setNotice(error instanceof Error?error.message:'Não foi possível preparar a edição.');
    } finally {setLoadingEdit(null);}
  }
  return <>
    <section className="panel reservation-list-panel" aria-labelledby="booking-list-title">
      <div className="reservation-list-toolbar">
        <h2 id="booking-list-title"><ClipboardCheck size={19} aria-hidden="true"/> {showHistory?'Histórico de alterações':'Reservas cadastradas'}</h2>
        <button type="button" className="secondary reservation-history-toggle"
          onClick={()=>setShowHistory(previous=>!previous)}>
          <History size={17} aria-hidden="true"/>
          {showHistory?'Voltar à lista':'Ver histórico'}
        </button>
      </div>
      {notice&&<p className="notice" role="status">{notice}</p>}
      {!showHistory&&<>
        <div className="reservation-list-filters">
          <label className="field" htmlFor="reservation-search"><span>Buscar reserva</span>
            <input id="reservation-search" type="search" value={search}
              placeholder="Professor, carrinho ou quantidade"
              onChange={event=>setSearch(event.target.value)}/>
          </label>
          <label className="field" htmlFor="reservation-status-filter"><span>Situação</span>
            <select id="reservation-status-filter" value={statusFilter}
              onChange={event=>setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">Todas as situações</option>
              <option value="CONFIRMADA">Confirmadas</option>
              <option value="CANCELADA">Canceladas</option>
            </select>
          </label>
        </div>
        {reservations.isLoading||periods.isLoading?<p role="status">Carregando reservas…</p>:
        reservations.error||periods.error?<p className="notice error" role="alert">Não foi possível consultar reservas e períodos.</p>:
        !bookings.length?<p className="empty">Nenhuma reserva registrada. Use “Nova reserva” para criar a primeira.</p>:
        !filteredBookings.length?<p className="empty">Nenhuma reserva corresponde à busca ou ao filtro.</p>:
        <div className="booking-list">{filteredBookings.map(booking=>{
          const active=(periods.data??[]).filter(p=>p.reservation_id===booking.id&&p.active);
          const allFuture=active.length>0&&active.every(p=>p.usage_date>currentDay);
          const editable=active.length>0&&active.every(p=>p.usage_date>=currentDay);
          const requester=requesters.find(x=>x.id===booking.requester_id)?.name??'Professor';
          const cart=carts.find(x=>x.id===booking.cart_id)?.name??'Carrinho';
          const isConfirmWhole=selectedCancel?.bookingId===booking.id&&!selectedCancel.periodId;
          return <article className="booking-item" key={booking.id}>
            <div className="booking-info"><strong>{requester}</strong>
              <span>{cart} · {booking.quantity} notebooks · {booking.mode==='COMPLETA'?'Completa':'Parcial'}</span>
              {booking.destination_label&&<span>Sala de utilização: {booking.destination_label}</span>}
              <span>{booking.needs_mouse?'Precisa de mouse · ':''}{booking.status}</span>
            </div>
            {active.length>0&&<div className="booking-periods">{active.map(p=><div key={p.id} className="booking-period">
              <span>{showDate(p.usage_date)} · {shiftLabel[p.shift]} · {p.quantity} notebooks</span>
              <button type="button" className="text-button" disabled={p.usage_date<=currentDay||cancel.isPending}
                title={p.usage_date<=currentDay?'Cancelamento apenas até o dia anterior':undefined}
                onClick={()=>setSelectedCancel({bookingId:booking.id,periodId:p.id})}>
                Cancelar período
              </button>
            </div>)}</div>}
            {booking.status==='CONFIRMADA'&&<div className="reservation-actions">
              <button type="button" className="secondary" disabled={!editable||!!loadingEdit}
                onClick={()=>void startEdit(booking)}><Pencil size={15} aria-hidden="true"/>
                {loadingEdit===booking.id?'Abrindo…':'Editar'}
              </button>
              <button type="button" className="ghost" disabled={!allFuture||cancel.isPending}
                onClick={()=>setSelectedCancel({bookingId:booking.id})}><XCircle size={16} aria-hidden="true"/> Cancelar reserva
              </button>
            </div>}
            {selectedCancel?.bookingId===booking.id&&<div className="booking-confirm" role="group" aria-label="Confirmar cancelamento">
              <p>Confirmar cancelamento {isConfirmWhole?'da reserva inteira':'deste período'}? A operação será registrada no histórico.</p>
              <div className="reservation-actions">
                <button type="button" className="primary" disabled={cancel.isPending}
                  onClick={()=>selectedCancel&&cancel.mutate(selectedCancel)}>
                  {cancel.isPending?'Cancelando…':'Confirmar cancelamento'}
                </button>
                <button type="button" className="ghost" onClick={()=>setSelectedCancel(null)}>Voltar</button>
              </div>
            </div>}
          </article>;
        })}</div>}
        {reservations.hasNextPage&&<button type="button" className="secondary reservation-load-more"
          disabled={reservations.isFetchingNextPage} onClick={()=>void reservations.fetchNextPage()}>
          {reservations.isFetchingNextPage?'Carregando…':'Carregar mais reservas'}
        </button>}
        <p className="form-hint">Exibindo {bookings.length} reserva(s). Cancelamentos são permitidos até o dia anterior. Edições de períodos já transcorridos não são permitidas.</p>
      </>}
      {showHistory&&<div className="reservation-history-panel">
        <h3 id="booking-history-title">Auditoria de reservas</h3>
      {events.isLoading?<p role="status">Carregando histórico…</p>:
        events.error?<p role="alert" className="notice error">Falha ao consultar auditoria.</p>:
        !events.data?.length?<p className="empty">Nenhuma alteração registrada.</p>:
        <div className="booking-history">{events.data.map(e=><details key={e.id}>
          <summary><strong>{e.event_type==='CRIACAO'?'Criação':e.event_type==='EDICAO'?'Edição':'Cancelamento'}</strong>
            {' · '}{new Date(e.occurred_at).toLocaleString('pt-BR')}
            {' · '}{admins.data?.find(a=>a.user_id===e.admin_id)?.display_name??'Administrador'}</summary>
          <div className="booking-history-data"><p><strong>Antes</strong></p><pre>{JSON.stringify(e.before_data??{},null,2)}</pre>
            <p><strong>Depois</strong></p><pre>{JSON.stringify(e.after_data??{},null,2)}</pre></div>
        </details>)}</div>}
      </div>}
    </section>
  </>;
}
