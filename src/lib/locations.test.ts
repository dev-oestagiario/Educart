import {describe,it,expect} from 'vitest';
import {roomOptions,type LocationCatalog} from './locations';
const catalog:LocationCatalog={
 campuses:[{id:'c1',name:'Campus fictício A',active:true},{id:'c2',name:'Campus fictício B',active:false}],
 blocks:[{id:'b1',campus_id:'c1',name:'Bloco A',active:true},{id:'b2',campus_id:'c1',name:'Bloco inativo',active:false},{id:'b3',campus_id:'c2',name:'Bloco A',active:true}],
 rooms:[{id:'r1',block_id:'b1',name:'Sala 1',active:true},{id:'r2',block_id:'b1',name:'Sala 2',active:false},{id:'r3',block_id:'b2',name:'Sala 1',active:true},{id:'r4',block_id:'b3',name:'Sala 1',active:true}]
};
describe('localizações',()=>{
 it('oferece apenas salas de hierarquias inteiramente ativas',()=>{
  expect(roomOptions(catalog)).toEqual([{id:'r1',label:'Campus fictício A / Bloco A / Sala 1',active:true}]);
 });
 it('preserva rótulos de locais antigos para consulta administrativa',()=>{
  expect(roomOptions(catalog,false)).toHaveLength(4);
  expect(roomOptions(catalog,false).filter(r=>r.active).map(r=>r.id)).toEqual(['r1']);
 });
});
