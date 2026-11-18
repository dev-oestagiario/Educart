import {Feedback} from '../components/Feedback';
import {useEffect,useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {CalendarDays,RefreshCw,X} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import BrandLogo from '../components/BrandLogo';
import {supabase} from '../lib/supabase';
import {addCalendarDays,isWeekday,showDate,shiftLabel,todayInSaoPaulo,type Shift} from '../lib/reservations';
import {publicAvailabilityWindows,publicDateSelection,PUBLIC_PAGE_SIZE} from '../lib/publicAvailabilityDates';

type Slot={usage_date:string;cart_id:string;cart_name:string;capacity:number;shift:Shift;reserved:number;available:number};

function firstBusinessDay(){
  let day=todayInSaoPaulo();
  while(!isWeekday(day))day=addCalendarDays(day,1);
  return day;
}
const initialDay=firstBusinessDay();

export default function PublicCartAvailabilityPage(){
  const [start,setStart]=useState(initialDay);
  const [end,setEnd]=useState('');
  const [cartId,setCartId]=useState('');
  const [pageIndex,setPageIndex]=useState(0);

  const selection=useMemo(()=>publicDateSelection(start,end),[start,end]);
  const dates=selection.dates;
  const first=selection.first,last=selection.last;
  const windows=useMemo(()=>selection.error?[]:publicAvailabilityWindows(first,last),[selection.error,first,last]);
  const query=useQuery({
    queryKey:['public-cart-availability',first,last],
    enabled:dates.length>0,
    queryFn:async():Promise<Slot[]>=>{
      const output:Slot[][]=new Array(windows.length);
      let next=0;
      async function worker(){
        while(next<windows.length){
          const index=next++;
          const period=windows[index];
          const {data,error}=await supabase.rpc('public_cart_availability',{p_start:period.start,p_end:period.end});
          if(error)throw error;
          output[index]=(data??[]) as Slot[];
        }
      }
      // Evita sobrecarregar a API anônima ao consultar até um ano.
      await Promise.all(Array.from({length:Math.min(2,windows.length)},()=>worker()));
      return output.flat();
    },
    staleTime:30_000,
    refetchInterval:dates.length>25?300_000:60_000,
    refetchOnWindowFocus:true
  });
  useEffect(()=>setPageIndex(0),[start,end]);
  const carts=useMemo(()=>[...new Map((query.data??[]).map(row=>[row.cart_id,{id:row.cart_id,name:row.cart_name}])).values()]
    .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),[query.data]);
  const visible=(query.data??[]).filter(row=>!cartId||row.cart_id===cartId);
  const occupied=visible.filter(row=>row.reserved>0).length;
  const pageCount=Math.max(1,Math.ceil(dates.length/PUBLIC_PAGE_SIZE));
  const safeIndex=Math.min(pageIndex,pageCount-1);
  const pageDates=dates.slice(safeIndex*PUBLIC_PAGE_SIZE,(safeIndex+1)*PUBLIC_PAGE_SIZE);
  const dateSummary=selection.error?'Selecione as datas':
    selection.typeLabel+' · '+showDate(first)+(last===first?'':' a '+showDate(last));

  function updateStart(next:string){
    setStart(next);
    if(end&&end<next)setEnd('');
  }
  return <main id="main-content" className="public-agenda calendar-page">
    <header className="public-agenda-header">
      <div><BrandLogo tone="light"/><span className="eyebrow">CONSULTA PÚBLICA · LABORATÓRIOS MÓVEIS</span><h1>Disponibilidade dos carrinhos</h1>
        <p>Escolha a data para consultar um dia. Para consultar vários dias, informe também até quando.</p></div>
      <div className="public-agenda-header-actions"><ThemeToggle/><a className="secondary" href="#/login">Acesso ao sistema</a></div>
    </header>
    <section className="panel calendar-filters" aria-label="Filtros da consulta pública">
      <div className="calendar-filter-grid">
        <div className="field public-date-field">
          <span>Datas da consulta</span>
          <div className="public-date-range">
            <label htmlFor="public-focus"><span>Dia</span>
              <input id="public-focus" type="date" aria-label="Dia da consulta" value={start}
                onChange={e=>updateStart(e.target.value)}/></label>
            <label htmlFor="public-end"><span>Até (opcional)</span>
              <span className="public-end-control">
                <input id="public-end" type="date" aria-label="Data final (opcional)" value={end}
                  min={start||undefined} onChange={e=>setEnd(e.target.value)}/>
                {end&&<button type="button" className="public-clear-end" onClick={()=>setEnd('')}
                  aria-label="Limpar data final" title="Voltar a consultar apenas um dia"><X size={16} aria-hidden="true"/></button>}
              </span>
            </label>
          </div>
        </div>
        <label className="field" htmlFor="public-cart"><span>Carrinho</span>
          <select id="public-cart" value={cartId} onChange={e=>setCartId(e.target.value)}>
            <option value="">Todos os carrinhos</option>
            {carts.map(cart=><option key={cart.id} value={cart.id}>{cart.name}</option>)}
          </select></label>
        <button type="button" className="secondary public-agenda-refresh"
          onClick={()=>void query.refetch()} disabled={query.isFetching||dates.length===0}>
          <RefreshCw size={16} aria-hidden="true"/> Atualizar disponibilidade
        </button>
      </div>
      {selection.error&&<Feedback kind="error">{selection.error}</Feedback>}
    </section>
    <div className="stats calendar-stats">
      <div className="stat"><span className="stat-label">Carrinhos ativos</span><strong>{dates.length===0||query.isLoading?'—':carts.length}</strong></div>
      <div className="stat"><span className="stat-label">Turnos com reserva</span><strong>{dates.length===0||query.isLoading?'—':occupied}</strong></div>
      <div className="stat"><span className="stat-label">Datas consultadas</span><strong>{dateSummary}</strong></div>
    </div>
    <section className="panel calendar-result">
      <div className="calendar-header"><h2><CalendarDays size={20} aria-hidden="true"/> Agenda de reservas</h2>
        <p className="reservation-subtle">Apenas dias úteis. Reservas canceladas não ocupam vagas.</p></div>
      {selection.error?<p className="calendar-empty">Ajuste a data acima para consultar a disponibilidade.</p>:
        query.isLoading?<p role="status">Carregando disponibilidade para {dates.length} dia(s) útil(eis)…</p>:
        query.error?<Feedback kind="error">Não foi possível consultar as reservas. Tente atualizar mais tarde.</Feedback>:
        carts.length===0?<p>Nenhum carrinho ativo disponível para consulta.</p>:
        <>
          {pageCount>1&&<nav className="public-day-pagination" aria-label="Navegação dos dias consultados">
            <span>Exibindo {safeIndex*PUBLIC_PAGE_SIZE+1}–{Math.min((safeIndex+1)*PUBLIC_PAGE_SIZE,dates.length)} de {dates.length} dias úteis</span>
            <div className="public-pagination-actions">
              <button type="button" className="secondary" disabled={safeIndex===0} onClick={()=>setPageIndex(i=>Math.max(0,i-1))}>Anteriores</button>
              <button type="button" className="secondary" disabled={safeIndex===pageCount-1} onClick={()=>setPageIndex(i=>Math.min(pageCount-1,i+1))}>Próximos</button>
            </div>
          </nav>}
          <div className={'calendar-grid '+(dates.length===1?'public-single-day':'')}>{pageDates.map(selectedDay=>{
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
                      <span>{slot.capacity===0?'Indisponível':slot.reserved===0?'Livre':slot.available===0?'Totalmente reservado':'Parcialmente reservado'}</span>
                      <span>{slot.reserved} de {slot.capacity} notebooks reservados · {slot.available} disponíveis</span>
                    </div>)}
                  </div>
                )}</div>}
            </article>;
          })}</div>
        </>}
    </section>
    <p className="form-hint">Consulta apenas informativa, atualizada automaticamente enquanto esta página estiver aberta. A disponibilidade pode mudar quando novas reservas forem confirmadas. Para solicitar uma reserva, entre em contato com a equipe de TI.</p>
  </main>;
}
