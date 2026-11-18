import {Feedback} from '../components/Feedback';
import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Info, Laptop2, Plus } from 'lucide-react';
import WeeklyRecurrence from '../components/WeeklyRecurrence';
import {defaultWeeklyPattern,expandWeeklyPattern} from '../lib/recurrence';
import ReservationDatePicker from '../components/ReservationDatePicker';
import type {ReservationDateSelection,ReservationDateMode} from '../lib/reservationDatePicker';
import {useLocations,roomOptions} from '../lib/locations';
import {useMaintenanceWindows,applyMaintenance} from '../lib/maintenance';
import ReservationManager, {type ReservationEdit} from './ReservationManager';
import { supabase, type Cart, type Notebook, type Requester } from '../lib/supabase';
import {
  addCalendarDays, calculateAvailability, expandReservationDates, isWeekday, reservationInputSchema,
  SHIFTS, shiftLabel, showDate, todayInSaoPaulo, type Shift, type UsagePeriod
} from '../lib/reservations';

import {fetchCatalogRows} from '../lib/catalog';
import {invalidateReservationViews} from '../lib/queryRefresh';
function bookableDay(today:string){while(!isWeekday(today))today=addCalendarDays(today,1);return today;}
function explainError(error:unknown):string {
  if(error&&typeof error==='object'&&'message' in error && typeof error.message==='string')
    return error.message;
  return 'Não foi possível confirmar a reserva. Tente novamente.';
}
export default function ReservationsPage() {
  const qc=useQueryClient();
  const today=todayInSaoPaulo(),firstBookableDay=bookableDay(today);
  const locations=useLocations();
  const roomList=roomOptions(locations.data);
  const [roomId,setRoomId]=useState(''),[oldRoom,setOldRoom]=useState('');
  const carts=useQuery({queryKey:['carts','active'],queryFn:()=>fetchCatalogRows<Cart>('carts',true)});
  const teachers=useQuery({queryKey:['requesters','active'],queryFn:()=>fetchCatalogRows<Requester>('requesters',true)});

  const [screen,setScreen]=useState<'list'|'form'>('list');
  const [cartId,setCartId]=useState('');
  const [requesterId,setRequesterId]=useState('');
  const [reservationMode,setReservationMode]=useState<'COMPLETA'|'PARCIAL'>('COMPLETA');
  const [quantity,setQuantity]=useState('1');
  const [weekly,setWeekly]=useState(false);
  const [pattern,setPattern]=useState(()=>defaultWeeklyPattern(firstBookableDay));
  const [dateMode,setDateMode]=useState<ReservationDateMode>('single');
  const [startDate,setStartDate]=useState(firstBookableDay);
  const [endDate,setEndDate]=useState(firstBookableDay);
  const [specificDates,setSpecificDates]=useState<string[]>([]);
  const [selectedShifts,setSelectedShifts]=useState<Shift[]>(['MATUTINO']);
  const [selectedNotebookIds,setSelectedNotebookIds]=useState<string[]>([]);
  const [needsMouse,setNeedsMouse]=useState(false);
  const [notes,setNotes]=useState('');
  const [feedback,setFeedback]=useState<{kind:'error'|'success';text:string}|null>(null);
  const [editingId,setEditingId]=useState<string|null>(null);
  const notebooks=useQuery({queryKey:['notebooks','active',cartId],enabled:screen==='form'&&!!cartId&&reservationMode==='PARCIAL',queryFn:()=>fetchCatalogRows<Notebook>('notebook_codes',true,cartId)});
  const selectedCart=carts.data?.find(c=>c.id===cartId);
  const requestedQuantity=reservationMode==='COMPLETA'?(selectedCart?.capacity??0):Number(quantity);

  const dateResult=useMemo(()=>{
    try {
      return {dates:weekly?expandWeeklyPattern(pattern,todayInSaoPaulo()):expandReservationDates(dateMode==='multiple'?'avulsas':'intervalo',startDate,dateMode==='single'?startDate:endDate,specificDates),error:''};
    } catch(error) {
      return {dates:[] as string[],error:explainError(error)};
    }
  },[weekly,pattern,dateMode,startDate,endDate,specificDates,today]);
  const dates=dateResult.dates;
  const maintenance=useMaintenanceWindows(cartId,screen==='form'?dates[0]??'':'',screen==='form'?dates[dates.length-1]??'':'');

  const periods=useQuery({
    queryKey:['reservation-periods',cartId,dates.join(',')],
    enabled:screen==='form'&&!!cartId&&dates.length>0,
    queryFn:async():Promise<UsagePeriod[]>=>{
      const result:UsagePeriod[]=[];
      for(let offset=0;;offset+=250){
        const {data,error}=await supabase.from('reservation_periods')
          .select('reservation_id,usage_date,shift,quantity,active')
          .eq('cart_id',cartId).gte('usage_date',dates[0]).lte('usage_date',dates[dates.length-1])
          .eq('active',true).order('id').range(offset,offset+249);
        if(error)throw error;
        const page=(data??[]) as UsagePeriod[];
        result.push(...page);if(page.length<250)return result;
      }
    }
  });
  const slots=useMemo(()=>applyMaintenance(calculateAvailability(
    selectedCart?.capacity??0,(periods.data??[]).filter(p=>!editingId||p.reservation_id!==editingId),dates,selectedShifts
  ),maintenance.data??[],cartId),[selectedCart?.capacity,periods.data,dates,selectedShifts,editingId,maintenance.data,cartId]);
  const blocked=!!selectedCart && slots.some(s=>s.remaining<requestedQuantity);
  const knownNotebooks=(notebooks.data??[]).filter(n=>n.cart_id===cartId);
  const periodsCount=dates.length*selectedShifts.length;

  const save=useMutation({
    mutationFn:async()=>{
      if(!selectedCart)throw new Error('Selecione um carrinho.');
      if(periods.isLoading||periods.isFetching||maintenance.isLoading||maintenance.isFetching)throw new Error('Aguarde a consulta de disponibilidade.');
      if(periods.error||maintenance.error)throw new Error('Não foi possível verificar a disponibilidade. Tente novamente.');
      const checkedDates=weekly?expandWeeklyPattern(pattern,todayInSaoPaulo()):expandReservationDates(dateMode==='multiple'?'avulsas':'intervalo',startDate,dateMode==='single'?startDate:endDate,specificDates,todayInSaoPaulo());
      const data=reservationInputSchema.parse({
        requester_id:requesterId,cart_id:cartId,mode:reservationMode,
        quantity:requestedQuantity,dates:checkedDates,shifts:selectedShifts,needs_mouse:needsMouse,
        notes,notebook_ids:reservationMode==='PARCIAL'?selectedNotebookIds:[]
      });
      if(blocked)throw new Error('Um ou mais períodos não possuem a quantidade solicitada.');
      const args={
        p_requester_id:data.requester_id,p_cart_id:data.cart_id,
        p_mode:data.mode,p_quantity:data.quantity,p_dates:data.dates,p_shifts:data.shifts,
        p_needs_mouse:data.needs_mouse,p_notes:data.notes||null,p_notebook_ids:data.notebook_ids
      };
      const withRoom=!!roomId||!!oldRoom;
      const {data:reservationId,error}=editingId
        ?withRoom?await supabase.rpc('update_reservation_with_room',{p_reservation_id:editingId,...args,p_room_id:roomId||null}):await supabase.rpc('update_reservation',{p_reservation_id:editingId,...args})
        :withRoom?await supabase.rpc('create_reservation_with_room',{...args,p_room_id:roomId||null}):await supabase.rpc('create_reservation',args);
      if(error)throw error;
      return reservationId as string;
    },
    onSuccess:()=>{
      setFeedback({kind:'success',text:editingId?'Reserva editada e alteração registrada no histórico.':'Reserva confirmada para todos os períodos selecionados.'});
      setEditingId(null);setScreen('list');setSelectedNotebookIds([]);setNotes('');
      refreshData();
    },
    onError:error=>setFeedback({kind:'error',text:explainError(error)})
  });

  function refreshData(){
    void invalidateReservationViews(qc);
  }
  function loadForEdit(info:ReservationEdit){
    const {booking,dates:bookedDates,shifts,notebookIds}=info;
    setEditingId(booking.id);setRoomId(booking.destination_room_id??'');setOldRoom(booking.destination_room_id??'');
    setRequesterId(booking.requester_id);
    setCartId(booking.cart_id);
    setReservationMode(booking.mode);
    setQuantity(String(booking.quantity));
    setWeekly(false);setPattern(defaultWeeklyPattern(firstBookableDay));
    setDateMode('multiple');setSpecificDates(bookedDates);
    setStartDate(bookedDates[0]??firstBookableDay);
    setEndDate(bookedDates[bookedDates.length-1]??firstBookableDay);
    setSelectedShifts(shifts);
    setSelectedNotebookIds(notebookIds);
    setNeedsMouse(booking.needs_mouse);
    setNotes(booking.notes??'');
    setFeedback(null);setScreen('form');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function submit(event:FormEvent) {
    event.preventDefault();if(save.isPending)return;setFeedback(null);save.mutate();
  }
  function toggleShift(shift:Shift,checked:boolean) {
    setSelectedShifts(prev=>checked?[...prev,shift]:prev.filter(s=>s!==shift));
    setFeedback(null);
  }
  function openNew(){
    setEditingId(null);setCartId('');setRequesterId('');setRoomId('');setOldRoom('');
    setReservationMode('COMPLETA');setQuantity('1');
    setWeekly(false);setPattern(defaultWeeklyPattern(firstBookableDay));
    setDateMode('single');setStartDate(firstBookableDay);setEndDate(firstBookableDay);setSpecificDates([]);
    setSelectedShifts(['MATUTINO']);setSelectedNotebookIds([]);
    setNeedsMouse(false);setNotes('');setFeedback(null);
    setScreen('form');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function updateDates(next:ReservationDateSelection){
    setDateMode(next.mode);
    setStartDate(next.startDate);setEndDate(next.endDate);setSpecificDates(next.specificDates);
    setFeedback(null);
  }
  function returnToList(){
    if(save.isPending)return;
    setEditingId(null);setFeedback(null);setScreen('list');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function toggleNotebook(id:string,checked:boolean){
    setSelectedNotebookIds(prev=>checked?[...prev,id]:prev.filter(x=>x!==id));
  }
  const requestedValid=Number.isInteger(requestedQuantity)&&requestedQuantity>=1
    &&!!selectedCart&&requestedQuantity<=selectedCart.capacity;
  const showPreview=!!selectedCart&&dates.length>0&&selectedShifts.length>0;

  return <div className="reservation-page">
    {screen==='list'?<>
      <div className="page-header reservation-list-page-header">
        <div>
          <span className="eyebrow">GESTÃO DE LABORATÓRIOS</span>
          <h1>Reservas</h1>
          <p>Consulte as reservas, edite os agendamentos e acompanhe o histórico de alterações.</p>
        </div>
        <button type="button" className="primary reservation-new-button" onClick={openNew}>
          <Plus size={18} aria-hidden="true"/> Nova reserva
        </button>
      </div>
      {feedback&&<Feedback kind={feedback.kind}>{feedback.text}</Feedback>}
      <ReservationManager carts={carts.data??[]} requesters={teachers.data??[]}
        onEdit={loadForEdit} onChanged={()=>{setEditingId(null);refreshData()}}/>
    </>:<>
      <button type="button" className="ghost reservation-back" disabled={save.isPending} onClick={returnToList}>
        <ArrowLeft size={18} aria-hidden="true"/> Voltar para reservas
      </button>
      <div className="page-header reservation-form-page-header">
        <span className="eyebrow">{editingId?'ALTERAR AGENDAMENTO':'NOVO AGENDAMENTO'}</span>
        <h1>{editingId?'Editar reserva':'Nova reserva'}</h1>
        <p>Defina os equipamentos, escolha as datas no calendário e confirme a reserva.</p>
      </div>
      <section className="panel reservation-form-panel" aria-labelledby="reservation-form-title">
        <h2 id="reservation-form-title">Dados da reserva</h2>
        <form onSubmit={submit} className="form-stack reservation-form-stack">
          <div className="reservation-form-columns">
            <label className="field" htmlFor="reservation-requester"><span>Professor solicitante</span>
              <select id="reservation-requester" value={requesterId} required onChange={e=>setRequesterId(e.target.value)}>
                <option value="">Selecione um professor</option>
                {(teachers.data??[]).map(t=><option value={t.id} key={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="field" htmlFor="reservation-cart"><span>Laboratório móvel</span>
              <select id="reservation-cart" value={cartId} required onChange={e=>{
                setCartId(e.target.value);setSelectedNotebookIds([]);setFeedback(null);
              }}>
                <option value="">Selecione um carrinho</option>
                {(carts.data??[]).map(c=><option value={c.id} key={c.id}>{c.name} — {c.capacity} notebooks</option>)}
              </select>
            </label>
          </div>
          {(carts.error||teachers.error||notebooks.error)&&
            <Feedback kind="error">Não foi possível consultar todos os cadastros. Atualize a página.</Feedback>}
          <fieldset className="reservation-fieldset">
            <legend>O que deseja reservar?</legend>
            <div className="reservation-options reservation-type-options">
              <label><input type="radio" name="reservation-type" checked={reservationMode==='COMPLETA'}
                onChange={()=>{setReservationMode('COMPLETA');setSelectedNotebookIds([]);}}/> Carrinho completo</label>
              <label><input type="radio" name="reservation-type" checked={reservationMode==='PARCIAL'}
                onChange={()=>setReservationMode('PARCIAL')}/> Notebooks avulsos</label>
            </div>
          </fieldset>
          {reservationMode==='PARCIAL'?
            <label className="field reservation-quantity" htmlFor="reservation-quantity"><span>Quantidade de notebooks</span>
              <input id="reservation-quantity" type="number" min={1} max={selectedCart?.capacity??1}
                required value={quantity} onChange={e=>setQuantity(e.target.value)}/>
            </label>:
            <p className="reservation-subtle">O carrinho completo reserva <strong>{selectedCart?.capacity??'—'} notebooks</strong> em cada turno escolhido.</p>}
          <fieldset className="reservation-fieldset">
            <legend>Turnos</legend>
            <div className="reservation-options">{SHIFTS.map(shift=><label key={shift}>
              <input type="checkbox" checked={selectedShifts.includes(shift)} onChange={e=>toggleShift(shift,e.target.checked)}/>
              {shiftLabel[shift]}
            </label>)}</div>
          </fieldset>
          <div className="weekly-mode-toggle" role="group" aria-label="Forma de escolher as datas">
            <button type="button" className={weekly?'secondary':'primary'} aria-pressed={!weekly} disabled={save.isPending} onClick={()=>{if(weekly){setSpecificDates(dates);setDateMode('multiple');setWeekly(false);setFeedback(null);}}}>Calendário</button>
            <button type="button" className={weekly?'primary':'secondary'} aria-pressed={weekly} disabled={save.isPending} onClick={()=>{if(!weekly){setPattern(defaultWeeklyPattern(firstBookableDay));setWeekly(true);setFeedback(null);}}}>Repetir semanalmente</button>
          </div>
          {weekly?<WeeklyRecurrence id="reservation-weekly" value={pattern} today={todayInSaoPaulo()} shifts={selectedShifts.length} disabled={save.isPending} onChange={p=>{setPattern(p);setFeedback(null);}}/>:
          <ReservationDatePicker value={{mode:dateMode,startDate,endDate,specificDates}} selectedDates={dates} onChange={updateDates} minDate={today}/>}
          {editingId&&weekly&&<p className="form-hint">O padrão substituirá as datas do agrupamento em edição. Períodos já utilizados continuam protegidos pelas regras existentes.</p>}
          {!weekly&&dateResult.error&&<Feedback kind="error">{dateResult.error}</Feedback>}
          {reservationMode==='PARCIAL'&&<fieldset className="reservation-fieldset">
            <legend>Notebooks identificados (opcional)</legend>
            <p className="form-hint">Selecione os códigos conhecidos. Também é possível reservar notebooks sem identificar todos.</p>
            {notebooks.isFetching&&<p role="status">Consultando códigos…</p>}
            {cartId&&!notebooks.isFetching&&!notebooks.error&&!knownNotebooks.length&&<p className="reservation-subtle">Nenhum código individual cadastrado neste carrinho.</p>}
            {selectedNotebookIds.length>requestedQuantity&&<Feedback kind="warning">A quantidade de códigos selecionados excede a quantidade solicitada. Remova códigos ou aumente a quantidade.</Feedback>}
            <div className="reservation-notebooks">{knownNotebooks.map(n=><label key={n.id}>
              <input type="checkbox" checked={selectedNotebookIds.includes(n.id)} disabled={!selectedNotebookIds.includes(n.id)&&selectedNotebookIds.length>=requestedQuantity}
                onChange={e=>toggleNotebook(n.id,e.target.checked)}/>
              <span>{n.code}</span>
            </label>)}</div>
          </fieldset>}
          <label className="reservation-check"><input type="checkbox" checked={needsMouse} onChange={e=>setNeedsMouse(e.target.checked)}/>
            Precisa de mouse (avisar a TI)
          </label>
          <label className="field" htmlFor="reservation-room"><span>Sala de utilização (opcional)</span>
            <select id="reservation-room" value={roomId} onChange={e=>setRoomId(e.target.value)} disabled={locations.isLoading||!!locations.error}>
              <option value="">Não informada</option>{roomList.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
              {roomId&&!roomList.some(r=>r.id===roomId)&&<option value={roomId}>Local anterior (inativo)</option>}
            </select></label>
          {locations.error&&<p className="form-hint">Cadastro de salas indisponível. A reserva sem sala continua disponível.</p>}
          <label className="field" htmlFor="reservation-notes"><span>Observações (opcional)</span>
            <textarea id="reservation-notes" rows={3} maxLength={1000} value={notes}
              onChange={e=>setNotes(e.target.value)} placeholder="Informações para preparar os equipamentos"/>
          </label>
          <div className="reservation-form-summary">
            <CalendarDays size={18} aria-hidden="true"/>
            <span><strong>{dates.length} dia(s)</strong> · <strong>{selectedShifts.length} turno(s)</strong> ·
              <strong> {periodsCount} período(s)</strong></span>
          </div>
          <details className="reservation-form-availability" open>
            <summary><Laptop2 size={18} aria-hidden="true"/> Ver disponibilidade por turno</summary>
            {!showPreview?<p className="form-hint">Selecione carrinho, datas e turnos para verificar o saldo.</p>:
              periods.isLoading||periods.isFetching||maintenance.isLoading||maintenance.isFetching?<p role="status">Consultando disponibilidade…</p>:
              (periods.error||maintenance.error)?<Feedback kind="error">Falha ao consultar os períodos. Não confirme antes de atualizar.</Feedback>:
              <div className="reservation-table-wrap"><table className="reservation-table">
                <thead><tr><th>Data</th><th>Turno</th><th>Livres</th><th>Situação</th></tr></thead>
                <tbody>{slots.map(slot=><tr key={slot.date+'-'+slot.shift}>
                  <td>{showDate(slot.date)}</td><td>{shiftLabel[slot.shift]}</td><td>{slot.remaining}/{slot.capacity}</td>
                  <td><span className={slot.remaining<requestedQuantity?'reservation-status unavailable':'reservation-status available'}>
                    {slot.capacity===0?'Em manutenção':slot.remaining<requestedQuantity?'Conflito':'Disponível'}
                  </span></td>
                </tr>)}</tbody>
              </table></div>}
            {blocked&&<Feedback kind="error">Há períodos sem capacidade suficiente. Ajuste as datas, o turno, a quantidade ou o carrinho.</Feedback>}
          </details>
          {feedback&&<Feedback kind={feedback.kind}>{feedback.text}</Feedback>}
          <div className="reservation-form-actions">
            <button className="primary" type="submit"
              disabled={!requesterId||!cartId||!requestedValid||!dates.length||!selectedShifts.length||blocked||periods.isFetching||maintenance.isFetching||!!maintenance.error||!!periods.error||!!carts.error||!!teachers.error||(reservationMode==='PARCIAL'&&(notebooks.isFetching||!!notebooks.error||selectedNotebookIds.length>requestedQuantity))||save.isPending}>
              {save.isPending?'Salvando…':editingId?'Salvar alterações':'Confirmar reserva'}
            </button>
            <button type="button" className="ghost" disabled={save.isPending} onClick={returnToList}>Cancelar e voltar</button>
          </div>
          <p className="form-hint"><Info size={15} aria-hidden="true"/> A confirmação verifica todos os períodos. Se houver conflito, nada será registrado.</p>
        </form>
      </section>
    </>}
  </div>;
}
