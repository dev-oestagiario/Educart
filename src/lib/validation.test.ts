import { describe, expect, it } from 'vitest';
import { cartSchema, errorMessage, notebookSchema, validateCodes } from './validation';

describe('validação do Educart', () => {
  it('aceita capacidade positiva mesmo sem notebooks identificados', () => {
    expect(cartSchema.parse({code:'C-01',name:'Laboratório 1',capacity:'30'}).capacity).toBe(30);
  });
  it('rejeita capacidade zero ou negativa', () => {
    expect(cartSchema.safeParse({code:'C-01',name:'Lab 1',capacity:0}).success).toBe(false);
    expect(cartSchema.safeParse({code:'C-01',name:'Lab 1',capacity:-1}).success).toBe(false);
  });
  it('não permite códigos vazios ou longos', () => {
    expect(notebookSchema.safeParse({code:' '}).success).toBe(false);
    expect(notebookSchema.safeParse({code:'x'.repeat(81)}).success).toBe(false);
  });
  it('rejeita códigos repetidos ignorando diferenças de caixa', () => {
    expect(()=>validateCodes('NT-01\nnt-01')).toThrow(/repetidos/);
  });
  it('aceita lista válida e remove linhas vazias', () => {
    expect(validateCodes(' NT-01 \n\n NT-02 ')).toEqual(['NT-01','NT-02']);
  });
  it('retorna mensagens úteis para erros do PostgreSQL', () => {
    expect(errorMessage({code:'23505'})).toMatch(/já está cadastrado/);
    expect(errorMessage({code:'42501'})).toMatch(/permissão/);
  });

});
