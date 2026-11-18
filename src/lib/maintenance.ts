import {useQuery} from '@tanstack/react-query';
import {supabase} from './supabase';
import type {Shift,SlotAvailability} from './reservations';
export type MaintenanceWindow={cart_id:string;start_date:string;end_date:string;shifts:Shift[];closed_at:string|null};
export function isMaintenanceBlocked(windows:readonly MaintenanceWindow[],cartId:string,date:string,shift:Shift){
 return windows.some(w=>w.cart_id===cartId&&!w.closed_at&&w.start_date<=date&&date<=w.end_date&&w.shifts.includes(shift));
}
export function applyMaintenance(slots:SlotAvailability[],windows:readonly MaintenanceWindow[],cartId:string):SlotAvailability[]{
 return slots.map(slot=>isMaintenanceBlocked(windows,cartId,slot.date,slot.shift)?{...slot,capacity:0,remaining:0}:slot);
}
export function useMaintenanceWindows(cartId:string,start:string,end:string){
 return useQuery({queryKey:['maintenance','window',cartId,start,end],enabled:!!cartId&&!!start&&!!end,retry:false,
 queryFn:async()=>{
  const rows:MaintenanceWindow[]=[];
  for(let offset=0;;offset+=250){
   const {data,error}=await supabase.from('maintenance_windows').select('cart_id,start_date,end_date,shifts,closed_at').eq('cart_id',cartId).is('closed_at',null).lte('start_date',end).gte('end_date',start).order('id').range(offset,offset+249);
   if(error)throw error;const page=(data??[]) as MaintenanceWindow[];rows.push(...page);if(page.length<250)return rows;
  }
 }});
}
