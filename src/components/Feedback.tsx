import {LoaderCircle} from 'lucide-react';
import type {ReactNode} from 'react';
export function Feedback({kind,children}:{kind:'success'|'error'|'warning'|'neutral';children:ReactNode}){
 return <p className={'notice '+kind} role={kind==='error'?'alert':'status'}>{children}</p>;
}
export function LoadingState({children}:{children:ReactNode}){
 return <p className="ds-inline-status" role="status"><LoaderCircle className="ds-spinner" size={18} aria-hidden="true"/>{children}</p>;
}
export function EmptyState({children}:{children:ReactNode}){
 return <p className="empty">{children}</p>;
}
