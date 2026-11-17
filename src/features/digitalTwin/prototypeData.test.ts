import {describe,expect,it} from 'vitest';
import {demoAvailable,findPrototypeCarts,prototypeCarts} from './prototypeData';
describe('F5.0 — dados de demonstração',()=>{
  it('apresenta todos os carrinhos uma única vez, sem escolha prévia',()=>{
    expect(findPrototypeCarts('')).toHaveLength(4);
    expect(new Set(prototypeCarts.map(c=>c.id)).size).toBe(4);
    expect(prototypeCarts.some(c=>c.location==='Sem localização definida')).toBe(true);
  });
  it('pesquisa por código, nome ou condição sem alterar o conjunto',()=>{
    expect(findPrototypeCarts(' demo-02 ').map(c=>c.id)).toEqual(['demo-2']);
    expect(findPrototypeCarts('beta').map(c=>c.id)).toEqual(['demo-2']);
    expect(findPrototypeCarts('manutenção').map(c=>c.id)).toEqual(['demo-4']);
    expect(findPrototypeCarts('inexistente')).toEqual([]);
    expect(findPrototypeCarts('')).toHaveLength(4);
  });
  it('não trata manutenção como disponibilidade',()=>{
    expect(prototypeCarts.map(demoAvailable)).toEqual([30,18,0,0]);
  });
});
