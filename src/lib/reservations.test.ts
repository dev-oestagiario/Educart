import {describe,it,expect} from 'vitest';
import {addCalendarDays,calculateAvailability,expandReservationDates,isWeekday,reservationInputSchema,showDate} from './reservations';
describe('regras de reserva por data/turno',()=>{
 it('mantém apenas dias úteis nos intervalos e não ignora feriados',()=>{
   expect(expandReservationDates('intervalo','2026-11-16','2026-11-22',[],'2026-11-15')).toEqual([
     '2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20'
   ]);
 });
 it('permite datas não consecutivas de segunda a sexta, rejeita fins de semana',()=>{
   expect(expandReservationDates('avulsas','','',['2026-11-16','2026-11-20','2026-11-16'],'2026-11-15')).toEqual(['2026-11-16','2026-11-20']);
   expect(()=>expandReservationDates('avulsas','','',['2026-11-21'],'2026-11-15')).toThrow(/segunda a sexta/);
 });
 it('verifica data inválida e sequência inclusiva no mês',()=>{
   expect(isWeekday('2026-02-30')).toBe(false);
   expect(addCalendarDays('2026-11-30',1)).toBe('2026-12-01');
   expect(showDate('2026-11-16')).toBe('16/11/2026');
   expect(()=>expandReservationDates('intervalo','2026-11-20','2026-11-16',[],'2026-11-15')).toThrow(/ordem/);
 });
 it('não permite períodos apenas no fim de semana nem datas anteriores',()=>{
   expect(()=>expandReservationDates('intervalo','2026-11-21','2026-11-22',[],'2026-11-15')).toThrow(/segunda a sexta/);
   expect(()=>expandReservationDates('avulsas','','',['2026-11-13'],'2026-11-15')).toThrow(/anteriores/);
 });
 it('calcula capacidade por turno sem depender de códigos cadastrados',()=>{
   const out=calculateAvailability(30,[
     {usage_date:'2026-11-16',shift:'MATUTINO',quantity:10,active:true},
     {usage_date:'2026-11-16',shift:'MATUTINO',quantity:5,active:true},
     {usage_date:'2026-11-16',shift:'MATUTINO',quantity:100,active:false}
   ],['2026-11-16'],['MATUTINO','VESPERTINO']);
   expect(out.map(x=>x.remaining)).toEqual([15,30]);
 });
 it('valida lista de turnos e quantidade de notebooks vinculados',()=>{
   const input={
     requester_id:'4e50e08a-28e8-441e-94e5-9784b2e1f81b',
     cart_id:'dd105ea3-b34c-4d6f-98dc-67d269247dee',
     mode:'PARCIAL',quantity:1,dates:['2026-11-16'],shifts:['MATUTINO'],needs_mouse:false,notes:'',
     notebook_ids:['11ce4805-5f63-434d-bd66-655cf8d9007f','c75cb069-e0e7-4657-8ccb-a3d8f46c40a7']
   };
   expect(reservationInputSchema.safeParse(input).success).toBe(false);
   expect(reservationInputSchema.safeParse({...input,notebook_ids:[]}).success).toBe(true);
   expect(reservationInputSchema.safeParse({...input,shifts:[]}).success).toBe(false);
 });
});
