import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, BookOpen, Boxes, CalendarDays, ClipboardList, Laptop, LogOut, ClipboardCheck, Bell, Menu, ShieldCheck, UserRound, UserRoundPlus, X } from 'lucide-react';
import { create } from 'zustand';
import { supabase, isConfigured, type Cart, type Requester, type Notebook } from './lib/supabase';
import {errorMessage} from './lib/validation';
import { configuredCapacity } from './lib/capacity';
import NotificationBell from './components/NotificationBell';
import BrandLogo from './components/BrandLogo';

const CartsPage = lazy(()=>import('./pages/CartsPage'));
const RequestersPage = lazy(()=>import('./pages/RequestersPage'));
const NotebooksPage = lazy(()=>import('./pages/NotebooksPage'));
const ReservationsPage = lazy(()=>import('./pages/ReservationsPage'));
const CalendarReportsPage = lazy(()=>import('./pages/CalendarReportsPage'));
const Visual3DPage = lazy(()=>import('./pages/Visual3DPage'));
const PublicCartAvailabilityPage = lazy(()=>import('./pages/PublicCartAvailabilityPage'));
const TeacherPortal = lazy(()=>import('./pages/TeacherPortal'));
const TeacherApprovalsPage = lazy(()=>import('./pages/TeacherApprovalsPage'));
const NotificationsPage = lazy(()=>import('./pages/NotificationsPage'));

type Page = 'overview' | 'carts' | 'requesters' | 'notebooks' | 'reservations' | 'calendar' | 'visual3d' | 'approvals' | 'notifications';
const useUi = create<{page:Page; setPage:(page:Page)=>void}>()(
  set => ({page:'overview',setPage:page=>set({page})})
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
  const [mode,setMode]=useState<'login'|'signup'>('login');
  const [error,setError]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent) {
    e.preventDefault();setError('');setMessage('');setBusy(true);
    try {
      if(mode==='signup') {
        const {error}=await supabase.auth.signUp({
          email:email.trim(), password,
          options:{emailRedirectTo:new URL(import.meta.env.BASE_URL,window.location.href).toString()}
        });
        if(error)throw error;
        setMessage('Cadastro solicitado. Se a confirmação por e-mail estiver ativada, abra a mensagem recebida e confirme seu endereço. O acesso de professor ou administrador será autorizado separadamente pela TI.');
        setMode('login');setPassword('');
      } else {
        const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(error)throw error;
        onLogin();
      }
    } catch {
      setError(mode==='signup'
        ? 'Não foi possível criar a conta. Confira o e-mail e a senha ou tente novamente.'
        : 'Não foi possível entrar. Confira as credenciais e tente novamente.');
    } finally {setBusy(false)}
  }
  return <div className="auth-shell"><section className="auth-panel">
    <BrandLogo tone="light"/>
    <div className="auth-intro"><span className="eyebrow">PLATAFORMA EDUCACIONAL</span>
      <h1>{mode==='signup'?'Criar conta no Educart':'Acesso ao Educart'}</h1>
      <p>{mode==='signup'?'Cadastre seu e-mail. A TI autoriza o acesso de professor ou administrador depois da confirmação da conta.':'Entre com sua conta para acessar o painel da TI ou o portal do professor.'}</p></div>
    <form onSubmit={submit} className="form-stack">
      <TextInput id="email" label="E-mail" type="email" value={email} onChange={setEmail} required/>
      <TextInput id="password" label="Senha" type="password" value={password} onChange={setPassword} required/>
      {mode==='signup'&&<p className="form-hint">Use uma senha exclusiva. Depois do cadastro, confirme seu e-mail se receber uma mensagem do Supabase.</p>}
      {error&&<Notice message={error}/>}
      {message&&<Notice kind="success" message={message}/>}
      <button className="primary" disabled={busy} type="submit">{busy?'Aguarde…':mode==='signup'?'Criar minha conta':'Entrar no Educart'}</button>
    </form>
    <button type="button" className="auth-switch" onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');setMessage('');setPassword('')}}>
      {mode==='login'?'Ainda não tem conta? Criar conta':'Já tem conta? Fazer login'}
    </button>
    <a className="auth-switch" href="#/consulta-publica">Consultar disponibilidade sem login</a>
    <p className="auth-footer"><ShieldCheck size={16}/> Criar conta não concede acesso automático ao sistema.</p>
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
    <div className="panel welcome-panel"><div><span className="eyebrow">GESTÃO DE EQUIPAMENTOS</span><h2>Organize os equipamentos</h2><p>Cadastre os carrinhos, professores e códigos de notebooks. A contagem de códigos não altera a capacidade configurada do carrinho.</p></div><button className="secondary" onClick={()=>setPage('carts')}>Gerenciar carrinhos</button></div>
    <div className="panel muted-panel"><BookOpen size={19}/><p>Agora você já pode reservar carrinhos completos ou quantidades parciais por turno na área Reservas.</p></div>
  </>;
}
export default function App() {
  const qc=useQueryClient();const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true);
  const {page,setPage}=useUi();
  const [menuOpen,setMenuOpen]=useState(false);
  const [isPublicView,setIsPublicView]=useState(()=>window.location.hash==='#/consulta-publica');
  useEffect(()=>{
    const update=()=>setIsPublicView(window.location.hash==='#/consulta-publica');
    window.addEventListener('hashchange',update);
    return ()=>window.removeEventListener('hashchange',update);
  },[]);
  const menuButtonRef=useRef<HTMLButtonElement>(null);
  const closeButtonRef=useRef<HTMLButtonElement>(null);
  const sidebarRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    let current=true;
    supabase.auth.getSession().then(({data})=>{if(current){setSession(data.session);setLoading(false)}});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{setSession(session);if(!session){qc.clear();setMenuOpen(false)};});
    return ()=>{current=false;subscription.unsubscribe()};
  },[qc]);
  useEffect(()=>{
    if(!menuOpen)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    // A gaveta inicia oculta por CSS. Aguarde a próxima atualização de layout
    // antes de mover o foco para um botão que estava invisível.
    const focusFrame=window.requestAnimationFrame(()=>{
      closeButtonRef.current?.focus();
    });
    // Alguns navegadores adiam a visibilidade da gaveta durante a animação.
    // Só tenta novamente se o foco ainda estiver fora do próprio menu.
    const focusRetry=window.setTimeout(()=>{
      const sidebar=sidebarRef.current;
      if(sidebar?.classList.contains('sidebar-open') && !sidebar.contains(document.activeElement)) {
        closeButtonRef.current?.focus();
      }
    },250);

    function handleKeydown(event:KeyboardEvent){
      if(event.key==='Escape'){
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if(event.key!=='Tab')return;
      const controls=sidebarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
      if(!controls?.length)return;
      const first=controls[0], last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
    function handleResize(){if(window.innerWidth>690)setMenuOpen(false);}
    document.addEventListener('keydown',handleKeydown);
    window.addEventListener('resize',handleResize);
    return ()=>{
      window.cancelAnimationFrame(focusFrame);
      window.clearTimeout(focusRetry);
      document.body.style.overflow=previousOverflow;
      document.removeEventListener('keydown',handleKeydown);
      window.removeEventListener('resize',handleResize);
    };
  },[menuOpen]);
  function closeMobileMenu(){
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }
  function navigateTo(target:Page){
    setPage(target);
    if(menuOpen){
      setMenuOpen(false);
      document.getElementById('main-content')?.focus();
    }
  }
  const check=useQuery({queryKey:['admin',session?.user.id],enabled:Boolean(session),queryFn:async()=>{
    const {data,error}=await supabase.from('admin_users').select('user_id,display_name').eq('user_id',session!.user.id).eq('active',true).maybeSingle();
    if(error)throw error;return data;
  }});
  const teacherAccess=useQuery({
    queryKey:['teacher-account',session?.user.id],
    enabled:Boolean(session)&&check.isSuccess&&!check.data,
    queryFn:async()=>{
      const {data,error}=await supabase.from('teacher_account_links')
        .select('requester_id,active').eq('user_id',session!.user.id).eq('active',true).maybeSingle();
      if(error)throw error;
      return data as {requester_id:string;active:boolean}|null;
    }
  });
  if(!isConfigured)return <div className="setup"><h1>Educart ainda não está configurado</h1><p>Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env antes de iniciar a aplicação. Nunca exponha uma chave secreta.</p></div>;
  if(isPublicView)return <Suspense fallback={<div role="status" className="center-status">Carregando agenda pública…</div>}><PublicCartAvailabilityPage/></Suspense>;
  if(loading)return <div className="center-status" role="status">Carregando Educart…</div>;
  if(!session)return <Login onLogin={()=>setPage('overview')}/>;
  if(check.isLoading)return <div className="center-status" role="status">Validando acesso administrativo…</div>;
  if(check.error)return <div className="setup"><h1>Não foi possível validar o acesso</h1><p>{errorMessage(check.error)}</p><button className="secondary" onClick={()=>qc.invalidateQueries({queryKey:['admin']})}>Tentar novamente</button></div>;
  if(!check.data){
    if(teacherAccess.isLoading)return <div role="status" className="center-status">Verificando vínculo de professor…</div>;
    if(teacherAccess.error)return <div className="setup"><h1>Não foi possível verificar o acesso</h1>
      <p>Houve um erro na verificação do vínculo. Tente novamente.</p>
      <button className="secondary" onClick={()=>void qc.invalidateQueries({queryKey:['teacher-account']})}>Tentar novamente</button>
      <button className="ghost" onClick={()=>void supabase.auth.signOut()}>Sair</button></div>;
    if(teacherAccess.data)return <Suspense fallback={<div role="status" className="center-status">Carregando portal do professor…</div>}>
      <TeacherPortal requesterId={teacherAccess.data.requester_id} userId={session.user.id} email={session.user.email??''}
        onLogout={()=>{void supabase.auth.signOut()}}/>
    </Suspense>;
    return <div className="setup"><ShieldCheck size={34}/><h1>Conta criada, aguardando autorização</h1>
      <p>Seu login foi reconhecido. A TI precisa vincular seu e-mail a um professor cadastrado ou autorizar o acesso administrativo.</p>
      <button className="secondary" onClick={()=>{void qc.invalidateQueries({queryKey:['admin']});void qc.invalidateQueries({queryKey:['teacher-account']})}}>Verificar autorização</button>
      <button className="ghost" onClick={()=>void supabase.auth.signOut()}>Sair desta conta</button></div>;
  }
  const nav:[Page,string,typeof Boxes][]=[['overview','Visão geral',ClipboardList],['carts','Carrinhos',Boxes],['requesters','Professores',UserRoundPlus],['notebooks','Notebooks',Laptop],['reservations','Reservas',CalendarDays],['calendar','Calendário',BarChart3],['approvals','Solicitações',ClipboardCheck],['notifications','Notificações',Bell]];
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    {menuOpen&&<button type="button" tabIndex={-1} className="mobile-menu-backdrop" aria-label="Fechar navegação" onClick={closeMobileMenu}/>}
    <aside id="main-nav-panel" ref={sidebarRef} className={'sidebar '+(menuOpen?'sidebar-open':'')} role={menuOpen?'dialog':undefined} aria-modal={menuOpen||undefined} aria-label="Navegação principal">
      <div className="sidebar-top">
        <BrandLogo tone="light"/>
        <button type="button" ref={closeButtonRef} className="sidebar-close" aria-label="Fechar menu lateral" onClick={closeMobileMenu}><X size={21} strokeWidth={2} aria-hidden="true"/></button>
      </div>
      <p className="sidebar-label">GERENCIAMENTO</p>
      <nav aria-label="Menu principal" className="nav">{nav.map(([id,label,Icon])=>
        <button key={id} type="button" aria-current={page===id?'page':undefined} className={'nav-item '+(page===id?'selected':'')} onClick={()=>navigateTo(id)}><Icon size={19} aria-hidden="true"/>{label}</button>
      )}</nav>
      <div className="side-bottom">
        <div className="account"><span className="avatar"><UserRound size={18} aria-hidden="true"/></span><span><strong>{check.data.display_name}</strong><small>Administrador da TI</small></span></div>
        <button type="button" className="nav-item" onClick={()=>supabase.auth.signOut()}><LogOut size={18} aria-hidden="true"/> Sair</button>
      </div>
    </aside>
    <main id="main-content" tabIndex={-1} className="main">
      <header className="topbar">
        <div className="topbar-main">
          <button type="button" ref={menuButtonRef} className="mobile-menu-toggle" aria-controls="main-nav-panel" aria-expanded={menuOpen} aria-label="Abrir menu lateral" onClick={()=>setMenuOpen(true)}>
            <Menu size={21} strokeWidth={2} aria-hidden="true"/>
          </button>
          <span>Gestão dos laboratórios móveis</span>
        </div>
        <div className="topbar-actions"><span className="phase-tag">Gestão de laboratórios</span>
          <NotificationBell userId={session.user.id} onOpen={()=>navigateTo('notifications')}/></div>
      </header>
      <div className="content">
        {page==='overview'?<Overview/>:page==='carts'?<Suspense fallback={<p role="status">Carregando carrinhos…</p>}><CartsPage/></Suspense>:page==='requesters'?<Suspense fallback={<p role="status">Carregando professores…</p>}><RequestersPage/></Suspense>:page==='notebooks'?<Suspense fallback={<p role="status">Carregando notebooks…</p>}><NotebooksPage/></Suspense>:page==='reservations'?<Suspense fallback={<p role="status">Carregando reservas…</p>}><ReservationsPage/></Suspense>:page==='calendar'?<Suspense fallback={<p role="status">Carregando calendário…</p>}><CalendarReportsPage/></Suspense>:page==='visual3d'?<Suspense fallback={<p role="status">Carregando visualização 3D…</p>}><Visual3DPage/></Suspense>:page==='approvals'?<Suspense fallback={<p role="status">Carregando solicitações…</p>}><TeacherApprovalsPage/></Suspense>:<Suspense fallback={<p role="status">Carregando notificações…</p>}><NotificationsPage userId={session.user.id} audience="admin" onReturn={()=>navigateTo('overview')} onViewRequests={()=>navigateTo('approvals')}/></Suspense>}
      </div>
    </main>
  </div>;
}
