import {z} from 'zod';
import {supabase} from '../../lib/supabase';
import {loadLocations,roomOptions} from '../../lib/locations';
import {getSpatialSummary,getSpatialDetails,type SpatialSummary} from './spatialData';
import type {Shift} from '../../lib/reservations';

const id=z.string().uuid();
const dim=z.number().finite().positive();
const sceneSchema=z.object({id,room_id:id,name:z.string(),width_m:dim,depth_m:dim,active:z.boolean()});
const modelSchema=z.object({id,kind:z.enum(['ROOM','CART']),width_m:dim,depth_m:dim,active:z.boolean()});
const movementSchema=z.object({id,cart_id:id,quantity:z.number().int().positive(),pickup_at:z.string(),return_at:z.string().nullable()});
export type MovementSnapshot=z.infer<typeof movementSchema>;
async function readProjection(table:string,columns:string,signal:AbortSignal):Promise<unknown[]>{
 const rows:unknown[]=[];
 for(let offset=0;;offset+=250){
  const {data,error}=await supabase.from(table).select(columns).order('id').range(offset,offset+249).abortSignal(signal);
  if(error)throw error;
  if(!Array.isArray(data))throw Error('Catálogo espacial inválido.');
  rows.push(...data);if(data.length<250)return rows;
 }
}
export async function getOverviewCatalog(signal:AbortSignal){
 const [locations,rooms,models]=await Promise.all([
  loadLocations(),readProjection('spatial_scenes','id,room_id,name,width_m,depth_m,active',signal),
  readProjection('asset_models','id,kind,width_m,depth_m,active',signal),
 ]);
 return {rooms:z.array(sceneSchema).parse(rooms),models:z.array(modelSchema).parse(models),labels:roomOptions(locations,false)};
}
export async function getOverviewSummary(date:string,shift:Shift){
 const rows=await getSpatialSummary(date,shift);
 if(new Set(rows.map(r=>r.cart_id)).size!==rows.length)throw Error('Resumo duplicado.');
 if(rows.some(r=>!Number.isFinite(Date.parse(r.snapshot_at))))throw Error('Data do resumo inválida.');
 return rows;
}
export async function getOverviewDetails(cartId:string,date:string,shift:Shift){
 const detail=await getSpatialDetails(cartId,date,shift);
 if(detail.summary.cart_id!==cartId||!Number.isFinite(Date.parse(detail.summary.snapshot_at)))throw Error('Detalhe divergente.');
 return detail;
}
export async function getLastMovement(cartId:string,signal:AbortSignal){
 const {data,error}=await supabase.from('equipment_movements').select('id,cart_id,quantity,pickup_at,return_at')
  .eq('cart_id',cartId).order('pickup_at',{ascending:false}).order('id').limit(1).abortSignal(signal);
 if(error)throw error;
 const values=z.array(movementSchema).max(1).parse(data);
 const value=values[0]??null;
 if(value&&(value.cart_id!==cartId||!Number.isFinite(Date.parse(value.pickup_at))||
  (value.return_at!==null&&(!Number.isFinite(Date.parse(value.return_at))||Date.parse(value.return_at)<Date.parse(value.pickup_at)))))throw Error('Movimentação inválida.');
 return value;
}
export function sameOverviewSummary(a:SpatialSummary,b:SpatialSummary){
 return a.cart_id===b.cart_id&&a.active===b.active&&a.nominal_capacity===b.nominal_capacity&&
  a.effective_capacity===b.effective_capacity&&a.reserved===b.reserved&&a.available===b.available&&
  a.maintenance_count===b.maintenance_count&&a.availability_status===b.availability_status&&
  a.storage_room_id===b.storage_room_id&&a.scene_id===b.scene_id&&a.placement_version===b.placement_version;
}
