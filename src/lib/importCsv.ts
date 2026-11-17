/**
 * Importação CSV de identificadores. Suporta CSV UTF-8, vírgula/ponto e vírgula,
 * campos entre aspas e cabeçalho codigo/código/code em qualquer coluna.
 */
export function parseCsvCodes(input: string): string[] {
  const text = input.replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('O arquivo CSV está vazio.');

  const headerLine = text.split(/\r?\n/).find(line => line.trim()) ?? '';
  let inHeaderQuotes = false;
  let commas = 0;
  let semicolons = 0;
  for (let i = 0; i < headerLine.length; i++) {
    if (headerLine[i] === '"') {
      if (inHeaderQuotes && headerLine[i + 1] === '"') i++;
      else inHeaderQuotes = !inHeaderQuotes;
    } else if (!inHeaderQuotes && headerLine[i] === ',') commas++;
    else if (!inHeaderQuotes && headerLine[i] === ';') semicolons++;
  }
  const separator = semicolons > commas ? ';' : ',';
  const rows: string[][] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  function finishRow() {
    fields.push(field.trim());
    if (fields.some(Boolean)) rows.push(fields);
    fields = [];
    field = '';
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === separator) {
      fields.push(field.trim());
      field = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      finishRow();
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('O CSV contém aspas sem fechamento.');
  if (field || fields.length) finishRow();
  if (!rows.length) throw new Error('O arquivo CSV não contém códigos.');

  const headerIndex = rows[0].findIndex(value => /^(c[oó]digo|code)$/i.test(value.trim()));
  const codes = (headerIndex >= 0 ? rows.slice(1) : rows)
    .map(row => (row[headerIndex >= 0 ? headerIndex : 0] ?? '').trim())
    .filter(Boolean);
  if (!codes.length) throw new Error('O arquivo CSV não contém códigos.');
  if (codes.some(code => /[\r\n]/.test(code))) throw new Error('Cada código deve ocupar uma única linha do CSV.');
  return codes;
}
