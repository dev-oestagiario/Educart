import { describe, expect, it } from 'vitest';
import { parseCsvCodes } from './importCsv';

describe('importação CSV de notebooks', () => {
  it('importa coluna única com BOM e cabeçalho', () => {
    expect(parseCsvCodes('\uFEFFcódigo\r\nNT-01\r\nNT-02\r\n')).toEqual(['NT-01', 'NT-02']);
  });
  it('encontra coluna código entre outras colunas separadas por ponto e vírgula', () => {
    expect(parseCsvCodes('nome;codigo;status\nLaptop 1;NT-01;ativo\nLaptop 2;NT-02;ativo'))
      .toEqual(['NT-01', 'NT-02']);
  });
  it('respeita aspas, vírgulas e ponto e vírgula nos campos de descrição', () => {
    expect(parseCsvCodes('codigo,descricao\nNT-01,"Com mouse, fonte"\nNT-02,"Kit; 2"'))
      .toEqual(['NT-01', 'NT-02']);
  });
  it('usa primeira coluna quando não há cabeçalho conhecido', () => {
    expect(parseCsvCodes('NT-01;primeiro\nNT-02;segundo')).toEqual(['NT-01', 'NT-02']);
  });
  it('rejeita CSV vazio e aspas não fechadas', () => {
    expect(() => parseCsvCodes('')).toThrow(/vazio/);
    expect(() => parseCsvCodes('codigo,descricao\nNT-01,"sem fim')).toThrow(/aspas/);
  });
  it('não permite código com quebra de linha dentro de aspas', () => {
    expect(() => parseCsvCodes('codigo\n"NT-\n01"')).toThrow(/única linha/);
  });
});
