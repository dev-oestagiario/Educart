import {useQuery} from '@tanstack/react-query';
import {supabase} from './supabase';

export type NotificationKind='NOVO_PEDIDO'|'PEDIDO_RETIRADO'|'PEDIDO_APROVADO'|'PEDIDO_REJEITADO';
export type UserNotification={
  id:string;request_id:string;kind:NotificationKind;
  title:string;body:string;read_at:string|null;created_at:string
};
export function countUnread(items:readonly Pick<UserNotification,'read_at'>[]):number {
  return items.filter(item=>item.read_at===null).length;
}
export function useNotifications(userId:string){
  return useQuery({
    queryKey:['notifications',userId],
    enabled:Boolean(userId),
    queryFn:async():Promise<UserNotification[]>=>{
      const {data,error}=await supabase.from('user_notifications')
        .select('id,request_id,kind,title,body,read_at,created_at')
        .order('created_at',{ascending:false})
        .limit(100);
      if(error)throw error;
      return (data??[]) as UserNotification[];
    },
    refetchInterval:30000,
    staleTime:10000
  });
}
