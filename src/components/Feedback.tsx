import {LoaderCircle,CheckCircle2,AlertCircle,AlertTriangle,Info,X} from 'lucide-react';
import {useEffect,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
export type FeedbackKind='success'|'error'|'warning'|'neutral';
const icons={success:CheckCircle2,error:AlertCircle,warning:AlertTriangle,neutral:Info};
export function Feedback({kind,children}:{kind:FeedbackKind;children:ReactNode}){
 const [dismissed,setDismissed]=useState(false),[paused,setPaused]=useState(false);
 const message=typeof children==='string'?children:undefined;
 useEffect(()=>setDismissed(false),[kind,message]);
 useEffect(()=>{
  if(kind!=='success'||paused||dismissed)return;
  const timer=window.setTimeout(()=>setDismissed(true),6500);
  return ()=>window.clearTimeout(timer);
 },[kind,message,paused,dismissed]);
 if(dismissed)return null;
 const Icon=icons[kind];
 const content=<div className={'educart-toast toast-'+kind} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPaused(false)}}>
  <Icon className="toast-icon" size={19} aria-hidden="true"/>
  <div className="toast-text" role={kind==='error'?'alert':'status'}>{children}</div>
  <button type="button" className="toast-close" aria-label="Fechar aviso" onClick={()=>setDismissed(true)}><X size={17} aria-hidden="true"/></button>
 </div>;
 const target=typeof document==='undefined'?null:document.getElementById('educart-toasts');
 return target?createPortal(content,target):content;
}
export function LoadingState({children}:{children:ReactNode}){
 return <p className="ds-inline-status" role="status"><LoaderCircle className="ds-spinner" size={18} aria-hidden="true"/>{children}</p>;
}
export function EmptyState({children}:{children:ReactNode}){
 return <p className="empty">{children}</p>;
}
