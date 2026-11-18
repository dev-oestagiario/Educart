import {Feedback} from '../components/Feedback';
import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {ArrowLeft,Bell,CheckCheck,ClipboardList} from 'lucide-react';
import {supabase} from '../lib/supabase';
import EmailPreference from '../components/EmailPreference';
import {countUnread,useNotifications} from '../lib/notifications';

type Props={userId:string;onReturn:()=>void;onViewRequests:()=>void;audience:'admin'|'teacher'};
function explain(error:unknown){
  if(error instanceof Error)return error.message;
  if(error&&typeof error==='object'&&'message' in error&&typeof error.message==='string')
    return error.message;
  return 'Não foi possível concluir a operação.';
}

export default function NotificationsPage({userId,onReturn,onViewRequests,audience}:Props){
  const qc=useQueryClient();
  const [notice,setNotice]=useState<{kind:'success'|'error';message:string}|null>(null);
  const data=useNotifications(userId);
  const unread=countUnread(data.data??[]);
  const invalidate=()=>void qc.invalidateQueries({queryKey:['notifications',userId]});
  const markOne=useMutation({
    mutationFn:async(id:string)=>{
      const {data:updated,error}=await supabase.rpc('mark_notification_read',{p_notification_id:id});
      if(error)throw error;
      if(!updated)throw new Error('Este aviso não pertence à sua conta ou não existe.');
    },
    onSuccess:()=>{setNotice(null);invalidate();},
    onError:error=>setNotice({kind:'error',message:explain(error)})
  });
  const markAll=useMutation({
    mutationFn:async()=>{
      const {error}=await supabase.rpc('mark_all_notifications_read');
      if(error)throw error;
    },
    onSuccess:()=>{setNotice({kind:'success',message:'Notificações marcadas como lidas.'});invalidate();},
    onError:error=>setNotice({kind:'error',message:explain(error)})
  });
  return <div className="notifications-page">
    {audience==='teacher'&&<button type="button" className="ghost notifications-back" onClick={onReturn}>
      <ArrowLeft size={17} aria-hidden="true"/> Voltar ao portal
    </button>}
    <div className="page-header">
      <span className="eyebrow">ATUALIZAÇÕES DO EDUCART</span>
      <h1>Notificações</h1>
      <p>{audience==='admin'
        ?'Avisos sobre novas solicitações de reserva e retiradas pelos professores.'
        :'Acompanhe as decisões da TI sobre suas solicitações de reserva.'}</p>
    </div>
    <EmailPreference userId={userId}/>
    <section className="panel" aria-label="Caixa de notificações">
      <div className="notifications-heading">
        <div><h2><Bell size={19} aria-hidden="true"/> Seus avisos</h2>
          <p className="form-hint">{data.isLoading?'Consultando…':unread+' notificação(ões) não lida(s)'}</p>
        </div>
        <button type="button" className="secondary" disabled={!unread||markAll.isPending}
          onClick={()=>markAll.mutate()}>
          <CheckCheck size={17} aria-hidden="true"/> {markAll.isPending?'Atualizando…':'Marcar todas como lidas'}
        </button>
      </div>
      {notice&&<Feedback kind={notice.kind}>{notice.message}</Feedback>}
      {data.isLoading?<p role="status">Carregando notificações…</p>:
        data.isError?<Feedback kind="error">Não foi possível consultar as notificações. <button type="button" className="text-button" onClick={()=>void data.refetch()}>Tentar novamente</button></Feedback>:
        !data.data?.length?<div className="empty">Não há notificações ainda. As atualizações aparecerão aqui quando houver solicitações ou decisões da TI.</div>:
        <div className="notifications-list">{data.data.map(item=><article
          className={'notification-item '+(item.read_at?'':'unread')} key={item.id}>
          <div className="notification-text">
            <div className="notification-item-heading">
              <strong>{item.title}</strong>
              {!item.read_at&&<span className="notification-new">Nova</span>}
            </div>
            <p>{item.body}</p>
            <small>{new Date(item.created_at).toLocaleString('pt-BR')}</small>
          </div>
          <div className="notification-actions">
            <button type="button" className="secondary" onClick={onViewRequests}>
              <ClipboardList size={16} aria-hidden="true"/> Abrir solicitações
            </button>
            {!item.read_at&&<button type="button" className="ghost"
              disabled={markOne.isPending||markAll.isPending}
              onClick={()=>markOne.mutate(item.id)}>Marcar como lida</button>}
          </div>
        </article>)}</div>}
      <p className="form-hint notifications-limit">Exibindo no máximo 100 avisos recentes. A lista é atualizada periodicamente enquanto o Educart está aberto.</p>
    </section>
  </div>;
}
