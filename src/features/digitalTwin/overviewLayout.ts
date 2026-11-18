/** Layout esquemático: as coordenadas locais vêm do cadastro, não de rastreamento. */
export type OverviewStatus='FREE'|'PARTIAL'|'FULL'|'MAINTENANCE'|'UNAVAILABLE'|'INACTIVE'|'UNKNOWN';
export const overviewStatuses:Record<OverviewStatus,{label:string;color:number}>={
 FREE:{label:'Livre',color:0x36b68a},PARTIAL:{label:'Parcialmente reservado',color:0xe9ad55},
 FULL:{label:'Totalmente reservado',color:0xd97586},MAINTENANCE:{label:'Em manutenção',color:0x946ec4},
 UNAVAILABLE:{label:'Indisponível',color:0x8993aa},INACTIVE:{label:'Inativo',color:0x646b79},UNKNOWN:{label:'Não confirmado',color:0x9ca3af},
};
export type OverviewRow={cart_id:string;code:string;name:string;scene_id:string|null;model_id:string|null;storage_room_id:string|null;position_x:number|null;position_y:number|null;position_z:number|null;yaw:number|null;active:boolean;availability_status:Exclude<OverviewStatus,'UNKNOWN'>};
export type OverviewRoom={id:string;name:string;room_id:string;width_m:number;depth_m:number;active:boolean};
export type OverviewModel={id:string;kind:'CART'|'ROOM';width_m:number;depth_m:number;active:boolean};
export type RoomLabel={id:string;label:string;active:boolean};
export type SceneZone={id:string;label:string;x:number;z:number;width:number;depth:number;unplaced:boolean};
export type SceneCart={id:string;code:string;name:string;location:string;storage:string;zoneId:string;x:number;y:number;z:number;yaw:number;width:number;depth:number;status:OverviewStatus;placed:boolean};
export type OverviewLayout={zones:SceneZone[];carts:SceneCart[];width:number;depth:number};
const validSize=(v:number)=>Number.isFinite(v)&&v>0&&v<=1000;
const fold=(v:string)=>v.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
const cmp=(a:string,b:string)=>a.localeCompare(b,'pt-BR')||a.localeCompare(b);
export function buildOverviewLayout(rows:readonly OverviewRow[],rooms:readonly OverviewRoom[],models:readonly OverviewModel[],labels:readonly RoomLabel[],fresh:boolean):OverviewLayout{
 const unique=new Set<string>();
 const labelsById=new Map(labels.map(r=>[r.id,r]));
 const sceneById=new Map(rooms.filter(r=>r.active&&labelsById.get(r.room_id)?.active&&validSize(r.width_m)&&validSize(r.depth_m)).map(r=>[r.id,r]));
 const modelById=new Map(models.filter(m=>m.kind==='CART'&&m.active&&validSize(m.width_m)&&validSize(m.depth_m)).map(m=>[m.id,m]));
 const items=[...rows].sort((a,b)=>cmp(a.code,b.code)||cmp(a.cart_id,b.cart_id)).map(row=>{
  if(unique.has(row.cart_id))throw Error('Carrinho duplicado no resumo');unique.add(row.cart_id);
  const room=row.scene_id?sceneById.get(row.scene_id):undefined,model=row.model_id?modelById.get(row.model_id):undefined;
  const width=model?.width_m??1.24,depth=model?.depth_m??.83;
  const radius=Math.hypot(width,depth)/2;
  const x=row.position_x,y=row.position_y,z=row.position_z,yaw=row.yaw;
  const placed=Boolean(row.active&&room&&model&&x!==null&&y!==null&&z!==null&&yaw!==null&&[x,y,z,yaw].every(Number.isFinite)&&y===0&&yaw>=0&&yaw<360&&Math.abs(x)+radius<=room.width_m/2&&Math.abs(z)+radius<=room.depth_m/2);
  const storage=row.storage_room_id?(labelsById.get(row.storage_room_id)?.label??'Guarda cadastrada sem identificação disponível'):'Guarda não cadastrada';
  return {row,width,depth,room:placed?room:undefined,storage};
 });
 const unplaced=items.filter(i=>!i.room);
 const zones:SceneZone[]=[...sceneById.values()].sort((a,b)=>cmp(a.id,b.id)).map(r=>({id:r.id,label:(labelsById.get(r.room_id)?.label??r.name)+' · '+r.name,x:0,z:0,width:r.width_m,depth:r.depth_m,unplaced:false}));
 const step=Math.max(2.5,...unplaced.map(i=>Math.max(i.width,i.depth)+1.4)),columns=Math.max(1,Math.ceil(Math.sqrt(unplaced.length)));
 if(unplaced.length)zones.push({id:'unplaced',label:'Sem localização definida',x:0,z:0,width:columns*step+1,depth:Math.ceil(unplaced.length/columns)*step+1,unplaced:true});
 // Independently modelled rooms are laid out as separated tiles, not a campus floor plan.
 const gridCols=Math.max(1,Math.ceil(Math.sqrt(zones.length))),gap=3;
 const colWidths=Array.from({length:gridCols},(_,c)=>Math.max(1,...zones.filter((_,i)=>i%gridCols===c).map(v=>v.width)));
 const rowDepths=Array.from({length:Math.ceil(zones.length/gridCols)},(_,r)=>Math.max(1,...zones.slice(r*gridCols,(r+1)*gridCols).map(v=>v.depth)));
 const width=Math.max(6,colWidths.reduce((a,b)=>a+b,0)+gap*Math.max(0,gridCols-1));
 const depth=Math.max(6,rowDepths.reduce((a,b)=>a+b,0)+gap*Math.max(0,rowDepths.length-1));
 zones.forEach((zone,i)=>{const c=i%gridCols,r=Math.floor(i/gridCols);zone.x=-width/2+colWidths.slice(0,c).reduce((a,b)=>a+b+gap,0)+colWidths[c]!/2;zone.z=-depth/2+rowDepths.slice(0,r).reduce((a,b)=>a+b+gap,0)+rowDepths[r]!/2;});
 const zoneById=new Map(zones.map(z=>[z.id,z]));let pending=0;
 const carts=items.map(i=>{const zone=zoneById.get(i.room?.id??'unplaced')!;const pos=pending;const placed=!!i.room;if(!placed)pending++;
  return {id:i.row.cart_id,code:i.row.code,name:i.row.name,location:zone.label,storage:i.storage,zoneId:zone.id,
   x:zone.x+(placed?i.row.position_x!:-zone.width/2+step/2+.5+(pos%columns)*step),y:0,z:zone.z+(placed?i.row.position_z!:-zone.depth/2+step/2+.5+Math.floor(pos/columns)*step),
   yaw:placed?i.row.yaw!:0,width:i.width,depth:i.depth,status:fresh?i.row.availability_status:'UNKNOWN' as const,placed};
 });
 return {zones,carts,width,depth};
}
export function searchOverview(carts:readonly SceneCart[],query:string){const q=fold(query.trim());return carts.filter(c=>fold([c.code,c.name,c.location,c.storage,overviewStatuses[c.status].label].join(' ')).includes(q));}
export function isSnapshotFresh(updatedAt:number,now:number,failed:boolean){return !failed&&updatedAt>0&&now>=updatedAt&&now-updatedAt<=120_000;}
