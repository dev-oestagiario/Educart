import {describe,it,expect} from 'vitest';
import {placementValues,validatePose,summarySchema,detailSchema,type SpatialScene,type AssetModel} from './spatialData';
const scene:SpatialScene={id:'scene',room_id:'room',name:'Sala',model_id:null,width_m:10,depth_m:8,height_m:3,revision:1,active:true};
const model:AssetModel={id:'model',name:'Modelo',kind:'CART',version:1,author:'TI',license:'Interno',storage_path:null,checksum:null,scale:1,width_m:1,depth_m:1,active:true};
describe('F5.1 contratos espaciais',()=>{
 it('mantém pose não posicionada explicitamente nula',()=>{
  expect(placementValues('cart','model','','','','',2)).toEqual({cart_id:'cart',model_id:'model',scene_id:null,position_x:null,position_y:null,position_z:null,yaw:null,version:2});
 });
 it('rejeita pose incompleta ou não finita',()=>{
  expect(()=>placementValues('cart','','scene','0','0','0')).toThrow();
  expect(()=>placementValues('cart','model','scene','','0','0')).toThrow();
  expect(()=>placementValues('cart','model','scene','Infinity','0','0')).toThrow();
 });
 it('avalia limites conservadores independentes da rotação',()=>{
  expect(validatePose(scene,model,0,0,359)).toBeNull();
  expect(validatePose(scene,model,4.5,0,0)).toContain('limites');
  expect(validatePose(scene,model,0,4,0)).toContain('limites');
  expect(validatePose(scene,model,0,0,360)).not.toBeNull();
 });
 it('rejeita resposta que poderia transformar dado desconhecido em disponível',()=>{
  expect(summarySchema.safeParse({availability_status:'FREE',available:10}).success).toBe(false);
 });
});

const uuid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const row={cart_id:uuid(1),code:'C01',name:'Carrinho',active:true,storage_room_id:null,scene_id:null,model_id:null,position_x:null,position_y:null,position_z:null,yaw:null,placement_version:null,nominal_capacity:30,effective_capacity:30,reserved:10,available:20,maintenance_count:0,availability_status:'PARTIAL',snapshot_at:'2026-11-18T12:00:00Z'};
const reservation={id:uuid(2),period_id:uuid(3),requester:'Teste',quantity:10,mode:'PARCIAL',destination_room_id:null,destination_label:null,needs_mouse:false,notes:null};
const slot={slot_key:'POS-1',notebook_id:uuid(4),code:'NB01',confirmed_at:'2026-11-18T12:00:00Z',reservation_period_id:uuid(3)};
describe('F5.6 coerência funcional e fail closed',()=>{
 it('aceita capacidade nominal independentemente dos vínculos e saldo correto',()=>{expect(summarySchema.safeParse(row).success).toBe(true);expect(detailSchema.safeParse({summary:row,reservations:[reservation],confirmed_slots:[slot]}).success).toBe(true);});
 it('rejeita saldo, status, capacidade e data contraditórios',()=>{
 for(const patch of [{available:30},{availability_status:'FREE'},{effective_capacity:20,available:10},{active:false},{maintenance_count:1},{snapshot_at:'invalid'}])expect(summarySchema.safeParse({...row,...patch}).success).toBe(false);
 });
 it('aceita estados bloqueados sem saldo mesmo com reserva anterior',()=>{
 for(const patch of [{active:false,availability_status:'INACTIVE'},{maintenance_count:1,availability_status:'MAINTENANCE'},{availability_status:'UNAVAILABLE'}])expect(summarySchema.safeParse({...row,...patch,effective_capacity:0,available:0}).success).toBe(true);
 });
 it('rejeita posição incompleta e coordenada em cena ausente',()=>{
 for(const patch of [{position_x:0},{scene_id:uuid(5)},{scene_id:uuid(5),model_id:uuid(6),placement_version:1,position_x:0,position_y:1,position_z:0,yaw:0}])expect(summarySchema.safeParse({...row,...patch}).success).toBe(false);
 expect(summarySchema.safeParse({...row,scene_id:uuid(5),model_id:uuid(6),placement_version:1,position_x:0,position_y:0,position_z:0,yaw:0}).success).toBe(true);
 });
 it('rejeita detalhe com reserva parcial, repetida ou vínculo sem atribuição comprovada',()=>{
 for(const patch of [{reservations:[]},{reservations:[{...reservation,quantity:9}]},{reservations:[{...reservation,quantity:5},{...reservation,quantity:5}]},{confirmed_slots:[slot,slot]},{confirmed_slots:[{...slot,reservation_period_id:uuid(99)}]},{confirmed_slots:[{...slot,confirmed_at:'invalid'}]}])expect(detailSchema.safeParse({summary:row,reservations:[reservation],confirmed_slots:[slot],...patch}).success).toBe(false);
 });
});
