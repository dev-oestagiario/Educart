import {useEffect} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {supabase} from './supabase';
/** RLS remains authoritative. Payloads only invalidate cached queries, never populate UI. */
export const operationalRealtimeKeys=[['notifications'],['teacher-requests'],['admin-teacher-requests'],['operational-dashboard']] as const;
export function useOperationalRealtime(userId:string|undefined,enabled:boolean){
 const qc=useQueryClient();
 useEffect(()=>{
  if(!userId||!enabled)return;
  let active=true;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const refresh=()=>{if(!active)return;for(const queryKey of operationalRealtimeKeys)void qc.invalidateQueries({queryKey});};
  const schedule=()=>{if(timer)return;timer=setTimeout(()=>{timer=undefined;refresh();},150);};
  const channel=supabase.channel('educart-operational-'+userId)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'user_notifications',filter:'recipient_user_id=eq.'+userId},schedule)
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'user_notifications',filter:'recipient_user_id=eq.'+userId},schedule)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'reservation_requests'},schedule)
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'reservation_requests'},schedule)
   .subscribe(status=>{if(status==='SUBSCRIBED')schedule();});
  // Keep a bounded fallback when the network, browser, or project blocks WebSockets.
  const fallback=setInterval(()=>{if(document.visibilityState==='visible')refresh();},30000);
  const onVisible=()=>{if(document.visibilityState==='visible')schedule();};
  document.addEventListener('visibilitychange',onVisible);
  window.addEventListener('online',schedule);
  return ()=>{active=false;clearInterval(fallback);if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('online',schedule);void supabase.removeChannel(channel);};
 },[userId,enabled,qc]);
}
