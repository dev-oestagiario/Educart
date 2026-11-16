import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {CalendarDays,RefreshCw} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {addCalendarDays,isWeekday,showDate,shiftLabel,todayInSaoPaulo,type Shift} from '../lib/reservations';

type Slot={usage_date:string;cart_id:string;cart_name:string;capacity:number;shift:Shift;reserved:number;available:number};
function firstMonday(day:string){
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();
  return addCalendarDays(day,-((weekday+6)%7));
}
function range(mode:'semana'|'mes',focus:string){
  if(mode==='semana') {
    const first=firstMonday(focus);
    return {first,last:addCalendarDays(first,4)};
  }
  const first=focus.slice(0,7)+'-01';
  const last=addCalendarDays(addCalendarDays(first,32).slice(0,7)+'-01',-1);
  return {first,last};
}
export default function PublicCartAvailabilityPage(){
  const [mode,setMode]=useState<'semana'|'mes'>('semana');
  const [focus,setFocus]=useState(todayInSaoPaulo());
  const [cartId,setCartId]=useState('');
  const {first,last}=useMemo(()=>range(mode,focus),[mode,focus]);
  const dates=useMemo(()=>{
    const result:string[]=[];
    for(let day=first;day<=last;day=addCalendarDays(day,1))if(isWeekday(day))result.push(day);
    return result;
  },[first,last]);
  const query=useQuery({
    queryKey:['public-cart-availability',first,last],
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
  const visible=(query.data??[]).filter(row=>!cartId||row.cart_id===cartId);
  const occupied=visible.filter(row=>row.reserved>0).length;
  return <main id="main-content" className="public-agenda calendar-page">
    <header className="public-agenda-header">
      <div><span className="eyebrow">EDUCART · CONSULTA PÚBLICA</span><h1>Disponibilidade dos carrinhos</h1>
        <p>Veja as reservas dos laboratórios móveis por dia e turno. Não é necessário criar conta.</p></div>
      <a className="secondary" href="#/login">Acesso ao sistema</a>
    </header>
    <section className="panel calendar-filters" aria-label="Filtros da consulta pública">
      <div className="calendar-filter-grid">
        <label className="field" htmlFor="public-mode"><span>Visualização</span>
          <select id="public-mode" value={mode} onChange={e=>setMode(e.target.value as 'semana'|'mes')}>
            <option value="semana">Semana</option><option value="mes">Mês</option>
          </select></label>
        <label className="field" htmlFor="public-focus"><span>Período</span>
          <input id="public-focus" type={mode==='semana'?'date':'month'}
            value={mode==='semana'?focus:focus.slice(0,7)}
            onChange={e=>setFocus(mode==='semana'?e.target.value:e.target.value+'-01')}/></label>
        <label className="field" htmlFor="public-cart"><span>Carrinho</span>
          <select id="public-cart" value={cartId} onChange={e=>setCartId(e.target.value)}>
            <option value="">Todos os carrinhos</option>
            {carts.map(cart=><option key={cart.id} value={cart.id}>{cart.name}</option>)}
          </select></label>
      </div>
      <button type="button" className="secondary" onClick={()=>void query.refetch()} disabled={query.isFetching}>
        <RefreshCw size={16} aria-hidden="true"/> Atualizar disponibilidade
      </button>
    </section>
    <div className="stats calendar-stats">
      <div className="stat"><span className="stat-label">Carrinhos ativos</span><strong>{query.isLoading?'—':carts.length}</strong></div>
      <div className="stat"><span className="stat-label">Turnos com reserva</span><strong>{query.isLoading?'—':occupied}</strong></div>
      <div className="stat"><span className="stat-label">Período consultado</span><strong>{showDate(first)} a {showDate(last)}</strong></div>
    </div>
    <section className="panel calendar-result">
      <div className="calendar-header"><h2><CalendarDays size={20} aria-hidden="true"/> Agenda de reservas</h2>
        <p className="reservation-subtle">Apenas dias úteis. Reservas canceladas não ocupam vagas.</p></div>
      {query.isLoading?<p role="status">Carregando disponibilidade…</p>:
        query.error?<p className="notice error" role="alert">Não foi possível consultar as reservas. Tente atualizar mais tarde.</p>:
        carts.length===0?<p>Nenhum carrinho ativo disponível para consulta.</p>:
        <div className="calendar-grid">{dates.map(day=>{
          const dayRows=visible.filter(row=>row.usage_date===day);
          const byCart=new Map<string,Slot[]>();
          for(const slot of dayRows)byCart.set(slot.cart_id,[...(byCart.get(slot.cart_id)??[]),slot]);
          return <article className="calendar-day" key={day}>
            <header><strong>{showDate(day)}</strong><span>{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(day+'T12:00:00Z').getUTCDay()]}</span></header>
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
