import {Feedback} from '../../components/Feedback';
import {lazy,Suspense,useEffect,useMemo,useState,Component,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Box,Focus,RotateCcw,RefreshCw} from 'lucide-react';
import {SHIFTS,shiftLabel,todayInSaoPaulo,isValidIsoDate,isWeekday,type Shift} from '../../lib/reservations';
import {buildOverviewLayout,isSnapshotFresh,overviewStatuses,searchOverview} from './overviewLayout';
import {getOverviewCatalog,getOverviewSummary,getOverviewDetails,getLastMovement,sameOverviewSummary} from './overviewData';
import NotebookInspection from './NotebookInspection';
import {hotspots,type Hotspot} from './inspection';
import {resolveQuality,pageSlice,type QualityChoice} from './renderPolicy';
import './prototype.css';

const Canvas=lazy(()=>import('./EnvironmentCanvas'));
const FORMAT=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'});
const format=(v:string)=>Number.isFinite(Date.parse(v))?FORMAT.format(new Date(v)):'Horário não confirmado';
const poll={retry:false,staleTime:0,refetchOnMount:'always' as const,refetchOnWindowFocus:'always' as const,refetchInterval:30_000};
class CanvasBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<Feedback kind="warning">Não foi possível renderizar a cena. Use a lista de carrinhos.</Feedback>:this.props.children;}
}
export default function DigitalTwinPage({onNavigate}:{onNavigate:(target:'reservations'|'movements'|'maintenance'|'spatial-editor'|'notebooks')=>void}){
 const [date,setDate]=useState(todayInSaoPaulo),[shift,setShift]=useState<Shift>('MATUTINO');
 const [search,setSearch]=useState(''),[selection,setSelection]=useState<string|null>(null),[focusId,setFocusId]=useState<string|null>(null);
 const [reset,setReset]=useState(0),[show3d,setShow3d]=useState(()=>!window.matchMedia('(max-width: 690px)').matches),[qualityChoice,setQualityChoice]=useState<QualityChoice>('auto');
 const [viewport,setViewport]=useState(()=>window.innerWidth),[listPage,setListPage]=useState(0);
 const [saveData,setSaveData]=useState(()=>Boolean((navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData));
 useEffect(()=>{const sync=()=>{setViewport(window.innerWidth);setSaveData(Boolean((navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData));};window.addEventListener('resize',sync);window.addEventListener('online',sync);return()=>{window.removeEventListener('resize',sync);window.removeEventListener('online',sync);};},[]);
 const [doorOpen,setDoorOpen]=useState(false),[hotspot,setHotspot]=useState<Hotspot|null>(null),[inspectionReady,setInspectionReady]=useState(false);
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),5000);return()=>window.clearInterval(timer);},[]);
 const valid=isValidIsoDate(date);
 const catalog=useQuery({queryKey:['spatial','overview-catalog'],queryFn:({signal})=>getOverviewCatalog(signal),...poll});
 const summary=useQuery({queryKey:['spatial','overview-summary',date,shift],queryFn:()=>getOverviewSummary(date,shift),enabled:valid,...poll});
 const summaryFresh=valid&&isSnapshotFresh(summary.dataUpdatedAt,Math.max(now,summary.dataUpdatedAt),summary.isError);
 const catalogFresh=isSnapshotFresh(catalog.dataUpdatedAt,Math.max(now,catalog.dataUpdatedAt),catalog.isError);
 const rows=summary.data??[];
 const layout=useMemo(()=>buildOverviewLayout(summary.data??[],catalogFresh?catalog.data?.rooms??[]:[],catalogFresh?catalog.data?.models??[]:[],catalogFresh?catalog.data?.labels??[]:[],summaryFresh),[summary.data,catalog.data,catalogFresh,summaryFresh]);
 const quality=resolveQuality(qualityChoice,viewport,navigator.hardwareConcurrency,saveData,layout.carts.length);
 useEffect(()=>{setDoorOpen(false);setInspectionReady(false);},[quality]);
 const selected=layout.carts.find(c=>c.id===selection);
 const selectedSummary=rows.find(r=>r.cart_id===selected?.id);
 const detail=useQuery({queryKey:['spatial','overview-detail',selected?.id,date,shift],queryFn:()=>getOverviewDetails(selected!.id,date,shift),enabled:!!selected&&summaryFresh,...poll});
 const movement=useQuery({queryKey:['spatial','overview-movement',selected?.id],queryFn:({signal})=>getLastMovement(selected!.id,signal),enabled:!!selected&&summaryFresh,...poll});
 const detailFresh=!!detail.data&&!!selectedSummary&&summaryFresh&&isSnapshotFresh(detail.dataUpdatedAt,Math.max(now,detail.dataUpdatedAt),detail.isError)&&sameOverviewSummary(detail.data.summary,selectedSummary);
 const movementFresh=summaryFresh&&isSnapshotFresh(movement.dataUpdatedAt,Math.max(now,movement.dataUpdatedAt),movement.isError);
 const matches=useMemo(()=>searchOverview(layout.carts,search),[layout.carts,search]);
 const page=pageSlice(matches,listPage);
 const summaryById=useMemo(()=>new Map(rows.map(r=>[r.cart_id,r])),[rows]);
 const counts=summaryFresh?rows.reduce((a,r)=>({reserved:a.reserved+r.reserved,available:a.available+r.available}),{reserved:0,available:0}):null;
 const firstSnapshot=rows.reduce<string|null>((old,r)=>old===null||Date.parse(r.snapshot_at)<Date.parse(old)?r.snapshot_at:old,null);
 function pick(id:string){if(!layout.carts.some(c=>c.id===id))return;setSelection(id);if(focusId&&focusId!==id){setFocusId(null);setDoorOpen(false);setHotspot(null);}}
 function overview(){setDoorOpen(false);setHotspot(null);setFocusId(null);setSelection(null);setReset(v=>v+1);}
 function period(nextDate:string,nextShift:Shift){setDate(nextDate);setShift(nextShift);setDoorOpen(false);setHotspot(null);setFocusId(null);setReset(v=>v+1);}
 function refresh(){void catalog.refetch();if(valid)void summary.refetch();if(selected&&summaryFresh){void detail.refetch();void movement.refetch();}}
 return <div className="dt-page" onKeyDown={e=>{if(e.key==='Escape'&&focusId){e.preventDefault();overview();}}}>
  <header className="page-header"><h1>Ambiente 3D</h1><p>Consulte todos os carrinhos cadastrados e a ocupação no período selecionado.</p></header>
  <p className="notice warning"><strong>F5.5 — ambiente de desenvolvimento.</strong> Modelos 3D ilustrativos; salas exibidas separadamente, sem planta real. Posições e movimentações registradas não comprovam localização física em tempo real.</p>
  <div className="panel dt-overview-toolbar">
   <label className="field dt-search-field"><span>Buscar carrinho na lista</span><input type="search" value={search} onChange={e=>{setSearch(e.target.value);setListPage(0);}} placeholder="Código, nome ou local"/></label>
   <label className="field"><span>Data</span><input id="dt-date" type="date" value={date} onChange={e=>period(e.target.value,shift)}/></label>
   <label className="field"><span>Turno</span><select id="dt-shift" value={shift} onChange={e=>period(date,e.target.value as Shift)}>{SHIFTS.map(s=><option key={s} value={s}>{shiftLabel[s]}</option>)}</select></label>
   <label className="field"><span>Qualidade visual</span><select value={qualityChoice} onChange={e=>setQualityChoice(e.target.value as QualityChoice)}><option value="auto">Automática</option><option value="high">Detalhada (GLB)</option><option value="low">Econômica</option></select></label>
   <label className="dt-toggle"><input type="checkbox" checked={show3d} onChange={e=>{setDoorOpen(false);setInspectionReady(false);setShow3d(e.target.checked);}}/> Exibir ambiente 3D</label>
   <p className="form-hint dt-quality-note">Qualidade em uso: {quality==='low'?'Econômica':'Detalhada'}. Em telas pequenas a lista abre primeiro; ative o 3D quando desejar.</p>
   <div className="dt-overview-actions"><button type="button" className="secondary" onClick={overview}><RotateCcw size={16}/> Visão geral</button><button type="button" className="secondary" disabled={catalog.isFetching||summary.isFetching||detail.isFetching||movement.isFetching} onClick={refresh}><RefreshCw size={16}/> Atualizar dados</button></div>
  </div>
  {!valid&&<Feedback kind="error">Informe uma data válida para consultar disponibilidade.</Feedback>}
  {valid&&!isWeekday(date)&&<Feedback kind="warning">Fim de semana: o saldo operacional segue a regra institucional de indisponibilidade.</Feedback>}
  {summary.isError?<Feedback kind="error">Não foi possível confirmar a ocupação deste período. Saldos e estados não serão apresentados como livres.</Feedback>:summary.isPending&&valid?<p role="status">Carregando todos os carrinhos…</p>:valid&&!summaryFresh?<Feedback kind="warning">Resumo defasado; aguarde a atualização ou tente novamente.</Feedback>:null}
  {catalog.isError||(!catalogFresh&&catalog.data)?<Feedback kind="warning">Não foi possível confirmar a configuração espacial; os carrinhos aparecem na zona sem localização definida.</Feedback>:catalog.isPending?<p role="status">Carregando localizações cadastradas…</p>:null}
  <div className="dt-overview-metrics">
   <div className="panel"><span>Carrinhos no resumo</span><strong>{summary.data?rows.length:'—'}</strong></div>
   <div className="panel"><span>Sem posição confirmada</span><strong>{summary.data?layout.carts.filter(c=>!c.placed).length:'—'}</strong></div>
   <div className="panel"><span>Reservados</span><strong>{counts?.reserved??'—'}</strong></div>
   <div className="panel"><span>Disponíveis</span><strong>{counts?.available??'—'}</strong></div>
  </div>
  <p className="form-hint" role="status">{summary.isFetching?'Atualizando resumo…':firstSnapshot?'Consulta registrada em '+format(firstSnapshot):summary.isSuccess?'Consulta concluída sem carrinhos.':'Sem resumo confirmado.'}{summaryFresh?' · atualização a cada 30 segundos.':' · disponibilidade não confirmada.'}</p>
  <div className="dt-layout dt-overview-layout">
   <section className="panel dt-scene">
    <h2><Box size={19}/> {focusId&&selected?.id===focusId?'Foco: '+selected.code:'Ambientes — visão geral'}</h2>
    <div className="dt-legend">{Object.entries(overviewStatuses).map(([key,s])=><span key={key}><i style={{backgroundColor:'#'+s.color.toString(16).padStart(6,'0')}}/>{s.label}</span>)}</div>
    {show3d&&layout.carts.length>0?<CanvasBoundary key={quality}><Suspense fallback={<p role="status">Carregando visualização 3D…</p>}><Canvas layout={layout} selectedId={selected?.id??null} focusId={focusId} reset={reset} onPick={pick} doorOpen={doorOpen&&selected?.id===focusId} hotspot={hotspot} onHotspot={(id,part)=>{if(id===focusId&&id===selected?.id)setHotspot(part);}} onInspectionReady={setInspectionReady} quality={quality}/></Suspense></CanvasBoundary>:<p className="empty">{!show3d?'Cena desativada; use a lista acessível.':summary.isSuccess?'Nenhum carrinho cadastrado neste resumo.':'Aguardando dados para a cena.'}</p>}
    <p className="form-hint">Arraste para orbitar, roda ou pinça para zoom; use a lista para selecionar por teclado. A busca não remove carrinhos da cena. Focalize o carrinho e abra a porta virtual para inspecionar o interior. Os componentes são ilustrativos; não indicam ocupação real.</p>
   </section>
   <section className="panel dt-details" aria-labelledby="dt-real-details">
    <h2 id="dt-real-details">Detalhes do carrinho</h2>
    {!selected||!selectedSummary?<p className="empty">Selecione um carrinho na cena ou na lista.</p>:<>
     <div aria-live="polite"><h3>{selected.name}</h3><p>{selected.code} · {overviewStatuses[selected.status].label}</p>
      <dl><div><dt>Capacidade nominal</dt><dd>{selectedSummary.nominal_capacity}</dd></div><div><dt>Capacidade efetiva</dt><dd>{summaryFresh?selectedSummary.effective_capacity:'—'}</dd></div>
       <div><dt>Reservados</dt><dd>{summaryFresh?selectedSummary.reserved:'—'}</dd></div><div><dt>Disponíveis</dt><dd>{summaryFresh?selectedSummary.available:'—'}</dd></div>
       <div><dt>Manutenções no período</dt><dd>{summaryFresh?selectedSummary.maintenance_count:'—'}</dd></div></dl>
      <p><strong>Posição cadastrada: </strong>{selected.location}</p><p><strong>Local de guarda: </strong>{selected.storage}</p>
     </div>
     <button type="button" className="secondary" disabled={!show3d} onClick={()=>{setFocusId(selected.id);setDoorOpen(false);setHotspot(null);setReset(v=>v+1);}}><Focus size={16}/> Focalizar carrinho</button>
     {focusId===selected.id&&<section className="dt-inspection" aria-label="Inspeção virtual">
      <h3>Inspeção virtual</h3>
      <p className="form-hint">Ações apenas na visualização; nenhuma alteração no cadastro ou equipamento físico.</p>
      {!inspectionReady&&<p className="form-hint">Porta virtual indisponível sem o modelo detalhado. Consulte os componentes e vínculos pela lista.</p>}
      <div className="dt-inspection-actions">
       <button type="button" className="secondary" disabled={!show3d||quality==='low'||!inspectionReady} aria-pressed={doorOpen} onClick={()=>{setDoorOpen(v=>!v);setHotspot('door');}}>{doorOpen?'Fechar porta virtual':'Abrir porta virtual'}</button>
       <button type="button" className="secondary" onClick={overview}>Sair da inspeção</button>
      </div>
      <div className="dt-inspection-actions" aria-label="Componentes ilustrativos">{(Object.keys(hotspots) as Hotspot[]).map(key=><button key={key} type="button" className="secondary" aria-pressed={hotspot===key} onClick={()=>setHotspot(key)}>{hotspots[key].label}</button>)}</div>
      {hotspot&&<p role="status"><strong>{hotspots[hotspot].label}: </strong>{hotspots[hotspot].description}</p>}
     </section>}
     <h3>Última movimentação registrada</h3>
     {movement.isFetching&&!movement.dataUpdatedAt?<p role="status">Consultando movimentações…</p>:!movementFresh?<p className="form-hint">Movimentação não confirmada.</p>:movement.data?<><p>{movement.data.return_at?'Devolução registrada':'Retirada sem devolução registrada'}</p><p>{format(movement.data.return_at??movement.data.pickup_at)} · {movement.data.quantity} equipamento(s)</p></>:<p>Nenhuma movimentação registrada.</p>}
     <button className="secondary" type="button" onClick={()=>onNavigate('movements')}>Consultar movimentações</button>
     <button className="secondary" type="button" onClick={()=>onNavigate('maintenance')}>Consultar manutenção</button>
     <h3>Reservas do período</h3>
     {detail.isFetching&&!detail.dataUpdatedAt?<p role="status">Consultando reservas…</p>:!detailFresh?<p className="form-hint" role="status">Detalhe não confirmado ou divergente do resumo. Atualize os dados.</p>:<>
      <p className="form-hint">Detalhe consultado em {format(detail.data!.summary.snapshot_at)}.</p>
      {detail.data!.reservations.length===0?<p>Nenhuma reserva registrada neste período.</p>:<div className="dt-reservations">{detail.data!.reservations.map(r=><article key={r.period_id}>
       <strong>{r.requester}</strong><p>{r.quantity} notebook(s) · {r.mode==='COMPLETA'?'Carrinho completo':'Parcial'}</p>
       <p>Destino da reserva: {r.destination_room_id?(catalogFresh?catalog.data?.labels.find(l=>l.id===r.destination_room_id)?.label??r.destination_label??'Sala não identificada':r.destination_label??'Sala cadastrada; identificação indisponível'):r.destination_label??'Não informado'}</p>
       <p>Mouse: {r.needs_mouse?'Sim':'Não'}</p>{r.notes&&<p>Observações: {r.notes}</p>}
      </article>)}</div>}
      <NotebookInspection key={selected.id+':'+date+':'+shift} cartId={selected.id} slots={detail.data!.confirmed_slots} reservations={detail.data!.reservations} now={now} onHistory={()=>onNavigate('movements')} onCatalog={()=>onNavigate('notebooks')}/>
     </>}
     <p className="form-hint">Próxima reserva futura não consultada nesta tela.</p>
     <button className="secondary" type="button" onClick={()=>onNavigate('reservations')}>Ver reservas</button>
    </>}
   </section>
  </div>
  <section className="panel"><h2>Todos os carrinhos — lista acessível</h2><p className="form-hint">{matches.length} de {layout.carts.length} carrinho(s) na lista.</p>
   <div className="dt-list">{page.items.map(c=><button type="button" className="dt-cart" key={c.id} aria-pressed={selected?.id===c.id} onClick={()=>pick(c.id)}>
    <strong>{c.code} · {c.name}</strong><span>{overviewStatuses[c.status].label}{summaryFresh?' · '+summaryById.get(c.id)!.available+' disponíveis':''}</span><small>{c.location}</small>
   </button>)}</div>
   {page.pages>1&&<nav className="dt-pagination" aria-label="Paginação dos carrinhos"><button type="button" className="secondary" disabled={page.page===0} onClick={()=>setListPage(page.page-1)}>Anterior</button><span role="status">Página {page.page+1} de {page.pages}</span><button type="button" className="secondary" disabled={page.page===page.pages-1} onClick={()=>setListPage(page.page+1)}>Próxima</button></nav>}
   {matches.length===0&&<p className="empty">{layout.carts.length?'Nenhum carrinho encontrado nessa busca.':summary.isSuccess?'Nenhum carrinho cadastrado.':'Nenhum resumo disponível.'}</p>}
  </section>
 </div>;
}
