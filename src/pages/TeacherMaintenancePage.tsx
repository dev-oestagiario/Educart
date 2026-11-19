import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Wrench,RefreshCw} from 'lucide-react';
import {Feedback,LoadingState,EmptyState} from '../components/Feedback';
import DateRangeFields from '../components/DateRangeFields';
import {supabase} from '../lib/supabase';
import {todayInSaoPaulo,addCalendarDays,showDate,shiftLabel,type Shift} from '../lib/reservations';
import {publicDateSelection} from '../lib/publicAvailabilityDates';
type Window={id:string;cart_name:string;start_date:string;end_date:string;shifts:Shift[];notebook_count:number|null};
export default function TeacherMaintenancePage(){
 const today=todayInSaoPaulo();
 const [start,setStart]=useState(today),[end,setEnd]=useState(addCalendarDays(today,30));
 const selection=publicDateSelection(start,end);
 const query=useQuery({queryKey:['teacher-maintenance',start,end],enabled:!selection.error,queryFn:async()=>{
  const {data,error}=await supabase.rpc('teacher_maintenance_schedule',{p_start:start,p_end:end||start});
  if(error)throw error;return (data??[]) as Window[];
 },refetchInterval:30000,refetchOnWindowFocus:true});
 return <div className="records-page">
  <header className="page-header"><h1>Manutenções</h1><p>Consulte as indisponibilidades programadas pela equipe de TI. Somente leitura.</p></header>
  <section className="panel"><DateRangeFields id="teacher-maintenance" start={start} end={end} onChange={(a,b)=>{setStart(a);setEnd(b);}}/><button type="button" className="secondary" disabled={query.isFetching||!!selection.error} onClick={()=>void query.refetch()}><RefreshCw size={16} aria-hidden="true"/> Atualizar</button></section>
  {selection.error?<Feedback kind="warning">{selection.error}</Feedback>:query.isPending?<LoadingState>Consultando manutenções…</LoadingState>:query.isError?<Feedback kind="error">Não foi possível consultar as manutenções.</Feedback>:<section className="panel"><h2><Wrench size={18} aria-hidden="true"/> Manutenções vigentes e programadas</h2>{!query.data?.length?<EmptyState>Nenhuma manutenção neste período.</EmptyState>:<div className="item-list">{query.data.map(m=><article className="item" key={m.id}><div><strong>{m.cart_name}</strong><span>{m.notebook_count===null?'Carrinho completo':m.notebook_count+' notebook(s)'} · {showDate(m.start_date)} a {showDate(m.end_date)}</span><span>{m.shifts.map(s=>shiftLabel[s]).join(', ')} · {m.start_date>today?'Programada':'Em manutenção'}</span></div></article>)}</div>}</section>}
 </div>;
}
