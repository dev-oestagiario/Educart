import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Info, Laptop2 } from 'lucide-react';
import ReservationManager, {type ReservationEdit} from './ReservationManager';
import { supabase, type Cart, type Notebook, type Requester } from '../lib/supabase';
import {
  addCalendarDays, calculateAvailability, expandReservationDates, isWeekday, reservationInputSchema,
  SHIFTS, shiftLabel, showDate, todayInSaoPaulo, type Shift, type UsagePeriod
} from '../lib/reservations';

const today=todayInSaoPaulo();
let firstBookableDay=today;
while(!isWeekday(firstBookableDay))firstBookableDay=addCalendarDays(firstBookableDay,1);
async function fetchActive<T>(table:'carts'|'requesters'|'notebook_codes'):Promise<T[]>{
  const {data,error}=await supabase.from(table).select('*').eq('active',true).order('created_at',{ascending:false});
  if(error)throw error;
  return (data??[]) as T[];
}
function explainError(error:unknown):string {
  if(error&&typeof error==='object'&&'message' in error && typeof error.message==='string')
    return error.message;
  return 'Não foi possível confirmar a reserva. Tente novamente.';
}
export default function ReservationsPage() {
  const qc=useQueryClient();
  const carts=useQuery({queryKey:['carts','active'],queryFn:()=>fetchActive<Cart>('carts')});
  const teachers=useQuery({queryKey:['requesters','active'],queryFn:()=>fetchActive<Requester>('requesters')});
  const notebooks=useQuery({queryKey:['notebooks','active'],queryFn:()=>fetchActive<Notebook>('notebook_codes')});
  const [cartId,setCartId]=useState('');
  const [requesterId,setRequesterId]=useState('');
  const [reservationMode,setReservationMode]=useState<'COMPLETA'|'PARCIAL'>('COMPLETA');
  const [quantity,setQuantity]=useState('1');
  const [dateMode,setDateMode]=useState<'intervalo'|'avulsas'>('intervalo');
  const [startDate,setStartDate]=useState(firstBookableDay);
  const [endDate,setEndDate]=useState(today);
  const [specificDate,setSpecificDate]=useState(today);
  const [specificDates,setSpecificDates]=useState<string[]>([]);
  const [selectedShifts,setSelectedShifts]=useState<Shift[]>(['MATUTINO']);
  const [selectedNotebookIds,setSelectedNotebookIds]=useState<string[]>([]);
  const [needsMouse,setNeedsMouse]=useState(false);
  const [notes,setNotes]=useState('');
  const [feedback,setFeedback]=useState<{kind:'error'|'success';text:string}|null>(null);
  const [editingId,setEditingId]=useState<string|null>(null);
  const selectedCart=carts.data?.find(c=>c.id===cartId);
  const requestedQuantity=reservationMode==='COMPLETA'?(selectedCart?.capacity??0):Number(quantity);

  const dateResult=useMemo(()=>{
    try {
      return {dates:expandReservationDates(dateMode,startDate,endDate,specificDates),error:''};
    } catch(error) {
      return {dates:[] as string[],error:explainError(error)};
    }
  },[dateMode,startDate,endDate,specificDates]);
  const dates=dateResult.dates;

  const periods=useQuery({
    queryKey:['reservation-periods',cartId,dates.join(',')],
    enabled:!!cartId&&dates.length>0,
    queryFn:async():Promise<UsagePeriod[]>=>{
      const {data,error}=await supabase.from('reservation_periods')
        .select('reservation_id,usage_date,shift,quantity,active')
        .eq('cart_id',cartId).gte('usage_date',dates[0]).lte('usage_date',dates[dates.length-1])
        .eq('active',true);
      if(error)throw error;
      return (data??[]) as UsagePeriod[];
    }
  });
  const slots=useMemo(()=>calculateAvailability(
    selectedCart?.capacity??0,(periods.data??[]).filter(p=>!editingId||p.reservation_id!==editingId),dates,selectedShifts
  ),[selectedCart?.capacity,periods.data,dates,selectedShifts,editingId]);
  const blocked=!!selectedCart && slots.some(s=>s.remaining<requestedQuantity);
  const knownNotebooks=(notebooks.data??[]).filter(n=>n.cart_id===cartId);
  const periodsCount=dates.length*selectedShifts.length;

  const save=useMutation({
    mutationFn:async()=>{
      if(!selectedCart)throw new Error('Selecione um carrinho.');
      if(periods.isLoading||periods.isFetching)throw new Error('Aguarde a consulta de disponibilidade.');
      if(periods.error)throw new Error('Não foi possível verificar a disponibilidade. Tente novamente.');
      const data=reservationInputSchema.parse({
        requester_id:requesterId,cart_id:cartId,mode:reservationMode,
        quantity:requestedQuantity,dates,shifts:selectedShifts,needs_mouse:needsMouse,
        notes,notebook_ids:selectedNotebookIds
      });
      if(blocked)throw new Error('Um ou mais períodos não possuem a quantidade solicitada.');
      const args={
        p_requester_id:data.requester_id,p_cart_id:data.cart_id,
        p_mode:data.mode,p_quantity:data.quantity,p_dates:data.dates,p_shifts:data.shifts,
        p_needs_mouse:data.needs_mouse,p_notes:data.notes||null,p_notebook_ids:data.notebook_ids
      };
      const {data:reservationId,error}=editingId
        ?await supabase.rpc('update_reservation',{p_reservation_id:editingId,...args})
        :await supabase.rpc('create_reservation',args);
      if(error)throw error;
      return reservationId as string;
    },
    onSuccess:()=>{
      setFeedback({kind:'success',text:editingId?'Reserva editada e alteração registrada no histórico.':'Reserva confirmada para todos os períodos selecionados.'});
      setEditingId(null);setSelectedNotebookIds([]);setNotes('');
      refreshData();
    },
    onError:error=>setFeedback({kind:'error',text:explainError(error)})
  });

  function refreshData(){
    void qc.invalidateQueries({queryKey:['reservation-periods']});
    void qc.invalidateQueries({queryKey:['reservations']});
    void qc.invalidateQueries({queryKey:['booking-periods']});
    void qc.invalidateQueries({queryKey:['reservation-events']});
  }
  function loadForEdit(info:ReservationEdit){
    const {booking,dates:bookedDates,shifts,notebookIds}=info;
    setEditingId(booking.id);
    setRequesterId(booking.requester_id);
    setCartId(booking.cart_id);
    setReservationMode(booking.mode);
    setQuantity(String(booking.quantity));
    setDateMode('avulsas');setSpecificDates(bookedDates);
    setStartDate(bookedDates[0]??firstBookableDay);
    setEndDate(bookedDates[bookedDates.length-1]??firstBookableDay);
    setSelectedShifts(shifts);
    setSelectedNotebookIds(notebookIds);
    setNeedsMouse(booking.needs_mouse);
    setNotes(booking.notes??'');
    setFeedback(null);
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function submit(event:FormEvent) {
    event.preventDefault();setFeedback(null);save.mutate();
  }
  function toggleShift(shift:Shift,checked:boolean) {
    setSelectedShifts(prev=>checked?[...prev,shift]:prev.filter(s=>s!==shift));
    setFeedback(null);
  }
  function addSpecificDate(){
    if(!isWeekday(specificDate)){setFeedback({kind:'error',text:'Só é possível selecionar datas de segunda a sexta.'});return;}
    if(specificDate<today){setFeedback({kind:'error',text:'Escolha uma data a partir de hoje.'});return;}
    setSpecificDates(prev=>[...new Set([...prev,specificDate])].sort());
    setFeedback(null);
  }
  function toggleNotebook(id:string,checked:boolean){
    setSelectedNotebookIds(prev=>checked?[...prev,id]:prev.filter(x=>x!==id));
  }
  const requestedValid=Number.isInteger(requestedQuantity)&&requestedQuantity>=1
    &&!!selectedCart&&requestedQuantity<=selectedCart.capacity;
  const showPreview=!!selectedCart&&dates.length>0&&selectedShifts.length>0;

  return <div className="reservation-page">
    <div className="page-header"><h1>Reservas</h1>
      <p>Organize carrinhos e notebooks por data e turno, com disponibilidade atualizada no Supabase.</p>
    </div>
    <div className="panel muted-panel reservation-hint"><Info size={20} aria-hidden="true"/>
      <p>Reservas completas ocupam todas as unidades do carrinho no turno. Reservas parciais deixam o saldo disponível para outros professores. O sistema não permite conflitos na confirmação.</p>
    </div>
    <div className="reservation-layout">
      <section className="panel" aria-labelledby="reservation-form-title">
        <h2 id="reservation-form-title">{editingId?'Editar reserva':'Nova reserva'}</h2>
        <form onSubmit={submit} className="form-stack">
          <label className="field" htmlFor="reservation-requester"><span>Professor solicitante</span>
            <select id="reservation-requester" value={requesterId} required onChange={e=>setRequesterId(e.target.value)}>
              <option value="">Selecione um professor</option>
              {(teachers.data??[]).map(t=><option value={t.id} key={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="field" htmlFor="reservation-cart"><span>Carrinho</span>
            <select id="reservation-cart" value={cartId} required onChange={e=>{
              setCartId(e.target.value);setSelectedNotebookIds([]);setFeedback(null);
            }}>
              <option value="">Selecione um carrinho</option>
              {(carts.data??[]).map(c=><option value={c.id} key={c.id}>{c.name} — {c.capacity} notebooks</option>)}
            </select>
          </label>
          {(carts.error||teachers.error||notebooks.error)&&<p className="notice error" role="alert">Não foi possível consultar todos os cadastros. Atualize a página.</p>}
          <fieldset className="reservation-fieldset">
            <legend>Modalidade</legend>
            <label><input type="radio" name="reservation-type" checked={reservationMode==='COMPLETA'} onChange={()=>setReservationMode('COMPLETA')}/> Carrinho completo</label>
            <label><input type="radio" name="reservation-type" checked={reservationMode==='PARCIAL'} onChange={()=>setReservationMode('PARCIAL')}/> Notebooks avulsos</label>
          </fieldset>
          {reservationMode==='PARCIAL'?<label className="field" htmlFor="reservation-quantity"><span>Quantidade de notebooks</span>
            <input id="reservation-quantity" type="number" min={1} max={selectedCart?.capacity??1} required value={quantity} onChange={e=>setQuantity(e.target.value)}/>
          </label>:<p className="reservation-subtle">Reserva completa: <strong>{selectedCart?.capacity??'—'} notebooks</strong> por turno.</p>}
          <fieldset className="reservation-fieldset">
            <legend>Turnos</legend>
            <div className="reservation-options">{SHIFTS.map(shift=><label key={shift}>
              <input type="checkbox" checked={selectedShifts.includes(shift)} onChange={e=>toggleShift(shift,e.target.checked)}/>
              {shiftLabel[shift]}
            </label>)}</div>
          </fieldset>
          <label className="field" htmlFor="date-mode"><span>Escolha das datas</span>
            <select id="date-mode" value={dateMode} onChange={e=>{setDateMode(e.target.value as 'intervalo'|'avulsas');setFeedback(null)}}>
              <option value="intervalo">Intervalo contínuo (semana ou mês)</option>
              <option value="avulsas">Dias específicos</option>
            </select>
          </label>
          {dateMode==='intervalo'?<div className="reservation-dates">
            <label className="field" htmlFor="reservation-start"><span>Data inicial</span>
              <input type="date" id="reservation-start" value={startDate} min={today} onChange={e=>setStartDate(e.target.value)}/>
            </label>
            <label className="field" htmlFor="reservation-end"><span>Data final</span>
              <input type="date" id="reservation-end" value={endDate} min={startDate||today} onChange={e=>setEndDate(e.target.value)}/>
            </label>
          </div>:<>
            <div className="reservation-dates">
              <label className="field" htmlFor="reservation-specific"><span>Adicionar dia</span>
                <input id="reservation-specific" type="date" value={specificDate} min={today} onChange={e=>setSpecificDate(e.target.value)}/>
              </label>
              <button className="secondary" type="button" onClick={addSpecificDate}>Adicionar data</button>
            </div>
            <div className="reservation-pills" aria-label="Datas adicionadas">
              {specificDates.map(date=><button type="button" className="reservation-pill" key={date} onClick={()=>setSpecificDates(prev=>prev.filter(d=>d!==date))} aria-label={'Remover '+showDate(date)}>{showDate(date)} ×</button>)}
              {!specificDates.length&&<p className="reservation-subtle">Adicione uma ou mais datas.</p>}
            </div>
          </>}
          <p className="form-hint">Somente segunda a sexta. Feriados são incluídos normalmente.</p>
          {dateResult.error&&<p role="alert" className="notice error">{dateResult.error}</p>}
          <fieldset className="reservation-fieldset">
            <legend>Notebooks identificados (opcional)</legend>
            <p className="form-hint">Escolha os códigos conhecidos. Você pode reservar sem identificar todos os notebooks.</p>
            {cartId&&!knownNotebooks.length&&<p className="reservation-subtle">Nenhum código individual cadastrado neste carrinho.</p>}
            <div className="reservation-notebooks">{knownNotebooks.map(n=><label key={n.id}>
              <input type="checkbox" checked={selectedNotebookIds.includes(n.id)} onChange={e=>toggleNotebook(n.id,e.target.checked)}/>
              <span>{n.code}</span>
            </label>)}</div>
          </fieldset>
          <label className="reservation-check"><input type="checkbox" checked={needsMouse} onChange={e=>setNeedsMouse(e.target.checked)}/>
            Precisa de mouse (avisar a TI)
          </label>
          <label className="field" htmlFor="reservation-notes"><span>Observações (opcional)</span>
            <textarea id="reservation-notes" rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Informações para preparar os equipamentos"/>
          </label>
          <p className="reservation-subtle">Esta reserva terá <strong>{dates.length} dia(s)</strong>, <strong>{selectedShifts.length} turno(s)</strong> e <strong>{periodsCount} período(s)</strong>.</p>
          {feedback&&<p className={'notice '+feedback.kind} role={feedback.kind==='error'?'alert':'status'}>{feedback.text}</p>}
          <button className="primary" type="submit"
            disabled={!requesterId||!cartId||!requestedValid||!dates.length||!selectedShifts.length||blocked||periods.isFetching||save.isPending}>
            {save.isPending?'Salvando…':editingId?'Salvar alterações':'Confirmar reserva'}
          </button>
          {editingId&&<button type="button" className="ghost"
            onClick={()=>{setEditingId(null);setFeedback(null);setSelectedNotebookIds([]);}}>
            Cancelar edição
          </button>}
        </form>
      </section>
      <div className="reservation-side">
        <section className="panel" aria-labelledby="availability-title">
          <h2 id="availability-title"><Laptop2 size={19} aria-hidden="true"/> Disponibilidade por turno</h2>
          {!showPreview?<p className="empty">Escolha carrinho, datas e turnos para consultar a disponibilidade.</p>:
            periods.isLoading||periods.isFetching?<p role="status">Consultando disponibilidade…</p>:
            periods.error?<p role="alert" className="notice error">Falha ao consultar os períodos. Não confirme antes de atualizar.</p>:
            <><p className="reservation-subtle">Capacidade do carrinho: <strong>{selectedCart.capacity}</strong> notebooks em cada período.</p>
              <div className="reservation-table-wrap"><table className="reservation-table">
                <thead><tr><th>Data</th><th>Turno</th><th>Livres</th><th>Situação</th></tr></thead>
                <tbody>{slots.map(slot=><tr key={slot.date+'-'+slot.shift}>
                  <td>{showDate(slot.date)}</td><td>{shiftLabel[slot.shift]}</td><td>{slot.remaining}/{slot.capacity}</td>
                  <td><span className={slot.remaining<requestedQuantity?'reservation-status unavailable':'reservation-status available'}>
                    {slot.remaining<requestedQuantity?'Conflito':'Disponível'}
                  </span></td>
                </tr>)}</tbody>
              </table></div>
              {blocked&&<p className="notice error" role="alert">Há períodos sem capacidade suficiente. Ajuste as datas, o turno, a quantidade ou o carrinho.</p>}
            </>}
        </section>
        <ReservationManager carts={carts.data??[]} requesters={teachers.data??[]}
          onEdit={loadForEdit} onChanged={()=>{setEditingId(null);refreshData()}}/>
        <div className="reservation-side-note"><CalendarDays size={18} aria-hidden="true"/>
          <p>A confirmação reserva todos os períodos de uma vez. Se algum turno já estiver ocupado, nada será registrado.</p>
        </div>
      </div>
    </div>
  </div>;
}
