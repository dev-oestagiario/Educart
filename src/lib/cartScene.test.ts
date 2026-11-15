import {describe,it,expect} from 'vitest';
import {buildCartSlots} from './cartScene';
describe('projeção 3D da disponibilidade',()=>{
 it('sempre renderiza a capacidade cadastrada mesmo com menos códigos conhecidos',()=>{
   const codes=Array.from({length:28},(_,i)=>({id:'id-'+i,code:'NT-'+i}));
   const slots=buildCartSlots(30,codes,[],[]);
   expect(slots).toHaveLength(30);
   expect(slots.filter(s=>s.reserved)).toHaveLength(0);
 });
 it('reserva quantidade parcial sem atribuir códigos fictícios',()=>{
   const known=Array.from({length:28},(_,i)=>({id:'id-'+i,code:'NT-'+i}));
   const slots=buildCartSlots(30,known,[{id:'period-1',reservation_id:'booking-1',quantity:10}],[]);
   expect(slots.filter(s=>s.reserved)).toHaveLength(10);
   expect(slots.filter(s=>!s.reserved)).toHaveLength(20);
   expect(slots.filter(s=>s.reserved&&s.code)).toHaveLength(0);
 });
 it('destaca código físico somente quando atribuído explicitamente',()=>{
   const slots=buildCartSlots(5,[{id:'n1',code:'FISICO-1'}],
     [{id:'p1',reservation_id:'b1',quantity:2}],[{period_id:'p1',notebook_id:'n1'}]);
   const named=slots.find(s=>s.code==='FISICO-1');
   expect(named).toMatchObject({reserved:true,confirmedCode:true,reservationId:'b1'});
   expect(slots.filter(s=>s.reserved)).toHaveLength(2);
 });
 it('reserva completa ocupa toda a capacidade, sem criar unidades extras',()=>{
   const slots=buildCartSlots(30,[],[{id:'p',reservation_id:'b',quantity:30}],[]);
   expect(slots).toHaveLength(30);
   expect(slots.every(s=>s.reserved)).toBe(true);
 });
});
