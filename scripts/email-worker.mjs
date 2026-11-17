// Server-side only. No provider credentials, networking or scheduler in this module.
// The approved adapter must classify only definitive non-acceptance as RETRY.
export const templates=Object.freeze({
 NOVO_PEDIDO:'Nova solicitação de reserva',
 PEDIDO_RETIRADO:'Solicitação retirada',
 PEDIDO_APROVADO:'Solicitação aprovada',
 PEDIDO_REJEITADO:'Solicitação rejeitada',
 EQUIPAMENTO_RETIRADO:'Retirada de equipamento registrada',
 EQUIPAMENTO_DEVOLVIDO:'Devolução de equipamento registrada'
});
export async function processEmailBatch({rpc,transport,enabled=false,limit=10}){
 const counts={claimed:0,sent:0,retry:0,failed:0,review:0,cancelled:0,unconfirmed:0};
 if(!enabled)return counts;
 if(typeof rpc!=='function'||typeof transport!=='function')throw Error('Worker não configurado');
 const call=async(name,args)=>{const {data,error}=await rpc(name,args);if(error)throw Error('Falha de processamento da fila');return data;};
 const jobs=await call('claim_email_batch',{p_limit:limit});
 if(!Array.isArray(jobs))throw Error('Resposta da fila inválida');
 counts.claimed=jobs.length;
 for(const job of jobs){
  const args={p_id:job.id,p_token:job.lease_token};
  let recipient;
  try{recipient=await call('authorize_email_send',args);}catch{counts.unconfirmed++;continue;}
  if(!recipient){counts.cancelled++;continue;}
  let outcome='REVIEW';
  if(!Object.hasOwn(templates,job.kind))outcome='FAILED';
  else try{
   const result=await transport({to:recipient,subject:'Educart — '+templates[job.kind],text:'Há uma atualização no Educart. Acesse sua conta para consultar os detalhes.',idempotencyKey:'educart-email-'+job.id});
   if(['SENT','RETRY','FAILED','REVIEW'].includes(result))outcome=result;
  }catch{/* Unknown acceptance: never retry automatically. */}
  try{const saved=await call('finish_email_delivery',{...args,p_outcome:outcome});if(saved===true)counts[outcome.toLowerCase()]++;else counts.unconfirmed++;}catch{counts.unconfirmed++;}
 }
 return counts; // Aggregate only: no addresses, payloads, tokens or provider errors in logs.
}
