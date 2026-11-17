import {describe,it,expect} from 'vitest';
import {defaultWeeklyPattern,weeklyCandidates,expandWeeklyPattern,type WeeklyPattern} from './recurrence';
const today='2026-11-16';
const sample:WeeklyPattern={start:'2026-11-16',end:'2026-12-04',weekdays:[1,3,5],excluded:[]};
describe('recorrência semanal',()=>{
 it('materializa dias selecionados em ordem, inclusive término',()=>{
  expect(expandWeeklyPattern(sample,today)).toEqual(['2026-11-16','2026-11-18','2026-11-20','2026-11-23','2026-11-25','2026-11-27','2026-11-30','2026-12-02','2026-12-04']);
 });
 it('remove e restaura exceções sem alterar o padrão',()=>{
  const exclude={...sample,excluded:['2026-11-20','2026-12-04']};
  expect(weeklyCandidates(exclude,today)).toHaveLength(9);
  expect(expandWeeklyPattern(exclude,today)).toHaveLength(7);
  expect(expandWeeklyPattern(exclude,today)).not.toContain('2026-11-20');
  expect(expandWeeklyPattern(sample,today)).toHaveLength(9);
 });
 it('rejeita dias inválidos, repetidos, padrão vazio e exceção fora do padrão',()=>{
  expect(()=>expandWeeklyPattern({...sample,weekdays:[]},today)).toThrow();
  expect(()=>expandWeeklyPattern({...sample,weekdays:[1,1]},today)).toThrow();
  expect(()=>expandWeeklyPattern({...sample,excluded:['2026-11-17']},today)).toThrow();
  expect(()=>expandWeeklyPattern({...sample,excluded:['2026-11-20','2026-11-20']},today)).toThrow();
 });
 it('rejeita todas as ocorrências excluídas e intervalo sem ocorrência',()=>{
  expect(()=>expandWeeklyPattern({...sample,excluded:weeklyCandidates(sample,today)},today)).toThrow();
  expect(()=>expandWeeklyPattern({...sample,start:'2026-11-21',end:'2026-11-22'},today)).toThrow();
 });
 it('rejeita início no passado, datas inválidas e intervalo invertido ou extenso',()=>{
  for(const patch of [{start:'2026-11-15'},{start:'2026-11-31'},{end:'2026-11-15'},{end:'2027-04-01'}]){
   expect(()=>expandWeeklyPattern({...sample,...patch},today)).toThrow();
  }
 });
 it('cria padrão inicial semanal finito, sem exceções',()=>{
  expect(defaultWeeklyPattern('2026-11-18')).toEqual({start:'2026-11-18',end:'2026-12-16',weekdays:[3],excluded:[]});
 });
 it('limite de 93 datas permite excluir ocorrências excedentes',()=>{
  const p:WeeklyPattern={start:today,end:'2027-03-25',weekdays:[1,2,3,4,5],excluded:[]};
  const candidates=weeklyCandidates(p,today);
  expect(candidates.length).toBe(94);
  expect(()=>expandWeeklyPattern(p,today)).toThrow(/93/);
  expect(expandWeeklyPattern({...p,excluded:[candidates[0]]},today)).toHaveLength(93);
 });
});
