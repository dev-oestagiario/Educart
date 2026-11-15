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
export async function downloadPdf(rows:ReportRow[],period:string,basename='educart-relatorio'):Promise<void>{
  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
  const width=pdf.internal.pageSize.getWidth();
  const height=pdf.internal.pageSize.getHeight();
  const margin=38;
  let y=56;
  let page=1;
  function header() {
    pdf.setFont('helvetica','bold');pdf.setFontSize(17);
    pdf.text('Educart - Relatório de reservas',margin,34);
    pdf.setFont('helvetica','normal');pdf.setFontSize(9);
    pdf.text(period,margin,48);
    pdf.text('Página '+page,width-margin-54,height-22);
    pdf.setDrawColor(210,220,233);pdf.line(margin,54,width-margin,54);
  }
  header();
  pdf.setFont('helvetica','normal');pdf.setFontSize(9);
  pdf.text('Períodos no recorte: '+rows.length,margin,y+14);
  y+=30;
  for(const row of rows){
    const headline=[row.date,row.shift,row.cart,row.requester].join('  |  ');
    const subtitle=[
      row.quantity+' notebook(s)',row.mode,'Mouse: '+(row.needsMouse?'Sim':'Não'),row.status,'TI: '+row.createdBy
    ].join('  -  ');
    const details=row.notes?'Observações: '+row.notes:'';
    const lines1=pdf.splitTextToSize(headline,width-2*margin) as string[];
    const lines2=pdf.splitTextToSize(subtitle,width-2*margin) as string[];
    const lines3=details?pdf.splitTextToSize(details,width-2*margin) as string[]:[];
    const blockHeight=15+lines1.length*11+lines2.length*11+lines3.length*11;
    if(y+blockHeight>height-39){pdf.addPage();page++;header();y=73;}
    pdf.setFont('helvetica','bold');pdf.setFontSize(10);
    pdf.text(lines1,margin,y);
    y+=lines1.length*12+3;
    pdf.setFont('helvetica','normal');pdf.setFontSize(9);
    pdf.text(lines2,margin,y);y+=lines2.length*12;
    if(lines3.length){pdf.text(lines3,margin,y);y+=lines3.length*12;}
    pdf.setDrawColor(233,238,246);pdf.line(margin,y+3,width-margin,y+3);
    y+=18;
  }
  if(!rows.length){pdf.text('Nenhuma reserva encontrada para os filtros selecionados.',margin,y);}
  pdf.save(basename+'.pdf');
}
