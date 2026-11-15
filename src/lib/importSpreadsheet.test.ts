import { describe, expect, it } from 'vitest';
import { parseWorksheetCodes } from './importSpreadsheet';

describe('importação de planilhas XLSX do Educart', () => {
  it('encontra a coluna código mesmo que não seja a primeira', () => {
    expect(parseWorksheetCodes([
      ['Nome', 'Código', 'Situação'], ['Notebook 1', 'NT-001', 'Ativo'], ['Notebook 2', 'NT-002', 'Ativo']
    ])).toEqual(['NT-001', 'NT-002']);
  });
  it('aceita primeira coluna quando não há cabeçalho reconhecido', () => {
    expect(parseWorksheetCodes([['PC-01', 'Notebook A'], ['PC-02', 'Notebook B']])).toEqual(['PC-01', 'PC-02']);
  });
  it('ignora linhas vazias mas preserva códigos textuais com zeros', () => {
    expect(parseWorksheetCodes([['code'], [null], [' 00012 '], [14]])).toEqual(['00012', '14']);
  });
  it('rejeita planilha vazia ou sem códigos', () => {
    expect(() => parseWorksheetCodes([])).toThrow(/vazia/);
    expect(() => parseWorksheetCodes([['codigo'], [null]])).toThrow(/não contém códigos/);
  });
  it('rejeita datas e células multinha como código', () => {
    expect(() => parseWorksheetCodes([['code'], [new Date()]])).toThrow(/inválida/);
    expect(() => parseWorksheetCodes([['code'], ['PC\n01']])).toThrow(/única linha/);
  });
  it('limita a quantidade para proteger a importação', () => {
    expect(() => parseWorksheetCodes([['codigo'], ...Array.from({length:1001}, (_,i)=>['NT-'+i])]))
      .toThrow(/1000/);
  });
});
