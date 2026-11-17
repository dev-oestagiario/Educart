import {describe,it,expect} from 'vitest';
import {dashboardSummary,type DashboardData,type DashboardPeriod,type DashboardFilter} from './dashboard';
const today='2026-11-17';
const initial:DashboardFilter={cartId:'',shift:'all',days:7};
const period=(id:string,date:string,shift:DashboardPeriod['shift']='MATUTINO',cart='a',active=true):DashboardPeriod=>({id,reservation_id:id,cart_id:cart,usage_date:date,shift,quantity:4,active,reservations:{requester_id:'p',status:'CONFIRMADA',destination_label:null}});
const data:DashboardData={
 carts:[{id:'a',code:'A',name:'A',capacity:10,active:true,created_at:''},{id:'b',code:'B',name:'B',capacity:8,active:false,created_at:''}],
 requesters:[{id:'p',name:'Professor',reference_code:null,active:true,created_at:''}],notebooks:[],
 periods:[period('today-open',today),period('today-done',today,'VESPERTINO'),period('today-await',today,'NOTURNO'),period('cancelled',today,'MATUTINO','a',false),{...period('cancel-header',today),reservations:{requester_id:'p',status:'CANCELADA',destination_label:null}},period('other',today,'MATUTINO','b'),period('up','2026-11-24'),period('outside','2026-11-25'),period('past','2026-11-16')],
 movements:[{id:'m1',period_id:'today-open',cart_id:'a',requester_id:'p',usage_date:today,shift:'MATUTINO',quantity:3,pickup_at:today+'T09:00:00Z',return_at:null},{id:'m2',period_id:'today-done',cart_id:'a',requester_id:'p',usage_date:today,shift:'VESPERTINO',quantity:2,pickup_at:today+'T13:00:00Z',return_at:today+'T14:00:00Z'},{id:'old',period_id:'past',cart_id:'a',requester_id:'p',usage_date:'2026-10-01',shift:'MATUTINO',quantity:2,pickup_at:'2026-10-01T12:00:00Z',return_at:null}],
 maintenance:[{id:'maint',cart_id:'a',start_date:'2026-11-16',end_date:today,shifts:['NOTURNO'],closed_at:null},{id:'closed',cart_id:'a',start_date:today,end_date:today,shifts:['MATUTINO'],closed_at:today},{id:'far',cart_id:'b',start_date:'2026-11-25',end_date:'2026-11-26',shifts:['MATUTINO'],closed_at:null}],
 requests:[{id:'r1',cart_id:'a',requester_id:'p',dates:['2026-12-15'],shifts:['MATUTINO'],quantity:2,status:'PENDENTE',created_at:'2026-10-01'},{id:'r2',cart_id:'b',requester_id:'p',dates:[today],shifts:['VESPERTINO'],quantity:1,status:'APROVADA',created_at:today}]
};
describe('dashboard operacional',()=>{
 it('conta períodos confirmados, não confirmações canceladas nem pendências de aprovação',()=>{
  const s=dashboardSummary(data,today,initial);
  expect(s.todayPeriods.map(p=>p.id)).toEqual(['other','today-open','today-done','today-await']);
  expect(s.awaitingPickup).toBe(2);expect(s.returnedToday).toBe(1);
  expect(s.pendingRequests.map(r=>r.id)).toEqual(['r1']);
  expect(s.status(s.todayPeriods[1])).toBe('Retirada registrada');
  expect(s.status(s.todayPeriods[2])).toBe('Devolvida');
 });
 it('mantém devoluções antigas e solicitações além do horizonte',()=>{
  const s=dashboardSummary(data,today,initial);
  expect(s.pendingReturns.map(m=>m.id)).toEqual(['old','m1']);
  expect(s.pendingQuantity).toBe(5);expect(s.overdueReturns).toBe(1);
  expect(s.upcoming.map(p=>p.id)).toEqual(['up']);
  expect(dashboardSummary(data,today,{...initial,days:14}).upcoming.map(p=>p.id)).toEqual(['up','outside']);
 });
 it('filtra carrinho e turno e ignora janelas encerradas',()=>{
  const s=dashboardSummary(data,today,{cartId:'a',shift:'NOTURNO',days:7});
  expect(s.todayPeriods.map(p=>p.id)).toEqual(['today-await']);expect(s.pendingReturns).toEqual([]);
  expect(s.maintenance.map(m=>m.id)).toEqual(['maint']);expect(s.maintenanceToday).toBe(1);expect(s.pendingRequests).toEqual([]);
 });
 it('capacidade nominal considera carrinhos ativos, sem descontar custódia',()=>{
  expect(dashboardSummary(data,today,initial).capacity).toBe(10);
  expect(dashboardSummary(data,today,{...initial,cartId:'b'}).capacity).toBe(0);
 });
});
