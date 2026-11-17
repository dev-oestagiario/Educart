import {z} from 'zod';
import {supabase,type Cart,type Notebook} from '../../lib/supabase';
import type {Shift} from '../../lib/reservations';
import {loadLocations} from '../../lib/locations';

export type AssetModel={id:string;name:string;kind:'CART'|'ROOM';version:number;author:string;license:string;storage_path:string|null;checksum:string|null;scale:number;width_m:number;depth_m:number;active:boolean};
export type SpatialScene={id:string;room_id:string;name:string;model_id:string|null;width_m:number;depth_m:number;height_m:number;revision:number;active:boolean};
export type Placement={cart_id:string;model_id:string|null;scene_id:string|null;position_x:number|null;position_y:number|null;position_z:number|null;yaw:number|null;version:number};
export type ModelSlot={model_id:string;slot_key:string;position_x:number;position_y:number;position_z:number;description:string|null};
export type SlotLink={cart_id:string;model_id:string;slot_key:string;notebook_id:string;confirmed_at:string};
const n=z.number().finite();
const coordinate=n.nullable();
export const summarySchema=z.object({
  cart_id:z.string().uuid(),code:z.string(),name:z.string(),active:z.boolean(),storage_room_id:z.string().uuid().nullable(),
  scene_id:z.string().uuid().nullable(),model_id:z.string().uuid().nullable(),position_x:coordinate,position_y:coordinate,position_z:coordinate,yaw:coordinate,
  placement_version:z.number().int().positive().nullable(),nominal_capacity:z.number().int().positive(),effective_capacity:z.number().int().nonnegative(),
  reserved:z.number().int().nonnegative(),available:z.number().int().nonnegative(),maintenance_count:z.number().int().nonnegative(),
  availability_status:z.enum(['INACTIVE','MAINTENANCE','UNAVAILABLE','FULL','PARTIAL','FREE']),snapshot_at:z.string(),
});
export type SpatialSummary=z.infer<typeof summarySchema>;
const detailSchema=z.object({summary:summarySchema,reservations:z.array(z.object({
  id:z.string().uuid(),period_id:z.string().uuid(),requester:z.string(),quantity:z.number().int(),mode:z.enum(['COMPLETA','PARCIAL']),
  destination_room_id:z.string().uuid().nullable(),destination_label:z.string().nullable(),needs_mouse:z.boolean(),notes:z.string().nullable(),
})),confirmed_slots:z.array(z.object({slot_key:z.string(),notebook_id:z.string().uuid(),code:z.string(),confirmed_at:z.string(),reservation_period_id:z.string().uuid().nullable()}))});
export async function getSpatialSummary(date:string,shift:Shift) {
  const rows:SpatialSummary[]=[];
  for(let offset=0;;offset+=250){
    const {data,error}=await supabase.rpc('spatial_cart_summary',{p_date:date,p_shift:shift}).order('cart_id').range(offset,offset+249);
    if(error)throw error;const page=z.array(summarySchema).parse(data);rows.push(...page);if(page.length<250)return rows;
  }
}
export async function getSpatialDetails(cartId:string,date:string,shift:Shift){
  const {data,error}=await supabase.rpc('spatial_cart_details',{p_cart_id:cartId,p_date:date,p_shift:shift});
  if(error)throw error;return detailSchema.parse(data);
}
async function readAll<T>(table:string,key:string) {
  const rows:T[]=[];
  for(let offset=0;;offset+=250){
    const ordered=supabase.from(table).select('*').order(key);
    const {data,error}=await (table==='cart_model_slots'?ordered.order('model_id'):ordered).range(offset,offset+249);
    if(error)throw error;const batch=(data??[]) as T[];rows.push(...batch);if(batch.length<250)return rows;
  }
}
export async function getSpatialCatalog(){
  const [locations,models,scenes,placements,slots,links,carts,notebooks]=await Promise.all([
    loadLocations(),readAll<AssetModel>('asset_models','id'),readAll<SpatialScene>('spatial_scenes','id'),
    readAll<Placement>('cart_scene_placements','cart_id'),readAll<ModelSlot>('cart_model_slots','slot_key'),
    readAll<SlotLink>('notebook_slot_links','notebook_id'),readAll<Cart>('carts','id'),readAll<Notebook>('notebook_codes','id')
  ]);
  return {locations,models,scenes,placements,slots,links,carts,notebooks};
}
export function validatePose(scene:SpatialScene,model:AssetModel,x:number,z:number,yaw:number){
  if(![x,z,yaw].every(Number.isFinite)||yaw<0||yaw>=360)return 'Informe coordenadas e rotação de 0 a 359,999°.';
  const radius=Math.hypot(model.width_m,model.depth_m)/2;
  if(Math.abs(x)+radius>scene.width_m/2||Math.abs(z)+radius>scene.depth_m/2)return 'Posição fora dos limites da cena.';
  return null;
}
export function placementValues(cartId:string,modelId:string,sceneId:string,x:string,z:string,yaw:string,version?:number){
  const pose=sceneId?{scene_id:sceneId,position_x:Number(x),position_y:0,position_z:Number(z),yaw:Number(yaw)}:{scene_id:null,position_x:null,position_y:null,position_z:null,yaw:null};
  if(sceneId&&(!modelId||[x,z,yaw].some(v=>!v.trim()||!Number.isFinite(Number(v)))))throw Error('Selecione modelo e informe uma pose válida.');
  return {cart_id:cartId,model_id:modelId||null,...pose,...(version===undefined?{}:{version})};
}
export async function savePlacement(values:ReturnType<typeof placementValues>,existing?:Placement){
  const query=existing?supabase.from('cart_scene_placements').update(values).eq('cart_id',existing.cart_id).eq('version',existing.version):supabase.from('cart_scene_placements').insert(values);
  const {data,error}=await query.select('cart_id');
  if(error)throw error;if(data?.length!==1)throw Error('Posição alterada por outro administrador. Atualize o cadastro.');
}
