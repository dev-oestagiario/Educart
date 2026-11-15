/**
 * A capacidade registrada é independente da quantidade de códigos individuais.
 * O desconto por reserva passa a ocorrer na Fase 2.
 */
export function configuredCapacity(capacity: number, _registeredCodes: number): number {
  return capacity;
}
