import {ArrowLeft,Plus} from 'lucide-react';
type Props={
  title:string;
  description:string;
  actionLabel:string;
  onAction:()=>void;
  editing?:boolean;
};
export default function RecordsHeader({title,description,actionLabel,onAction,editing=false}:Props){
  return <div className="page-header records-page-header">
    <div className="records-heading">
      {editing&&<span className="eyebrow">CADASTRO</span>}
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    <button type="button" className={editing?'ghost records-back':'primary records-add'} onClick={onAction}>
      {editing?<ArrowLeft size={18} aria-hidden="true"/>:<Plus size={18} aria-hidden="true"/>}
      {actionLabel}
    </button>
  </div>;
}
