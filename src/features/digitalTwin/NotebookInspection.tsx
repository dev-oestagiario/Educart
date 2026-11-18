import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {safeConfirmedRows,type ConfirmedSlot,type ReservationRef} from './inspection';
import {getNotebookHistory} from './inspectionData';
import {isSnapshotFresh} from './overviewLayout';
const time=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'});
const format=(v:string)=>time.format(new Date(v));
const condition=(v:'BOA'|'RESSALVA'|null)=>v==='BOA'?'Sem ressalva':v==='RESSALVA'?'Com ressalva':'Não registrada';
export default function NotebookInspection({cartId,slots,reservations,now,onHistory,onCatalog}:{cartId:string;slots:ConfirmedSlot[];reservations:ReservationRef[];now:number;onHistory:()=>void;onCatalog:()=>void}){
 const [chosen,setChosen]=useState('');
 const [filter,setFilter]=useState('');
 const rows=safeConfirmedRows(slots,reservations);
 const selected=rows?.find(r=>r.notebook_id===chosen);
 const history=useQuery({queryKey:['spatial','notebook-history',cartId,selected?.notebook_id],enabled:!!selected,
  queryFn:({signal})=>getNotebookHistory(cartId,selected!.notebook_id,signal),retry:false,staleTime:0,refetchOnMount:'always',refetchOnWindowFocus:'always',refetchInterval:30_000});
 const fresh=isSnapshotFresh(history.dataUpdatedAt,Math.max(now,history.dataUpdatedAt),history.isError);
 const matches=rows?.filter(r=>(r.code+' '+r.slot_key).toLocaleLowerCase('pt-BR').includes(filter.trim().toLocaleLowerCase('pt-BR')));
 return <section className="dt-inspection" aria-label="Notebooks vinculados">
  <h3>Notebooks com vínculo cadastrado</h3>
  <p className="form-hint">Vínculos confirmados no cadastro. Não são posições do modelo GLB nem confirmação de presença atual. Reservas por quantidade não atribuem automaticamente um notebook.</p>
  {rows===null?<p role="alert">Vínculos inconsistentes; atualize os dados antes de consultar.</p>:rows.length===0?<p>Nenhum vínculo individual confirmado neste carrinho.</p>:<>
   <label className="field"><span>Filtrar notebooks vinculados</span><input type="search" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
   <div className="dt-inspection-list">{matches?.map(r=><button type="button" className="dt-cart" key={r.notebook_id} aria-pressed={chosen===r.notebook_id} onClick={()=>setChosen(r.notebook_id)}><strong>{r.code}</strong><span>Slot cadastrado: {r.slot_key}</span><small>{r.reservation?'Reserva individual vinculada':'Sem atribuição individual confirmada'}</small></button>)}</div>
   {!matches?.length&&<p>Nenhum vínculo corresponde à busca.</p>}
   {selected&&<article className="dt-inspection-record" aria-live="polite">
    <h4>{selected.code}</h4><p>Slot cadastrado: {selected.slot_key}</p><p>Vínculo confirmado em {format(selected.confirmed_at)}.</p>
    <p>{selected.reservation?'Reserva vinculada: '+selected.reservation.requester+' · '+selected.reservation.quantity+' equipamento(s) no período.':'Sem atribuição individual confirmada no período. Isso não significa disponível.'}</p>
    <h4>Histórico individual registrado</h4>
    <p className="form-hint">Até 10 movimentações explicitamente vinculadas ao código, por identidade. Condição registrada na movimentação, não diagnóstico atual. Quantidades sem identificação não vinculam equipamentos.</p>
    {history.isFetching&&!history.dataUpdatedAt?<p role="status">Consultando histórico…</p>:!fresh?<p role="status">Histórico não confirmado. Atualize a consulta.</p>:history.data?.length===0?<p>Nenhuma movimentação individual registrada.</p>:<ul>{history.data?.map(m=><li key={m.id}><strong>Retirada: {format(m.pickup_at)}</strong><p>Condição de retirada: {condition(m.pickup_condition)}</p><p>{m.return_at?'Devolução: '+format(m.return_at)+' · '+condition(m.return_condition):'Devolução não registrada'}</p></li>)}</ul>}
    <button type="button" className="secondary" disabled={history.isFetching} onClick={()=>void history.refetch()}>Atualizar histórico individual</button>
   </article>}
  </>}
  <div className="dt-inspection-actions"><button type="button" className="secondary" onClick={onCatalog}>Consultar cadastro de notebooks</button><button type="button" className="secondary" onClick={onHistory}>Consultar histórico de movimentações</button></div>
 </section>;
}
