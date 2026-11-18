import {lazy,Suspense,useState} from 'react';
import {Box, DoorOpen, Focus, RotateCcw} from 'lucide-react';
import {demoAvailable,findPrototypeCarts,prototypeCarts,statuses} from './prototypeData';
import './prototype.css';
const Canvas=lazy(()=>import('./PrototypeCanvas'));
export default function PrototypePage() {
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [inspection,setInspection]=useState(false);
  const [doorOpen,setDoorOpen]=useState(false);
  const [show3d,setShow3d]=useState(true);
  const [quality,setQuality]=useState<'low'|'high'>('high');
  const [search,setSearch]=useState('');
  const [reset,setReset]=useState(0);
  const selected=prototypeCarts.find(c=>c.id===selectedId);
  const matches=findPrototypeCarts(search);
  function select(id:string){if(id===selectedId)return;setSelectedId(id);setDoorOpen(false);setInspection(false);}
  function overview(){setInspection(false);setDoorOpen(false);setSelectedId(null);setReset(n=>n+1);}
  return <div className="dt-page" onKeyDown={e=>{if(e.key==='Escape'&&inspection){e.preventDefault();overview();}}}>
    <header className="page-header"><h1>Ambiente 3D · Protótipo</h1><p>Explore todos os carrinhos de uma sala de TI ilustrativa.</p></header>
    <p className="notice warning"><strong>F5.0 — demonstração.</strong> Ambiente, localização, ocupação e equipamentos fictícios. Nenhuma leitura ou alteração de reservas reais.</p>
    <div className="dt-toolbar panel">
      <label className="field"><span>Buscar carrinho na lista</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome ou código"/></label>
      <label className="field"><span>Qualidade visual</span><select value={quality} onChange={e=>setQuality(e.target.value==='low'?'low':'high')}><option value="high">Padrão</option><option value="low">Econômica</option></select></label>
      <label className="dt-toggle"><input type="checkbox" checked={show3d} onChange={e=>setShow3d(e.target.checked)}/> Exibir ambiente 3D</label>
      <button className="secondary" onClick={overview}><RotateCcw size={16}/> Visão geral</button>
    </div>
    <div className="dt-layout">
      <section className="panel dt-scene">
        <h2><Box size={19}/> {inspection&&selected?'Inspeção: '+selected.code:'Sala de TI — visão geral'}</h2>
        <div className="dt-legend">{Object.entries(statuses).map(([key,s])=><span key={key}><i style={{backgroundColor:'#'+s.color.toString(16).padStart(6,'0')}}/>{s.label}</span>)}</div>
        {show3d?<Suspense fallback={<p role="status">Carregando cena…</p>}><Canvas selectedId={selectedId} inspection={inspection} doorOpen={doorOpen} onPick={select} quality={quality} reset={reset}/></Suspense>:<p className="empty">Cena desativada. Todas as demonstrações continuam disponíveis na lista.</p>}
        <p className="form-hint">Arraste para orbitar; roda ou pinça para zoom; botão direito ou dois dedos para deslocar. A lista oferece os mesmos controles de consulta.</p>
      </section>
      <section className="panel dt-details" aria-labelledby="dt-details-title">
        <h2 id="dt-details-title">Detalhes do carrinho</h2>
        {!selected?<p className="empty">Selecione um dos quatro carrinhos na cena ou na lista.</p>:<>
          <div aria-live="polite"><h3>{selected.name}</h3><p>{selected.code} · {statuses[selected.status].label}</p><p>{selected.location}</p>
          <dl><div><dt>Capacidade fictícia</dt><dd>{selected.capacity}</dd></div><div><dt>Reservados</dt><dd>{selected.reserved}</dd></div><div><dt>Disponíveis</dt><dd>{demoAvailable(selected)}</dd></div></dl></div>
          <button className="primary" onClick={()=>{setInspection(!inspection);setDoorOpen(false);}}><Focus size={16}/>{inspection?'Sair da inspeção':'Inspecionar carrinho'}</button>
          {inspection&&<><button className="secondary" aria-pressed={doorOpen} onClick={()=>setDoorOpen(!doorOpen)}><DoorOpen size={16}/>{doorOpen?'Fechar porta':'Abrir porta'}</button>
          <p role="status">Porta {doorOpen?'aberta':'fechada'} · interior ilustrativo; sem identificação física de notebooks.</p></>}
          <p className="form-hint">Consulta demonstrativa, não representa localização em tempo real.</p>
        </>}
      </section>
    </div>
    <section className="panel"><h2>Todos os carrinhos — lista acessível</h2><p className="form-hint">A busca não oculta ativos na cena. {matches.length} de {prototypeCarts.length} exemplos na lista.</p>
      <div className="dt-list">{matches.map(cart=><button key={cart.id} className="dt-cart" aria-pressed={cart.id===selectedId} onClick={()=>select(cart.id)}>
        <strong>{cart.code} · {cart.name}</strong><span>{statuses[cart.status].label} · {demoAvailable(cart)} disponíveis</span><small>{cart.location}</small></button>)}</div>
      {!matches.length&&<p className="empty">Nenhum carrinho encontrado nessa busca.</p>}
    </section>
  </div>;
}
