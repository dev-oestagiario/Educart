import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Mail} from 'lucide-react';
import {supabase} from '../lib/supabase';
type Pref={enabled:boolean;channel_enabled:boolean};
function parse(data:unknown):Pref{
 if(!data||typeof data!=='object'||!('enabled' in data)||!('channel_enabled' in data)||typeof data.enabled!=='boolean'||typeof data.channel_enabled!=='boolean')throw new Error('Preferência inválida');
 return {enabled:data.enabled,channel_enabled:data.channel_enabled};
}
export default function EmailPreference({userId}:{userId:string}){
 const qc=useQueryClient(),key=['email-preference',userId];
 const query=useQuery({queryKey:key,queryFn:async()=>{const {data,error}=await supabase.rpc('get_email_preference');if(error)throw error;return parse(data);},retry:false});
 const save=useMutation({mutationFn:async(enabled:boolean)=>{const {data,error}=await supabase.rpc('set_email_preference',{p_enabled:enabled});if(error)throw error;return parse(data);},onSuccess:data=>qc.setQueryData(key,data)});
 return <section className="panel" aria-label="Preferências de e-mail">
  <h2><Mail size={18} aria-hidden="true"/> Preferências de e-mail</h2>
  <p className="form-hint">Opcional. Os avisos internos permanecem disponíveis independentemente desta preferência.</p>
  {query.isLoading?<p role="status">Consultando preferência…</p>:query.error?<p role="alert">Não foi possível consultar a preferência. <button type="button" className="text-button" onClick={()=>void query.refetch()}>Tentar novamente</button></p>:query.data&&<>
   <label className="reservation-check"><input type="checkbox" checked={query.data.enabled} disabled={save.isPending} onChange={e=>save.mutate(e.target.checked)}/> Receber avisos no e-mail confirmado da minha conta</label>
   <p className="form-hint">{query.data.channel_enabled?'Canal habilitado pela administração. Somente novos eventos elegíveis.':'O envio externo ainda não está habilitado. Você pode salvar sua preferência; nenhum e-mail será enviado enquanto o canal estiver desativado.'}</p>
   {save.isPending&&<p role="status">Salvando preferência…</p>}
   {save.isError&&<p role="alert" className="notice error">Não foi possível salvar a preferência. Tente novamente.</p>}
   {save.isSuccess&&<p role="status">Preferência salva.</p>}
  </>}
 </section>;
}
