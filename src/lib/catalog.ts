import {supabase} from './supabase';
export async function fetchCatalogRows<T>(table:'carts'|'requesters'|'notebook_codes'):Promise<T[]>{
  const {data,error}=await supabase.from(table).select('*').order('created_at',{ascending:false});
  if(error)throw error;
  return (data??[]) as T[];
}
