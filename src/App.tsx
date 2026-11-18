import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Boxes, CalendarDays, ClipboardList, Laptop, LogOut, ClipboardCheck, Bell, Menu, ShieldCheck, UserRound, UserRoundPlus, MapPin, Wrench, ArrowLeftRight, X } from 'lucide-react';
import { create } from 'zustand';
import { supabase, isConfigured, getRecoveryState, subscribeRecovery, rejectDirectRecovery, clearRecovery } from './lib/supabase';
import {diagnostics} from './lib/observability';
import {errorMessage} from './lib/validation';
import NotificationBell from './components/NotificationBell';
import BrandLogo from './components/BrandLogo';
import ThemeToggle from './components/ThemeToggle';
import PasswordResetPage from './pages/PasswordResetPage';
import {recoveryRedirect,recoveryMessage,newPasswordError} from './lib/passwordRecovery';

const HealthPage=lazy(()=>import('./pages/HealthPage'));
const DashboardPage=lazy(()=>import('./pages/DashboardPage'));
const MovementsPage=lazy(()=>import('./pages/MovementsPage'));
const MaintenancePage=lazy(()=>import('./pages/MaintenancePage'));
const LocationsPage=lazy(()=>import('./pages/LocationsPage'));
const CartsPage = lazy(()=>import('./pages/CartsPage'));
const RequestersPage = lazy(()=>import('./pages/RequestersPage'));
const NotebooksPage = lazy(()=>import('./pages/NotebooksPage'));
const ReservationsPage = lazy(()=>import('./pages/ReservationsPage'));
const CalendarReportsPage = lazy(()=>import('./pages/CalendarReportsPage'));
const SpatialEditorPage = lazy(()=>import('./features/digitalTwin/SpatialEditorPage'));
const Prototype3DPage = lazy(()=>import('./features/digitalTwin/PrototypePage'));
const DigitalTwinPage = lazy(()=>import('./features/digitalTwin/DigitalTwinPage'));
const Visual3DPage = lazy(()=>import('./pages/Visual3DPage'));
const PublicCartAvailabilityPage = lazy(()=>import('./pages/PublicCartAvailabilityPage'));
const TeacherPortal = lazy(()=>import('./pages/TeacherPortal'));
const TeacherApprovalsPage = lazy(()=>import('./pages/TeacherApprovalsPage'));
const NotificationsPage = lazy(()=>import('./pages/NotificationsPage'));

type Page = 'health' | 'digital-twin' | 'spatial-editor' | 'movements' | 'maintenance' | 'locations' | 'overview' | 'carts' | 'requesters' | 'notebooks' | 'reservations' | 'calendar' | 'visual3d' | 'approvals' | 'notifications';
const useUi = create<{page:Page; setPage:(page:Page)=>void}>()(
  set => ({page:'overview',setPage:page=>set({page})})
);

function Notice({message,kind='error'}:{message:string;kind?:'error'|'success'}) {
  return <p role={kind==='error'?'alert':'status'} className={'notice '+kind}>{message}</p>;
}
function TextInput({label,id,value,onChange,required=false,type='text',min,autoComplete,disabled=false}:{label:string;id:string;value:string;onChange:(v:string)=>void;required?:boolean;type?:string;min?:number;autoComplete?:string;disabled?:boolean}) {
  return <label className="field" htmlFor={id}><span>{label}</span>
    <input id={id} value={value} onChange={e=>onChange(e.target.value)} required={required} type={type} min={min} autoComplete={autoComplete} disabled={disabled} />
  </label>;
}
function Login({onLogin,resetSuccess=false}:{onLogin:()=>void;resetSuccess?:boolean}) {
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [mode,setMode]=useState<'login'|'signup'|'recover'>('login');
  const [error,setError]=useState('');const [message,setMessage]=useState(resetSuccess?'Senha alterada com sucesso. Entre com a nova senha.':'');const [busy,setBusy]=useState(false);
  const submitting=useRef(false);
  async function submit(e:FormEvent) {
    e.preventDefault();if(submitting.current)return;
    setError('');setMessage('');
    if(mode==='signup'){
      const validation=newPasswordError(password,password);
      if(validation){setError(validation);return;}
    }
    submitting.current=true;setBusy(true);
    try {
      if(mode==='recover') {
        // Keep the same response for registered and unknown addresses, including server rejection.
        await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:recoveryRedirect(window.location.href,import.meta.env.BASE_URL)});
        setMessage(recoveryMessage);
      } else if(mode==='signup') {
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
      if(mode==='recover'){setMessage(recoveryMessage);return;}
      setError(mode==='signup'
        ? 'Não foi possível criar a conta. Confira o e-mail e a senha ou tente novamente.'
        : 'Não foi possível entrar. Confira as credenciais e tente novamente.');
    } finally {submitting.current=false;setBusy(false)}
  }
  return <div className="auth-shell"><section className="auth-panel">
    <div className="auth-theme-bar"><BrandLogo tone="light"/><ThemeToggle/></div>
    <div className="auth-intro"><span className="eyebrow">PLATAFORMA EDUCACIONAL</span>
      <h1>{mode==='recover'?'Recuperar senha':mode==='signup'?'Criar conta no Educart':'Acesso ao Educart'}</h1>
      <p>{mode==='recover'?'Informe o e-mail da sua conta para receber as instruções de recuperação.':mode==='signup'?'Cadastre seu e-mail. A TI autoriza o acesso de professor ou administrador depois da confirmação da conta.':'Entre com sua conta para acessar o painel da TI ou o portal do professor.'}</p></div>
    <form onSubmit={submit} className="form-stack">
      <TextInput id="email" label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" disabled={busy} required/>
      {mode!=='recover'&&<TextInput id="password" label="Senha" type="password" value={password} onChange={setPassword} autoComplete={mode==='signup'?'new-password':'current-password'} disabled={busy} required/>}
      {mode==='signup'&&<p className="form-hint">Use uma senha exclusiva com pelo menos 8 caracteres. Depois do cadastro, confirme seu e-mail se receber uma mensagem do Supabase.</p>}
      {error&&<Notice message={error}/>}
      {message&&<Notice kind="success" message={message}/>}
      <button className="primary" disabled={busy} type="submit">{busy?'Aguarde…':mode==='recover'?'Enviar instruções':mode==='signup'?'Criar minha conta':'Entrar no Educart'}</button>
    </form>
    {mode==='login'&&<button type="button" className="auth-switch" disabled={busy} onClick={()=>{setMode('recover');setError('');setMessage('');setPassword('');}}>Esqueci minha senha</button>}
    <button type="button" className="auth-switch" disabled={busy} onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');setMessage('');setPassword('')}}>
      {mode==='recover'?'Voltar ao login':mode==='login'?'Ainda não tem conta? Criar conta':'Já tem conta? Fazer login'}
    </button>
    <p className="auth-footer"><ShieldCheck size={16}/> Criar conta não concede acesso automático ao sistema.</p>
    <a className="auth-public-link" href="#/consulta-publica">Consultar disponibilidade sem login</a>
  </section></div>;
}
export default function App() {
  const qc=useQueryClient();const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true);
  const {page,setPage}=useUi();
  const recoveryState=useSyncExternalStore(subscribeRecovery,getRecoveryState,getRecoveryState);
  const [resetSuccess,setResetSuccess]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const [isPublicView,setIsPublicView]=useState(()=>window.location.hash==='#/consulta-publica');
  useEffect(()=>{
    const update=()=>{
      setIsPublicView(window.location.hash==='#/consulta-publica');
      if(window.location.hash==='#/redefinir-senha')rejectDirectRecovery();
    };
    window.addEventListener('hashchange',update);
    return ()=>window.removeEventListener('hashchange',update);
  },[]);
  const menuButtonRef=useRef<HTMLButtonElement>(null);
  const closeButtonRef=useRef<HTMLButtonElement>(null);
  const mainRef=useRef<HTMLElement>(null);
  const skipRef=useRef<HTMLAnchorElement>(null);
  const sidebarRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    let current=true;
    let observed=false;
    let previousUser:string|null=null;
    function acceptSession(next:Session|null){
      if(!current)return;
      const id=next?.user.id??null;
      if(previousUser!==id||!next){diagnostics.reset();qc.clear();setMenuOpen(false);setPage('overview');}
      previousUser=id;setSession(next);setLoading(false);
    }
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{observed=true;acceptSession(next);});
    void supabase.auth.getSession().then(({data,error})=>{if(!observed)acceptSession(error?null:data.session);},()=>{if(!observed)acceptSession(null);});
    return ()=>{current=false;subscription.unsubscribe()};
  },[qc,setPage]);
  useEffect(()=>{
    if(!menuOpen)return;
    const main=mainRef.current,skip=skipRef.current;
    if(main)main.inert=true;if(skip)skip.inert=true;
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
        event.preventDefault();closeMobileMenu();
        return;
      }
      if(event.key!=='Tab')return;
      const controls=Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')??[]).filter(el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden');
      if(!controls?.length)return;
      const first=controls[0], last=controls[controls.length-1];
      if(!sidebarRef.current?.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first).focus();}
      else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
    function handleResize(){if(window.innerWidth>690)setMenuOpen(false);}
    document.addEventListener('keydown',handleKeydown);
    window.addEventListener('resize',handleResize);
    return ()=>{
      window.cancelAnimationFrame(focusFrame);
      window.clearTimeout(focusRetry);
      if(main)main.inert=false;if(skip)skip.inert=false;
      document.body.style.overflow=previousOverflow;
      document.removeEventListener('keydown',handleKeydown);
      window.removeEventListener('resize',handleResize);
    };
  },[menuOpen]);
  function closeMobileMenu(){
    if(mainRef.current)mainRef.current.inert=false;
    if(skipRef.current)skipRef.current.inert=false;
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }
  function navigateTo(target:Page){
    setPage(target);
    if(menuOpen){
      if(mainRef.current)mainRef.current.inert=false;
      if(skipRef.current)skipRef.current.inert=false;
      setMenuOpen(false);
      mainRef.current?.focus();
    }
  }
  const check=useQuery({queryKey:['admin',session?.user.id],enabled:Boolean(session)&&recoveryState==='none',refetchOnWindowFocus:'always',refetchInterval:60_000,queryFn:async()=>{
    const {data,error}=await supabase.from('admin_users').select('user_id,display_name').eq('user_id',session!.user.id).eq('active',true).maybeSingle();
    if(error)throw error;return data;
  }});
  const teacherAccess=useQuery({
    queryKey:['teacher-account',session?.user.id],
    enabled:Boolean(session)&&recoveryState==='none'&&check.isSuccess&&!check.data,
    refetchOnWindowFocus:'always',refetchInterval:60_000,
    queryFn:async()=>{
      const {data,error}=await supabase.from('teacher_account_links')
        .select('requester_id,active').eq('user_id',session!.user.id).eq('active',true).maybeSingle();
      if(error)throw error;
      return data as {requester_id:string;active:boolean}|null;
    }
  });
  if(!isConfigured)return <div className="setup"><h1>Educart ainda não está configurado</h1><p>Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env antes de iniciar a aplicação. Nunca exponha uma chave secreta.</p></div>;
  if(recoveryState!=='none')return <PasswordResetPage state={recoveryState} onFinish={changed=>{
    setSession(null);diagnostics.reset();qc.clear();setMenuOpen(false);setPage('overview');setResetSuccess(changed);
    const clean=new URL(window.location.href);clean.search='';clean.hash='/login';
    window.history.replaceState(window.history.state,'',clean.toString());
    setIsPublicView(false);clearRecovery();
  }}/>;
  if(isPublicView)return <Suspense fallback={<div role="status" className="center-status">Carregando agenda pública…</div>}><PublicCartAvailabilityPage/></Suspense>;
  if(loading)return <div className="center-status" role="status">Carregando Educart…</div>;
  if(!session)return <Login resetSuccess={resetSuccess} onLogin={()=>{setResetSuccess(false);setPage('overview')}}/>;
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
  const nav:[Page,string,typeof Boxes][]=[['overview','Visão geral',ClipboardList],['carts','Carrinhos',Boxes],['locations','Localizações',MapPin],['maintenance','Manutenção',Wrench],['movements','Retirada e devolução',ArrowLeftRight],['requesters','Professores',UserRoundPlus],['notebooks','Notebooks',Laptop],['reservations','Reservas',CalendarDays],['calendar','Calendário',BarChart3],['approvals','Solicitações',ClipboardCheck],['notifications','Notificações',Bell],['health','Saúde da aplicação',ShieldCheck]];
  const prototypeEnabled=import.meta.env.DEV&&new URLSearchParams(window.location.search).get('prototype3d')==='1';
  if(prototypeEnabled)nav.push(['visual3d','Protótipo 3D',Boxes]);
  const spatialEnabled=import.meta.env.DEV&&new URLSearchParams(window.location.search).get('spatial3d')==='1';
  if(spatialEnabled)nav.push(['spatial-editor','Configuração espacial',MapPin]);
  const digitalTwinEnabled=import.meta.env.DEV&&new URLSearchParams(window.location.search).get('environment3d')==='1';
  if(digitalTwinEnabled)nav.push(['digital-twin','Ambiente 3D',Boxes]);
  return <div className="app-shell">
    <a ref={skipRef} className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();mainRef.current?.focus();}}>Pular para o conteúdo</a>
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
    <main ref={mainRef} id="main-content" tabIndex={-1} className="main">
      <header className="topbar">
        <div className="topbar-main">
          <button type="button" ref={menuButtonRef} className="mobile-menu-toggle" aria-controls="main-nav-panel" aria-expanded={menuOpen} aria-label="Abrir menu lateral" onClick={()=>setMenuOpen(true)}>
            <Menu size={21} strokeWidth={2} aria-hidden="true"/>
          </button>
          <span>Gestão dos laboratórios móveis</span>
        </div>
        <div className="topbar-actions"><span className="phase-tag">Gestão de laboratórios</span><ThemeToggle/>
          <NotificationBell userId={session.user.id} onOpen={()=>navigateTo('notifications')}/></div>
      </header>
      <div className="content">
        {page==='health'?<Suspense fallback={<p role="status">Carregando diagnóstico…</p>}><HealthPage/></Suspense>:page==='digital-twin'&&digitalTwinEnabled?<Suspense fallback={<p role="status">Carregando ambiente 3D…</p>}><DigitalTwinPage onNavigate={navigateTo}/></Suspense>:page==='spatial-editor'&&spatialEnabled?<Suspense fallback={<p role="status">Carregando configuração espacial…</p>}><SpatialEditorPage/></Suspense>:page==='overview'?<Suspense fallback={<p role="status">Carregando painel operacional…</p>}><DashboardPage onNavigate={navigateTo}/></Suspense>:page==='movements'?<Suspense fallback={<p role="status">Carregando movimentações…</p>}><MovementsPage/></Suspense>:page==='maintenance'?<Suspense fallback={<p role="status">Carregando manutenção…</p>}><MaintenancePage/></Suspense>:page==='locations'?<Suspense fallback={<p role="status">Carregando localizações…</p>}><LocationsPage/></Suspense>:page==='carts'?<Suspense fallback={<p role="status">Carregando carrinhos…</p>}><CartsPage/></Suspense>:page==='requesters'?<Suspense fallback={<p role="status">Carregando professores…</p>}><RequestersPage/></Suspense>:page==='notebooks'?<Suspense fallback={<p role="status">Carregando notebooks…</p>}><NotebooksPage/></Suspense>:page==='reservations'?<Suspense fallback={<p role="status">Carregando reservas…</p>}><ReservationsPage/></Suspense>:page==='calendar'?<Suspense fallback={<p role="status">Carregando calendário…</p>}><CalendarReportsPage/></Suspense>:page==='visual3d'?<Suspense fallback={<p role="status">Carregando visualização 3D…</p>}>{prototypeEnabled?<Prototype3DPage/>:<Visual3DPage/>}</Suspense>:page==='approvals'?<Suspense fallback={<p role="status">Carregando solicitações…</p>}><TeacherApprovalsPage/></Suspense>:<Suspense fallback={<p role="status">Carregando notificações…</p>}><NotificationsPage userId={session.user.id} audience="admin" onReturn={()=>navigateTo('overview')} onViewRequests={()=>navigateTo('approvals')}/></Suspense>}
      </div>
    </main>
  </div>;
}
