import {useState,type FormEvent} from 'react';
import {useQuery,useQueryClient,useMutation} from '@tanstack/react-query';
import {supabase,type Cart} from '../lib/supabase';
import {useLocations,roomOptions,type Campus,type Block,type Room} from '../lib/locations';
import {fetchCatalogRows} from '../lib/catalog';
import {errorMessage} from '../lib/validation';
import RecordsHeader from '../components/RecordsHeader';
type Kind='campuses'|'campus_blocks'|'campus_rooms';
const labels:Record<Kind,string>={campuses:'Campus',campus_blocks:'Bloco',campus_rooms:'Sala'};
export default function LocationsPage(){
 const query=useLocations(),qc=useQueryClient();
 const carts=useQuery({queryKey:['carts'],queryFn:()=>fetchCatalogRows<Cart>('carts')});
 const storage=useQuery({queryKey:['cart-storage'],queryFn:async()=>{
  const {data,error}=await supabase.from('cart_storage_locations').select('cart_id,room_id');if(error)throw error;
  return (data??[]) as {cart_id:string;room_id:string|null}[];
 }});
 const [tab,setTab]=useState<Kind|'storage'>('campuses');
 const [editing,setEditing]=useState<Campus|Block|Room|null>(null),[form,setForm]=useState(false);
 const [name,setName]=useState(''),[parent,setParent]=useState(''),[active,setActive]=useState(true);
 const [cart,setCart]=useState(''),[room,setRoom]=useState('');
 const [notice,setNotice]=useState<{error:boolean;text:string}|null>(null);
 const options=roomOptions(query.data),allRooms=roomOptions(query.data,false);
 const save=useMutation({mutationFn:async()=>{
  if(tab==='storage'){
   if(!cart)throw new Error('Selecione um carrinho.');
   const {error}=await supabase.from('cart_storage_locations').upsert({cart_id:cart,room_id:room||null});
   if(error)throw error;return;
  }
  if(!name.trim())throw new Error('Informe o nome.');
  const values={name:name.trim(),active,...(tab==='campus_blocks'?{campus_id:parent}:tab==='campus_rooms'?{block_id:parent}:{})};
  if(tab!=='campuses'&&!parent)throw new Error('Selecione o vínculo.');
  const result=editing?await supabase.from(tab).update(values).eq('id',editing.id):await supabase.from(tab).insert(values);
  if(result.error)throw result.error;
 },onSuccess:()=>{void qc.invalidateQueries({queryKey:['locations']});void qc.invalidateQueries({queryKey:['cart-storage']});setForm(false);setNotice({error:false,text:'Localização salva.'});},onError:e=>setNotice({error:true,text:errorMessage(e)})});
 function open(row:Campus|Block|Room|null){
  setEditing(row);setName(row?.name??'');setActive(row?.active??true);setParent(row&&'campus_id' in row?row.campus_id:row&&'block_id' in row?row.block_id:'');setNotice(null);setForm(true);
 }
 function submit(e:FormEvent){e.preventDefault();setNotice(null);if(!save.isPending)save.mutate();}
 const rows=tab==='campuses'?query.data?.campuses??[]:tab==='campus_blocks'?query.data?.blocks??[]:tab==='campus_rooms'?query.data?.rooms??[]:[];
 const parents=tab==='campus_blocks'?query.data?.campuses??[]:query.data?.blocks??[];
 return <div className="records-page">
  <RecordsHeader title="Localizações" description="Organize campus, blocos e salas. O local de guarda do carrinho é independente do destino de cada reserva."
   actionLabel={tab==='storage'?'Atualizar listagem':'Cadastrar '+labels[tab].toLocaleLowerCase('pt-BR')} onAction={()=>tab==='storage'?void storage.refetch():open(null)}/>
  <div className="panel" style={{display:'flex',gap:8,flexWrap:'wrap'}} aria-label="Tipo de localização">
   {([['campuses','Campus'],['campus_blocks','Blocos'],['campus_rooms','Salas'],['storage','Local de guarda']] as const).map(([id,label])=><button key={id} type="button" className={tab===id?'primary':'secondary'} aria-pressed={tab===id} disabled={save.isPending} onClick={()=>{setTab(id);setForm(false);setNotice(null);}}>{label}</button>)}
  </div>
  {notice&&<p className={'notice '+(notice.error?'error':'success')} role={notice.error?'alert':'status'}>{notice.text}</p>}
  {query.error?<p role="alert" className="notice error">Não foi possível carregar as localizações. {errorMessage(query.error)}</p>:query.isLoading?<p role="status">Carregando localizações…</p>:tab==='storage'?<section className="panel records-form-panel">
   <h2>Local de guarda do carrinho</h2>
   <p className="form-hint">Cadastro administrativo. Não informa posição em tempo real e não aparece na consulta pública.</p>
   {storage.error||carts.error?<p role="alert">Não foi possível carregar os carrinhos ou locais.</p>:<form className="form-stack" onSubmit={submit}>
    <label className="field"><span>Carrinho</span><select required value={cart} onChange={e=>{setCart(e.target.value);setRoom(storage.data?.find(x=>x.cart_id===e.target.value)?.room_id??'');}}><option value="">Selecione</option>{(carts.data??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="field"><span>Sala de guarda</span><select value={room} onChange={e=>setRoom(e.target.value)}><option value="">Não informada</option>{options.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}{room&&!options.some(x=>x.id===room)&&<option value={room} disabled>{allRooms.find(r=>r.id===room)?.label??'Local anterior'} (inativo)</option>}</select></label>
    <button className="primary" disabled={save.isPending||storage.isLoading||!cart}>Salvar localização</button>
   </form>}
  </section>:form?<section className="panel records-form-panel"><h2>{editing?'Editar':'Cadastrar'} {labels[tab].toLocaleLowerCase('pt-BR')}</h2><form className="form-stack" onSubmit={submit}>
   {tab!=='campuses'&&<label className="field"><span>{tab==='campus_blocks'?'Campus':'Bloco'}</span><select required value={parent} onChange={e=>setParent(e.target.value)}><option value="">Selecione</option>{parents.map(p=><option key={p.id} value={p.id} disabled={!p.active&&p.id!==parent}>{p.name}{'campus_id' in p?' — '+(query.data?.campuses.find(c=>c.id===p.campus_id)?.name??''):''}{!p.active?' (inativo)':''}</option>)}</select></label>}
   <label className="field"><span>Nome</span><input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
   <label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Ativo</label>
   <p className="form-hint">Desativar preserva o histórico; salas de uma hierarquia inativa deixam de estar disponíveis para novos vínculos.</p>
   <div className="records-form-actions"><button className="primary" disabled={save.isPending}>Salvar</button><button type="button" className="ghost" disabled={save.isPending} onClick={()=>setForm(false)}>Cancelar</button></div>
  </form></section>:<section className="panel records-panel"><h2>{tab==='campuses'?'Campus cadastrados':tab==='campus_blocks'?'Blocos cadastrados':'Salas cadastradas'}</h2>
   {rows.length===0?<p className="empty">Nenhum registro cadastrado.</p>:<div className="item-list">{rows.map(r=><article key={r.id} className="item records-item"><div><strong>{r.name}</strong><span>{'block_id' in r?allRooms.find(x=>x.id===r.id)?.label:'campus_id' in r?query.data?.campuses.find(c=>c.id===r.campus_id)?.name:''}</span>{!r.active&&<span>Inativo</span>}</div><button type="button" className="secondary" onClick={()=>open(r)}>Editar</button></article>)}</div>}
  </section>}
 </div>;
}
