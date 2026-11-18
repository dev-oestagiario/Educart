import {describe,it,expect} from 'vitest';
import {QueryClient} from '@tanstack/react-query';
import {collectPages,invalidateReservationViews} from './queryRefresh';
describe('consulta e atualização dos fluxos',()=>{
 it('coleta todas as páginas sem truncar dados',async()=>{
  const source=Array.from({length:613},(_,i)=>i);const calls:number[][]=[];
  expect(await collectPages<number>(async(a,b)=>{calls.push([a,b]);return {data:source.slice(a,b+1),error:null};})).toEqual(source);
  expect(calls).toEqual([[0,249],[250,499],[500,749]]);
 });
 it('não devolve resultado parcial em caso de falha',async()=>{
  await expect(collectPages<number>(async(a)=>a?{data:null,error:new Error('falha')}:{data:[1,2],error:null},2)).rejects.toThrow('falha');
 });
 it('invalida recortes dependentes e preserva consultas não relacionadas',async()=>{
  const qc=new QueryClient();
  const keys=[['calendar-periods','semana'],['calendar-bookings','id'],['operational-dashboard','date'],['booking-periods',['id']],['movement-periods','date'],['teacher-availability','id'],['spatial','overview-detail','cart'],['spatial','notebook-history','cart','notebook'],['notifications']];
  keys.forEach(k=>qc.setQueryData(k,[1]));
  await invalidateReservationViews(qc);
  expect(keys.map(k=>qc.getQueryState(k)?.isInvalidated)).toEqual([true,true,true,true,true,true,true,true,false]);
  qc.clear();
 });
});
