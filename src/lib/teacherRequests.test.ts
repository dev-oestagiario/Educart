import {describe,it,expect} from 'vitest';
import {calculateAvailability,todayInSaoPaulo,addCalendarDays,isWeekday} from './reservations';
import {validateTeacherRequest,requestStatusLabel} from './teacherRequests';
function nextWeekday(){
  let d=addCalendarDays(todayInSaoPaulo(),1);
  while(!isWeekday(d))d=addCalendarDays(d,1);
  return d;
}
const sample=()=>({cart_id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',mode:'PARCIAL' as const,
  quantity:7,dates:[nextWeekday()],shifts:['MATUTINO' as const],
  needs_mouse:true,notes:'Equipamentos para aula'});
describe('Fase 6 — solicitações',()=>{
  it('respeita capacidade configurada e não exige códigos físicos',()=>{
    expect(validateTeacherRequest(sample(),30).quantity).toBe(7);
    expect(()=>validateTeacherRequest({...sample(),quantity:31},30)).toThrow(/capacidade/);
  });
  it('carrinho completo solicita sua capacidade, não a quantidade de códigos',()=>{
    expect(validateTeacherRequest({...sample(),mode:'COMPLETA',quantity:30},30).quantity).toBe(30);
    expect(()=>validateTeacherRequest({...sample(),mode:'COMPLETA'},30)).toThrow(/toda a capacidade/);
  });
  it('datas inválidas e turnos repetidos são rejeitados',()=>{
    expect(()=>validateTeacherRequest({...sample(),dates:['2026-11-14']},30)).toThrow();
    expect(()=>validateTeacherRequest({...sample(),shifts:['MATUTINO','MATUTINO']},30)).toThrow();
  });
  it('pendências não alteram o saldo de reservas confirmadas',()=>{
    const day=nextWeekday();
    expect(calculateAvailability(30,[],[day],['MATUTINO'])[0].remaining).toBe(30);
  });
  it('expõe status em linguagem clara',()=>{
    expect(requestStatusLabel.PENDENTE).toContain('Aguardando');
    expect(requestStatusLabel.APROVADA).toBe('Aprovada');
  });
});
