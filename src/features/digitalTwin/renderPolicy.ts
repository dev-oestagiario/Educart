import type {OverviewLayout,SceneCart} from './overviewLayout';
export type Quality='high'|'low';
export type QualityChoice=Quality|'auto';
export function resolveQuality(choice:QualityChoice,viewport:number,cores:number|undefined,saveData:boolean,count:number):Quality{
 if(choice!=='auto')return choice;
 return saveData||viewport<=690||(cores!==undefined&&cores>0&&cores<=4)||count>80?'low':'high';
}
/** Bound detailed meshes, prioritising explicit focus even far from the camera. */
export function detailIds(carts:readonly SceneCart[],focusId:string|null,selectedId:string|null,target:{x:number;z:number},pixelsPerMeter:number,previous:ReadonlySet<string>=new Set(),limit=12){
 const candidates=carts.filter(c=>c.id===focusId||c.id===selectedId||pixelsPerMeter*Math.min(c.width,c.depth)>=(previous.has(c.id)?24:36));
 return new Set(candidates.sort((a,b)=>{
  const priority=(c:SceneCart)=>c.id===focusId?0:c.id===selectedId?1:2;
  return priority(a)-priority(b)||Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z)||a.id.localeCompare(b.id);
 }).slice(0,Math.max(0,limit)).map(c=>c.id));
}
/** All scene-visible attributes, excluding transient fetched timestamps/counts. */
export function sceneKey(layout:OverviewLayout){
 return JSON.stringify([layout.width,layout.depth,layout.zones.map(z=>[z.id,z.label,z.x,z.z,z.width,z.depth,z.unplaced]),
 layout.carts.map(c=>[c.id,c.code,c.name,c.location,c.storage,c.zoneId,c.x,c.y,c.z,c.yaw,c.width,c.depth,c.status,c.placed])]);
}
/** Coalesce renders into at most one pending animation frame. */
export function frameScheduler(draw:()=>void,request:(callback:FrameRequestCallback)=>number,cancel:(id:number)=>void){
 let pending:number|null=null,disposed=false;
 return {schedule(){if(disposed||pending!==null)return;pending=request(()=>{pending=null;if(!disposed)draw();});},dispose(){disposed=true;if(pending!==null)cancel(pending);pending=null;}};
}
export function pageSlice<T>(items:readonly T[],page:number,size=40){
 const pages=Math.max(1,Math.ceil(items.length/size)),current=Math.max(0,Math.min(pages-1,page));
 return {items:items.slice(current*size,(current+1)*size),page:current,pages};
}
