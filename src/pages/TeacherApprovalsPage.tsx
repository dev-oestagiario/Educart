import {useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {ClipboardCheck,Link2,ShieldCheck,UserMinus} from 'lucide-react';
import {supabase,type Cart,type Requester} from '../lib/supabase';
import {shiftLabel,showDate,type Shift} from '../lib/reservations';
import {requestStatusLabel,type TeacherRequest} from '../lib/teacherRequests';

type TeacherLink={user_id:string;requester_id:string;requester_name:string;email:string;active:boolean};
const explain=(err:unknown)=>err instanceof Error?err.message:'Operação não concluída.';

async function rows<T>(table:'requesters'|'carts'):Promise<T[]>{
  const {data,error}=await supabase.from(table).select('*').eq('active',true).order('name');
  if(error)throw error;
  return (data??[]) as T[];
}
export default function TeacherApprovalsPage(){
  const qc=useQueryClient();
  const [requesterId,setRequesterId]=useState('');
  const [email,setEmail]=useState('');
  const [message,setMessage]=useState<{kind:'error'|'success';text:string}|null>(null);
  const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
  const [filter,setFilter]=useState<'PENDENTE'|'TODAS'>('PENDENTE');
  const [confirmRevoke,setConfirmRevoke]=useState<string|null>(null);
  const teachers=useQuery({queryKey:['requesters'],queryFn:()=>rows<Requester>('requesters')});
  const carts=useQuery({queryKey:['carts'],queryFn:()=>rows<Cart>('carts')});
  const links=useQuery({
    queryKey:['teacher-account-links'],queryFn:async()=>{
      const {data,error}=await supabase.rpc('list_teacher_accounts');
      if(error)throw error;return (data??[]) as TeacherLink[];
    }
  });
  const requests=useQuery({
    queryKey:['admin-teacher-requests'],queryFn:async()=>{
      const {data,error}=await supabase.from('reservation_requests')
        .select('id,requester_id,requested_by,cart_id,mode,quantity,dates,shifts,needs_mouse,notes,status,review_notes,reservation_id,created_at,reviewed_at')
        .order('created_at',{ascending:false}).limit(200);
      if(error)throw error;return (data??[]) as TeacherRequest[];
    }
  });
  function refresh(){
    void qc.invalidateQueries({queryKey:['admin-teacher-requests']});
    void qc.invalidateQueries({queryKey:['teacher-account-links']});
    void qc.invalidateQueries({queryKey:['reservations']});
    void qc.invalidateQueries({queryKey:['reservation-periods']});
    void qc.invalidateQueries({queryKey:['booking-periods']});
    void qc.invalidateQueries({queryKey:['reservation-events']});
    void qc.invalidateQueries({queryKey:['calendar-']});
    void qc.invalidateQueries({queryKey:['3d-periods']});
  }
  const link=useMutation({
    mutationFn:async()=>{
      if(!requesterId||!email.includes('@'))throw new Error('Selecione um professor e informe o e-mail da conta já confirmada.');
      const {error}=await supabase.rpc('link_teacher_account',{p_requester_id:requesterId,p_email:email.trim()});
      if(error)throw error;
    },
    onSuccess:()=>{setMessage({kind:'success',text:'Conta vinculada. O professor já pode enviar solicitações.'});setEmail('');setRequesterId('');refresh();},
    onError:err=>setMessage({kind:'error',text:explain(err)})
  });
  const unlink=useMutation({
    mutationFn:async(userId:string)=>{
      const {error}=await supabase.rpc('unlink_teacher_account',{p_user_id:userId});
      if(error)throw error;
    },
    onSuccess:()=>{setConfirmRevoke(null);setMessage({kind:'success',text:'Vínculo desativado; o professor não pode enviar novos pedidos.'});refresh();},
    onError:err=>setMessage({kind:'error',text:explain(err)})
  });
  const review=useMutation({
    mutationFn:async({id,approve}:{id:string;approve:boolean})=>{
      const {error}=await supabase.rpc('review_teacher_request',{
        p_request_id:id,p_approve:approve,p_review_notes:reviewNotes[id]?.trim()||null
      });
      if(error)throw error;
      return approve;
    },
    onSuccess:approved=>{
      setMessage({kind:'success',text:approved?'Solicitação aprovada e reserva confirmada.':'Solicitação rejeitada; disponibilidade inalterada.'});
      refresh();
    },
    onError:err=>setMessage({kind:'error',text:'Não foi possível concluir a decisão: '+explain(err)+'. O pedido permanece pendente.'})
  });
  const pending=(requests.data??[]).filter(x=>x.status==='PENDENTE').length;
  const displayed=(requests.data??[]).filter(x=>filter==='TODAS'||x.status==='PENDENTE');
  function submitLink(event:FormEvent){event.preventDefault();setMessage(null);link.mutate();}
  return <div className="teacher-approvals">
    <div className="page-header"><h1>Solicitações de professores</h1>
      <p>Vincule contas verificadas aos professores cadastrados e aprove ou rejeite os pedidos.</p></div>
    <div className="panel muted-panel"><ShieldCheck size={20} aria-hidden="true"/>
      <p>Pedidos pendentes <strong>não ocupam notebooks</strong>. A aprovação chama a função transacional de reserva e verifica a disponibilidade naquele momento.</p>
    </div>
    {message&&<p role={message.kind==='error'?'alert':'status'} className={'notice '+message.kind}>{message.text}</p>}
    <div className="stats teacher-approval-stats">
      <div className="stat"><span className="stat-label">Pedidos pendentes</span><strong>{requests.isLoading?'—':pending}</strong></div>
      <div className="stat"><span className="stat-label">Solicitações registradas</span><strong>{requests.isLoading?'—':requests.data?.length??0}</strong></div>
      <div className="stat"><span className="stat-label">Contas de professor ativas</span><strong>{links.isLoading?'—':(links.data??[]).filter(x=>x.active).length}</strong></div>
    </div>
    <section className="panel" aria-labelledby="approval-list-heading">
      <div className="approval-list-head"><h2 id="approval-list-heading"><ClipboardCheck size={19} aria-hidden="true"/> Analisar solicitações</h2>
        <label className="field" htmlFor="approval-filter"><span>Exibir</span>
          <select id="approval-filter" value={filter} onChange={e=>setFilter(e.target.value as 'PENDENTE'|'TODAS')}>
            <option value="PENDENTE">Pendentes</option><option value="TODAS">Todas</option>
          </select>
        </label>
      </div>
      {requests.isLoading?<p role="status">Carregando pedidos…</p>:
        requests.error?<p className="notice error" role="alert">Não foi possível carregar os pedidos.</p>:
        displayed.length===0?<p className="empty">Nenhuma solicitação para este filtro.</p>:
        <div className="teacher-request-list">{displayed.map(req=><article className="booking-item" key={req.id}>
          <div className="teacher-request-heading"><strong>{teachers.data?.find(t=>t.id===req.requester_id)?.name??'Professor'}</strong>
            <span className={'teacher-status '+req.status.toLowerCase()}>{requestStatusLabel[req.status]}</span></div>
          <p className="reservation-subtle">{carts.data?.find(c=>c.id===req.cart_id)?.name??'Carrinho'} · {req.mode==='COMPLETA'?'Carrinho completo':req.quantity+' notebooks'} · {req.shifts.map(x=>shiftLabel[x as Shift]??x).join(', ')}</p>
          <p className="reservation-subtle">{req.dates.map(showDate).join(', ')}</p>
          {req.needs_mouse&&<p className="reservation-subtle">Solicitou mouse</p>}
          {req.notes&&<p className="form-hint"><strong>Observações:</strong> {req.notes}</p>}
          {req.review_notes&&<p className="form-hint"><strong>Justificativa da TI:</strong> {req.review_notes}</p>}
          {req.status==='PENDENTE'&&<div className="form-stack approval-actions">
            <label className="field" htmlFor={'review-note-'+req.id}><span>Resposta ou justificativa (opcional)</span>
              <textarea id={'review-note-'+req.id} rows={2} maxLength={1000}
                value={reviewNotes[req.id]??''} onChange={e=>setReviewNotes(old=>({...old,[req.id]:e.target.value}))}/>
            </label>
            <div className="reservation-actions">
              <button type="button" className="primary" disabled={review.isPending} onClick={()=>review.mutate({id:req.id,approve:true})}>
                Aprovar e confirmar reserva
              </button>
              <button type="button" className="secondary" disabled={review.isPending} onClick={()=>review.mutate({id:req.id,approve:false})}>
                Rejeitar solicitação
              </button>
            </div>
            <p className="form-hint">Se não houver disponibilidade, a aprovação falhará e o pedido continuará pendente.</p>
          </div>}
        </article>)}</div>}
    </section>
    <section className="panel" aria-labelledby="links-heading">
      <h2 id="links-heading"><Link2 size={19} aria-hidden="true"/> Autorizar contas de professores</h2>
      <p className="form-hint">O professor deve criar a conta e confirmar o e-mail antes. A TI escolhe o cadastro correspondente: não há vínculo automático por nome.</p>
      <form className="teacher-link-form" onSubmit={submitLink}>
        <label className="field" htmlFor="teacher-link-requester"><span>Professor cadastrado</span>
          <select id="teacher-link-requester" required value={requesterId} onChange={e=>setRequesterId(e.target.value)}>
            <option value="">Selecione um professor</option>
            {(teachers.data??[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="teacher-link-email"><span>E-mail da conta confirmada</span>
          <input id="teacher-link-email" type="email" autoComplete="email" required value={email}
            onChange={e=>setEmail(e.target.value)} placeholder="professor@escola.edu.br"/>
        </label>
        <button type="submit" className="primary" disabled={link.isPending||!!teachers.error}>
          {link.isPending?'Vinculando…':'Vincular professor'}
        </button>
      </form>
      <h3 className="teacher-subheading">Contas vinculadas</h3>
      {links.isLoading?<p role="status">Carregando vínculos…</p>:
        links.error?<p role="alert" className="notice error">Não foi possível consultar os vínculos.</p>:
        !links.data?.length?<p className="empty">Nenhuma conta vinculada.</p>:
        <div className="item-list">{links.data.map(row=><div className="item" key={row.user_id}>
          <div><strong>{row.requester_name}</strong><span>{row.email} · {row.active?'Ativo':'Desativado'}</span></div>
          {row.active&&(confirmRevoke===row.user_id?
            <div className="reservation-actions"><button type="button" className="secondary" disabled={unlink.isPending}
              onClick={()=>unlink.mutate(row.user_id)}>Confirmar revogação</button>
              <button type="button" className="ghost" onClick={()=>setConfirmRevoke(null)}>Voltar</button></div>:
            <button type="button" className="text-button" onClick={()=>setConfirmRevoke(row.user_id)}>
              <UserMinus size={15} aria-hidden="true"/> Revogar</button>)}
        </div>)}</div>}
    </section>
  </div>;
}
