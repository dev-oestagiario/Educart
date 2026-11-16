import {describe,it,expect} from 'vitest';
import {buildAgendaReport,safeSpreadsheetCell,toCsv,type ReportRow} from './reportExports';
const item:ReportRow={
  date:'16/11/2026',shift:'Manhã',cart:'Carrinho 01',requester:'Professora A',
  mode:'Parcial',quantity:10,needsMouse:true,status:'Confirmada',
  createdBy:'Administrador da TI',notes:'Teste'
};
describe('exportação de relatórios',()=>{
  it('exporta colunas e valores em CSV UTF-8 compatível com Excel',()=>{
    const csv=toCsv([item]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Data";"Turno"');
    expect(csv).toContain('"16/11/2026";"Manhã";"Carrinho 01"');
    expect(csv).toContain('"Sim";"Confirmada"');
  });
  it('escapa aspas e quebra o risco de injeção de fórmula',()=>{
    const csv=toCsv([{...item,requester:'=cmd()',notes:'"A"; B'}]);
    expect(csv).toContain('"\'=cmd()"');
    expect(csv).toContain('"""A""; B"');
    expect(safeSpreadsheetCell('+SUM(1,2)')).toBe("'+SUM(1,2)");
  });
  it('não conta cabeçalho como linha de dados',()=>{
    expect(toCsv([]).split('\r\n').filter(Boolean)).toHaveLength(1);
  });
});


describe('PDF agenda SENAI — divisão por dia e resumo',()=>{
  const week=['2026-07-06','2026-07-07','2026-07-08','2026-07-09','2026-07-10'];
  it('repete linhas de equipamento e mouses como no exemplo de julho, sem duplicar reservas',()=>{
    const source:ReportRow[]=[
      {...item,date:'06/07/2026',shift:'Tarde',requester:'Rosemar',
        cart:'Laboratório Móvel SN1 - Dell',mode:'Completa',
        status:'Confirmada',notes:'',needsMouse:true},
      {...item,date:'07/07/2026',shift:'Tarde',requester:'Rosemar',
        cart:'Laboratório Móvel SN1 - Dell',mode:'Completa',
        status:'Confirmada',notes:'',needsMouse:true}
    ];
    const report=buildAgendaReport(source,week);
    expect(report.days.map(day=>day.weekday)).toEqual(['SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA']);
    expect(report.days.map(day=>day.entries.length)).toEqual([2,2,0,0,0]);
    expect(report.days[0].entries[0]).toMatchObject({
      requester:'Rosemar',shift:'Tarde',room:'Não informada'
    });
    expect(report.days[0].entries[1].equipment).toContain('Mouses');
    expect(report.counts.map(day=>day.value)).toEqual([2,2,0,0,0]);
    expect(report).toMatchObject({total:4,periodCount:2,mouseExtras:2});
  });
  it('preserva o tipo parcial, as observações e a situação de cancelamento',()=>{
    const row:ReportRow={
      ...item,date:'09/07/2026',quantity:7,cart:'Carrinho de informática',
      mode:'Parcial',notes:'Atividade de informática',status:'Cancelada',needsMouse:false
    };
    const report=buildAgendaReport([row],week);
    expect(report.days[3].entries[0]).toMatchObject({
      cancelled:true,room:'Não informada'
    });
    expect(report.days[3].entries[0].equipment).toContain('7 notebooks');
    expect(report.days[3].entries[0].equipment).toContain('Atividade de informática');
    expect(report.total).toBe(1);
  });
  it('mostra todos os dias mesmo que não haja reservas',()=>{
    const report=buildAgendaReport([],week);
    expect(report.days).toHaveLength(5);
    expect(report.days.every(day=>day.entries.length===0)).toBe(true);
    expect(report.total).toBe(0);
  });
  it('no mês, soma os dias de mesma semana sem perder registros',()=>{
    const dates=['2026-07-06','2026-07-13','2026-07-14'];
    const report=buildAgendaReport([
      {...item,date:'06/07/2026',needsMouse:false},
      {...item,date:'13/07/2026',needsMouse:false},
      {...item,date:'14/07/2026',needsMouse:false}
    ],dates);
    expect(report.counts.map(day=>day.value)).toEqual([2,1,0,0,0]);
    expect(report.total).toBe(3);
  });
});
