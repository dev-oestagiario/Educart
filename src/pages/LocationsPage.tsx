import {useState,type FormEvent} from 'react';
import {useQuery,useQueryClient,useMutation} from '@tanstack/react-query';
import {supabase,type Cart} from '../lib/supabase';
import {useLocations,roomOptions,type Campus,type Block,type Room} from '../lib/locations';
import {fetchCatalogRows} from '../lib/catalog';
import {errorMessage} from '../lib/validation';
import {Feedback,LoadingState,EmptyState} from '../components/Feedback';
import RecordsHeader from '../components/RecordsHeader';
import {RecordTrail,RecordDetail,DetailFields} from '../components/RecordDetail';
type Kind='campuses'|'campus_blocks'|'campus_rooms';
type Tab=Kind|'storage';
type Row=Campus|Block|Room;
const labels:Record<Kind,string>={campuses:'Campus',campus_blocks:'Bloco',campus_rooms:'Sala'};
const sections:Record<Tab,string>={campuses:'Campus',campus_blocks:'Blocos',campus_rooms:'Salas',storage:'Local de guarda'};
export default function LocationsPage(){
 const query=useLocations(),qc=useQueryClient();
 const carts=useQuery({queryKey:['carts'],queryFn:()=>fetchCatalogRows<Cart>('carts')});
 const storage=useQuery({queryKey:['cart-storage'],queryFn:async()=>{
  const rows:{cart_id:string;room_id:string|null}[]=[];
  for(let offset=0;;offset+=250){
   const {data,error}=await supabase.from('cart_storage_locations').select('cart_id,room_id').order('cart_id').range(offset,offset+249);
   if(error)throw error;const page=data??[];rows.push(...page);if(page.length<250)return rows;
  }
 }});
 const [tab,setTab]=useState<Tab>('campuses'),[screen,setScreen]=useState<'list'|'detail'|'form'>('list');
 const [selected,setSelected]=useState<string|null>(null),[search,setSearch]=useState(''),[status,setStatus]=useState('all');
 const [name,setName]=useState(''),[parent,setParent]=useState(''),[active,setActive]=useState(true),[room,setRoom]=useState('');
 const [notice,setNotice]=useState<{error:boolean;text:string}|null>(null);
 const options=roomOptions(query.data),allRooms=roomOptions(query.data,false);
 const rows:Row[]=tab==='campuses'?query.data?.campuses??[]:tab==='campus_blocks'?query.data?.blocks??[]:tab==='campus_rooms'?query.data?.rooms??[]:[];
 const parents=tab==='campus_blocks'?query.data?.campuses??[]:query.data?.blocks??[];
 const record=rows.find(r=>r.id===selected),cart=carts.data?.find(c=>c.id===selected);
 const linkedRoom=(id:string)=>storage.data?.find(x=>x.cart_id===id)?.room_id??'';
 const roomLabel=(id:string)=>id?(allRooms.find(r=>r.id===id)?.label??'Local anterior'):'Não informada';
 const rowLabel=(r:Row)=>'block_id' in r?allRooms.find(x=>x.id===r.id)?.label??r.name:'campus_id' in r?(query.data?.campuses.find(c=>c.id===r.campus_id)?.name??'Campus não informado')+' / '+r.name:r.name;
 const normalized=search.trim().toLocaleLowerCase('pt-BR');
 const matches=(text:string,enabled:boolean)=>text.toLocaleLowerCase('pt-BR').includes(normalized)&&(status==='all'||enabled===(status==='active'));
 const save=useMutation({mutationFn:async()=>{
  if(tab==='storage'){
   if(!selected||!cart)throw new Error('Selecione um carrinho.');
   const {error}=await supabase.from('cart_storage_locations').upsert({cart_id:selected,room_id:room||null});
   if(error)throw error;return;
  }
  if(!name.trim())throw new Error('Informe o nome.');
  if(tab!=='campuses'&&!parent)throw new Error('Selecione o vínculo.');
  const values={name:name.trim(),active,...(tab==='campus_blocks'?{campus_id:parent}:tab==='campus_rooms'?{block_id:parent}:{})};
  const result=selected?await supabase.from(tab).update(values).eq('id',selected):await supabase.from(tab).insert(values);
  if(result.error)throw result.error;
 },onSuccess:async()=>{await Promise.all([qc.invalidateQueries({queryKey:['locations']}),qc.invalidateQueries({queryKey:['cart-storage']})]);setScreen(selected?'detail':'list');setNotice({error:false,text:'Localização salva.'});},onError:e=>setNotice({error:true,text:errorMessage(e)})});
 function list(){if(save.isPending)return;setScreen('list');setSelected(null);setNotice(null);}
 function detail(id:string){setSelected(id);setScreen('detail');setNotice(null);}
 function edit(row:Row|null){
  setSelected(row?.id??null);setName(row?.name??'');setActive(row?.active??true);setParent(row&&'campus_id' in row?row.campus_id:row&&'block_id' in row?row.block_id:'');setNotice(null);setScreen('form');
 }
 function cancel(){if(save.isPending)return;setScreen(selected?'detail':'list');setNotice(null);}
 function submit(e:FormEvent){e.preventDefault();setNotice(null);if(!save.isPending)save.mutate();}
 const title=screen==='list'?'Localizações':screen==='detail'?'Detalhes da localização':tab==='storage'?'Alterar local de guarda':(selected?'Editar ':'Cadastrar ')+labels[tab].toLocaleLowerCase('pt-BR');
 const isLoading=query.isLoading||(tab==='storage'&&(storage.isLoading||carts.isLoading));
 const error=query.error||(tab==='storage'&&(storage.error||carts.error));
 return <div className="records-page">
  {screen!=='list'&&<RecordTrail module="Localizações" section={sections[tab]} current={screen==='detail'?'Detalhes':selected?'Editar':'Novo'} onBack={list} busy={save.isPending}/>}
  <RecordsHeader title={title} description={screen==='list'?'Organize campus, blocos, salas e locais de guarda dos carrinhos.':'O local de guarda cadastral é independente do destino da reserva.'}
   actionKind={screen!=='list'?'back':tab==='storage'?'refresh':'add'} busy={save.isPending}
   actionLabel={screen==='form'?'Voltar':screen==='detail'?'Voltar à listagem':tab==='storage'?'Atualizar listagem':'Cadastrar '+labels[tab].toLocaleLowerCase('pt-BR')}
   onAction={()=>screen==='form'?cancel():screen==='detail'?list():tab==='storage'?void Promise.all([storage.refetch(),carts.refetch(),query.refetch()]):edit(null)}/>
  {screen==='list'&&<div className="panel ds-choice-group" role="group" aria-label="Tipo de localização">{(Object.entries(sections) as [Tab,string][]).map(([id,label])=><button key={id} type="button" className={tab===id?'primary':'secondary'} aria-pressed={tab===id} onClick={()=>{setTab(id);setSelected(null);setSearch('');setStatus('all');setNotice(null);}}>{label}</button>)}</div>}
  {notice&&<Feedback kind={notice.error?'error':'success'}>{notice.text}</Feedback>}
  {error?<Feedback kind="error">Não foi possível carregar as localizações. {errorMessage(error)}</Feedback>:isLoading?<LoadingState>Carregando localizações…</LoadingState>:screen==='detail'?tab==='storage'&&cart?<RecordDetail title={cart.name} actions={<button className="primary" onClick={()=>{setRoom(linkedRoom(cart.id));setScreen('form');setNotice(null);}}>Alterar local de guarda</button>}>
    <DetailFields fields={[{label:'Código do carrinho',value:cart.code},{label:'Local de guarda',value:roomLabel(linkedRoom(cart.id))},{label:'Situação',value:cart.active?'Ativo':'Inativo'}]}/>
    <p className="form-hint">Local cadastral administrativo; não representa rastreamento.</p>
   </RecordDetail>:record?<RecordDetail title={record.name} actions={<button className="primary" onClick={()=>edit(record)}>Editar</button>}>
    <DetailFields fields={[{label:'Tipo',value:sections[tab]},{label:'Hierarquia',value:rowLabel(record)},{label:'Situação',value:record.active?'Ativo':'Inativo'},...('block_id' in record?[{label:'Disponível para novos vínculos',value:allRooms.find(r=>r.id===record.id)?.active?'Sim':'Não'}]:[])]}/>
   </RecordDetail>:<EmptyState>Registro não encontrado. Volte à listagem.</EmptyState>:screen==='form'?<section className="panel records-form-panel"><h2>{tab==='storage'?'Sala de guarda':'Dados do cadastro'}</h2>
   <form className="form-stack" onSubmit={submit}>
    {tab==='storage'?<><p>{cart?.name}</p><label className="field"><span>Sala de guarda</span><select value={room} onChange={e=>setRoom(e.target.value)}><option value="">Não informada</option>{options.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}{room&&!options.some(x=>x.id===room)&&<option value={room} disabled>{roomLabel(room)} (inativo)</option>}</select></label></>:<>
    {tab!=='campuses'&&<label className="field"><span>{tab==='campus_blocks'?'Campus':'Bloco'}</span><select required value={parent} onChange={e=>setParent(e.target.value)}><option value="">Selecione</option>{parents.map(p=><option key={p.id} value={p.id} disabled={!p.active&&p.id!==parent}>{p.name}{'campus_id' in p?' — '+(query.data?.campuses.find(c=>c.id===p.campus_id)?.name??''):''}{!p.active?' (inativo)':''}</option>)}</select></label>}
    <label className="field"><span>Nome</span><input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label className="reservation-check"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Ativo</label>
    <p className="form-hint">Desativar preserva o histórico; salas de uma hierarquia inativa deixam de estar disponíveis para novos vínculos.</p></>}
    <div className="records-form-actions"><button className="primary" disabled={save.isPending||(tab==='storage'?!selected:!name.trim())}>{save.isPending?'Salvando…':tab==='storage'?'Salvar localização':'Salvar'}</button><button type="button" className="ghost" disabled={save.isPending} onClick={cancel}>Cancelar</button></div>
   </form></section>:<section className="panel records-panel"><h2>{tab==='storage'?'Carrinhos e locais de guarda':sections[tab]+' cadastrados'}</h2>
   <div className="record-list-filters"><label className="field"><span>Buscar registro</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome ou localização"/></label><label className="field"><span>Situação</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></label></div>
   {tab==='storage'?<div className="item-list">{(carts.data??[]).filter(c=>matches(c.name+' '+c.code+' '+roomLabel(linkedRoom(c.id)),c.active)).map(c=><article className="item records-item" key={c.id}><div><strong>{c.name}</strong><span>{c.code} · {roomLabel(linkedRoom(c.id))}</span>{!c.active&&<span>Inativo</span>}</div><button className="secondary" onClick={()=>detail(c.id)}>Ver detalhes</button></article>)}{!(carts.data??[]).some(c=>matches(c.name+' '+c.code+' '+roomLabel(linkedRoom(c.id)),c.active))&&<EmptyState>Nenhum carrinho neste recorte.</EmptyState>}</div>:
   <div className="item-list">{rows.filter(r=>matches(rowLabel(r),r.active)).map(r=><article key={r.id} className="item records-item"><div><strong>{r.name}</strong><span>{rowLabel(r)}</span>{!r.active&&<span>Inativo</span>}</div><button type="button" className="secondary" onClick={()=>detail(r.id)}>Ver detalhes</button></article>)}{!rows.some(r=>matches(rowLabel(r),r.active))&&<EmptyState>Nenhum registro neste recorte.</EmptyState>}</div>}
  </section>}
 </div>;
}
