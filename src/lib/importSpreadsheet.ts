import { parseCsvCodes } from './importCsv';

const MAX_IMPORT_SIZE = 2_000_000;
const MAX_CODES = 1000;

function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new Error('A coluna de código contém uma célula inválida. Use texto ou número.');
}

export function parseWorksheetCodes(rows: ReadonlyArray<ReadonlyArray<unknown>>): string[] {
  if (!rows.length) throw new Error('A planilha está vazia.');
  const nonEmpty = rows.filter(row => row.some(value => value !== null && value !== undefined && String(value).trim()));
  if (!nonEmpty.length) throw new Error('A planilha não contém códigos.');
  if (nonEmpty.length > MAX_CODES + 1) throw new Error('Importe no máximo 1000 códigos por vez.');
  const first = nonEmpty[0];
  const columnIndex = first.findIndex(value => typeof value === 'string' &&
    /^(codigo|code)$/.test(value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  const codeIndex = columnIndex < 0 ? 0 : columnIndex;
  const dataRows = columnIndex < 0 ? nonEmpty : nonEmpty.slice(1);
  const codes = dataRows.map(row => cleanCell(row[codeIndex])).filter(Boolean);
  if (!codes.length) throw new Error('A planilha não contém códigos.');
  if (codes.length > MAX_CODES) throw new Error('Importe no máximo 1000 códigos por vez.');
  if (codes.some(value => /[\r\n]/.test(value))) throw new Error('Cada código deve estar em uma única linha da planilha.');
  return codes;
}

export async function parseImportFile(file: File): Promise<string[]> {
  if (file.size > MAX_IMPORT_SIZE) throw new Error('O arquivo deve ter no máximo 2 MB.');
  if (/\.csv$/i.test(file.name)) {
    const codes = parseCsvCodes(await file.text());
    if (codes.length > MAX_CODES) throw new Error('Importe no máximo 1000 códigos por vez.');
    return codes;
  }
  if (/\.xlsx$/i.test(file.name)) {
    // Carregamento sob demanda para não aumentar o JavaScript da tela inicial.
    const { readSheet } = await import('read-excel-file/browser');
    return parseWorksheetCodes(await readSheet(file));
  }
  throw new Error('Formato não suportado. Selecione um arquivo CSV ou XLSX.');
}
