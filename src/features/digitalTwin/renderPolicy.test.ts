import {describe,it,expect,vi} from 'vitest';
import {resolveQuality,detailIds,frameScheduler,sceneKey,pageSlice} from './renderPolicy';
import type {SceneCart,OverviewLayout} from './overviewLayout';

const cart=(i:number):SceneCart=>({id:'cart-'+i,code:'C'+i,name:'Carrinho '+i,location:'Sala',storage:'Guarda',zoneId:'z',x:i*2,y:0,z:0,yaw:0,width:1,depth:.8,status:'FREE',placed:true});
const carts=Array.from({length:120},(_,i)=>cart(i));
describe('F5.5 política de renderização',()=>{
 it('auto limita dispositivos pequenos, rede econômica e inventários grandes; escolha explícita prevalece',()=>{
  expect(resolveQuality('auto',390,8,false,2)).toBe('low');
  expect(resolveQuality('auto',1280,4,false,2)).toBe('low');
  expect(resolveQuality('auto',1280,8,true,2)).toBe('low');
  expect(resolveQuality('auto',1280,8,false,81)).toBe('low');
  expect(resolveQuality('auto',1280,undefined,false,80)).toBe('high');
  expect(resolveQuality('high',390,2,true,120)).toBe('high');
  expect(resolveQuality('low',1920,16,false,2)).toBe('low');
 });
 it('visão distante sem foco não aloca modelos de carrinho',()=>expect(detailIds(carts,null,null,{x:0,z:0},10).size).toBe(0));
 it('prioriza foco e seleção, inclusive distantes, com teto de 12',()=>{
  const ids=detailIds(carts,'cart-119','cart-118',{x:0,z:0},80);
  expect(ids.size).toBe(12);expect(ids.has('cart-119')).toBe(true);expect(ids.has('cart-118')).toBe(true);
  expect(ids.has('cart-0')).toBe(true);expect(ids.has('cart-40')).toBe(false);
 });
 it('histerese reduz trocas de LOD no limiar',()=>{
  const list=[cart(0)];
  expect(detailIds(list,null,null,{x:0,z:0},40).size).toBe(0);
  expect(detailIds(list,null,null,{x:0,z:0},40,new Set(['cart-0'])).size).toBe(1);
  expect(detailIds(list,null,null,{x:0,z:0},20,new Set(['cart-0'])).size).toBe(0);
 });
 it('chave de cena independente de identidade do objeto, mas sensível a estado, posição e nome',()=>{
  const l:OverviewLayout={width:8,depth:6,zones:[],carts:[cart(0)]};
  expect(sceneKey(structuredClone(l))).toBe(sceneKey(l));
  for(const patch of [{status:'UNKNOWN'},{x:2},{code:'Outro'},{placed:false}] as Partial<SceneCart>[])expect(sceneKey({...l,carts:[{...l.carts[0]!,...patch}]})).not.toBe(sceneKey(l));
 });
 it('agrupa eventos num frame e permite reagendar após a execução',()=>{
  const queue=new Map<number,FrameRequestCallback>(),draw=vi.fn();let seq=0;
  const schedule=frameScheduler(draw,fn=>{queue.set(++seq,fn);return seq;},id=>{queue.delete(id);});
  for(let i=0;i<100;i++)schedule.schedule();expect(queue.size).toBe(1);
  queue.get(1)!(0);queue.delete(1);expect(draw).toHaveBeenCalledTimes(1);
  schedule.schedule();expect(queue.size).toBe(1);schedule.dispose();expect(queue.size).toBe(0);schedule.schedule();expect(queue.size).toBe(0);
 });
 it('cancelamento impede callback já despachado de renderizar',()=>{
  let cb:FrameRequestCallback|undefined;const draw=vi.fn();
  const s=frameScheduler(draw,f=>{cb=f;return 1;},()=>{});s.schedule();s.dispose();cb!(0);expect(draw).not.toHaveBeenCalled();
 });
 it('paginação não perde carrinhos nem deixa índice inválido após filtro',()=>{
  expect([0,1,2].flatMap(i=>pageSlice(carts,i).items)).toEqual(carts);
  expect(pageSlice(carts,9).page).toBe(2);expect(pageSlice(carts.slice(0,1),2).page).toBe(0);
  expect(pageSlice([],2)).toEqual({items:[],page:0,pages:1});
 });
});
