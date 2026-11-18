import type {QueryClient} from '@tanstack/react-query';
// Query keys are arrays: ['calendar-'] does not match ['calendar-periods'].
const dependentKeys=['reservation-periods','reservations','booking-periods','reservation-events','calendar-periods','calendar-bookings','operational-dashboard','movement-periods','teacher-availability','3d-periods','spatial'];
export function invalidateReservationViews(qc:QueryClient){
 return Promise.all(dependentKeys.map(key=>qc.invalidateQueries({queryKey:[key]})));
}
export async function collectPages<T>(get:(start:number,end:number)=>PromiseLike<{data:unknown;error:unknown}>,size=250):Promise<T[]>{
 const result:T[]=[];
 for(let offset=0;;offset+=size){
  const {data,error}=await get(offset,offset+size-1);if(error)throw error;
  const page=(data??[]) as T[];result.push(...page);
  if(page.length<size)return result;
 }
}
