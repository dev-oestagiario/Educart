import {describe,it,expect} from 'vitest';
import {placementValues,validatePose,summarySchema,type SpatialScene,type AssetModel} from './spatialData';
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
