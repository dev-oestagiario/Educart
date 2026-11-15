import {describe,it,expect} from 'vitest';
import {parseAvailabilitySlots,summarizeAvailability,slotDescription} from './availabilityPreview';
const dates=['2026-11-16','2026-11-17'];
const shifts=['MATUTINO','VESPERTINO'] as const;
const rows=[
 {usage_date:dates[0],shift:'MATUTINO',capacity:30,reserved:0,remaining:30},
 {usage_date:dates[0],shift:'VESPERTINO',capacity:30,reserved:12,remaining:18},
 {usage_date:dates[1],shift:'MATUTINO',capacity:30,reserved:20,remaining:10},
 {usage_date:dates[1],shift:'VESPERTINO',capacity:30,reserved:30,remaining:0}
];
describe('Fase 8 — disponibilidade em turno',()=>{
 it('preserva capacidade configurada independentemente de códigos físicos',()=>{
   const slots=parseAvailabilitySlots(rows,dates,[...shifts]);
   expect(slots).toHaveLength(4);
   expect(slots[0].remaining).toBe(30);
 });
 it('identifica turnos sem saldo suficiente na prévia',()=>{
   const summary=summarizeAvailability(rows as ReturnType<typeof parseAvailabilitySlots>,15);
   expect(summary).toMatchObject({total:4,withEnough:2,minimumRemaining:0,maximumRemaining:30});
   expect(summary.insufficient.map(slot=>slot.remaining)).toEqual([10,0]);
 });
 it('não conta pedidos pendentes na ocupação',()=>{
   expect(summarizeAvailability([rows[0]] as ReturnType<typeof parseAvailabilitySlots>,30).withEnough).toBe(1);
 });
 it('rejeita conjunto incompleto ou turno diferente dos solicitados',()=>{
   expect(()=>parseAvailabilitySlots(rows.slice(0,3),dates,[...shifts])).toThrow(/incompleta/);
   expect(()=>parseAvailabilitySlots([rows[0],rows[0],rows[2],rows[3]],dates,[...shifts])).toThrow(/inconsistente/);
 });
 it('rejeita saldo inválido e não expõe detalhes de quem reservou',()=>{
   expect(()=>parseAvailabilitySlots([{...rows[0],remaining:29}],['2026-11-16'],['MATUTINO'])).toThrow(/inconsistente/);
   expect(slotDescription(rows[1] as ReturnType<typeof parseAvailabilitySlots>[number])).toContain('Tarde');
 });
});
