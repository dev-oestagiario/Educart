import {describe,it,expect} from 'vitest';
import {safeSpreadsheetCell,toCsv,type ReportRow} from './reportExports';
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
