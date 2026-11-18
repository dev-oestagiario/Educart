import {ChevronRight} from 'lucide-react';
import {useEffect,useRef,type ReactNode} from 'react';
export function RecordTrail({module,section,current,onBack,busy=false}:{module:string;section?:string;current:string;onBack:()=>void;busy?:boolean}){
 return <nav className="record-trail" aria-label="Caminho de navegação"><button type="button" className="text-button" disabled={busy} onClick={onBack}>{module}</button>{section&&<><ChevronRight size={14} aria-hidden="true"/><span>{section}</span></>}<ChevronRight size={14} aria-hidden="true"/><span aria-current="page">{current}</span></nav>;
}
export function RecordDetail({title,children,actions}:{title:string;children:ReactNode;actions?:ReactNode}){
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus();},[title]);
 return <section className="panel records-form-panel record-detail"><h2 tabIndex={-1} ref={heading}>{title}</h2>{children}{actions&&<div className="records-form-actions">{actions}</div>}</section>;
}
export function DetailFields({fields}:{fields:{label:string;value:ReactNode}[]}){
 return <dl className="record-detail-fields">{fields.map(({label,value})=><div key={label}><dt>{label}</dt><dd>{value??'Não informado'}</dd></div>)}</dl>;
}
