import {useEffect,useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Laptop2,MousePointer2,Rotate3D} from 'lucide-react';
import {supabase,type Cart,type Notebook,type Requester} from '../lib/supabase';
import {buildCartSlots,type SlotPeriod,type SlotAssignment} from '../lib/cartScene';
import {isWeekday,showDate,todayInSaoPaulo,shiftLabel,SHIFTS,type Shift} from '../lib/reservations';
import Cart3DCanvas from './Cart3DCanvas';

type Period=SlotPeriod&{cart_id:string;usage_date:string;shift:Shift;active:boolean};
type Assignment=SlotAssignment&{active:boolean};
type Booking={id:string;requester_id:string;needs_mouse:boolean;notes:string|null};
const today=todayInSaoPaulo();

async function getActive<T>(table:'carts'|'requesters'|'notebook_codes'):Promise<T[]>{
  const {data,error}=await supabase.from(table).select('*').eq('active',true);
  if(error)throw error;
  return (data??[]) as T[];
}
export default function Visual3DPage(){
  const [cartId,setCartId]=useState('');
  const [date,setDate]=useState(today);
  const [shift,setShift]=useState<Shift>('MATUTINO');
  const [selectedPosition,setSelectedPosition]=useState<number|null>(null);
  const [show3d,setShow3d]=useState(true);
  const carts=useQuery({queryKey:['carts','3d'],queryFn:()=>getActive<Cart>('carts')});
  const teachers=useQuery({queryKey:['requesters','3d'],queryFn:()=>getActive<Requester>('requesters')});
  const notebooks=useQuery({queryKey:['notebooks','3d'],queryFn:()=>getActive<Notebook>('notebook_codes')});
  const cart=carts.data?.find(c=>c.id===cartId);
  const periods=useQuery({
    queryKey:['3d-periods',cartId,date,shift],
    enabled:!!cartId,
    queryFn:async():Promise<Period[]>=>{
      const {data,error}=await supabase.from('reservation_periods')
        .select('id,reservation_id,cart_id,usage_date,shift,quantity,active')
        .eq('cart_id',cartId).eq('usage_date',date).eq('shift',shift).eq('active',true);
      if(error)throw error;
      return (data??[]) as Period[];
    }
  });
  const periodIds=(periods.data??[]).map(p=>p.id);
  const bookingIds=[...new Set((periods.data??[]).map(p=>p.reservation_id))];
  const assignments=useQuery({
    queryKey:['3d-notebook-assignments',periodIds.join(',')],
    enabled:periodIds.length>0,
    queryFn:async():Promise<Assignment[]>=>{
      const {data,error}=await supabase.from('reservation_notebooks')
        .select('period_id,notebook_id,active').in('period_id',periodIds).eq('active',true);
      if(error)throw error;return (data??[]) as Assignment[];
    }
  });
  const bookings=useQuery({
    queryKey:['3d-bookings',bookingIds.join(',')],
    enabled:bookingIds.length>0,
    queryFn:async():Promise<Booking[]>=>{
      const {data,error}=await supabase.from('reservations')
        .select('id,requester_id,needs_mouse,notes').in('id',bookingIds);
      if(error)throw error;return (data??[]) as Booking[];
    }
  });
  const slots=useMemo(()=>buildCartSlots(cart?.capacity??0,
    (notebooks.data??[]).filter(n=>n.cart_id===cartId).map(n=>({id:n.id,code:n.code})),
    periods.data??[],assignments.data??[]
  ),[cart?.capacity,cartId,notebooks.data,periods.data,assignments.data]);
  const selected=slots.find(s=>s.position===selectedPosition);
  const booked=selected?.reservationId?bookings.data?.find(b=>b.id===selected.reservationId):null;
  const teacher=booked?teachers.data?.find(t=>t.id===booked.requester_id):null;
  const loading=periods.isLoading||carts.isLoading||notebooks.isLoading||teachers.isLoading||
    (periodIds.length>0&&assignments.isLoading)||(bookingIds.length>0&&bookings.isLoading);
  const hasError=periods.error||carts.error||notebooks.error||teachers.error||assignments.error||bookings.error;
  const ready=!loading&&!hasError;
  const reserved=slots.filter(s=>s.reserved).length;
  const remaining=slots.length-reserved;
  useEffect(()=>setSelectedPosition(null),[cartId,date,shift]);
  return <div className="visual3d-page">
    <div className="page-header"><h1>Laboratório móvel em 3D</h1>
      <p>Explore a ocupação de cada carrinho conforme os registros reais de reserva por data e turno.</p>
    </div>
    <div className="panel muted-panel"><Rotate3D size={20} aria-hidden="true"/>
      <p>Esta é uma representação ilustrativa. A capacidade e as reservas vêm do Supabase; as posições não representam necessariamente o encaixe físico de cada notebook.</p>
    </div>
    <section className="panel">
      <div className="visual3d-filters">
        <label className="field" htmlFor="visual-cart"><span>Carrinho</span>
          <select id="visual-cart" value={cartId} onChange={e=>setCartId(e.target.value)}>
            <option value="">Selecione um carrinho</option>
            {(carts.data??[]).map(c=><option value={c.id} key={c.id}>{c.name} — {c.capacity} notebooks</option>)}
          </select>
        </label>
        <label className="field" htmlFor="visual-date"><span>Data</span>
          <input id="visual-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
        </label>
        <label className="field" htmlFor="visual-shift"><span>Turno</span>
          <select id="visual-shift" value={shift} onChange={e=>setShift(e.target.value as Shift)}>
            {SHIFTS.map(s=><option key={s} value={s}>{shiftLabel[s]}</option>)}
          </select>
        </label>
      </div>
      {!isWeekday(date)&&<p className="reservation-subtle">Este dia é fim de semana e não recebe reservas pelo fluxo padrão.</p>}
    </section>
    {cart&&<>
      <div className="stats visual3d-stats">
        <div className="stat"><span className="stat-label">Capacidade configurada</span><strong>{cart.capacity}</strong></div>
        <div className="stat"><span className="stat-label">Reservados</span><strong>{ready?reserved:'—'}</strong></div>
        <div className="stat"><span className="stat-label">Disponíveis</span><strong>{ready?remaining:'—'}</strong></div>
        <div className="stat"><span className="stat-label">Período</span><strong className="visual3d-period-title">{shiftLabel[shift]}</strong></div>
      </div>
      <div className="visual3d-layout">
        <section className="panel">
          <h2><Laptop2 size={19} aria-hidden="true"/> Vista do carrinho</h2>
          <div className="visual3d-legend"><span><i className="visual3d-dot free"/> Disponível</span>
            <span><i className="visual3d-dot busy"/> Reservado</span></div>
          {loading?<p role="status">Consultando equipamentos…</p>:
            hasError?<p className="notice error" role="alert">Não foi possível consultar a disponibilidade. Atualize a página.</p>:
            <>
              <label className="reservation-check">
                <input type="checkbox" checked={show3d} onChange={e=>setShow3d(e.target.checked)}/>
                Exibir modelo 3D
              </label>
              {show3d&&<Cart3DCanvas slots={slots} onPick={setSelectedPosition}/>}
            </>}
        </section>
        <section className="panel">
          <h2><MousePointer2 size={19} aria-hidden="true"/> Detalhes da posição</h2>
          {!selected?<p className="empty">Selecione uma posição no modelo ou na lista abaixo para ver os detalhes.</p>:
            <div className="visual3d-details">
              <h3>Posição {selected.position}</h3>
              <p><strong>Situação:</strong> {selected.reserved?'Reservada':'Disponível'}</p>
              <p><strong>Código:</strong> {selected.code??'Não atribuído a esta posição'}</p>
              {selected.reserved&&<>
                <p><strong>Identificação física:</strong> {selected.confirmedCode?'Confirmada':'Não confirmada; ocupação ilustrativa'}</p>
                <p><strong>Professor:</strong> {teacher?.name??'Não identificado'}</p>
                <p><strong>Data/turno:</strong> {showDate(date)} · {shiftLabel[shift]}</p>
                <p><strong>Precisa de mouse:</strong> {booked?.needs_mouse?'Sim':'Não'}</p>
                {booked?.notes&&<p><strong>Observação:</strong> {booked.notes}</p>}
              </>}
            </div>}
        </section>
      </div>
      <section className="panel">
        <h2>Consulta textual equivalente</h2>
        <p className="reservation-subtle">Use os botões para consultar cada posição mesmo sem acesso ao WebGL. O total corresponde à capacidade configurada, independentemente de quantos códigos estão cadastrados.</p>
        {hasError&&<p role="alert" className="notice error">Não foi possível confirmar a ocupação. Tente novamente quando a conexão estiver disponível.</p>}
        <div className="visual3d-text-grid">{ready&&slots.map(slot=><button key={slot.position} type="button"
          className={'visual3d-slot '+(slot.reserved?'reserved':'available')}
          aria-pressed={selectedPosition===slot.position}
          onClick={()=>setSelectedPosition(slot.position)}>
          <strong>Posição {slot.position}</strong>
          <span>{slot.reserved?'Reservada':'Disponível'}</span>
          {slot.code&&<small>{slot.code}</small>}
        </button>)}</div>
      </section>
    </>}
    {!cart&&!carts.isLoading&&<div className="panel empty">Selecione um carrinho para visualizar os notebooks.</div>}
  </div>;
}
