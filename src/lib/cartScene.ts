export type SlotPeriod={id:string;reservation_id:string;quantity:number};
export type SlotNotebook={id:string;code:string};
export type SlotAssignment={period_id:string;notebook_id:string};
export type CartSlot={
  position:number;code:string|null;reserved:boolean;
  confirmedCode:boolean;reservationId:string|null;
};
export function buildCartSlots(
  capacity:number, notebooks:SlotNotebook[], periods:SlotPeriod[], assignments:SlotAssignment[]
):CartSlot[]{
  const amount=Math.max(0,Math.min(Math.trunc(capacity),500));
  const codes=notebooks.slice(0,amount);
  const slots:CartSlot[]=Array.from({length:amount},(_,index)=>({
    position:index+1,code:codes[index]?.code??null,reserved:false,
    confirmedCode:false,reservationId:null
  }));
  const notebookIndex=new Map(codes.map((n,i)=>[n.id,i]));
  const periodsById=new Map(periods.map(p=>[p.id,p]));
  for(const assignment of assignments){
    const period=periodsById.get(assignment.period_id);
    const index=notebookIndex.get(assignment.notebook_id);
    if(period&&index!==undefined&&slots[index]&&!slots[index].reserved){
      slots[index]={...slots[index],reserved:true,confirmedCode:true,reservationId:period.reservation_id};
    }
  }
  for(const period of periods){
    const known=slots.filter(s=>s.confirmedCode&&s.reservationId===period.reservation_id).length;
    let remainder=Math.max(0,period.quantity-known);
    // Priorizar posições sem código. Outros lugares ocupados são ilustrativos,
    // nunca tratados como confirmação de um identificador físico.
    for(const slot of [...slots.filter(s=>!s.reserved&&!s.code),...slots.filter(s=>!s.reserved&&!!s.code)]){
      if(!remainder)break;
      const index=slot.position-1;
      slots[index]={...slot,code:null,reserved:true,confirmedCode:false,reservationId:period.reservation_id};
      remainder--;
    }
  }
  return slots;
}
