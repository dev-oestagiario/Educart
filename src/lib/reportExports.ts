import {showDate} from './reservations';

export type ReportRow={
  date:string;shift:string;cart:string;requester:string;mode:string;
  quantity:number;needsMouse:boolean;status:string;createdBy:string;notes:string
};
export function safeSpreadsheetCell(value:unknown):string{
  const valueAsText=String(value??'');
  return /^[\s]*[=+@-]/.test(valueAsText) ? "'"+valueAsText : valueAsText;
}
export function toCsv(rows:ReportRow[]):string {
  const header=['Data','Turno','Carrinho','Solicitante','Tipo','Notebooks',
    'Precisa mouse','Situação','Registrado por','Observações'];
  const values=rows.map(r=>[
    r.date,r.shift,r.cart,r.requester,r.mode,r.quantity,r.needsMouse?'Sim':'Não',
    r.status,r.createdBy,r.notes
  ]);
  const quote=(v:unknown)=>'"'+safeSpreadsheetCell(v).replace(/"/g,'""')+'"';
  return '\uFEFF'+[header,...values].map(row=>row.map(quote).join(';')).join('\r\n')+'\r\n';
}
export function downloadCsv(rows:ReportRow[],basename='educart-relatorio'):void{
  const blob=new Blob([toCsv(rows)],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download=basename+'.csv';
  document.body.append(link);link.click();link.remove();
  URL.revokeObjectURL(url);
}


export type AgendaEntry={
  shift:string;
  requester:string;
  equipment:string;
  room:string;
  cancelled:boolean;
};
export type AgendaDay={
  iso:string;dateLabel:string;weekday:string;
  entries:AgendaEntry[];
};
export type AgendaReport={
  days:AgendaDay[];
  counts:{weekday:string;value:number}[];
  total:number;
  periodCount:number;
  mouseExtras:number;
};
export type AgendaPdfOptions={
  dates:string[];
  period:string;
  mode:'semana'|'mes';
  title?:string;
  issuedAt?:Date;
};
const weekdayNames=['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO'];
const weekdays=['Segunda','Terça','Quarta','Quinta','Sexta'];

/** Cada período gera uma linha de equipamento e uma complementar de mouse,
 * quando solicitado. O complemento não é uma segunda reserva no banco. */
export function buildAgendaReport(rows:readonly ReportRow[],dates:readonly string[]):AgendaReport{
  const indexed=new Map<string,ReportRow[]>();
  for(const row of rows){
    const key=row.date;
    const existing=indexed.get(key)??[];
    existing.push(row);
    indexed.set(key,existing);
  }
  const days:AgendaDay[]=dates.map(iso=>{
    const date=new Date(iso+'T12:00:00Z');
    const weekday=weekdayNames[date.getUTCDay()];
    const shiftOrder=['Manhã','Tarde','Noite'];
    const records=[...(indexed.get(showDate(iso))??[])].sort((a,b)=>
      shiftOrder.indexOf(a.shift)-shiftOrder.indexOf(b.shift)
    );
    const entries:AgendaEntry[]=records.flatMap(row=>{
      const suffix=row.mode==='Parcial'?' ('+row.quantity+' notebooks)':'';
      const cancelled=row.status.toLocaleLowerCase('pt-BR')==='cancelada';
      const equipment=row.cart+suffix+(row.notes?' - '+row.notes:'')+(cancelled?' [Cancelada]':'');
      const base:AgendaEntry={
        shift:row.shift,requester:row.requester,equipment,room:'Não informada',cancelled
      };
      return row.needsMouse?[base,{
        shift:row.shift,requester:row.requester,
        equipment:'Mouses - '+row.cart+(cancelled?' [Cancelada]':''),
        room:'Não informada',cancelled
      }]:[base];
    });
    return {iso,dateLabel:showDate(iso),weekday,entries};
  });
  const counts=weekdays.map((name,index)=>({
    weekday:name,value:days.filter(day=>
      new Date(day.iso+'T12:00:00Z').getUTCDay()===index+1
    ).reduce((total,day)=>total+day.entries.length,0)
  }));
  return {
    days,counts,total:days.reduce((total,day)=>total+day.entries.length,0),
    periodCount:rows.length,mouseExtras:rows.filter(row=>row.needsMouse).length
  };
}

/** Exporta em A4 vertical, seguindo o modelo de agenda semanal do SENAI.
 * Os dados de sala inexistentes não são inventados. */
export async function createAgendaPdf(
  rows:ReportRow[],options:AgendaPdfOptions
){
  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({orientation:'portrait',unit:'pt',format:'a4'});
  const report=buildAgendaReport(rows,options.dates);
  const W=pdf.internal.pageSize.getWidth(),H=pdf.internal.pageSize.getHeight();
  const m=38,right=W-m,available=W-2*m;
  const purple:[number,number,number]=[54,38,79];
  const lilac:[number,number,number]=[145,112,205];
  const ink:[number,number,number]=[38,35,48];
  const muted:[number,number,number]=[94,92,103];
  const paper:[number,number,number]=[249,248,251];
  const grid:[number,number,number]=[222,220,227];
  const columns=[83,116,available-83-116-84,84];
  const colX=[m,m+columns[0],m+columns[0]+columns[1],m+columns[0]+columns[1]+columns[2]];
  const issued=(options.issuedAt??new Date()).toLocaleString('pt-BR',{
    timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',
    hour:'2-digit',minute:'2-digit',hour12:false
  });
  const title=options.title?.trim()||'Agenda de Reservas - Laboratórios Móveis';
  let y=40;
  const drawPageHeader=(first:boolean)=>{
    y=43;
    pdf.setFillColor(...lilac);pdf.rect(m,y-15,5,16,'F');
    pdf.setTextColor(...purple);pdf.setFont('helvetica','bold');
    pdf.setFontSize(18);
    const titleLines=pdf.splitTextToSize(title,available-20) as string[];
    pdf.text(titleLines,m+16,y);
    y+=Math.max(0,titleLines.length-1)*21+21;
    pdf.setFont('helvetica','normal');pdf.setFontSize(9);
    pdf.setTextColor(...muted);
    pdf.text('Período: '+options.period+'  |  Emissão: '+issued,m,y);
    y+=17;
    pdf.setDrawColor(...grid);pdf.line(m,y,right,y);
    y+=first?29:20;
  };
  drawPageHeader(true);
  const nextPage=()=>{
    pdf.addPage();drawPageHeader(false);
  };
  const reserve=(points:number)=>{
    if(y+points>H-55)nextPage();
  };
  function textInCell(value:string,width:number){
    pdf.setFont('helvetica','normal');pdf.setFontSize(8.4);
    return pdf.splitTextToSize(value,width-14) as string[];
  }
  function drawTableHeader(){
    const height=23;
    pdf.setFillColor(...purple);pdf.rect(m,y,available,height,'F');
    pdf.setFont('helvetica','bold');pdf.setFontSize(8.7);
    pdf.setTextColor(255,255,255);
    ['Horário','Solicitante','Equipamento / Objetivo','Sala'].forEach((label,i)=>
      pdf.text(label,colX[i]+7,y+15)
    );
    y+=height;
  }
  function drawDayHeading(day:AgendaDay,continued=false){
    pdf.setFillColor(...lilac);pdf.rect(m,y-9,6,9,'F');
    pdf.setFont('helvetica','bold');pdf.setFontSize(12.4);
    pdf.setTextColor(...purple);
    pdf.text(day.weekday+' - '+day.dateLabel+(continued?' (continuação)':''),m+12,y);
    y+=16;
  }
  function continueDay(day:AgendaDay){
    nextPage();drawDayHeading(day,true);drawTableHeader();
  }
  function drawEntry(day:AgendaDay,entry:AgendaEntry,index:number){
    const cells=[
      textInCell(entry.shift,columns[0]),textInCell(entry.requester,columns[1]),
      textInCell(entry.equipment,columns[2]),textInCell(entry.room,columns[3])
    ];
    const maxLines=Math.max(...cells.map(lines=>lines.length));
    let offset=0;
    while(offset<maxLines){
      // Use the same explicit 11 pt line grid for measuring and rendering.
      let fit=Math.floor((H-55-y-11)/11);
      if(fit<1||y+27>H-55){continueDay(day);fit=Math.floor((H-55-y-11)/11);}
      const take=Math.min(maxLines-offset,Math.max(1,fit));
      const rowHeight=Math.max(27,take*11+11);
      pdf.setFillColor(...(index%2===0?paper:[255,255,255] as [number,number,number]));
      pdf.rect(m,y,available,rowHeight,'F');
      pdf.setDrawColor(...grid);
      pdf.line(m,y+rowHeight,right,y+rowHeight);
      for(let i=1;i<columns.length;i++)pdf.line(colX[i],y,colX[i],y+rowHeight);
      pdf.setTextColor(...(entry.cancelled?muted:ink));pdf.setFont('helvetica','normal');pdf.setFontSize(8.4);
      cells.forEach((lines,i)=>lines.slice(offset,offset+take).forEach((line,j)=>pdf.text(line,colX[i]+7,y+12+j*11)));
      y+=rowHeight;offset+=take;
      if(offset<maxLines)continueDay(day);
    }
  }
  for(const day of report.days){
    reserve(67+(day.entries.length?27:0));
    drawDayHeading(day);
    if(day.entries.length===0){
      pdf.setFont('helvetica','italic');pdf.setFontSize(9);
      pdf.setTextColor(...muted);
      pdf.text('Nenhuma reserva registrada para este dia.',m,y+7);
      y+=38;
      continue;
    }
    drawTableHeader();
    day.entries.forEach((entry,index)=>drawEntry(day,entry,index));
    y+=27;
  }
  reserve(205);
  pdf.setFont('helvetica','bold');pdf.setFontSize(12.4);
  pdf.setTextColor(...purple);
  pdf.text(options.mode==='semana'?'Resumo Geral da Semana':'Resumo Geral do Mês',m,y);
  y+=16;
  const summaryLeft=m+92,summaryValue=m+256;
  pdf.setFontSize(9);
  for(const item of report.counts){
    pdf.setFont('helvetica','normal');pdf.setTextColor(...ink);
    pdf.text(item.weekday+':',summaryLeft,y);
    pdf.text(item.value+' '+(item.value===1?'registro':'registros'),summaryValue,y);
    y+=18;
  }
  pdf.setDrawColor(...purple);
  pdf.line(summaryLeft-5,y-7,summaryValue+150,y-7);
  pdf.setFont('helvetica','bold');pdf.setFontSize(10);
  pdf.text('Total Geral:',summaryLeft,y+7);
  pdf.text(report.total+' '+(report.total===1?'registro':'registros'),summaryValue,y+7);
  y+=34;
  pdf.setFont('helvetica','normal');pdf.setFontSize(8);
  pdf.setTextColor(...muted);
  const legend='Cada período gera uma linha de equipamento; quando solicitado, mouse aparece em linha adicional. Sala sem cadastro: Não informada.';
  const legendLines=pdf.splitTextToSize(legend,available) as string[];
  reserve(legendLines.length*11+13);
  pdf.text(legendLines,m,y);
  const pages=pdf.getNumberOfPages();
  for(let i=1;i<=pages;i++){
    pdf.setPage(i);
    pdf.setDrawColor(...grid);pdf.line(m,H-39,right,H-39);
    pdf.setFont('helvetica','normal');pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    pdf.text('Educart | Agenda de reservas',m,H-25);
    pdf.text('Página '+i+' de '+pages,right,H-25,{align:'right'});
  }
  return pdf;
}

export async function downloadPdf(rows:ReportRow[],options:AgendaPdfOptions,basename='educart-agenda-reservas'):Promise<void>{
  const pdf=await createAgendaPdf(rows,options);
  pdf.save(basename+'.pdf');
}
