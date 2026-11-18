import {useEffect,useRef} from 'react';
import {ArrowLeft,Plus,RefreshCw} from 'lucide-react';
type Props={
  title:string;
  description:string;
  actionLabel:string;
  onAction:()=>void;
  editing?:boolean;
  actionKind?:'add'|'back'|'refresh';
  busy?:boolean;
};
export default function RecordsHeader({title,description,actionLabel,onAction,editing=false,actionKind=editing?'back':'add',busy=false}:Props){
  const heading=useRef<HTMLHeadingElement>(null),previous=useRef(title);
  useEffect(()=>{if(previous.current!==title){previous.current=title;heading.current?.focus();}},[title]);
  return <div className="page-header records-page-header">
    <div className="records-heading">
      {editing&&<span className="eyebrow">CADASTRO</span>}
      <h1 tabIndex={-1} ref={heading}>{title}</h1>
      <p>{description}</p>
    </div>
    <button type="button" className={actionKind==='back'?'ghost records-back':actionKind==='refresh'?'secondary':'primary records-add'} disabled={busy} onClick={onAction}>
      {actionKind==='back'?<ArrowLeft size={18} aria-hidden="true"/>:actionKind==='refresh'?<RefreshCw size={18} aria-hidden="true"/>:<Plus size={18} aria-hidden="true"/>}
      {actionLabel}
    </button>
  </div>;
}
