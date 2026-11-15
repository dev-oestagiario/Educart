import { z } from 'zod';

export const cartSchema = z.object({
  code: z.string().trim().min(1, 'Informe o código').max(50),
  name: z.string().trim().min(2, 'Informe o nome (2 caracteres ou mais)').max(120),
  capacity: z.coerce.number<number>().int('Informe um número inteiro').positive('A capacidade deve ser maior que zero')
});
export const requesterSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do professor').max(160),
  reference_code: z.string().trim().max(60).optional().default('')
});
export const notebookSchema = z.object({
  code: z.string().trim().min(1, 'Informe o código').max(80)
});
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}
export function validateCodes(raw: string): string[] {
  const codes = raw.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!codes.length) throw new Error('Informe pelo menos um código.');
  if (codes.some(x => x.length > 80)) throw new Error('Cada código deve ter até 80 caracteres.');
  if (new Set(codes.map(x => x.toLocaleLowerCase('pt-BR'))).size !== codes.length) {
    throw new Error('Existem códigos repetidos na lista. Corrija antes de salvar.');
  }
  return codes;
}
