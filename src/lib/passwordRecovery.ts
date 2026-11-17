// Keep the public hash router separate from Supabase's authentication callback.
export type RecoveryEntry='none'|'pending'|'invalid';
export function recoveryEntry(href:string):RecoveryEntry{
  const url=new URL(href);
  const hash=new URLSearchParams(url.hash.replace(/^#/,''));
  const type=hash.get('type')??url.searchParams.get('type');
  if(hash.has('error')||hash.has('error_code')||url.searchParams.has('error')||url.searchParams.has('error_code'))return 'invalid';
  if(type==='recovery')return hash.has('access_token')&&hash.has('refresh_token')?'pending':'invalid';
  if(url.hash==='#/redefinir-senha'||url.searchParams.get('recuperar')==='1')return 'invalid';
  return 'none';
}
export function recoveryRedirect(href:string,base:string){
  const url=new URL(base,href);
  url.search='';url.hash='';
  return url.toString();
}
export const recoveryMessage='Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha. Confira também a caixa de spam.';
export function newPasswordError(password:string,confirmation:string){
  if(password.length<8)return 'A nova senha deve ter pelo menos 8 caracteres.';
  if(password!==confirmation)return 'As senhas não coincidem.';
  return '';
}
