import {useEffect,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,Check, X} from 'lucide-react';
import {isValidIsoDate,isWeekday,showDate,todayInSaoPaulo} from '../lib/reservations';
import {
  describeReservationSelection,firstBookableDate,reservationDatePreset,
  toggleSpecificDate,type ReservationDateSelection,type ReservationDateMode
} from '../lib/reservationDatePicker';

type Props={
  value:ReservationDateSelection;
  selectedDates:string[];
  onChange:(next:ReservationDateSelection)=>void;
  minDate?:string;
};
const weekDays=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
function daysOfMonth(ym:string):Array<string|null>{
  const [y,m]=ym.split('-').map(Number);
  const first=new Date(Date.UTC(y,m-1,1,12));
  const padding=(first.getUTCDay()+6)%7;
  const total=new Date(Date.UTC(y,m,0,12)).getUTCDate();
  return [...Array<string|null>(padding).fill(null),
    ...Array.from({length:total},(_,i)=>ym+'-'+String(i+1).padStart(2,'0'))];
}
function monthLabel(ym:string){
  return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})
    .format(new Date(ym+'-01T12:00:00Z'));
}
function changeMonth(ym:string,delta:number){
  const [y,m]=ym.split('-').map(Number);
  const d=new Date(Date.UTC(y,m-1+delta,1,12));
  return d.toISOString().slice(0,7);
}
export default function ReservationDatePicker({value,selectedDates,onChange,minDate=todayInSaoPaulo()}:Props){
  const min=firstBookableDate(minDate);
  const [open,setOpen]=useState(false);
  const [month,setMonth]=useState(()=>value.startDate?.slice(0,7)||min.slice(0,7));
  const [awaitEnd,setAwaitEnd]=useState(false);
  const rootRef=useRef<HTMLDivElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(e:PointerEvent)=>{
      if(rootRef.current&&!rootRef.current.contains(e.target as Node))setOpen(false);
    };
    const escape=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){setOpen(false);triggerRef.current?.focus();}
    };
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  function closePicker(){setOpen(false);triggerRef.current?.focus();}
  function changeMode(mode:ReservationDateMode){
    setAwaitEnd(false);
    if(mode==='single')onChange({...value,mode,endDate:value.startDate});
    else if(mode==='multiple'){
      onChange({...value,mode,specificDates:selectedDates.length?selectedDates:[min]});
    } else onChange({...value,mode,endDate:value.endDate>=value.startDate?value.endDate:value.startDate});
  }
  function selectDate(date:string){
    if(date<minDate||!isWeekday(date))return;
    if(value.mode==='multiple'){
      onChange({...value,specificDates:toggleSpecificDate(value.specificDates,date)});
      return;
    }
    if(value.mode==='single'){
      onChange({...value,startDate:date,endDate:date});
      closePicker();
      return;
    }
    if(!awaitEnd){
      onChange({...value,startDate:date,endDate:date});
      setAwaitEnd(true);
      return;
    }
    onChange({...value,startDate:date<value.startDate?date:value.startDate,
      endDate:date<value.startDate?value.startDate:date});
    setAwaitEnd(false);
    closePicker();
  }
  function usePreset(kind:'day'|'week'|'month'){
    const anchor=isValidIsoDate(value.startDate)&&value.startDate>=minDate&&isWeekday(value.startDate)
      ?value.startDate:min;
    const {startDate,endDate,mode}=reservationDatePreset(anchor,kind);
    onChange({...value,mode,startDate,endDate});
    setAwaitEnd(false);
    setMonth(startDate.slice(0,7));
    closePicker();
  }
  function openPicker(){
    setOpen(x=>!x);
    setAwaitEnd(false);
    if(value.startDate)setMonth(value.startDate.slice(0,7));
  }
  const rendered=daysOfMonth(month);
  const earliestMonth=minDate.slice(0,7);
  return <div className="reservation-date-picker" ref={rootRef}>
    <span className="reservation-date-label" id="reservation-date-label">Data ou período da reserva</span>
    <button type="button" id="reservation-date-trigger" ref={triggerRef}
      className="reservation-date-trigger" onClick={openPicker}
      aria-expanded={open} aria-controls="reservation-date-calendar" aria-labelledby="reservation-date-label reservation-date-trigger">
      <CalendarDays size={20} aria-hidden="true"/>
      <span>{describeReservationSelection(value,selectedDates)}</span>
      <span className="reservation-date-trigger-action">{open?'Fechar':'Escolher no calendário'}</span>
    </button>
    {open&&<div className="reservation-date-popover" id="reservation-date-calendar"
      role="group" aria-label="Calendário para escolher as datas da reserva">
      <div className="reservation-date-tabs" role="group" aria-label="Tipo de seleção">
        {([['single','Um dia'],['range','Período'],['multiple','Dias avulsos']] as const).map(([mode,label])=>
          <button type="button" key={mode} className={value.mode===mode?'is-active':''}
            aria-pressed={value.mode===mode} onClick={()=>changeMode(mode)}>{label}</button>)}
      </div>
      <div className="reservation-date-presets" role="group" aria-label="Selecionar duração">
        <span>Seleção rápida:</span>
        <button type="button" onClick={()=>usePreset('day')}>1 dia</button>
        <button type="button" onClick={()=>usePreset('week')}>1 semana</button>
        <button type="button" onClick={()=>usePreset('month')}>1 mês</button>
      </div>
      <p className="reservation-date-instruction" aria-live="polite">
        {value.mode==='single'?'Clique no dia desejado.':
          value.mode==='multiple'?'Toque em cada dia desejado para adicionar ou remover.':
          awaitEnd?'Escolha a data final do período.':'Escolha a data inicial e depois a data final.'}
      </p>
      <div className="reservation-date-month-header">
        <button type="button" aria-label="Mês anterior" onClick={()=>setMonth(x=>changeMonth(x,-1))}
          disabled={month<=earliestMonth}><ChevronLeft size={19} aria-hidden="true"/></button>
        <strong aria-live="polite">{monthLabel(month)}</strong>
        <button type="button" aria-label="Próximo mês" onClick={()=>setMonth(x=>changeMonth(x,1))}>
          <ChevronRight size={19} aria-hidden="true"/></button>
      </div>
      <div className="reservation-date-grid" role="group" aria-label={'Dias de '+monthLabel(month)}>
        {weekDays.map(day=><span className="reservation-date-weekday" key={day}>{day}</span>)}
        {rendered.map((date,i)=>date?(()=>{
          const weekend=!isWeekday(date),past=date<minDate;
          const selected=value.mode==='multiple'?value.specificDates.includes(date):
            value.mode==='single'?date===value.startDate:
              date>=value.startDate&&date<=value.endDate;
          const isEndpoint=value.mode==='range'&&(date===value.startDate||date===value.endDate);
          return <button key={date} type="button" className={[
            'reservation-date-day',selected?'is-selected':'',isEndpoint?'is-endpoint':''
          ].join(' ')} disabled={weekend||past}
            aria-label={'Selecionar '+showDate(date)} aria-pressed={selected}
            title={weekend?'Reservas apenas de segunda a sexta-feira':past?'Data anterior a hoje':showDate(date)}
            onClick={()=>selectDate(date)}>{Number(date.slice(-2))}</button>;
        })():<span className="reservation-date-blank" key={'blank-'+i} aria-hidden="true"/>)}
      </div>
      <div className="reservation-date-popover-footer">
        <span aria-live="polite">{selectedDates.length} dia(s) útil(eis) selecionado(s)</span>
        <button className="secondary" type="button" onClick={closePicker}>
          <Check size={16} aria-hidden="true"/> Concluir
        </button>
        <button className="ghost" type="button" aria-label="Fechar calendário"
          onClick={closePicker}><X size={17} aria-hidden="true"/></button>
      </div>
      <p className="form-hint">Sábados e domingos são desativados. Feriados continuam disponíveis.</p>
    </div>}
  </div>;
}
