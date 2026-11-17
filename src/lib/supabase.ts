import { createClient } from '@supabase/supabase-js';
import {recoveryEntry} from './passwordRecovery';

type RecoveryState='none'|'pending'|'ready'|'invalid';
let recovery:RecoveryState=typeof window==='undefined'?'none':recoveryEntry(window.location.href);
let recoveredUserId:string|null=null;
const recoveryListeners=new Set<()=>void>();
function publishRecovery(next:RecoveryState){
  recovery=next;
  recoveryListeners.forEach(listener=>listener());
}
export const getRecoveryState=()=>recovery;
export function subscribeRecovery(listener:()=>void){
  recoveryListeners.add(listener);
  return ()=>{recoveryListeners.delete(listener)};
}
export function clearRecovery(){
  recoveredUserId=null;
  publishRecovery('none');
}

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const isConfigured = Boolean(url && key && !key.includes('substitua_'));
export const supabase = createClient(
  isConfigured ? url : 'https://invalid.supabase.co',
  isConfigured ? key : 'not-configured'
);
export type Cart = { id:string; code:string; name:string; capacity:number; active:boolean; created_at:string };
export type Requester = { id:string; name:string; reference_code:string|null; active:boolean; created_at:string };
export type Notebook = { id:string; code:string; cart_id:string; active:boolean; created_at:string };

/* Subscribe before React mounts: the SDK may consume the hash during initialization. */
if(typeof window!=='undefined'&&recovery!=='none'){
  supabase.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY'&&recovery==='pending'&&session){
      recoveredUserId=session.user.id;
      publishRecovery('ready');
    }else if(recovery==='ready'&&(!session||session.user.id!==recoveredUserId)){
      publishRecovery('invalid');
    }
  });
  const finishInit=()=>{
    // The recovery event can be delivered asynchronously after initialization.
    window.setTimeout(()=>{
      if(recovery==='pending')publishRecovery('invalid');
      if(recovery==='none')return;
      const current=new URL(window.location.href);
      current.search='';
      current.hash='/redefinir-senha';
      window.history.replaceState(window.history.state,'',current.toString());
    },1000);
  };
  void supabase.auth.getSession().then(finishInit,finishInit);
}
