import {z} from 'zod';
import {isWeekday,isValidIsoDate,SHIFTS,todayInSaoPaulo} from './reservations';

export const teacherRequestSchema=z.object({
  cart_id:z.string().uuid('Selecione um carrinho válido'),
  mode:z.enum(['COMPLETA','PARCIAL']),
  quantity:z.number().int().positive('Informe uma quantidade válida'),
  dates:z.array(z.string().refine(isValidIsoDate)).min(1).max(93),
  shifts:z.array(z.enum(SHIFTS)).min(1,'Selecione um turno').max(3),
  needs_mouse:z.boolean(),
  notes:z.string().max(1000,'Observações devem ter até 1000 caracteres')
}).superRefine((input,ctx)=>{
  if(input.dates.some(date=>!isWeekday(date)||date<todayInSaoPaulo()))
    ctx.addIssue({code:'custom',path:['dates'],message:'Use datas úteis de hoje em diante'});
  if(new Set(input.dates).size!==input.dates.length)
    ctx.addIssue({code:'custom',path:['dates'],message:'Há datas duplicadas'});
  if(new Set(input.shifts).size!==input.shifts.length)
    ctx.addIssue({code:'custom',path:['shifts'],message:'Há turnos duplicados'});
});

export type TeacherRequestInput=z.infer<typeof teacherRequestSchema>;
export type RequestStatus='PENDENTE'|'APROVADA'|'REJEITADA'|'DESISTENCIA';
export type TeacherRequest={
  id:string;requester_id:string;requested_by:string;cart_id:string;
  mode:'COMPLETA'|'PARCIAL';quantity:number;dates:string[];shifts:string[];
  needs_mouse:boolean;notes:string|null;status:RequestStatus;review_notes:string|null;
  reservation_id:string|null;created_at:string;reviewed_at:string|null
};
export const requestStatusLabel:Record<RequestStatus,string>={
  PENDENTE:'Aguardando aprovação',APROVADA:'Aprovada',
  REJEITADA:'Rejeitada',DESISTENCIA:'Retirada pelo professor'
};

export function validateTeacherRequest(input:TeacherRequestInput,cartCapacity:number){
  const valid=teacherRequestSchema.parse(input);
  if(!Number.isInteger(cartCapacity)||cartCapacity<=0||valid.quantity>cartCapacity)
    throw new Error('Quantidade acima da capacidade do carrinho');
  if(valid.mode==='COMPLETA'&&valid.quantity!==cartCapacity)
    throw new Error('Carrinho completo precisa reservar toda a capacidade configurada');
  return valid;
}
