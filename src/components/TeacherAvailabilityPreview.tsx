import {useQuery} from '@tanstack/react-query';
import {BarChart3,CalendarCheck2,Info,RefreshCw} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {parseAvailabilitySlots,summarizeAvailability,slotDescription} from '../lib/availabilityPreview';
import type {Shift} from '../lib/reservations';

type Props={
  cartId:string;
  dates:string[];
  shifts:Shift[];
  quantity:number;
};

export default function TeacherAvailabilityPreview({cartId,dates,shifts,quantity}:Props){
  const validSelection=Boolean(cartId)&&dates.length>0&&shifts.length>0;
  const preview=useQuery({
    queryKey:['teacher-availability',cartId,dates.join(','),shifts.join(',')],
    enabled:validSelection,
    queryFn:async()=>{
      const {data,error}=await supabase.rpc('preview_teacher_availability',{
        p_cart_id:cartId,p_dates:dates,p_shifts:shifts
      });
      if(error)throw error;
      return parseAvailabilitySlots(data,dates,shifts);
    },
    staleTime:15_000,
    refetchInterval:60_000,
    refetchOnWindowFocus:true
  });
  const slots=preview.data??[];
  const summary=summarizeAvailability(slots,quantity);
  const validQuantity=Number.isInteger(quantity)&&quantity>0;
  return <section className="teacher-availability" aria-labelledby="teacher-availability-heading">
    <div className="teacher-availability-heading">
      <h3 id="teacher-availability-heading"><BarChart3 size={18} aria-hidden="true"/> Prévia de disponibilidade</h3>
      <button type="button" className="ghost teacher-availability-reload" disabled={!validSelection||preview.isFetching}
        onClick={()=>void preview.refetch()} aria-label="Atualizar prévia de disponibilidade">
        <RefreshCw size={16} aria-hidden="true"/> Atualizar
      </button>
    </div>
    {!validSelection?
      <p className="form-hint">Escolha carrinho, datas e turnos para consultar o saldo disponível.</p>:
      preview.isPending?<p role="status" className="form-hint">Consultando a ocupação por dia e turno…</p>:
      preview.isError?<div role="alert" className="notice error">
        Não foi possível consultar o saldo agora. Você ainda pode enviar o pedido; a TI verificará a disponibilidade antes de aprovar.
      </div>:
      <>
        <div className="teacher-availability-summary" role="status">
          <CalendarCheck2 size={18} aria-hidden="true"/>
          {validQuantity?
            <p><strong>{summary.withEnough} de {summary.total} períodos</strong> possuem saldo estimado para {quantity} notebook(s).</p>:
            <p>Informe uma quantidade válida para comparar o saldo disponível.</p>}
        </div>
        {validQuantity&&summary.insufficient.length>0&&<div className="teacher-availability-warning">
          <strong>Saldo abaixo do solicitado em {summary.insufficient.length} período(s).</strong>
          <p>Você pode ajustar datas, turnos ou quantidade. O pedido ainda pode ser enviado para avaliação da TI.</p>
          <ul>{summary.insufficient.slice(0,8).map(slot=>
            <li key={slot.usage_date+'-'+slot.shift}>{slotDescription(slot)}: {slot.remaining} disponível(is) de {slot.capacity}</li>)}</ul>
          {summary.insufficient.length>8&&<p>Há mais {summary.insufficient.length-8} períodos com saldo insuficiente na lista completa.</p>}
        </div>}
        <details className="teacher-availability-details">
          <summary>Ver saldo por data e turno ({slots.length})</summary>
          <div className="teacher-availability-table-wrap">
            <table><thead><tr><th>Dia e turno</th><th>Capacidade</th><th>Reservados</th><th>Disponíveis</th></tr></thead>
              <tbody>{slots.map(slot=><tr key={slot.usage_date+'-'+slot.shift}>
                <th scope="row">{slotDescription(slot)}</th><td>{slot.capacity}</td><td>{slot.reserved}</td><td>{slot.remaining}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </details>
      </>
    }
    <p className="teacher-availability-disclaimer"><Info size={16} aria-hidden="true"/>
      Esta é uma consulta informativa. Pedidos pendentes não reduzem o saldo e a aprovação depende de nova verificação pela TI.</p>
  </section>;
}
