import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const isConfigured = Boolean(url && key && !key.includes('substitua_'));
export const supabase = createClient(
  isConfigured ? url : 'https://invalid.supabase.co',
  isConfigured ? key : 'not-configured'
);
export type Cart = { id:string; code:string; name:string; capacity:number; active:boolean; created_at:string };
export type Requester = { id:string; name:string; reference_code:string|null; active:boolean; created_at:string };
export type Notebook = { id:string; code:string; cart_id:string; active:boolean; created_at:string };
