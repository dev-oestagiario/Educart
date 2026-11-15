import {Bell} from 'lucide-react';
import {countUnread,useNotifications} from '../lib/notifications';

type Props={userId:string;onOpen:()=>void};
export default function NotificationBell({userId,onOpen}:Props){
  const notifications=useNotifications(userId);
  const unread=countUnread(notifications.data??[]);
  return <button type="button" className="notifications-trigger" onClick={()=>{
    void notifications.refetch();onOpen();
  }} aria-label={notifications.isError?'Notificações (não foi possível consultar)':
      unread>0?'Notificações, '+unread+' não lida'+(unread===1?'':'s'):'Notificações'}>
    <Bell size={20} aria-hidden="true"/>
    {unread>0&&<span className="notifications-count" aria-hidden="true">{unread>99?'99+':unread}</span>}
  </button>;
}
