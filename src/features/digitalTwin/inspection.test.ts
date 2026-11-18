import {describe,it,expect} from 'vitest';
import {confirmedNotebookRows,safeConfirmedRows,hotspotForName,validateNotebookHistory,type ConfirmedSlot,type NotebookMovement} from './inspection';
const slot:ConfirmedSlot={slot_key:'P-01',notebook_id:'n-1',code:'NB-01',confirmed_at:'2026-11-17T10:00:00Z',reservation_period_id:'r-1'};
const reservation={period_id:'r-1',requester:'Pessoa teste',quantity:2};
const movement:NotebookMovement={id:'m-1',cart_id:'c-1',notebook_ids:['n-1'],pickup_at:'2026-11-17T10:00:00Z',return_at:null,pickup_condition:'BOA',return_condition:null};
describe('F5.4 inspection',()=>{
 it('identifica somente os componentes ilustrativos conhecidos',()=>{
 for(const [name,result] of [['door-hinge','door'],['handle','door'],['shelf-2','shelf'],['divider-0-1','shelf'],['connector-0-1','charging'],['wheel-0','wheels'],['sample-notebook-01','notebook']])expect(hotspotForName(name)).toBe(result);
 for(const name of ['P-01','NB-01','illustrative-slot-01','sample-notebook-1','unknown',''])expect(hotspotForName(name)).toBeNull();
 });
 it('preserva identidade e reserva explícita, sem inferir atribuições',()=>{
 const rows=confirmedNotebookRows([slot,{...slot,notebook_id:'n-2',slot_key:'P-02',code:'NB-02',reservation_period_id:null}],[reservation]);
 expect(rows[0].reservation).toEqual(reservation);expect(rows[1].reservation).toBeNull();
 });
 it('recusa slots e identidades duplicados ou reserva não confirmada',()=>{
 expect(safeConfirmedRows([slot,slot],[reservation])).toBeNull();
 expect(safeConfirmedRows([slot,{...slot,slot_key:'P-02'}],[reservation])).toBeNull();
 expect(safeConfirmedRows([slot,{...slot,notebook_id:'n-2'}],[reservation])).toBeNull();
 expect(safeConfirmedRows([slot],[])).toBeNull();
 expect(safeConfirmedRows([slot],[reservation,reservation])).toBeNull();
 });
 it('recusa confirmação inválida e aceita ausência de vínculos',()=>{
 expect(safeConfirmedRows([{...slot,confirmed_at:'invalid'}],[reservation])).toBeNull();
 expect(safeConfirmedRows([{...slot,code:''}],[reservation])).toBeNull();
 expect(safeConfirmedRows([],[])).toEqual([]);
 });
 it('histórico só aceita UUIDs de notebook explicitamente presentes no carrinho',()=>{
 expect(validateNotebookHistory([movement],'c-1','n-1')).toEqual([movement]);
 expect(validateNotebookHistory([],'c-1','n-1')).toEqual([]);
 expect(()=>validateNotebookHistory([{...movement,notebook_ids:[]}],'c-1','n-1')).toThrow();
 expect(()=>validateNotebookHistory([movement],'c-2','n-1')).toThrow();
 expect(()=>validateNotebookHistory([movement,movement],'c-1','n-1')).toThrow();
 });
 it('histórico exige timestamps e condição de devolução coerentes',()=>{
 expect(validateNotebookHistory([{...movement,return_at:'2026-11-17T11:00:00Z',return_condition:'RESSALVA'}],'c-1','n-1')).toHaveLength(1);
 for(const patch of [{pickup_at:'invalid'},{return_at:'2026-11-17T09:00:00Z',return_condition:'BOA'},{return_at:'2026-11-17T11:00:00Z'},{return_condition:'BOA'}] as Partial<NotebookMovement>[])expect(()=>validateNotebookHistory([{...movement,...patch}],'c-1','n-1')).toThrow();
 });
});
