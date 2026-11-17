import {useState,useEffect,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {CalendarDays,PackageMinus,PackageCheck,Clock,ClipboardCheck,Wrench,RefreshCw,Boxes,Laptop,UserRound,ArrowRight} from 'lucide-react';
import {supabase,type Cart,type Requester,type Notebook} from '../lib/supabase';
import {todayInSaoPaulo,addCalendarDays,showDate,shiftLabel,SHIFTS,type Shift} from '../lib/reservations';
import {dashboardSummary,type DashboardData,type DashboardFilter,type DashboardPeriod,type DashboardMovement,type DashboardMaintenance,type DashboardRequest} from '../lib/dashboard';
type Target='reservations'|'movements'|'maintenance'|'approvals'|'calendar'|'carts'|'requesters'|'notebooks';
async function pages<T>(get:(a:number,b:number)=>PromiseLike<{data:unknown;error:unknown}>):Promise<T[]>{
 const result:T[]=[];
 for(let i=0;;i+=250){const {data,error}=await get(i,i+249);if(error)throw error;const rows=(data??[]) as T[];result.push(...rows);if(rows.length<250)return result;}
}
async function load(today:string):Promise<DashboardData>{
 const end=addCalendarDays(today,30);
 const [carts,requesters,notebooks,periods,todayMovements,openMovements,maintenance,requests]=await Promise.all([
  pages<Cart>((a,b)=>supabase.from('carts').select('*').order('id').range(a,b)),
  pages<Requester>((a,b)=>supabase.from('requesters').select('*').order('id').range(a,b)),
  pages<Notebook>((a,b)=>supabase.from('notebook_codes').select('id,cart_id').order('id').range(a,b)),
  pages<DashboardPeriod>((a,b)=>supabase.from('reservation_periods').select('id,reservation_id,cart_id,usage_date,shift,quantity,active,reservations(requester_id,status,destination_label)').eq('active',true).gte('usage_date',today).lte('usage_date',end).order('usage_date').order('id').range(a,b)),
  pages<DashboardMovement>((a,b)=>supabase.from('equipment_movements').select('id,period_id,cart_id,requester_id,usage_date,shift,quantity,pickup_at,return_at').eq('usage_date',today).order('id').range(a,b)),
  pages<DashboardMovement>((a,b)=>supabase.from('equipment_movements').select('id,period_id,cart_id,requester_id,usage_date,shift,quantity,pickup_at,return_at').is('return_at',null).order('id').range(a,b)),
  pages<DashboardMaintenance>((a,b)=>supabase.from('maintenance_windows').select('id,cart_id,start_date,end_date,shifts,closed_at').is('closed_at',null).lte('start_date',end).gte('end_date',today).order('id').range(a,b)),
  pages<DashboardRequest>((a,b)=>supabase.from('reservation_requests').select('id,cart_id,requester_id,dates,shifts,quantity,status,created_at').eq('status','PENDENTE').order('id').range(a,b))
 ]);
 return {carts,requesters,notebooks,periods,movements:[...new Map([...todayMovements,...openMovements].map(m=>[m.id,m])).values()],maintenance,requests};
}
const initial:DashboardFilter={cartId:'',shift:'all',days:7};
function Metric({label,value,icon}: {label:string;value:string|number;icon:ReactNode}){
 return <div className="stat"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><strong>{value}</strong></div>;
}
function Section({title,count,action,onAction,empty,children}:{title:string;count:number;action:string;onAction:()=>void;empty:string;children:ReactNode}){
 const [expanded,setExpanded]=useState(false);
 const rows=Array.isArray(children)?children:[children];
 return <section className="panel dashboard-section"><div className="dashboard-section-heading"><h2>{title} <span className="dashboard-count">{count}</span></h2><button type="button" className="secondary" onClick={onAction}>{action} <ArrowRight size={14} aria-hidden="true"/></button></div>
  {count===0?<p className="empty">{empty}</p>:<div className="item-list">{expanded?rows:rows.slice(0,5)}</div>}
  {count>5&&<button type="button" className="ghost dashboard-more" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Mostrar menos':'Exibir todos ('+count+')'}</button>}
 </section>;
}
export default function DashboardPage({onNavigate}:{onNavigate:(target:Target)=>void}){
 const [today,setToday]=useState(todayInSaoPaulo),[filter,setFilter]=useState<DashboardFilter>(initial);
 useEffect(()=>{const sync=()=>setToday(todayInSaoPaulo());const id=window.setInterval(sync,30000);window.addEventListener('focus',sync);return()=>{window.clearInterval(id);window.removeEventListener('focus',sync)};},[]);
 const query=useQuery({queryKey:['operational-dashboard',today],queryFn:()=>load(today),staleTime:15000,refetchInterval:60000,retry:false});
 const data=query.data;
 const s=data?dashboardSummary(data,today,filter):null;
 const cartName=(id:string)=>data?.carts.find(c=>c.id===id)?.name??'Carrinho';
 const professor=(id:string)=>data?.requesters.find(p=>p.id===id)?.name??'Solicitante';
 const agenda=(p:DashboardPeriod)=> <article key={p.id} className="item dashboard-item"><div><strong>{cartName(p.cart_id)}</strong><span>{professor(p.reservations!.requester_id)} · {showDate(p.usage_date)} · {shiftLabel[p.shift]}</span><span>{p.quantity} notebook(s){p.reservations?.destination_label?' · '+p.reservations.destination_label:''}</span></div>{p.usage_date===today&&<span className="dashboard-status">{s!.status(p)}</span>}</article>;
 return <div className="dashboard-page">
  <header className="page-header dashboard-header"><div><h1>Visão geral</h1><p>Operação dos laboratórios · {showDate(today)}</p></div><button className="secondary" disabled={query.isFetching} onClick={()=>void query.refetch()}><RefreshCw size={16} aria-hidden="true"/> {query.isFetching?'Atualizando…':'Atualizar painel'}</button></header>
  <section className="panel dashboard-filters" aria-label="Filtros do dashboard">
   <label className="field" htmlFor="dashboard-cart"><span>Carrinho</span><select id="dashboard-cart" value={filter.cartId} onChange={e=>setFilter(f=>({...f,cartId:e.target.value}))}><option value="">Todos os carrinhos</option>{(data?.carts??[]).map(c=><option key={c.id} value={c.id}>{c.name}{c.active?'':' (inativo)'}</option>)}</select></label>
   <label className="field" htmlFor="dashboard-shift"><span>Turno</span><select id="dashboard-shift" value={filter.shift} onChange={e=>setFilter(f=>({...f,shift:e.target.value as Shift|'all'}))}><option value="all">Todos os turnos</option>{SHIFTS.map(s=><option key={s} value={s}>{shiftLabel[s]}</option>)}</select></label>
   <label className="field" htmlFor="dashboard-days"><span>Próximos dias</span><select id="dashboard-days" value={filter.days} onChange={e=>setFilter(f=>({...f,days:Number(e.target.value) as DashboardFilter['days']}))}><option value={7}>7 dias</option><option value={14}>14 dias</option><option value={30}>30 dias</option></select></label>
   <button className="ghost" onClick={()=>setFilter(initial)}>Limpar filtros</button>
  </section>
  {query.error?<p className="notice error" role="alert">Não foi possível carregar o painel operacional. {data?'Exibindo a última consulta; atualize antes de tomar decisões.':'Tente atualizar. Nenhum indicador foi presumido.'}</p>:null}
  {query.isLoading&&<p role="status" className="center-status">Carregando painel operacional…</p>}
  {s&&<>
    <div className="dashboard-updated">Última atualização: {new Intl.DateTimeFormat('pt-BR',{timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(query.dataUpdatedAt))} · horários de Brasília</div>
    <div className="stats dashboard-metrics">
     <Metric label="Períodos de hoje" value={s.todayPeriods.length} icon={<CalendarDays/>}/>
     <Metric label="Aguardando retirada" value={s.awaitingPickup} icon={<PackageMinus/>}/>
     <Metric label="Pendentes de devolução" value={s.pendingReturns.length} icon={<Clock/>}/>
     <Metric label="Devolvidas (agenda de hoje)" value={s.returnedToday} icon={<PackageCheck/>}/>
     <Metric label="Manutenções de hoje" value={s.maintenanceToday} icon={<Wrench/>}/>
     <Metric label="Solicitações pendentes" value={s.pendingRequests.length} icon={<ClipboardCheck/>}/>
    </div>
    <div className="dashboard-grid">
     <Section title="Agenda de hoje" count={s.todayPeriods.length} action="Abrir reservas" onAction={()=>onNavigate('reservations')} empty="Nenhum período confirmado para hoje.">{s.todayPeriods.map(agenda)}</Section>
     <Section title="Devoluções pendentes" count={s.pendingReturns.length} action="Abrir movimentações" onAction={()=>onNavigate('movements')} empty="Nenhum equipamento pendente de devolução.">{s.pendingReturns.map(m=><article key={m.id} className="item dashboard-item"><div><strong>{cartName(m.cart_id)}</strong><span>{professor(m.requester_id)} · {showDate(m.usage_date)} · {shiftLabel[m.shift]}</span><span>{m.quantity} notebook(s) sob custódia registrada</span></div><span className="dashboard-status">{m.usage_date<today?'De data anterior':'Pendente'}</span></article>)}</Section>
     <Section title="Próximas utilizações" count={s.upcoming.length} action="Abrir calendário" onAction={()=>onNavigate('calendar')} empty="Nenhum período confirmado no intervalo.">{s.upcoming.map(agenda)}</Section>
     <Section title="Manutenções" count={s.maintenance.length} action="Abrir manutenção" onAction={()=>onNavigate('maintenance')} empty="Nenhuma janela de manutenção neste intervalo.">{s.maintenance.map(m=><article key={m.id} className="item dashboard-item"><div><strong>{cartName(m.cart_id)}</strong><span>{showDate(m.start_date)} a {showDate(m.end_date)} · {m.shifts.map(sh=>shiftLabel[sh]).join(', ')}</span></div><span className="dashboard-status">{m.start_date<=today?'Janela vigente':'Programada'}</span></article>)}</Section>
     <Section title="Solicitações aguardando análise" count={s.pendingRequests.length} action="Abrir solicitações" onAction={()=>onNavigate('approvals')} empty="Nenhuma solicitação pendente.">{s.pendingRequests.map(r=><article key={r.id} className="item dashboard-item"><div><strong>{professor(r.requester_id)}</strong><span>{cartName(r.cart_id)} · {r.quantity} notebook(s) · {r.dates.length} data(s)</span><span>{r.shifts.map(sh=>shiftLabel[sh]).join(', ')}</span></div><span className="dashboard-status">Pendente</span></article>)}</Section>
     <section className="panel dashboard-section"><h2>Cadastros e capacidade nominal</h2><p className="form-hint">Capacidade cadastrada não representa equipamentos fisicamente disponíveis. Pendências de devolução: {s.pendingQuantity} notebook(s), {s.overdueReturns} registro(s) de datas anteriores.</p><div className="dashboard-catalog"><Metric label="Carrinhos cadastrados" value={s.cartCount} icon={<Boxes/>}/><Metric label="Capacidade cadastrada" value={s.capacity} icon={<Laptop/>}/><Metric label="Professores (total)" value={s.teacherCount} icon={<UserRound/>}/><Metric label="Notebooks identificados" value={s.identified} icon={<Laptop/>}/></div><div className="actions"><button className="secondary" onClick={()=>onNavigate('carts')}>Gerenciar carrinhos</button><button className="secondary" onClick={()=>onNavigate('requesters')}>Gerenciar professores</button><button className="secondary" onClick={()=>onNavigate('notebooks')}>Gerenciar notebooks</button></div></section>
    </div>
    <p className="form-hint">O horizonte de dias limita próximas utilizações e manutenções. Devoluções e solicitações pendentes não expiram com esse filtro. O painel não representa rastreamento em tempo real.</p>
  </>}
 </div>;
}
