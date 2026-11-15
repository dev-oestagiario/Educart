import {describe,it,expect} from 'vitest';
import {countUnread} from './notifications';
describe('Fase 7 — contagem de notificações',()=>{
  it('não conta avisos já lidos',()=>{
    expect(countUnread([{read_at:null},{read_at:'2026-11-15T10:00:00Z'},{read_at:null}])).toBe(2);
  });
  it('com lista vazia não exibe alertas falsos',()=>{
    expect(countUnread([])).toBe(0);
    expect(countUnread([{read_at:'2026-11-15T10:00:00Z'}])).toBe(0);
  });
});
