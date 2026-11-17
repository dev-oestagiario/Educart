import {useQuery} from '@tanstack/react-query';
import {supabase} from './supabase';
export type Campus={id:string;name:string;active:boolean};
export type Block=Campus&{campus_id:string};
export type Room=Campus&{block_id:string};
export type LocationCatalog={campuses:Campus[];blocks:Block[];rooms:Room[]};
async function readAll<T>(table:string,order='id'):Promise<T[]>{
 const result:T[]=[];
 for(let i=0;;i+=250){
  const {data,error}=await supabase.from(table).select('*').order(order).range(i,i+249);
  if(error)throw error;
  const rows=(data??[]) as T[];
  result.push(...rows);if(rows.length<250)return result;
 }
}
export async function loadLocations():Promise<LocationCatalog>{
 const [campuses,blocks,rooms]=await Promise.all([readAll<Campus>('campuses'),readAll<Block>('campus_blocks'),readAll<Room>('campus_rooms')]);
 return {campuses,blocks,rooms};
}
export function useLocations(){return useQuery({queryKey:['locations'],queryFn:loadLocations,retry:false});}
export function roomOptions(catalog:LocationCatalog|undefined,onlyActive=true){
 if(!catalog)return [];
 return catalog.rooms.flatMap(room=>{
  const block=catalog.blocks.find(b=>b.id===room.block_id);
  const campus=catalog.campuses.find(c=>c.id===block?.campus_id);
  if(!block||!campus||(onlyActive&&(!room.active||!block.active||!campus.active)))return [];
  return [{id:room.id,label:campus.name+' / '+block.name+' / '+room.name,active:room.active&&block.active&&campus.active}];
 }).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
}
