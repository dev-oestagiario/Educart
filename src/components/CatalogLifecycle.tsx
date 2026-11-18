import {useEffect,useRef,useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../lib/supabase';
import {errorMessage} from '../lib/validation';
export type CatalogTable='carts'|'requesters'|'notebook_codes'|'campuses'|'campus_blocks'|'campus_rooms';
type Result={kind:'success'|'error';message:string};
type RecordRef={id:string;active:boolean;label:string;table:CatalogTable};
export type StatusFilter='active'|'inactive'|'all';
export function matchesStatus(active:boolean,status:StatusFilter){return status==='all'||active===(status==='active');}
export function CatalogStatusFilter({value,onChange}:{value:StatusFilter;onChange:(v:StatusFilter)=>void}){
 return <label className="field catalog-status-filter"><span>Situação</span><select value={value} onChange={e=>onChange(e.target.value as StatusFilter)}><option value="active">Ativos</option><option value="inactive">Inativos</option><option value="all">Todos</option></select></label>;
}
function ConfirmStatus({record,busy,onCancel,onConfirm}:{record:RecordRef;busy:boolean;onCancel:()=>void;onConfirm:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return ()=>dialog?.close();},[]);
 return <dialog ref={ref} className="catalog-status-dialog" aria-labelledby="catalog-status-title" onCancel={e=>{e.preventDefault();if(!busy)onCancel();}}>
  <h2 id="catalog-status-title">{record.active?'Inativar cadastro':'Reativar cadastro'}</h2>
  <p><strong>{record.label}</strong></p>
  <p>{record.active?'O cadastro deixará de estar disponível para novas operações. O histórico e os vínculos serão preservados. Pendências operacionais podem impedir a inativação.':'O cadastro voltará a estar disponível, se atender às regras atuais do sistema.'}</p>
  <div className="actions"><button type="button" className="ghost" disabled={busy} autoFocus onClick={onCancel}>Cancelar</button><button type="button" className="primary" disabled={busy} onClick={onConfirm}>{busy?'Aguarde…':record.active?'Confirmar inativação':'Confirmar reativação'}</button></div>
 </dialog>;
}
export function useCatalogLifecycle(onResult:(result:Result)=>void){
 const qc=useQueryClient(),[record,setRecord]=useState<RecordRef|null>(null);
 const mutation=useMutation({
  mutationFn:async(target:RecordRef)=>{
   const {data,error}=await supabase.from(target.table).update({active:!target.active}).eq('id',target.id).eq('active',target.active).select('id').maybeSingle();
   if(error)throw new Error(error.code==='P0001'?error.message:errorMessage(error));
   if(!data)throw new Error('O cadastro foi alterado ou não existe. Atualize a listagem.');
  },
  onSuccess:async(_,target)=>{await qc.invalidateQueries();setRecord(null);onResult({kind:'success',message:target.active?'Cadastro inativado.':'Cadastro reativado.'});},
  onError:error=>{setRecord(null);onResult({kind:'error',message:error.message});}
 });
 return {busy:mutation.isPending,request:(target:RecordRef)=>setRecord(target),
  dialog:record?<ConfirmStatus record={record} busy={mutation.isPending} onCancel={()=>setRecord(null)} onConfirm={()=>mutation.mutate(record)}/>:null};
}
