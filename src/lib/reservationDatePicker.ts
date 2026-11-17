import {addCalendarDays,isValidIsoDate,isWeekday,showDate} from './reservations';

export type ReservationDateMode='single'|'range'|'multiple';
export type ReservationDateSelection={
  mode:ReservationDateMode;
  startDate:string;
  endDate:string;
  specificDates:string[];
};

export function firstBookableDate(today:string):string{
  let date=today;
  while(!isWeekday(date))date=addCalendarDays(date,1);
  return date;
}

export function reservationDatePreset(start:string,kind:'day'|'week'|'month'):{
  startDate:string;endDate:string;mode:'single'|'range'
}{
  if(!isValidIsoDate(start)||!isWeekday(start))throw new Error('A data inicial precisa ser um dia útil');
  if(kind==='day')return {startDate:start,endDate:start,mode:'single'};
  if(kind==='week')return {startDate:start,endDate:addCalendarDays(start,6),mode:'range'};
  const initial=new Date(start+'T12:00:00Z');
  const year=initial.getUTCFullYear(),month=initial.getUTCMonth(),day=initial.getUTCDate();
  const nextMonthLastDay=new Date(Date.UTC(year,month+2,0)).getUTCDate();
  const endExclusive=new Date(Date.UTC(year,month+1,Math.min(day,nextMonthLastDay),12));
  endExclusive.setUTCDate(endExclusive.getUTCDate()-1);
  return {startDate:start,endDate:endExclusive.toISOString().slice(0,10),mode:'range'};
}
export function toggleSpecificDate(current:readonly string[],date:string):string[]{
  if(!isValidIsoDate(date)||!isWeekday(date))return [...current];
  return current.includes(date)?current.filter(x=>x!==date):[...current,date].sort();
}
export function describeReservationSelection(value:ReservationDateSelection,validDates:readonly string[]):string {
  if(!validDates.length)return 'Selecionar data ou período';
  if(value.mode==='single')return showDate(validDates[0]);
  if(value.mode==='multiple')return validDates.length===1?showDate(validDates[0]):
    validDates.length+' dias selecionados';
  return showDate(validDates[0])+' – '+showDate(validDates[validDates.length-1]);
}
