import {SHIFTS,type Shift} from './reservations';
import type {Cart,Requester,Notebook} from './supabase';
export type DashboardPeriod={id:string;reservation_id:string;cart_id:string;usage_date:string;shift:Shift;quantity:number;active:boolean;reservations:{requester_id:string;status:string;destination_label:string|null}|null};
export type DashboardMovement={id:string;period_id:string;cart_id:string;requester_id:string;usage_date:string;shift:Shift;quantity:number;pickup_at:string;return_at:string|null};
export type DashboardMaintenance={id:string;cart_id:string;start_date:string;end_date:string;shifts:Shift[];closed_at:string|null};
export type DashboardRequest={id:string;cart_id:string;requester_id:string;dates:string[];shifts:Shift[];quantity:number;status:string;created_at:string};
export type DashboardData={carts:Cart[];requesters:Requester[];notebooks:Notebook[];periods:DashboardPeriod[];movements:DashboardMovement[];maintenance:DashboardMaintenance[];requests:DashboardRequest[]};
export type DashboardFilter={cartId:string;shift:Shift|'all';start:string;end:string};
export function dashboardSummary(data:DashboardData,today:string,filter:DashboardFilter){
 const start=filter.start;
 const end=filter.end||start;
 const latest=end>today?end:today;
 const matches=(id:string,shifts:Shift[])=> (!filter.cartId||id===filter.cartId)&&(filter.shift==='all'||shifts.includes(filter.shift));
 const periods=data.periods.filter(p=>p.active&&p.usage_date>=today&&p.usage_date<=latest&&p.reservations?.status==='CONFIRMADA'&&matches(p.cart_id,[p.shift]))
  .sort((a,b)=>a.usage_date.localeCompare(b.usage_date)||SHIFTS.indexOf(a.shift)-SHIFTS.indexOf(b.shift)||a.id.localeCompare(b.id));
 const todayPeriods=periods.filter(p=>p.usage_date===today);
 const movements=data.movements.filter(m=>matches(m.cart_id,[m.shift]));
 const byPeriod=new Map(movements.map(m=>[m.period_id,m]));
 const status=(p:DashboardPeriod)=>{const m=byPeriod.get(p.id);return m?(m.return_at?'Devolvida':'Retirada registrada'):'Aguardando retirada';};
 const pendingReturns=movements.filter(m=>!m.return_at).sort((a,b)=>a.pickup_at.localeCompare(b.pickup_at)||a.id.localeCompare(b.id));
 const maintenance=data.maintenance.filter(m=>!m.closed_at&&m.start_date<=end&&m.end_date>=start&&matches(m.cart_id,m.shifts))
  .sort((a,b)=>a.start_date.localeCompare(b.start_date)||a.id.localeCompare(b.id));
 const pendingRequests=data.requests.filter(r=>r.status==='PENDENTE'&&matches(r.cart_id,r.shifts))
  .sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
 const carts=data.carts.filter(c=>!filter.cartId||c.id===filter.cartId);
 return {todayPeriods,upcoming:periods.filter(p=>p.usage_date>today&&p.usage_date>=start&&p.usage_date<=end),pendingReturns,maintenance,pendingRequests,status,
  awaitingPickup:todayPeriods.filter(p=>!byPeriod.has(p.id)).length,
  returnedToday:todayPeriods.filter(p=>!!byPeriod.get(p.id)?.return_at).length,
  pendingQuantity:pendingReturns.reduce((n,m)=>n+m.quantity,0),
  overdueReturns:pendingReturns.filter(m=>m.usage_date<today).length,
  maintenanceToday:data.maintenance.filter(m=>!m.closed_at&&m.start_date<=today&&m.end_date>=today&&matches(m.cart_id,m.shifts)).length,
  capacity:carts.filter(c=>c.active).reduce((n,c)=>n+c.capacity,0),
  cartCount:carts.length,teacherCount:data.requesters.length,
  identified:data.notebooks.filter(n=>!filter.cartId||n.cart_id===filter.cartId).length};
}
