import {useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../../lib/supabase';
import {roomOptions} from '../../lib/locations';
import {todayInSaoPaulo,SHIFTS,shiftLabel,type Shift} from '../../lib/reservations';
import {errorMessage} from '../../lib/validation';
import {getSpatialCatalog,getSpatialSummary,getSpatialDetails,validatePose,placementValues,savePlacement,type Placement} from './spatialData';
import './prototype.css';
const labels={FREE:'Livre',PARTIAL:'Parcial',FULL:'Reservado',MAINTENANCE:'Manutenção',INACTIVE:'Inativo',UNAVAILABLE:'Sem expediente'};
const field=(name:string,label:string,def:string|number='',type='text',required=true)=> <label className="field"><span>{label}</span><input name={name} type={type} defaultValue={def} required={required} {...(type==='number'?{step:'any'}:{})}/></label>;
export default function SpatialEditorPage(){
  const qc=useQueryClient();
  const catalog=useQuery({queryKey:['spatial','catalog'],queryFn:getSpatialCatalog,retry:false});
  const [date,setDate]=useState(todayInSaoPaulo),[shift,setShift]=useState<Shift>('MATUTINO'),[cartId,setCartId]=useState('');
  const [editModel,setEditModel]=useState(''),[editScene,setEditScene]=useState(''),[slotModel,setSlotModel]=useState(''),[modelId,setModelId]=useState(''),[sceneId,setSceneId]=useState('');
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const summary=useQuery({queryKey:['spatial','summary',date,shift],queryFn:()=>getSpatialSummary(date,shift),enabled:!!date,retry:false});
  const detail=useQuery({queryKey:['spatial','detail',cartId,date,shift],queryFn:()=>getSpatialDetails(cartId,date,shift),enabled:!!cartId&&!!date,retry:false});
  const data=catalog.data;
  const placement=data?.placements.find(p=>p.cart_id===cartId);
  const chosenModel=data?.models.find(m=>m.id===editModel),chosenScene=data?.scenes.find(s=>s.id===editScene);
  const rooms=roomOptions(data?.locations);
  function selectCart(id:string){const p=data?.placements.find(p=>p.cart_id===id);setCartId(id);setModelId(p?.model_id??'');setSceneId(p?.scene_id??'');}
  async function act(work:()=>Promise<void>,success:string){
    if(busy)return;setBusy(true);setMessage('');setError('');
    try{await work();await qc.invalidateQueries({queryKey:['spatial']});setMessage(success);}
    catch(e){setError(e&&typeof e==='object'&&'code' in e&&e.code==='P0001'&&'message' in e?String(e.message):errorMessage(e));}finally{setBusy(false);}
  }
  function submit(e:FormEvent<HTMLFormElement>,work:(f:FormData)=>Promise<void>,success:string){e.preventDefault();const f=new FormData(e.currentTarget);void act(()=>work(f),success);}
  const str=(f:FormData,k:string)=>String(f.get(k)??'').trim();
  async function saveModel(f:FormData){
    const record={name:str(f,'name'),kind:str(f,'kind'),author:str(f,'author'),license:str(f,'license'),version:Number(f.get('version')),width_m:Number(f.get('width')),depth_m:Number(f.get('depth')),scale:Number(f.get('scale')),storage_path:str(f,'path')||null,checksum:str(f,'checksum')||null,active:f.get('active')==='on'};
    const {error}=await (editModel?supabase.from('asset_models').update(record).eq('id',editModel):supabase.from('asset_models').insert(record));if(error)throw error;
  }
  async function saveScene(f:FormData){
    const record={name:str(f,'name'),room_id:str(f,'room'),model_id:str(f,'model')||null,width_m:Number(f.get('width')),depth_m:Number(f.get('depth')),height_m:Number(f.get('height')),revision:Number(f.get('revision')),active:f.get('active')==='on'};
    const {error}=await (editScene?supabase.from('spatial_scenes').update(record).eq('id',editScene):supabase.from('spatial_scenes').insert(record));if(error)throw error;
  }
  async function savePose(f:FormData,existing?:Placement){
    const values=placementValues(cartId,modelId,sceneId,str(f,'x'),str(f,'z'),str(f,'yaw'),existing?.version);
    if(sceneId){const scene=data?.scenes.find(s=>s.id===sceneId),model=data?.models.find(m=>m.id===modelId);
      if(!scene||!model)throw Error('Selecione cena e modelo.');const invalid=validatePose(scene,model,values.position_x!,values.position_z!,values.yaw!);if(invalid)throw Error(invalid);}
    await savePlacement(values,existing);
  }
  async function createSlot(f:FormData){
    const record={model_id:slotModel,slot_key:str(f,'key'),position_x:Number(f.get('x')),position_y:Number(f.get('y')),position_z:Number(f.get('z')),description:str(f,'description')||null};
    const {error}=await supabase.from('cart_model_slots').insert(record);if(error)throw error;
  }
  async function linkSlot(f:FormData){
    if(!placement?.model_id||!cartId)throw Error('Salve o modelo do carrinho primeiro.');
    const {error}=await supabase.from('notebook_slot_links').insert({cart_id:cartId,model_id:placement.model_id,slot_key:str(f,'slot'),notebook_id:str(f,'notebook')});if(error)throw error;
  }
  return <div className="dt-page">
    <header className="page-header"><h1>Configuração espacial · F5.1</h1><p>Cadastre modelos, ambientes e posições registradas, sem alterar reservas.</p></header>
    <p className="notice warning">Ferramenta administrativa de desenvolvimento. Posições representam o cadastro, não rastreamento físico. Utilize somente referências autorizadas.</p>
    {error&&<p role="alert" className="notice error">{error}</p>}{message&&<p role="status" className="notice success">{message}</p>}
    {catalog.isPending?<p role="status">Carregando catálogos espaciais…</p>:catalog.isError?<div className="panel"><p role="alert">Não foi possível carregar o catálogo espacial. Verifique a migration F5.1.</p><button className="secondary" onClick={()=>void catalog.refetch()}>Tentar novamente</button></div>:data&&<>
      <section className="panel"><h2>Modelos tridimensionais</h2>
        <label className="field"><span>Modelo para editar</span><select value={editModel} onChange={e=>setEditModel(e.target.value)}><option value="">Novo modelo</option>{data.models.map(m=><option key={m.id} value={m.id}>{m.name} · v{m.version}</option>)}</select></label>
        <form key={editModel} className="dt-editor-form" onSubmit={e=>submit(e,saveModel,'Modelo salvo.')}>
          <fieldset disabled={busy} className="dt-editor-fields">
          {field('name','Nome do modelo',chosenModel?.name)}<label className="field"><span>Tipo</span><select name="kind" defaultValue={chosenModel?.kind??'CART'}><option value="CART">Carrinho</option><option value="ROOM">Sala</option></select></label>
          {field('version','Versão',chosenModel?.version??1,'number')}{field('width','Largura (m)',chosenModel?.width_m??1,'number')}{field('depth','Profundidade (m)',chosenModel?.depth_m??1,'number')}{field('scale','Escala',chosenModel?.scale??1,'number')}{field('author','Autoria',chosenModel?.author)}{field('license','Licença',chosenModel?.license)}{field('path','Caminho GLB privado (opcional)',chosenModel?.storage_path??'','text',false)}{field('checksum','SHA-256 (opcional)',chosenModel?.checksum??'','text',false)}
          <label className="dt-toggle"><input name="active" type="checkbox" defaultChecked={chosenModel?.active??true}/> Ativo</label><button className="primary" type="submit">Salvar modelo</button></fieldset>
        </form><p className="form-hint">Modelos em uso são imutáveis: cadastre nova versão. Upload/renderização de GLB serão tratados na F5.3.</p>
      </section>
      <section className="panel"><h2>Ambientes</h2>
        <label className="field"><span>Ambiente para editar</span><select value={editScene} onChange={e=>setEditScene(e.target.value)}><option value="">Novo ambiente</option>{data.scenes.map(s=><option key={s.id} value={s.id}>{s.name} · v{s.revision}</option>)}</select></label>
        <form key={editScene} className="dt-editor-form" onSubmit={e=>submit(e,saveScene,'Ambiente salvo.')}><fieldset disabled={busy} className="dt-editor-fields">
          {field('name','Nome do ambiente',chosenScene?.name)}<label className="field"><span>Sala de referência</span><select name="room" required defaultValue={chosenScene?.room_id??''}><option value="">Selecione</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
          <label className="field"><span>Modelo da sala</span><select name="model" defaultValue={chosenScene?.model_id??''}><option value="">Sem modelo</option>{data.models.filter(m=>m.active&&m.kind==='ROOM').map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          {field('width','Largura (m)',chosenScene?.width_m??10,'number')}{field('depth','Profundidade (m)',chosenScene?.depth_m??8,'number')}{field('height','Altura (m)',chosenScene?.height_m??3,'number')}{field('revision','Revisão',chosenScene?.revision??1,'number')}
          <label className="dt-toggle"><input name="active" type="checkbox" defaultChecked={chosenScene?.active??true}/> Ativo</label><button className="primary" type="submit">Salvar ambiente</button></fieldset></form>
      </section>
      <section className="panel"><h2>Posicionamento dos carrinhos</h2>
        <label className="field"><span>Carrinho para configurar</span><select value={cartId} onChange={e=>selectCart(e.target.value)}><option value="">Selecione</option>{data.carts.map(c=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></label>
        {cartId&&<form key={cartId+':'+(placement?.version??0)} className="dt-editor-form" onSubmit={e=>submit(e,f=>savePose(f,placement),'Posicionamento salvo.')}><fieldset disabled={busy} className="dt-editor-fields">
          <label className="field"><span>Modelo do carrinho</span><select value={modelId} onChange={e=>setModelId(e.target.value)}><option value="">Sem modelo</option>{data.models.filter(m=>m.kind==='CART'&&m.active).map(m=><option key={m.id} value={m.id}>{m.name} · v{m.version}</option>)}</select></label>
          <label className="field"><span>Ambiente</span><select value={sceneId} onChange={e=>setSceneId(e.target.value)}><option value="">Sem localização definida</option>{data.scenes.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          {sceneId&&<>{field('x','X (m)',placement?.position_x??0,'number')}{field('z','Z (m)',placement?.position_z??0,'number')}{field('yaw','Rotação (graus)',placement?.yaw??0,'number')}</>}
          <button className="primary" type="submit">Salvar posicionamento</button></fieldset></form>}
        <p className="form-hint">Origem no centro da sala; Y=0 no piso. Limites e colisões são validados no banco. Guarda e destino não são alterados.</p>
      </section>
      <section className="panel"><h2>Compartimentos e identificação física</h2>
        <label className="field"><span>Modelo para cadastrar slot</span><select value={slotModel} onChange={e=>setSlotModel(e.target.value)}><option value="">Selecione</option>{data.models.filter(m=>m.kind==='CART'&&m.active).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        {slotModel&&<form className="dt-editor-form" onSubmit={e=>submit(e,createSlot,'Compartimento cadastrado.')}><fieldset disabled={busy} className="dt-editor-fields">
          {field('key','Chave do compartimento')}{field('x','X (m)',0,'number')}{field('y','Y (m)',0,'number')}{field('z','Z (m)',0,'number')}{field('description','Descrição','','text',false)}<button className="primary" type="submit">Cadastrar compartimento</button></fieldset></form>}
        {cartId&&placement?.model_id&&<><form key={cartId+':'+placement.model_id} className="dt-editor-form" onSubmit={e=>submit(e,linkSlot,'Vínculo físico confirmado.')}><fieldset disabled={busy} className="dt-editor-fields">
          <label className="field"><span>Compartimento confirmado</span><select name="slot" required><option value="">Selecione</option>{data.slots.filter(s=>s.model_id===placement.model_id&&!data.links.some(l=>l.cart_id===cartId&&l.slot_key===s.slot_key)).map(s=><option key={s.slot_key} value={s.slot_key}>{s.slot_key}</option>)}</select></label>
          <label className="field"><span>Notebook do carrinho</span><select name="notebook" required><option value="">Selecione</option>{data.notebooks.filter(n=>n.active&&n.cart_id===cartId&&!data.links.some(l=>l.notebook_id===n.id)).map(n=><option key={n.id} value={n.id}>{n.code}</option>)}</select></label>
          <button className="primary" type="submit">Confirmar vínculo físico</button></fieldset></form>
          <div className="dt-list">{data.links.filter(l=>l.cart_id===cartId).map(l=><div className="dt-cart" key={l.slot_key}><strong>{l.slot_key} — {data.notebooks.find(n=>n.id===l.notebook_id)?.code??'Notebook cadastrado'}</strong><button disabled={busy} className="secondary" onClick={()=>void act(async()=>{const {error}=await supabase.from('notebook_slot_links').delete().eq('cart_id',cartId).eq('slot_key',l.slot_key);if(error)throw error;},'Vínculo removido.')}>Desvincular {l.slot_key}</button></div>)}</div></>}
        <p className="form-hint">Confirme somente posições verificadas fisicamente. Sem vínculo, não será atribuído um código à geometria.</p>
      </section>
    </>}
    <section className="panel"><h2>Prévia de disponibilidade real (somente leitura)</h2><div className="dt-editor-fields">
      <label className="field"><span>Data da consulta</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
      <label className="field"><span>Turno</span><select value={shift} onChange={e=>setShift(e.target.value as Shift)}>{SHIFTS.map(s=><option key={s} value={s}>{shiftLabel[s]}</option>)}</select></label></div>
      {!date?<p className="empty">Selecione uma data.</p>:summary.isFetching?<p role="status">Consultando…</p>:summary.isError?<p role="alert" className="notice error">Não foi possível confirmar a disponibilidade.</p>:<div className="dt-list">{summary.data?.map(s=><button className="dt-cart" key={s.cart_id} aria-pressed={cartId===s.cart_id} onClick={()=>selectCart(s.cart_id)}><strong>{s.code} — {s.name}</strong><span>{labels[s.availability_status]} · {s.available}/{s.nominal_capacity} disponíveis</span><small>{s.scene_id?'Ambiente cadastrado':'Sem localização definida'}</small></button>)}</div>}
      {cartId&&date&&(detail.isFetching?<p role="status">Carregando detalhes…</p>:detail.isError?<p className="notice error" role="alert">Detalhes indisponíveis.</p>:detail.data&&<div className="dt-editor-form"><h3>{detail.data.summary.name}</h3><p>{detail.data.reservations.length} reservas confirmadas · {detail.data.confirmed_slots.length} vínculos físicos ativos</p>{detail.data.reservations.map(r=><p key={r.period_id}>{r.requester} · {r.quantity} notebooks · {r.destination_label??'Destino não informado'}</p>)}</div>)}
    </section>
  </div>;
}
