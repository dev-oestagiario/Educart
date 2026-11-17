import {z} from 'zod';
import {isValidIsoDate,SHIFTS,type Shift,showDate,shiftLabel} from './reservations';

export const availabilitySlotSchema=z.object({
  usage_date:z.string().refine(isValidIsoDate),
  shift:z.enum(SHIFTS),
  capacity:z.number().int().nonnegative(),
  reserved:z.number().int().nonnegative(),
  remaining:z.number().int().nonnegative()
});
export type AvailabilitySlot=z.infer<typeof availabilitySlotSchema>;
export type AvailabilitySummary={
  total:number;withEnough:number;insufficient:AvailabilitySlot[];
  minimumRemaining:number;maximumRemaining:number
};
export function parseAvailabilitySlots(data:unknown,dates:readonly string[],shifts:readonly Shift[]):AvailabilitySlot[]{
  const result=z.array(availabilitySlotSchema).parse(data);
  const expected=dates.flatMap(date=>shifts.map(shift=>date+'|'+shift));
  if(result.length!==expected.length)throw new Error('Consulta de disponibilidade incompleta');
  const actual=result.map(slot=>slot.usage_date+'|'+slot.shift);
  if(new Set(actual).size!==actual.length||expected.some(key=>!actual.includes(key)))
    throw new Error('Consulta de disponibilidade inconsistente');
  if(result.some(slot=>slot.reserved+slot.remaining!==slot.capacity))
    throw new Error('Saldo calculado de forma inconsistente');
  return result;
}
export function summarizeAvailability(slots:readonly AvailabilitySlot[],requestedQuantity:number):AvailabilitySummary{
  const insufficient=slots.filter(slot=>slot.remaining<requestedQuantity);
  return {
    total:slots.length,
    withEnough:slots.length-insufficient.length,
    insufficient,
    minimumRemaining:slots.length?Math.min(...slots.map(slot=>slot.remaining)):0,
    maximumRemaining:slots.length?Math.max(...slots.map(slot=>slot.remaining)):0
  };
}
export function slotDescription(slot:AvailabilitySlot){
  return showDate(slot.usage_date)+' · '+shiftLabel[slot.shift];
}
