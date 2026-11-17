import {useMemo,useState,type CSSProperties} from 'react';
import {useQuery} from '@tanstack/react-query';
import {CalendarDays,Download,FileText,Filter} from 'lucide-react';
import {supabase,type Cart,type Requester} from '../lib/supabase';
import {addCalendarDays,isWeekday,shiftLabel,showDate,todayInSaoPaulo,type Shift} from '../lib/reservations';
import {downloadCsv,downloadPdf,type ReportRow} from '../lib/reportExports';

type Period={id:string;reservation_id:string;cart_id:string;usage_date:string;shift:Shift;quantity:number;active:boolean};
type Booking={id:string;requester_id:string;cart_id:string;mode:string;needs_mouse:boolean;notes:string|null;created_by:string};
type Admin={user_id:string;display_name:string};
type CalendarRow=ReportRow&{dateIso:string;shiftCode:Shift;bookingId:string;active:boolean};
function firstDayOfWeek(day:string):string{
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();
  return addCalendarDays(day,-((weekday+6)%7));
}
export function calendarWeekdays(view:'semana'|'mes',focus:string):string[]{
  if(view==='semana') {
    const first=firstDayOfWeek(focus);
    return Array.from({length:5},(_,i)=>addCalendarDays(first,i));
  }
  const start=focus.slice(0,7)+'-01';
  const y=Number(focus.slice(0,4)),month=Number(focus.slice(5,7));
  const length=new Date(Date.UTC(y,month,0)).getUTCDate();
  const dates=Array.from({length},(_,i)=>addCalendarDays(start,i));
  return dates.filter(isWeekday);
}
function humanMonth(iso:string){
  return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',month:'long',year:'numeric'})
    .format(new Date(iso+'T12:00:00Z'));
}
const today=todayInSaoPaulo();
async function getRows<T>(table:'carts'|'requesters'|'admin_users',cols='*'):Promise<T[]>{
  const {data,error}=await supabase.from(table).select(cols);
  if(error)throw error;return (data??[]) as T[];
}
export default function CalendarReportsPage(){
  const [mode,setMode]=useState<'semana'|'mes'>('semana');
  const [focus,setFocus]=useState(today);
  const [cartId,setCartId]=useState('');
  const [teacherId,setTeacherId]=useState('');
  const [includeCancelled,setIncludeCancelled]=useState(false);
  const [exportBusy,setExportBusy]=useState(false);
  const [exportError,setExportError]=useState('');
  const dates=useMemo(()=>calendarWeekdays(mode,focus),[mode,focus]);
  const first=dates[0]??today,last=dates[dates.length-1]??today;
  const periodQuery=useQuery({
    queryKey:['calendar-periods',mode,first,last],
    queryFn:async():Promise<Period[]>=>{
      const {data,error}=await supabase.from('reservation_periods')
        .select('id,reservation_id,cart_id,usage_date,shift,quantity,active')
        .gte('usage_date',first).lte('usage_date',last)
        .order('usage_date',{ascending:true});
      if(error)throw error;
      return (data??[]) as Period[];
    }
  });
  const bookingIds=useMemo(()=>[...new Set((periodQuery.data??[]).map(p=>p.reservation_id))],[periodQuery.data]);
  const bookings=useQuery({
    queryKey:['calendar-bookings',bookingIds.join(',')],
    enabled:bookingIds.length>0,
    queryFn:async():Promise<Booking[]>=>{
      const {data,error}=await supabase.from('reservations')
        .select('id,requester_id,cart_id,mode,needs_mouse,notes,created_by')
        .in('id',bookingIds);
      if(error)throw error;
      return (data??[]) as Booking[];
    }
  });
  const carts=useQuery({queryKey:['carts','report'],queryFn:()=>getRows<Cart>('carts')});
  const teachers=useQuery({queryKey:['requesters','report'],queryFn:()=>getRows<Requester>('requesters')});
  const admins=useQuery({queryKey:['admins','report'],queryFn:()=>getRows<Admin>('admin_users','user_id,display_name')});
  const rows=useMemo(():CalendarRow[]=>{
    if(!periodQuery.data)return [];
    const lookup=new Map((bookings.data??[]).map(x=>[x.id,x]));
    return periodQuery.data.flatMap(p=>{
      const booking=lookup.get(p.reservation_id);
      if(!booking)return [];
      if(cartId&&p.cart_id!==cartId)return [];
      if(teacherId&&booking.requester_id!==teacherId)return [];
      if(!includeCancelled&&!p.active)return [];
      const cart=carts.data?.find(x=>x.id===p.cart_id);
      const requester=teachers.data?.find(x=>x.id===booking.requester_id);
      const admin=admins.data?.find(x=>x.user_id===booking.created_by);
      return [{
        date:showDate(p.usage_date),dateIso:p.usage_date,shift:shiftLabel[p.shift],shiftCode:p.shift,
        cart:cart?.name??'Carrinho',requester:requester?.name??'Solicitante',
        mode:booking.mode==='COMPLETA'?'Completa':'Parcial',quantity:p.quantity,
        needsMouse:booking.needs_mouse,status:p.active?'Confirmada':'Cancelada',
        createdBy:admin?.display_name??'TI',notes:booking.notes??'',bookingId:booking.id,active:p.active
      }];
    });
  },[periodQuery.data,bookings.data,carts.data,teachers.data,admins.data,cartId,teacherId,includeCancelled]);
  const active=rows.filter(r=>r.active);
  const bookingCount=new Set(active.map(r=>r.bookingId)).size;
  const notebookPeriods=active.reduce((n,r)=>n+r.quantity,0);
  const busy=periodQuery.isLoading||(bookingIds.length>0&&bookings.isLoading)
    ||carts.isLoading||teachers.isLoading||admins.isLoading;
  const hasError=periodQuery.error||bookings.error||carts.error||teachers.error||admins.error;
  const dateLabel=mode==='mes'?humanMonth(first):showDate(first)+' a '+showDate(last);

  async function exportFile(format:'pdf'|'csv'){
    setExportError('');setExportBusy(true);
    try{
      const data=rows.map(({dateIso,shiftCode,bookingId,active,...report})=>report);
      const name='educart-'+mode+'-'+first;
      if(format==='csv')downloadCsv(data,name);
      else await downloadPdf(data,{
        dates,mode,
        period:mode==='semana'?'Semana de '+showDate(first)+' até '+showDate(last):dateLabel,
        title:'Agenda de Reservas - '+(cartId?carts.data?.find(c=>c.id===cartId)?.name??'Laboratórios Móveis':'Laboratórios Móveis')
      },name);
    }catch(error){
      setExportError(error instanceof Error?error.message:'Falha ao gerar relatório.');
    }finally{setExportBusy(false);}
  }
  return <div className="calendar-page">
    <div className="page-header"><h1>Calendário e relatórios</h1>
      <p>Consulte a ocupação dos notebooks por data e turno e exporte o recorte selecionado.</p>
    </div>
    <section className="panel calendar-filters" aria-label="Filtros do calendário">
      <h2><Filter size={18} aria-hidden="true"/> Filtros</h2>
      <div className="calendar-filter-grid">
        <label className="field" htmlFor="calendar-mode"><span>Visualização</span>
          <select id="calendar-mode" value={mode} onChange={e=>setMode(e.target.value as 'semana'|'mes')}>
            <option value="semana">Semana</option><option value="mes">Mês</option>
          </select>
        </label>
        <label className="field" htmlFor="calendar-focus"><span>{mode==='semana'?'Semana de referência':'Mês de referência'}</span>
          <input id="calendar-focus" type={mode==='semana'?'date':'month'}
            value={mode==='semana'?focus:focus.slice(0,7)}
            onChange={e=>{
              const value=e.target.value;
              setFocus(mode==='semana'?value:value+'-01');
            }}/>
        </label>
        <label className="field" htmlFor="calendar-cart"><span>Carrinho</span>
          <select id="calendar-cart" value={cartId} onChange={e=>setCartId(e.target.value)}>
            <option value="">Todos os carrinhos</option>
            {(carts.data??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="calendar-requester"><span>Professor</span>
          <select id="calendar-requester" value={teacherId} onChange={e=>setTeacherId(e.target.value)}>
            <option value="">Todos os professores</option>
            {(teachers.data??[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      <label className="reservation-check"><input type="checkbox" checked={includeCancelled} onChange={e=>setIncludeCancelled(e.target.checked)}/>
        Incluir períodos cancelados nos resultados</label>
    </section>
    <div className="stats calendar-stats">
      <div className="stat"><span className="stat-label">Reservas agrupadas</span><strong>{busy?'—':bookingCount}</strong></div>
      <div className="stat"><span className="stat-label">Períodos ocupados</span><strong>{busy?'—':active.length}</strong></div>
      <div className="stat"><span className="stat-label">Notebooks × turnos</span><strong>{busy?'—':notebookPeriods}</strong></div>
      <div className="stat"><span className="stat-label">Linhas no relatório</span><strong>{busy?'—':rows.length}</strong></div>
    </div>
    <section className="panel calendar-result">
      <div className="calendar-header">
        <div><h2><CalendarDays size={20} aria-hidden="true"/> {dateLabel}</h2>
          <p className="reservation-subtle">Segunda a sexta; feriados permanecem no calendário.</p>
        </div>
        <div className="reservation-actions">
          <button type="button" className="secondary" disabled={busy||!!hasError||exportBusy}
            onClick={()=>void exportFile('csv')}><Download size={16} aria-hidden="true"/> Planilha CSV</button>
          <button type="button" className="secondary" disabled={busy||!!hasError||exportBusy}
            onClick={()=>void exportFile('pdf')}><FileText size={16} aria-hidden="true"/> Exportar PDF</button>
        </div>
      </div>
      {exportError&&<p className="notice error" role="alert">{exportError}</p>}
      {busy?<p role="status">Carregando calendário…</p>:
        hasError?<p className="notice error" role="alert">Falha ao carregar o recorte. Tente atualizar a página.</p>:
        <div className="calendar-grid">{dates.map((day,index)=>{
          const dayRows=rows.filter(r=>r.dateIso===day);
          const weekday=new Date(day+'T12:00:00Z').getUTCDay();
          return <article className="calendar-day" key={day}
            style={index===0?{'--calendar-start':String(weekday===0?5:weekday)} as CSSProperties:undefined}>
            <header><strong>{showDate(day)}</strong><span>{['','Seg','Ter','Qua','Qui','Sex'][weekday]}</span></header>
            {dayRows.length===0?<p className="calendar-empty">Sem reservas</p>:
              <div className="calendar-items">{dayRows.map((r,i)=><div key={r.bookingId+'-'+r.shiftCode+'-'+i}
                className={'calendar-event '+(r.active?'':'cancelled')}>
                <strong>{r.shift}</strong><span>{r.requester}</span>
                <span>{r.cart} · {r.quantity} notebooks</span>
                {!r.active&&<em>Cancelado</em>}
              </div>)}</div>}
          </article>;
        })}</div>}
    </section>
    <p className="form-hint">O indicador “Reservas agrupadas” conta registros distintos; “Períodos ocupados” conta cada data e turno. O PDF e o CSV respeitam os filtros e incluem cancelamentos apenas se a opção estiver marcada. O PDF apresenta uma agenda por dia útil e um resumo geral; a linha complementar de mouses não corresponde a uma segunda reserva. Como a sala não está cadastrada no sistema, ela aparece como “Não informada”.</p>
  </div>;
}
