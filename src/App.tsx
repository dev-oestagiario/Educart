import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Boxes, ClipboardList, Laptop, LogOut, ShieldCheck, UserRound, UserRoundPlus } from 'lucide-react';
import { create } from 'zustand';
import { supabase, isConfigured, type Cart, type Requester, type Notebook } from './lib/supabase';
import { cartSchema, errorMessage, notebookSchema, requesterSchema, validateCodes } from './lib/validation';
import { configuredCapacity } from './lib/capacity';

type Page = 'overview' | 'carts' | 'requesters' | 'notebooks';
const useUi = create<{page:Page; setPage:(page:Page)=>void; cartId:string; setCartId:(id:string)=>void}>()(
  set => ({page:'overview',setPage:page=>set({page}),cartId:'',setCartId:cartId=>set({cartId})})
);

async function fetchRows<T>(table: 'carts'|'requesters'|'notebook_codes'): Promise<T[]> {
  const {data,error} = await supabase.from(table).select('*').order('created_at',{ascending:false});
  if (error) throw error;
  return (data ?? []) as T[];
}
function Notice({message,kind='error'}:{message:string;kind?:'error'|'success'}) {
  return <p role={kind==='error'?'alert':'status'} className={'notice '+kind}>{message}</p>;
}
function PageHeader({title,description}:{title:string;description:string}) {
  return <div className="page-header"><h1>{title}</h1><p>{description}</p></div>;
}
function TextInput({label,id,value,onChange,required=false,type='text',min}:{label:string;id:string;value:string;onChange:(v:string)=>void;required?:boolean;type?:string;min?:number}) {
  return <label className="field" htmlFor={id}><span>{label}</span>
    <input id={id} value={value} onChange={e=>onChange(e.target.value)} required={required} type={type} min={min} />
  </label>;
}
function Login({onLogin}:{onLogin:()=>void}) {
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent) {
    e.preventDefault();setError('');setBusy(true);
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error)setError('Não foi possível entrar. Confira as credenciais e tente novamente.');
    else onLogin();
    setBusy(false);
  }
  return <div className="auth-shell"><section className="auth-panel">
    <div className="brand"><span className="brand-mark"><Laptop size={22}/></span><span>educart</span></div>
    <div className="auth-intro"><span className="eyebrow">ÁREA RESTRITA • TI</span><h1>Acesso administrativo</h1><p>Entre com a conta autorizada para gerenciar os laboratórios móveis.</p></div>
    <form onSubmit={submit} className="form-stack">
      <TextInput id="email" label="E-mail" type="email" value={email} onChange={setEmail} required/>
      <TextInput id="password" label="Senha" type="password" value={password} onChange={setPassword} required/>
      {error&&<Notice message={error}/>}
      <button className="primary" disabled={busy} type="submit">{busy?'Entrando…':'Entrar no Educart'}</button>
    </form><p className="auth-footer"><ShieldCheck size={16}/> Somente administradores cadastrados pela TI.</p>
  </section></div>;
}
function Overview() {
  const carts=useQuery({queryKey:['carts'],queryFn:()=>fetchRows<Cart>('carts')});
  const requesters=useQuery({queryKey:['requesters'],queryFn:()=>fetchRows<Requester>('requesters')});
  const notebooks=useQuery({queryKey:['notebooks'],queryFn:()=>fetchRows<Notebook>('notebook_codes')});
  const totalCapacity=(carts.data??[]).filter(x=>x.active).reduce((n,c)=>n+configuredCapacity(c.capacity,0),0);
  const {setPage}=useUi();
  return <><PageHeader title="Visão geral" description="Uma visão rápida dos laboratórios e cadastros da instituição."/>
    <div className="stats">
      <div className="stat"><span className="stat-icon"><Boxes/></span><span className="stat-label">Carrinhos cadastrados</span><strong>{carts.data?.length??'—'}</strong></div>
      <div className="stat"><span className="stat-icon"><Laptop/></span><span className="stat-label">Capacidade cadastrada</span><strong>{carts.isLoading?'—':totalCapacity}</strong></div>
      <div className="stat"><span className="stat-icon"><UserRound/></span><span className="stat-label">Professores</span><strong>{requesters.data?.length??'—'}</strong></div>
      <div className="stat"><span className="stat-icon"><ClipboardList/></span><span className="stat-label">Notebooks identificados</span><strong>{notebooks.data?.length??'—'}</strong></div>
    </div>
    {(carts.error||requesters.error||notebooks.error)&&<Notice message="Não foi possível carregar alguns indicadores. Confira a conexão."/>}
    <div className="panel welcome-panel"><div><span className="eyebrow">FASE 1 • CADASTROS</span><h2>Organize os equipamentos</h2><p>Cadastre os carrinhos, professores e códigos de notebooks. A contagem de códigos não altera a capacidade configurada do carrinho.</p></div><button className="secondary" onClick={()=>setPage('carts')}>Gerenciar carrinhos</button></div>
    <div className="panel muted-panel"><BookOpen size={19}/><p>O agendamento e a disponibilidade por turno serão ativados na fase de reservas. Ainda não é possível criar reservas nesta tela.</p></div>
  </>;
}
function CartsPage() {
  const qc=useQueryClient();const q=useQuery({queryKey:['carts'],queryFn:()=>fetchRows<Cart>('carts')});
  const [editing,setEditing]=useState<string|null>(null),[code,setCode]=useState(''),[name,setName]=useState(''),[capacity,setCapacity]=useState('30'),[notice,setNotice]=useState('');
  const mutation=useMutation({mutationFn:async (values:{code:string;name:string;capacity:number})=>{
    const query=editing?supabase.from('carts').update(values).eq('id',editing):supabase.from('carts').insert(values);
    const {error}=await query;if(error)throw error;
  },onSuccess:()=>{qc.invalidateQueries({queryKey:['carts']});setEditing(null);setCode('');setName('');setCapacity('30');setNotice('Carrinho salvo.');}});
  function save(e:FormEvent){e.preventDefault();setNotice('');const p=cartSchema.safeParse({code,name,capacity});if(!p.success){setNotice(p.error.issues[0].message);return}mutation.mutate(p.data,{onError:err=>setNotice(errorMessage(err))});}
  return <><PageHeader title="Carrinhos" description="A capacidade configurada é a referência para as futuras reservas."/>
    <div className="split"><section className="panel">
      <h2>{editing?'Editar carrinho':'Novo carrinho'}</h2>
      <form onSubmit={save} className="form-stack">
        <TextInput id="cart-code" label="Código do carrinho" value={code} onChange={setCode} required/>
        <TextInput id="cart-name" label="Nome do laboratório móvel" value={name} onChange={setName} required/>
        <TextInput id="cart-capacity" label="Capacidade de notebooks" type="number" min={1} value={capacity} onChange={setCapacity} required/>
        {notice&&<Notice kind={notice.endsWith('salvo.')?'success':'error'} message={notice}/>}
        <div className="actions"><button type="submit" className="primary" disabled={mutation.isPending}>{mutation.isPending?'Salvando…':editing?'Salvar alterações':'Cadastrar carrinho'}</button>{editing&&<button className="ghost" type="button" onClick={()=>{setEditing(null);setCode('');setName('');setCapacity('30')}}>Cancelar edição</button>}</div>
      </form></section>
      <section className="panel"><h2>Carrinhos cadastrados</h2>
        {q.isLoading?<p>Carregando…</p>:q.error?<Notice message={errorMessage(q.error)}/>:!q.data?.length?<p className="empty">Nenhum carrinho cadastrado ainda.</p>:
        <div className="item-list">{q.data.map(item=><div className="item" key={item.id}><div><strong>{item.name}</strong><span>{item.code} · {item.capacity} notebooks de capacidade</span></div><button className="text-button" onClick={()=>{setEditing(item.id);setName(item.name);setCode(item.code);setCapacity(String(item.capacity));setNotice('')}}>Editar</button></div>)}</div>}
      </section></div></>;
}
function RequestersPage() {
  const qc=useQueryClient(),q=useQuery({queryKey:['requesters'],queryFn:()=>fetchRows<Requester>('requesters')});
  const [editing,setEditing]=useState<string|null>(null),[name,setName]=useState(''),[code,setCode]=useState(''),[notice,setNotice]=useState('');
  const mutation=useMutation({mutationFn:async (values:{name:string;reference_code:string|null})=>{
    const req=editing?supabase.from('requesters').update(values).eq('id',editing):supabase.from('requesters').insert(values);
    const {error}=await req;if(error)throw error;
  },onSuccess:()=>{qc.invalidateQueries({queryKey:['requesters']});setEditing(null);setName('');setCode('');setNotice('Professor salvo.')}});
  function save(e:FormEvent){e.preventDefault();setNotice('');const p=requesterSchema.safeParse({name,reference_code:code});if(!p.success){setNotice(p.error.issues[0].message);return}mutation.mutate({name:p.data.name,reference_code:p.data.reference_code||null},{onError:err=>setNotice(errorMessage(err))});}
  return <><PageHeader title="Professores" description="Cadastre os responsáveis que poderão solicitar equipamentos."/>
    <div className="split"><section className="panel"><h2>{editing?'Editar professor':'Novo professor'}</h2><form className="form-stack" onSubmit={save}>
      <TextInput id="teacher-name" label="Nome completo" required value={name} onChange={setName}/>
      <TextInput id="teacher-code" label="Identificador interno (opcional)" value={code} onChange={setCode}/>
      {notice&&<Notice kind={notice.endsWith('salvo.')?'success':'error'} message={notice}/>}
      <div className="actions"><button className="primary" disabled={mutation.isPending}>{mutation.isPending?'Salvando…':'Salvar professor'}</button>{editing&&<button className="ghost" type="button" onClick={()=>{setEditing(null);setName('');setCode('');setNotice('')}}>Cancelar edição</button>}</div>
    </form></section><section className="panel"><h2>Professores cadastrados</h2>
      {q.isLoading?<p>Carregando…</p>:q.error?<Notice message={errorMessage(q.error)}/>:!q.data?.length?<p className="empty">Nenhum professor cadastrado ainda.</p>:
      <div className="item-list">{q.data.map(p=><div className="item" key={p.id}><div><strong>{p.name}</strong><span>{p.reference_code||'Sem identificador interno'}</span></div><button className="text-button" onClick={()=>{setEditing(p.id);setName(p.name);setCode(p.reference_code||'');setNotice('')}}>Editar</button></div>)}</div>}
    </section></div></>;
}
function parseCsvCodes(text:string):string[] {
  const rows=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
  const first=rows[0]?.trim().toLocaleLowerCase('pt-BR');
  const source=(first==='codigo'||first==='código'||first==='code')?rows.slice(1):rows;
  return source.map(row=>row.split(/[;,]/)[0].trim().replace(/^"|"$/g,''));
}
function NotebooksPage() {
  const qc=useQueryClient();const carts=useQuery({queryKey:['carts'],queryFn:()=>fetchRows<Cart>('carts')});
  const {cartId,setCartId}=useUi();const notebooks=useQuery({queryKey:['notebooks'],queryFn:()=>fetchRows<Notebook>('notebook_codes')});
  const [codes,setCodes]=useState(''),[notice,setNotice]=useState(''),[generateCount,setGenerateCount]=useState('5');
  const currentCart=carts.data?.find(c=>c.id===cartId);const existing=notebooks.data?.filter(n=>n.cart_id===cartId&&n.active)||[];
  const mutation=useMutation({mutationFn:async (values:string[])=>{
    const {error}=await supabase.from('notebook_codes').insert(values.map(code=>({code,cart_id:cartId})));
    if(error)throw error;
  },onSuccess:()=>{qc.invalidateQueries({queryKey:['notebooks']});setCodes('');setNotice('Códigos cadastrados.')}});
  function generate(){
    setNotice('');const n=Number(generateCount);
    if(!Number.isInteger(n)||n<1||n>200){setNotice('Informe uma quantidade de 1 a 200.');return;}
    const taken=new Set([...(notebooks.data??[]).map(n=>n.code.toLowerCase()),...codes.split(/\r?\n/).map(x=>x.toLowerCase())]);
    const result:string[]=[];
    while(result.length<n){const code='EDU-'+crypto.randomUUID().slice(0,8).toUpperCase();if(!taken.has(code.toLowerCase())){taken.add(code.toLowerCase());result.push(code)}}
    setCodes(old=>[old.trim(),...result].filter(Boolean).join('\n'));
  }
  function save(e:FormEvent){e.preventDefault();setNotice('');if(!cartId){setNotice('Escolha um carrinho.');return;}
    try{const values=validateCodes(codes);for(const code of values)notebookSchema.parse({code});
      if(existing.length+values.length>(currentCart?.capacity??0)){setNotice('A quantidade de códigos ultrapassaria a capacidade do carrinho.');return;}
      mutation.mutate(values,{onError:err=>setNotice(errorMessage(err))});
    }catch(err){setNotice(errorMessage(err));}
  }
  async function upload(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;
    if(!file.name.toLowerCase().endsWith('.csv')){setNotice('Escolha um arquivo CSV.');e.target.value='';return;}
    try{const parsed=parseCsvCodes(await file.text());setCodes(parsed.join('\n'));setNotice('Revise os códigos importados antes de cadastrar.');}
    catch{setNotice('Não foi possível ler o arquivo CSV.');}e.target.value='';
  }
  return <><PageHeader title="Notebooks" description="Identifique os equipamentos por código, sem alterar a capacidade informada do carrinho."/>
    <div className="panel"><label className="field" htmlFor="cart-selector"><span>Laboratório móvel</span><select id="cart-selector" value={cartId} onChange={e=>{setCartId(e.target.value);setNotice('');setCodes('')}}><option value="">Selecione um carrinho</option>{(carts.data??[]).map(c=><option value={c.id} key={c.id}>{c.name} ({c.code})</option>)}</select></label>
      {currentCart&&<div className="capacity-line"><span>Capacidade configurada: <strong>{currentCart.capacity}</strong></span><span>Códigos ativos: <strong>{existing.length}</strong></span><span>Sem código informado: <strong>{Math.max(0,currentCart.capacity-existing.length)}</strong></span></div>}
    </div>
    {cartId&&<div className="split"><section className="panel"><h2>Cadastrar códigos</h2>
      <form onSubmit={save} className="form-stack">
        <label className="field" htmlFor="codes"><span>Códigos (um por linha)</span><textarea id="codes" rows={7} value={codes} onChange={e=>setCodes(e.target.value)} placeholder="NT-001&#10;NT-002"/></label>
        <div className="actions"><label className="field compact" htmlFor="generate-count"><span>Gerar quantidade</span><input id="generate-count" type="number" min={1} max={200} value={generateCount} onChange={e=>setGenerateCount(e.target.value)}/></label><button className="secondary" type="button" onClick={generate}>Gerar códigos</button></div>
        <label className="file-label" htmlFor="csv-import">Importar CSV com coluna <code>codigo</code> <input id="csv-import" accept=".csv,text/csv" type="file" onChange={upload}/></label>
        {notice&&<Notice kind={notice==='Códigos cadastrados.'||notice.startsWith('Revise')?'success':'error'} message={notice}/>}
        <button className="primary" disabled={mutation.isPending}>{mutation.isPending?'Salvando…':'Salvar códigos revisados'}</button>
      </form></section><section className="panel"><h2>Identificadores deste carrinho</h2>
        {notebooks.isLoading?<p>Carregando…</p>:notebooks.error?<Notice message={errorMessage(notebooks.error)}/>:existing.length===0?<p className="empty">Nenhum identificador registrado. A capacidade continua sendo {currentCart?.capacity??0}.</p>:
        <div className="code-grid">{existing.map(n=><span className="code-pill" key={n.id}>{n.code}</span>)}</div>}
      </section></div>}
  </>;
}
export default function App() {
  const qc=useQueryClient();const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true);
  const {page,setPage}=useUi();
  useEffect(()=>{
    let current=true;
    supabase.auth.getSession().then(({data})=>{if(current){setSession(data.session);setLoading(false)}});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{setSession(session);if(!session)qc.clear();});
    return ()=>{current=false;subscription.unsubscribe()};
  },[qc]);
  const check=useQuery({queryKey:['admin',session?.user.id],enabled:Boolean(session),queryFn:async()=>{
    const {data,error}=await supabase.from('admin_users').select('user_id,display_name').eq('user_id',session!.user.id).maybeSingle();
    if(error)throw error;return data;
  }});
  if(!isConfigured)return <div className="setup"><h1>Educart ainda não está configurado</h1><p>Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env antes de iniciar a aplicação. Nunca exponha uma chave secreta.</p></div>;
  if(loading)return <div className="center-status" role="status">Carregando Educart…</div>;
  if(!session)return <Login onLogin={()=>setPage('overview')}/>;
  if(check.isLoading)return <div className="center-status" role="status">Validando acesso administrativo…</div>;
  if(check.error)return <div className="setup"><h1>Não foi possível validar o acesso</h1><p>{errorMessage(check.error)}</p><button className="secondary" onClick={()=>qc.invalidateQueries({queryKey:['admin']})}>Tentar novamente</button></div>;
  if(!check.data)return <div className="setup"><ShieldCheck size={34}/><h1>Acesso não autorizado</h1><p>Esta conta não está habilitada como administradora da TI. Solicite autorização à equipe responsável.</p><button className="secondary" onClick={()=>supabase.auth.signOut()}>Sair desta conta</button></div>;
  const nav:[Page,string,typeof Boxes][]=[['overview','Visão geral',ClipboardList],['carts','Carrinhos',Boxes],['requesters','Professores',UserRoundPlus],['notebooks','Notebooks',Laptop]];
  return <div className="app-shell"><aside className="sidebar">
    <div className="brand"><span className="brand-mark"><Laptop size={22}/></span><span>educart</span></div>
    <p className="sidebar-label">GERENCIAMENTO</p>
    <nav aria-label="Menu principal" className="nav">{nav.map(([id,label,Icon])=><button key={id} aria-current={page===id?'page':undefined} className={'nav-item '+(page===id?'selected':'')} onClick={()=>setPage(id)}><Icon size={19}/>{label}</button>)}</nav>
    <div className="side-bottom"><div className="account"><span className="avatar"><UserRound size={18}/></span><span><strong>{check.data.display_name}</strong><small>Administrador da TI</small></span></div><button className="nav-item" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/> Sair</button></div>
  </aside>
    <main className="main"><header className="topbar"><span>Gestão dos laboratórios móveis</span><span className="phase-tag">Fase 1 • Cadastros</span></header><div className="content">
      {page==='overview'?<Overview/>:page==='carts'?<CartsPage/>:page==='requesters'?<RequestersPage/>:<NotebooksPage/>}
    </div></main>
  </div>;
}
