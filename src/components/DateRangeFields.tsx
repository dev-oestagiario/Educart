import {X} from 'lucide-react';
type Props={id:string;start:string;end:string;min?:string;disabled?:boolean;onChange:(start:string,end:string)=>void};
export default function DateRangeFields({id,start,end,min,disabled,onChange}:Props){
 return <div className="educart-date-range">
  <label className="field" htmlFor={id+'-start'}><span>Data inicial</span><input id={id+'-start'} type="date" required min={min} disabled={disabled} value={start} onChange={e=>{const next=e.target.value;onChange(next,end&&end<next?'':end);}}/></label>
  <label className="field" htmlFor={id+'-end'}><span>Data final (opcional)</span><span className="date-range-end"><input id={id+'-end'} type="date" min={start||min} disabled={disabled} value={end} onChange={e=>onChange(start,e.target.value)}/>{end&&<button type="button" className="ghost date-range-clear" disabled={disabled} onClick={()=>onChange(start,'')} aria-label="Limpar data final"><X size={16} aria-hidden="true"/></button>}</span></label>
 </div>;
}
