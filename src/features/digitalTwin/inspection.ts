/** Scene identifiers are illustrative, never notebook IDs or database slot keys. */
export const hotspots={
 door:{label:'Porta e dobradiças',description:'Porta virtual articulada. Nenhum comando físico é enviado.'},
 shelf:{label:'Prateleiras e divisórias',description:'Compartimentos ilustrativos; não correspondem a uma contagem de estoque.'},
 charging:{label:'Cabos e conectores',description:'Representação visual da alimentação. Não informa energia ou funcionamento.'},
 wheels:{label:'Rodízios e travas',description:'Modelo de rodízios; condição física não verificada.'},
 notebook:{label:'Notebook ilustrativo',description:'Exemplo visual sem patrimônio, posição física ou reserva individual associada.'},
} as const;
export type Hotspot=keyof typeof hotspots;
export function hotspotForName(name:string):Hotspot|null{
 if(/^(door-|handle$|hinge-|vent-|badge$)/.test(name))return 'door';
 if(/^(shelf-|divider-)/.test(name))return 'shelf';
 if(/^(charging-rail-|connector-|cable-)/.test(name))return 'charging';
 if(/^(wheel-|hub-|brake-|caster-bracket-)/.test(name))return 'wheels';
 if(/^sample-notebook-\d{2}$/.test(name))return 'notebook';
 return null;
}
export type ConfirmedSlot={slot_key:string;notebook_id:string;code:string;confirmed_at:string;reservation_period_id:string|null};
export type ReservationRef={period_id:string;requester:string;quantity:number};
export function confirmedNotebookRows(slots:readonly ConfirmedSlot[],reservations:readonly ReservationRef[]){
 const ids=new Set<string>(),keys=new Set<string>(),periods=new Map<string,ReservationRef>();
 for(const r of reservations){if(periods.has(r.period_id))throw Error('Período duplicado');periods.set(r.period_id,r);}
 return slots.map(s=>{
  if(!s.slot_key.trim()||!s.code.trim()||ids.has(s.notebook_id)||keys.has(s.slot_key)||!Number.isFinite(Date.parse(s.confirmed_at)))throw Error('Vínculo inconsistente');
  ids.add(s.notebook_id);keys.add(s.slot_key);
  const reservation=s.reservation_period_id?periods.get(s.reservation_period_id):undefined;
  if(s.reservation_period_id&&!reservation)throw Error('Período do vínculo não confirmado');
  return {...s,reservation:reservation??null};
 }).sort((a,b)=>a.slot_key.localeCompare(b.slot_key,'pt-BR',{numeric:true}));
}
export function safeConfirmedRows(slots:readonly ConfirmedSlot[],reservations:readonly ReservationRef[]){
 try{return confirmedNotebookRows(slots,reservations);}catch{return null;}
}
export type NotebookMovement={id:string;cart_id:string;notebook_ids:string[];pickup_at:string;return_at:string|null;pickup_condition:'BOA'|'RESSALVA';return_condition:'BOA'|'RESSALVA'|null};
export function validateNotebookHistory(rows:NotebookMovement[],cartId:string,notebookId:string){
 const ids=new Set<string>();
 for(const r of rows){
  if(ids.has(r.id)||r.cart_id!==cartId||!r.notebook_ids.includes(notebookId)||!Number.isFinite(Date.parse(r.pickup_at))||
   (r.return_at!==null&&(!Number.isFinite(Date.parse(r.return_at))||Date.parse(r.return_at)<Date.parse(r.pickup_at)||r.return_condition===null))||
   (r.return_at===null&&r.return_condition!==null))throw Error('Histórico inconsistente');
  ids.add(r.id);
 }
 return rows;
}
