import { describe, expect, it } from 'vitest';
import { configuredCapacity } from './capacity';

describe('regra aprovada de capacidade', () => {
  it('considera 30 como capacidade ainda que haja 28 códigos', () => {
    expect(configuredCapacity(30,28)).toBe(30);
  });
  it('não reduz capacidade quando não há códigos cadastrados', () => {
    expect(configuredCapacity(20,0)).toBe(20);
  });
});
