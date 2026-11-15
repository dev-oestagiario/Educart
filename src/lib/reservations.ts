import { z } from 'zod';

export const SHIFTS = ['MATUTINO','VESPERTINO','NOTURNO'] as const;
export type Shift = typeof SHIFTS[number];
export const shiftLabel: Record<Shift,string> = {
  MATUTINO:'Manhã', VESPERTINO:'Tarde', NOTURNO:'Noite'
};

const isoDatePattern=/^\d{4}-\d{2}-\d{2}$/;
export function isValidIsoDate(raw: string): boolean {
  if(!isoDatePattern.test(raw))return false;
  const date=new Date(raw+'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===raw;
}
export function isWeekday(iso: string): boolean {
  if(!isValidIsoDate(iso))return false;
  const day=new Date(iso+'T12:00:00Z').getUTCDay();
  return day>=1&&day<=5;
}
export function todayInSaoPaulo(): string {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=(type:string)=>parts.find(p=>p.type===type)?.value??'';
  return [part('year'),part('month'),part('day')].join('-');
}
export function addCalendarDays(iso: string, count: number): string {
  if(!isValidIsoDate(iso))throw new Error('Data inválida');
  const day=new Date(iso+'T12:00:00Z');
  day.setUTCDate(day.getUTCDate()+count);
  return day.toISOString().slice(0,10);
}
export function expandReservationDates(
  mode:'intervalo'|'avulsas', start:string,end:string,specific:string[],
  today=todayInSaoPaulo()
): string[] {
  let selected:string[]=[];
  if(mode==='intervalo'){
    if(!isValidIsoDate(start)||!isValidIsoDate(end)||end<start){
      throw new Error('Informe um intervalo com datas válidas e em ordem');
    }
    let date=start;
    let daySpan=0;
    while(date<=end) {
      if(++daySpan>130)throw new Error('Selecione um intervalo de até 130 dias corridos');
      if(isWeekday(date))selected.push(date);
      date=addCalendarDays(date,1);
    }
  } else {
    selected=[...new Set(specific)];
    if(selected.some(d=>!isValidIsoDate(d)||!isWeekday(d))) {
      throw new Error('Datas avulsas devem ser de segunda a sexta-feira');
    }
  }
  selected=[...new Set(selected)].sort();
  if(!selected.length)throw new Error('Selecione pelo menos um dia de segunda a sexta');
  if(selected.length>93)throw new Error('O limite é de 93 dias úteis por reserva');
  if(selected.some(day=>day<today))throw new Error('Não é permitido criar reservas em datas anteriores a hoje');
  return selected;
}

export const reservationInputSchema=z.object({
  requester_id:z.string().uuid('Selecione o professor'),
  cart_id:z.string().uuid('Selecione o carrinho'),
  mode:z.enum(['COMPLETA','PARCIAL']),
  quantity:z.number().int().positive(),
  dates:z.array(z.string().refine(isValidIsoDate,'Data inválida')).min(1).max(93),
  shifts:z.array(z.enum(SHIFTS)).min(1,'Selecione ao menos um turno').max(3),
  needs_mouse:z.boolean(),
  notes:z.string().max(1000,'Observação de até 1000 caracteres'),
  notebook_ids:z.array(z.string().uuid())
}).superRefine((data,ctx)=>{
  if(new Set(data.dates).size!==data.dates.length)
    ctx.addIssue({code:'custom',path:['dates'],message:'Datas duplicadas'});
  if(data.dates.some(x=>!isWeekday(x)))
    ctx.addIssue({code:'custom',path:['dates'],message:'Só é permitido reservar de segunda a sexta'});
  if(new Set(data.shifts).size!==data.shifts.length)
    ctx.addIssue({code:'custom',path:['shifts'],message:'Turnos duplicados'});
  if(new Set(data.notebook_ids).size!==data.notebook_ids.length)
    ctx.addIssue({code:'custom',path:['notebook_ids'],message:'Notebook repetido'});
  if(data.notebook_ids.length>data.quantity)
    ctx.addIssue({code:'custom',path:['notebook_ids'],message:'Quantidade de códigos maior que a reserva'});
});

export type UsagePeriod={reservation_id?:string;usage_date:string;shift:Shift;quantity:number;active:boolean};
export type SlotAvailability={date:string;shift:Shift;reserved:number;remaining:number;capacity:number};
export function calculateAvailability(capacity:number,periods:UsagePeriod[],dates:string[],shifts:Shift[]):SlotAvailability[]{
  return dates.flatMap(date=>shifts.map(shift=>{
    const reserved=periods.reduce((sum,p)=>sum+((p.active&&p.usage_date===date&&p.shift===shift)?p.quantity:0),0);
    return {date,shift,reserved,remaining:Math.max(0,capacity-reserved),capacity};
  }));
}
export function showDate(iso:string):string {
  if(!isValidIsoDate(iso))return iso;
  return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric'})
    .format(new Date(iso+'T12:00:00Z'));
}
