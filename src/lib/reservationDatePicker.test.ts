import {describe,it,expect} from 'vitest';
import {describeReservationSelection,firstBookableDate,reservationDatePreset,toggleSpecificDate} from './reservationDatePicker';
describe('Calendário de reservas',()=>{
 it('avança para o primeiro dia útil quando a data é fim de semana',()=>{
   expect(firstBookableDate('2026-11-14')).toBe('2026-11-16');
   expect(firstBookableDate('2026-11-15')).toBe('2026-11-16');
   expect(firstBookableDate('2026-11-16')).toBe('2026-11-16');
 });
 it('permite um dia, uma semana e um mês contínuo',()=>{
   expect(reservationDatePreset('2026-11-16','day')).toEqual({
     mode:'single',startDate:'2026-11-16',endDate:'2026-11-16'
   });
   expect(reservationDatePreset('2026-11-16','week').endDate).toBe('2026-11-22');
   expect(reservationDatePreset('2026-11-16','month').endDate).toBe('2026-12-15');
 });
 it('um mês a partir de 31 de janeiro termina no fim de fevereiro, sem overflow',()=>{
   expect(reservationDatePreset('2027-01-29','month').endDate).toBe('2027-02-27');
 });
 it('dias avulsos podem ser adicionados e retirados sem duplicidade',()=>{
   const first=toggleSpecificDate([], '2026-11-16');
   expect(toggleSpecificDate(first,'2026-11-16')).toEqual([]);
   expect(toggleSpecificDate(first,'2026-11-14')).toEqual(first);
   expect(toggleSpecificDate(first,'2026-11-18')).toEqual(['2026-11-16','2026-11-18']);
 });
 it('descreve intervalos e avulsos em linguagem clara',()=>{
   expect(describeReservationSelection({mode:'multiple',startDate:'2026-11-16',endDate:'2026-11-16',
     specificDates:['2026-11-16','2026-11-18']},['2026-11-16','2026-11-18'])).toContain('2 dias');
 });
});
