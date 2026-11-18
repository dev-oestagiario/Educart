import {addCalendarDays,isValidIsoDate,todayInSaoPaulo} from './reservations';
export type WeeklyDay=1|2|3|4|5;
export const WEEKLY_DAYS:readonly {id:WeeklyDay;label:string}[]=[
 {id:1,label:'Segunda-feira'},{id:2,label:'Terça-feira'},{id:3,label:'Quarta-feira'},{id:4,label:'Quinta-feira'},{id:5,label:'Sexta-feira'}
];
export type WeeklyPattern={start:string;end:string;weekdays:WeeklyDay[];excluded:string[]};
export function defaultWeeklyPattern(start:string):WeeklyPattern{
 const weekday=new Date(start+'T12:00:00Z').getUTCDay();
 return {start,end:addCalendarDays(start,28),weekdays:[weekday>=1&&weekday<=5?weekday as WeeklyDay:1],excluded:[]};
}
export function weeklyCandidates(pattern:WeeklyPattern,today=todayInSaoPaulo()):string[]{
 if(!isValidIsoDate(pattern.start)||!isValidIsoDate(pattern.end)||pattern.end<pattern.start)
  throw new Error('Informe datas inicial e final válidas e em ordem.');
 if(pattern.start<today)throw new Error('A data inicial não pode ser anterior a hoje.');
 if(!pattern.weekdays.length||pattern.weekdays.some(d=>!WEEKLY_DAYS.some(w=>w.id===d))||new Set(pattern.weekdays).size!==pattern.weekdays.length)
  throw new Error('Selecione os dias úteis da semana, sem repetições.');
 const result:string[]=[];
 for(let day=pattern.start,n=0;day<=pattern.end;day=addCalendarDays(day,1)){
  if(++n>130)throw new Error('O intervalo de recorrência é de até 130 dias corridos.');
  if(pattern.weekdays.includes(new Date(day+'T12:00:00Z').getUTCDay() as WeeklyDay))result.push(day);
 }
 if(!result.length)throw new Error('Nenhuma ocorrência no intervalo selecionado.');
 return result;
}
export function expandWeeklyPattern(pattern:WeeklyPattern,today=todayInSaoPaulo()):string[]{
 const candidates=weeklyCandidates(pattern,today);
 if(pattern.excluded.some(d=>!candidates.includes(d))||new Set(pattern.excluded).size!==pattern.excluded.length)
  throw new Error('As exceções precisam corresponder a ocorrências do padrão semanal.');
 const selected=candidates.filter(d=>!pattern.excluded.includes(d));
 if(!selected.length)throw new Error('Mantenha ao menos uma ocorrência.');
 if(selected.length>93)throw new Error('O limite é de 93 dias úteis por reserva.');
 return selected;
}
