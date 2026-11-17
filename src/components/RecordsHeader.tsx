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
  return <div className="page-header records-page-header">
    <div className="records-heading">
      {editing&&<span className="eyebrow">CADASTRO</span>}
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    <button type="button" className={actionKind==='back'?'ghost records-back':actionKind==='refresh'?'secondary':'primary records-add'} disabled={busy} onClick={onAction}>
      {actionKind==='back'?<ArrowLeft size={18} aria-hidden="true"/>:actionKind==='refresh'?<RefreshCw size={18} aria-hidden="true"/>:<Plus size={18} aria-hidden="true"/>}
      {actionLabel}
    </button>
  </div>;
}
