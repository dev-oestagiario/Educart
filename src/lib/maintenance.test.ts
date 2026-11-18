import {describe,it,expect} from 'vitest';
import {applyMaintenance,isMaintenanceBlocked,type MaintenanceWindow} from './maintenance';
import {calculateAvailability} from './reservations';
const window:MaintenanceWindow={cart_id:'c1',start_date:'2027-01-04',end_date:'2027-01-05',shifts:['MATUTINO'],closed_at:null};
describe('maintenance availability',()=>{
 it('blocks only affected cart, date and turn',()=>{
  const slots=calculateAvailability(10,[],['2027-01-04','2027-01-05','2027-01-06'],['MATUTINO','VESPERTINO']);
  expect(applyMaintenance(slots,[window],'c1').map(s=>s.remaining)).toEqual([0,10,0,10,10,10]);
  expect(applyMaintenance(slots,[window],'c2').map(s=>s.remaining)).toEqual([10,10,10,10,10,10]);
 });
 it('restores the balance when maintenance is closed',()=>{
  expect(isMaintenanceBlocked([{...window,closed_at:'2027-01-04T10:00:00Z'}],'c1','2027-01-04','MATUTINO')).toBe(false);
 });
 it('does not mutate source slots',()=>{
  const slots=calculateAvailability(8,[],['2027-01-04'],['MATUTINO']);
  expect(applyMaintenance(slots,[window],'c1')[0]).toMatchObject({capacity:0,remaining:0});
  expect(slots[0]).toMatchObject({capacity:8,remaining:8});
 });
});

it('reduces capacity only for distinct notebooks in the selected turn',()=>{
 const slots=calculateAvailability(10,[{usage_date:'2027-01-04',shift:'MATUTINO',quantity:3,active:true}],['2027-01-04'],['MATUTINO','VESPERTINO']);
 const individual={...window,notebook_id:'n1'};
 expect(isMaintenanceBlocked([individual],'c1','2027-01-04','MATUTINO')).toBe(false);
 expect(applyMaintenance(slots,[individual,individual,{...individual,notebook_id:'n2'}],'c1')).toMatchObject([{capacity:8,remaining:5},{capacity:10,remaining:10}]);
 expect(applyMaintenance(slots,[individual,window],'c1')[0]).toMatchObject({capacity:0,remaining:0});
});
