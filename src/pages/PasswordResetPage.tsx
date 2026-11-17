import {useState,type FormEvent} from 'react';
import BrandLogo from '../components/BrandLogo';
import ThemeToggle from '../components/ThemeToggle';
import {supabase} from '../lib/supabase';
import {newPasswordError} from '../lib/passwordRecovery';

type Props={state:'pending'|'ready'|'invalid';onFinish:(changed:boolean)=>void};
export default function PasswordResetPage({state,onFinish}:Props){
  const [password,setPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [changed,setChanged]=useState(false);
  async function leave(didChange:boolean){
    setBusy(true);setError('');
    try{
      const {error}=await supabase.auth.signOut({scope:didChange?'global':'local'});
      if(error)throw error;
      onFinish(didChange);
    }catch{
      setError('Não foi possível encerrar a sessão. Tente novamente antes de continuar.');
    }finally{setBusy(false);}
  }
  async function handleSubmit(e:FormEvent){
    e.preventDefault();
    if(state!=='ready'||busy||changed)return;
    const validation=newPasswordError(password,confirmation);
    if(validation){setError(validation);return;}
    setError('');setBusy(true);
    try{
      const {error}=await supabase.auth.updateUser({password});
      if(error)throw error;
      setChanged(true);setPassword('');setConfirmation('');
      await leave(true);
    }catch{
      setError('Não foi possível redefinir a senha. Confira os requisitos ou solicite um novo link.');
    }finally{setBusy(false);}
  }
  return <div className="auth-shell"><section className="auth-panel">
    <div className="auth-theme-bar"><BrandLogo tone="light"/><ThemeToggle/></div>
    <div className="auth-intro"><span className="eyebrow">SEGURANÇA DA CONTA</span><h1>Redefinir senha</h1>
      <p>Crie uma senha exclusiva para sua conta Educart.</p></div>
    {changed?<><p role="status" className="notice success">Senha alterada. Encerre a sessão para entrar novamente.</p>
      <button type="button" className="primary" disabled={busy} onClick={()=>void leave(true)}>Voltar ao login</button></>:
    state==='pending'?<p role="status">Validando link de recuperação…</p>:
    state==='invalid'?<><p role="alert" className="notice error">Link inválido, expirado ou já utilizado. Solicite uma nova recuperação de senha.</p>
      <button type="button" className="primary" disabled={busy} onClick={()=>void leave(false)}>Voltar ao login</button></>:
    <form className="form-stack" onSubmit={handleSubmit}>
      <label className="field" htmlFor="new-password"><span>Nova senha</span>
        <input id="new-password" type="password" autoComplete="new-password" required value={password}
          onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>
      <label className="field" htmlFor="confirm-password"><span>Confirmar nova senha</span>
        <input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation}
          onChange={e=>setConfirmation(e.target.value)} disabled={busy}/></label>
      <p className="form-hint">Use pelo menos 8 caracteres.</p>
      <button type="submit" className="primary" disabled={busy}>{busy?'Salvando…':'Salvar nova senha'}</button>
      <button type="button" className="auth-switch" disabled={busy} onClick={()=>void leave(false)}>Cancelar e voltar ao login</button>
    </form>}
    {error&&<p role="alert" className="notice error">{error}</p>}
  </section></div>;
}
