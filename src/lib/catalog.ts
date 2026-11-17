import {supabase} from './supabase';
import {collectPages} from './queryRefresh';
export async function fetchCatalogRows<T>(table:'carts'|'requesters'|'notebook_codes',activeOnly=false,cartId?:string):Promise<T[]>{
 return collectPages<T>((start,end)=>{
  let query=supabase.from(table).select('*');
  if(activeOnly)query=query.eq('active',true);
  if(table==='notebook_codes'&&cartId)query=query.eq('cart_id',cartId);
  return query.order('created_at',{ascending:false}).order('id').range(start,end);
 });
}
