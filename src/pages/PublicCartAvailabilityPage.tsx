import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {CalendarDays,Plus,RefreshCw,X} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import BrandLogo from '../components/BrandLogo';
import {supabase} from '../lib/supabase';
import {addCalendarDays,isValidIsoDate,isWeekday,showDate,shiftLabel,todayInSaoPaulo,type Shift} from '../lib/reservations';

type Slot={usage_date:string;cart_id:string;cart_name:string;capacity:number;shift:Shift;reserved:number;available:number};
type DateMode='dia'|'intervalo'|'avulsas';
type DateSelection={dates:string[];error:string|null};
const MAX_SPAN_DAYS=34; // API pública admite até 35 dias corridos, incluindo os extremos.

function firstBusinessDay(){
  let day=todayInSaoPaulo();
  while(!isWeekday(day))day=addCalendarDays(day,1);
  return day;
}
function selectDates(mode:DateMode,day:string,start:string,end:string,specific:string[]):DateSelection{
  if(mode==='dia'){
    if(!isValidIsoDate(day))return {dates:[],error:'Escolha uma data válida.'};
    if(!isWeekday(day))return {dates:[],error:'Não há agenda aos sábados e domingos. Escolha um dia útil.'};
    return {dates:[day],error:null};
  }
  if(mode==='avulsas'){
    const dates=[...new Set(specific)].sort();
    if(!dates.length)return {dates:[],error:'Adicione ao menos um dia para consultar.'};
    if(dates.some(d=>!isValidIsoDate(d)||!isWeekday(d)))
      return {dates:[],error:'Escolha apenas datas de segunda a sexta-feira.'};
    const span=(new Date(dates[dates.length-1]+'T12:00:00Z').getTime()-new Date(dates[0]+'T12:00:00Z').getTime())/86400000;
    if(span>MAX_SPAN_DAYS)return {dates:[],error:'Escolha dias dentro de um intervalo de até 35 dias corridos.'};
    return {dates,error:null};
  }
  if(!isValidIsoDate(start)||!isValidIsoDate(end))
    return {dates:[],error:'Informe a data inicial e a data final.'};
  if(end<start)return {dates:[],error:'A data final deve ser igual ou posterior à inicial.'};
  const span=(new Date(end+'T12:00:00Z').getTime()-new Date(start+'T12:00:00Z').getTime())/86400000;
  if(span>MAX_SPAN_DAYS)return {dates:[],error:'Consulte até 35 dias corridos por vez.'};
  const dates:string[]=[];
  for(let current=start;current<=end;current=addCalendarDays(current,1)){
    if(isWeekday(current))dates.push(current);
  }
  if(!dates.length)return {dates:[],error:'O período não possui dias úteis. Escolha outras datas.'};
  return {dates,error:null};
}

const initialDay=firstBusinessDay();
export default function PublicCartAvailabilityPage(){
  const [mode,setMode]=useState<DateMode>('dia');
  const [day,setDay]=useState(initialDay);
  const [start,setStart]=useState(initialDay);
  const [end,setEnd]=useState(initialDay);
  const [newDay,setNewDay]=useState(initialDay);
  const [specificDays,setSpecificDays]=useState<string[]>([initialDay]);
  const [dayMessage,setDayMessage]=useState('');
  const [cartId,setCartId]=useState('');

  const selection=useMemo(()=>selectDates(mode,day,start,end,specificDays),[mode,day,start,end,specificDays]);
  const dates=selection.dates;
  const first=dates[0]??'';
  const last=dates[dates.length-1]??'';
  const selectedSet=useMemo(()=>new Set(dates),[dates]);
  const query=useQuery({
    queryKey:['public-cart-availability',first,last],
    enabled:dates.length>0,
    queryFn:async():Promise<Slot[]>=>{
      const {data,error}=await supabase.rpc('public_cart_availability',{p_start:first,p_end:last});
      if(error)throw error;
      return (data??[]) as Slot[];
    },
    staleTime:30_000,
    refetchInterval:60_000,
    refetchOnWindowFocus:true
  });
  const carts=useMemo(()=>[...new Map((query.data??[]).map(row=>[row.cart_id,{id:row.cart_id,name:row.cart_name}])).values()]
    .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),[query.data]);
  const visible=(query.data??[]).filter(row=>selectedSet.has(row.usage_date)&&(!cartId||row.cart_id===cartId));
  const occupied=visible.filter(row=>row.reserved>0).length;
  const dateSummary=dates.length===0?'Selecione as datas':
    dates.length===1?showDate(dates[0]):
    mode==='avulsas'?dates.length+' dias escolhidos':
    showDate(start)+' a '+showDate(end);

  function addSpecificDay(){
    setDayMessage('');
    if(!isValidIsoDate(newDay)||!isWeekday(newDay)){
      setDayMessage('Escolha um dia útil válido, de segunda a sexta-feira.');
      return;
    }
    if(specificDays.includes(newDay)){
      setDayMessage('Esse dia já está selecionado.');
      return;
    }
    const next=[...specificDays,newDay].sort();
    const span=(new Date(next[next.length-1]+'T12:00:00Z').getTime()-new Date(next[0]+'T12:00:00Z').getTime())/86400000;
    if(span>MAX_SPAN_DAYS){
      setDayMessage('Os dias escolhidos devem estar dentro de até 35 dias corridos.');
      return;
    }
    setSpecificDays(next);
  }

  return <main id="main-content" className="public-agenda calendar-page">
    <header className="public-agenda-header">
      <div><BrandLogo tone="light"/><span className="eyebrow">CONSULTA PÚBLICA · LABORATÓRIOS MÓVEIS</span><h1>Disponibilidade dos carrinhos</h1>
        <p>Escolha um ou mais dias e consulte as reservas dos laboratórios móveis, sem precisar criar conta.</p></div>
      <div className="public-agenda-header-actions"><ThemeToggle/><a className="secondary" href="#/login">Acesso ao sistema</a></div>
    </header>
    <section className="panel calendar-filters" aria-label="Filtros da consulta pública">
      <div className="calendar-filter-grid">
        <label className="field" htmlFor="public-mode"><span>Consultar por</span>
          <select id="public-mode" value={mode} onChange={e=>{setMode(e.target.value as DateMode);setDayMessage('');}}>
            <option value="dia">Um dia</option><option value="intervalo">Intervalo de dias</option>
            <option value="avulsas">Dias específicos</option>
          </select></label>
        <div className="field public-date-field">
          <span>{mode==='dia'?'Escolha o dia':mode==='intervalo'?'Escolha o período':'Adicionar dias'}</span>
          {mode==='dia'?<input id="public-focus" type="date" aria-label="Dia da consulta" value={day} onChange={e=>setDay(e.target.value)}/>:
            mode==='intervalo'?<div className="public-date-range">
              <label><span>De</span><input type="date" aria-label="Data inicial" value={start} onChange={e=>setStart(e.target.value)}/></label>
              <label><span>Até</span><input type="date" aria-label="Data final" value={end} onChange={e=>setEnd(e.target.value)}/></label>
            </div>:
            <div className="public-date-add">
              <input type="date" aria-label="Novo dia" value={newDay} onChange={e=>{setNewDay(e.target.value);setDayMessage('');}}/>
              <button type="button" className="secondary" onClick={addSpecificDay}><Plus size={15} aria-hidden="true"/> Adicionar</button>
            </div>}
        </div>
        <label className="field" htmlFor="public-cart"><span>Carrinho</span>
          <select id="public-cart" value={cartId} onChange={e=>setCartId(e.target.value)}>
            <option value="">Todos os carrinhos</option>
            {carts.map(cart=><option key={cart.id} value={cart.id}>{cart.name}</option>)}
          </select></label>
        <button type="button" className="secondary public-agenda-refresh" onClick={()=>void query.refetch()} disabled={query.isFetching||dates.length===0}>
          <RefreshCw size={16} aria-hidden="true"/> Atualizar disponibilidade
        </button>
      </div>
      {mode==='avulsas'&&<div className="public-selected-days" aria-label="Dias selecionados">
        <span className="form-hint">Dias selecionados ({specificDays.length})</span>
        <div className="public-day-chips">{specificDays.map(selected=>
          <button key={selected} type="button" className="public-day-chip" aria-label={'Remover '+showDate(selected)}
            title={'Remover '+showDate(selected)}
            onClick={()=>{setSpecificDays(old=>old.filter(d=>d!==selected));setDayMessage('');}}>
            {showDate(selected)} <X size={14} aria-hidden="true"/>
          </button>)}</div>
      </div>}
      {dayMessage&&<p className="notice error" role="alert">{dayMessage}</p>}
      {selection.error&&<p className="notice error" role="alert">{selection.error}</p>}
      {mode!=='dia'&&<p className="public-selection-hint">Selecione até 35 dias corridos por consulta. A agenda considera apenas dias úteis.</p>}
    </section>
    <div className="stats calendar-stats">
      <div className="stat"><span className="stat-label">Carrinhos ativos</span><strong>{dates.length===0||query.isLoading?'—':carts.length}</strong></div>
      <div className="stat"><span className="stat-label">Turnos com reserva</span><strong>{dates.length===0||query.isLoading?'—':occupied}</strong></div>
      <div className="stat"><span className="stat-label">Datas consultadas</span><strong>{dateSummary}</strong></div>
    </div>
    <section className="panel calendar-result">
      <div className="calendar-header"><h2><CalendarDays size={20} aria-hidden="true"/> Agenda de reservas</h2>
        <p className="reservation-subtle">Apenas dias úteis. Reservas canceladas não ocupam vagas.</p></div>
      {selection.error?<p className="calendar-empty">Ajuste as datas acima para consultar a disponibilidade.</p>:
        query.isLoading?<p role="status">Carregando disponibilidade…</p>:
        query.error?<p className="notice error" role="alert">Não foi possível consultar as reservas. Tente atualizar mais tarde.</p>:
        carts.length===0?<p>Nenhum carrinho ativo disponível para consulta.</p>:
        <div className={'calendar-grid '+(dates.length===1?'public-single-day':'')}>{dates.map(selectedDay=>{
          const dayRows=visible.filter(row=>row.usage_date===selectedDay);
          const byCart=new Map<string,Slot[]>();
          for(const slot of dayRows)byCart.set(slot.cart_id,[...(byCart.get(slot.cart_id)??[]),slot]);
          return <article className="calendar-day" key={selectedDay}>
            <header><strong>{showDate(selectedDay)}</strong><span>{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(selectedDay+'T12:00:00Z').getUTCDay()]}</span></header>
            {byCart.size===0?<p className="calendar-empty">Nenhum carrinho no filtro</p>:
              <div className="calendar-items">{[...byCart].map(([id,slots])=>
                <div key={id} className="public-agenda-cart">
                  <strong>{slots[0].cart_name}</strong>
                  {slots.map(slot=><div key={slot.shift} className={'calendar-event '+(slot.available===0?'public-agenda-full':'')}>
                    <strong>{shiftLabel[slot.shift]}</strong>
                    <span>{slot.reserved===0?'Livre':slot.available===0?'Totalmente reservado':'Parcialmente reservado'}</span>
                    <span>{slot.reserved} de {slot.capacity} notebooks reservados · {slot.available} disponíveis</span>
                  </div>)}
                </div>
              )}</div>}
          </article>;
        })}</div>}
    </section>
    <p className="form-hint">Consulta apenas informativa, atualizada automaticamente enquanto esta página estiver aberta. A disponibilidade pode mudar quando novas reservas forem confirmadas. Para solicitar uma reserva, entre em contato com a equipe de TI.</p>
  </main>;
}
