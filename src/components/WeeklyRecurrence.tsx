import {useMemo,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import {showDate,addCalendarDays,isValidIsoDate} from '../lib/reservations';
import {WEEKLY_DAYS,weeklyCandidates,expandWeeklyPattern,type WeeklyPattern,type WeeklyDay} from '../lib/recurrence';
type Props={id:string;value:WeeklyPattern;onChange:(value:WeeklyPattern)=>void;today:string;shifts:number;disabled?:boolean};
export default function WeeklyRecurrence({id,value,onChange,today,shifts,disabled=false}:Props){
 const [expanded,setExpanded]=useState(false);
 const result=useMemo(()=>{
  try{
   const candidates=weeklyCandidates(value,today);
   try{return {candidates,dates:expandWeeklyPattern(value,today),error:''};}
   catch(e){return {candidates,dates:[],error:e instanceof Error?e.message:'Recorrência inválida.'};}
  }catch(e){return {candidates:[],dates:[],error:e instanceof Error?e.message:'Recorrência inválida.'};}
 },[value,today]);
 function update(patch:Partial<WeeklyPattern>){onChange({...value,...patch,excluded:[]});setExpanded(false);}
 function toggleDay(day:WeeklyDay,checked:boolean){update({weekdays:checked?[...value.weekdays,day].sort((a,b)=>a-b):value.weekdays.filter(x=>x!==day)});}
 return <fieldset className="reservation-fieldset weekly-recurrence" disabled={disabled}>
  <legend><CalendarDays size={16} aria-hidden="true"/> Recorrência semanal</legend>
  <div className="reservation-dates">
   <label className="field" htmlFor={id+'-start'}><span>Início da recorrência</span><input id={id+'-start'} type="date" min={today} value={value.start} onChange={e=>update({start:e.target.value})}/></label>
   <label className="field" htmlFor={id+'-end'}><span>Término da recorrência</span><input id={id+'-end'} type="date" min={value.start||today} max={isValidIsoDate(value.start)?addCalendarDays(value.start,129):undefined} value={value.end} onChange={e=>update({end:e.target.value})}/></label>
  </div>
  <div className="weekly-days" role="group" aria-label="Dias da semana">{WEEKLY_DAYS.map(d=><label key={d.id}><input type="checkbox" checked={value.weekdays.includes(d.id)} onChange={e=>toggleDay(d.id,e.target.checked)}/>{d.label}</label>)}</div>
  <p className="form-hint">Até 130 dias corridos e 93 ocorrências. Feriados não são excluídos automaticamente; desmarque as datas que não deseja reservar. Alterar o padrão redefine as exceções.</p>
  {result.error&&<p role="alert" className="notice error">{result.error}</p>}
  <div className="weekly-summary" aria-live="polite"><strong>{result.dates.length} ocorrência(s)</strong> · {shifts} turno(s) · {result.dates.length*shifts} período(s){value.excluded.length>0?' · '+value.excluded.length+' exceção(ões)':''}</div>
  {!!result.candidates.length&&<div className="weekly-preview">
   <button className="secondary" type="button" aria-expanded={expanded} aria-controls={id+'-preview'} onClick={()=>setExpanded(v=>!v)}>{expanded?'Ocultar datas':'Revisar datas e exceções'} ({result.candidates.length})</button>
   {expanded&&<div className="weekly-occurrences" id={id+'-preview'}>
    {result.candidates.map(date=><label key={date}><input type="checkbox" aria-label={'Incluir '+showDate(date)} checked={!value.excluded.includes(date)} onChange={e=>onChange({...value,excluded:e.target.checked?value.excluded.filter(d=>d!==date):[...value.excluded,date].sort()})}/><span>{showDate(date)}</span>{value.excluded.includes(date)&&<small>Excluída</small>}</label>)}
   </div>}
  </div>}
 </fieldset>;
}
