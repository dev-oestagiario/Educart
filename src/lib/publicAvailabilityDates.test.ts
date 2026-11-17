import {describe,expect,it} from 'vitest';
import {publicAvailabilityWindows,publicDateSelection} from './publicAvailabilityDates';

describe('Seleção automática de datas da consulta pública',()=>{
  it('um dia exige somente a data inicial',()=>{
    const value=publicDateSelection('2026-11-18','');
    expect(value).toMatchObject({first:'2026-11-18',last:'2026-11-18',typeLabel:'1 dia',error:null});
    expect(value.dates).toEqual(['2026-11-18']);
  });
  it('identifica uma semana útil automaticamente',()=>{
    const value=publicDateSelection('2026-11-16','2026-11-20');
    expect(value.typeLabel).toBe('1 semana');
    expect(value.dates).toHaveLength(5);
  });
  it('reconhece mês e ano e não inclui fins de semana',()=>{
    const month=publicDateSelection('2026-11-01','2026-11-30');
    expect(month.typeLabel).toBe('1 mês');
    expect(month.dates).toHaveLength(21);
    const year=publicDateSelection('2026-01-01','2026-12-31');
    expect(year.typeLabel).toBe('1 ano');
    expect(year.dates.length).toBeGreaterThan(250);
  });
  it('separa consultas anuais em janelas de até 35 dias para a RPC',()=>{
    const windows=publicAvailabilityWindows('2026-01-01','2026-12-31');
    expect(windows).toHaveLength(11);
    expect(windows[0]).toEqual({start:'2026-01-01',end:'2026-02-04'});
    expect(windows.at(-1)?.end).toBe('2026-12-31');
    for(const window of windows){
      expect(publicDateSelection(window.start,window.end).error).toBeNull();
    }
  });
  it('não faz consulta para data inválida ou intervalo excessivo',()=>{
    expect(publicDateSelection('2026-02-30','').error).not.toBeNull();
    expect(publicDateSelection('2026-11-16','2026-11-15').error).not.toBeNull();
    expect(publicDateSelection('2026-11-21','').error).not.toBeNull();
    expect(publicDateSelection('2026-01-01','2027-01-03').error).not.toBeNull();
  });
});
