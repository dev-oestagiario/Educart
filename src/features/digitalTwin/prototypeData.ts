export const statuses = {
  free: {label:'Livre', color:0x4abf9a},
  partial: {label:'Parcialmente reservado', color:0xe9ad55},
  full: {label:'Totalmente reservado', color:0xd97586},
  maintenance: {label:'Em manutenção', color:0x8993aa},
} as const;
export type PrototypeStatus = keyof typeof statuses;
export type PrototypeCart = {
  id:string; code:string; name:string; location:string; x:number; z:number;
  capacity:number; reserved:number; status:PrototypeStatus;
};
// Invented assets and numbers, never read from or written to Supabase.
export const prototypeCarts:readonly PrototypeCart[] = [
  {id:'demo-1',code:'DEMO-01',name:'Carrinho Alfa',location:'Sala de TI ilustrativa',x:-2.9,z:-1.4,capacity:30,reserved:0,status:'free'},
  {id:'demo-2',code:'DEMO-02',name:'Carrinho Beta',location:'Sala de TI ilustrativa',x:-.8,z:-1.4,capacity:30,reserved:12,status:'partial'},
  {id:'demo-3',code:'DEMO-03',name:'Carrinho Gama',location:'Sala de TI ilustrativa',x:1.3,z:-1.4,capacity:30,reserved:30,status:'full'},
  {id:'demo-4',code:'DEMO-04',name:'Carrinho Delta',location:'Sem localização definida',x:3.1,z:1.4,capacity:24,reserved:0,status:'maintenance'},
];
export function findPrototypeCarts(query:string) {
  const term=query.trim().toLocaleLowerCase('pt-BR');
  return prototypeCarts.filter(c=>[c.name,c.code,c.location,statuses[c.status].label].some(v=>v.toLocaleLowerCase('pt-BR').includes(term)));
}
export function demoAvailable(cart:PrototypeCart) {
  return cart.status==='maintenance'?0:Math.max(0,cart.capacity-cart.reserved);
}
