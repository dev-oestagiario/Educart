import {z} from 'zod';
import {supabase} from '../../lib/supabase';
import {validateNotebookHistory} from './inspection';
const id=z.string().uuid(),condition=z.enum(['BOA','RESSALVA']);
const row=z.object({id,cart_id:id,notebook_ids:z.array(id),pickup_at:z.string(),return_at:z.string().nullable(),pickup_condition:condition,return_condition:condition.nullable()});
/** History is scoped by actual UUID, never a code, ordinal, or visual slot. */
export async function getNotebookHistory(cartId:string,notebookId:string,signal:AbortSignal){
 const {data,error}=await supabase.from('equipment_movements').select('id,cart_id,notebook_ids,pickup_at,return_at,pickup_condition,return_condition')
  .eq('cart_id',cartId).contains('notebook_ids',[notebookId]).order('pickup_at',{ascending:false}).order('id').limit(10).abortSignal(signal);
 if(error)throw error;
 return validateNotebookHistory(z.array(row).max(10).parse(data),cartId,notebookId);
}
