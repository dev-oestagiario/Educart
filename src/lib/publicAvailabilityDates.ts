import {addCalendarDays,isValidIsoDate,isWeekday} from './reservations';

export const MAX_PUBLIC_DAYS=366;
export const PUBLIC_PAGE_SIZE=25;
const RPC_WINDOW_DAYS=35;

export type PublicSelection={
  first:string;
  last:string;
  dates:string[];
  typeLabel:string;
  error:string|null;
};

function dayCount(start:string,end:string){
  const from=new Date(start+'T12:00:00Z').getTime();
  const to=new Date(end+'T12:00:00Z').getTime();
  return Math.round((to-from)/86400000)+1;
}
function periodName(first:string,last:string,totalDays:number,weekdays:number){
  if(totalDays===1)return '1 dia';
  if(totalDays===5&&isWeekday(first)&&
    new Date(first+'T12:00:00Z').getUTCDay()===1 &&
    new Date(last+'T12:00:00Z').getUTCDay()===5)return '1 semana';
  if(totalDays%7===0 && totalDays<=28)return (totalDays/7)+' semana'+(totalDays===7?'':'s');
  if(totalDays>=28&&totalDays<=31)return '1 mês';
  if(totalDays>=365&&totalDays<=366)return '1 ano';
  return weekdays+' dias úteis';
}
export function publicDateSelection(start:string,optionalEnd:string):PublicSelection{
  const empty={first:'',last:'',dates:[],typeLabel:'',error:''};
  if(!isValidIsoDate(start))return {...empty,error:'Escolha uma data válida.'};
  const last=optionalEnd||start;
  if(!isValidIsoDate(last))return {...empty,error:'Escolha uma data final válida.'};
  if(last<start)return {...empty,error:'A data final deve ser igual ou posterior à inicial.'};
  const length=dayCount(start,last);
  if(length>MAX_PUBLIC_DAYS)return {...empty,error:'Selecione no máximo um ano por consulta.'};
  const dates:string[]=[];
  for(let current=start;current<=last;current=addCalendarDays(current,1)){
    if(isWeekday(current))dates.push(current);
  }
  if(!dates.length)return {...empty,error:'O período não possui dias úteis. Escolha outra data.'};
  return {first:start,last,dates,typeLabel:periodName(start,last,length,dates.length),error:null};
}
export function publicAvailabilityWindows(start:string,end:string){
  if(!isValidIsoDate(start)||!isValidIsoDate(end)||end<start||dayCount(start,end)>MAX_PUBLIC_DAYS)
    return [] as {start:string;end:string}[];
  const windows:{start:string;end:string}[]=[];
  for(let current=start;current<=end;){
    const maxEnd=addCalendarDays(current,RPC_WINDOW_DAYS-1);
    const last=maxEnd<end?maxEnd:end;
    windows.push({start:current,end:last});
    current=addCalendarDays(last,1);
  }
  return windows;
}
