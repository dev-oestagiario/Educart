import {useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import RecordsHeader from '../components/RecordsHeader';
import {supabase,type Cart} from '../lib/supabase';
import {fetchCatalogRows} from '../lib/catalog';
import {cartSchema,errorMessage} from '../lib/validation';

type Feedback={kind:'success'|'error';message:string};
export default function CartsPage(){
  const qc=useQueryClient();
  const carts=useQuery({queryKey:['carts'],queryFn:()=>fetchCatalogRows<Cart>('carts')});
  const [screen,setScreen]=useState<'list'|'form'>('list');
  const [search,setSearch]=useState('');
  const [editingId,setEditingId]=useState<string|null>(null);
  const [code,setCode]=useState(''),[name,setName]=useState(''),[capacity,setCapacity]=useState('30');
  const [feedback,setFeedback]=useState<Feedback|null>(null);
  const save=useMutation({
    mutationFn:async(values:{code:string;name:string;capacity:number})=>{
      const req=editingId
        ?supabase.from('carts').update(values).eq('id',editingId)
        :supabase.from('carts').insert(values);
      const {error}=await req;
      if(error)throw error;
    },
    onSuccess:()=>{
      void qc.invalidateQueries({queryKey:['carts']});
      setFeedback({kind:'success',message:editingId?'Carrinho atualizado.':'Carrinho cadastrado.'});
      setEditingId(null);setScreen('list');
    },
    onError:err=>setFeedback({kind:'error',message:errorMessage(err)})
  });
  function addNew(){
    setCode('');setName('');setCapacity('30');setEditingId(null);setFeedback(null);setScreen('form');
  }
  function edit(item:Cart){
    setEditingId(item.id);setCode(item.code);setName(item.name);
    setCapacity(String(item.capacity));setFeedback(null);setScreen('form');
  }
  function cancel(){
    if(save.isPending)return;
    setScreen('list');setEditingId(null);setFeedback(null);
  }
  function submit(event:FormEvent){
    event.preventDefault();setFeedback(null);
    const parsed=cartSchema.safeParse({code,name,capacity});
    if(!parsed.success){
      setFeedback({kind:'error',message:parsed.error.issues[0].message});return;
    }
    save.mutate(parsed.data);
  }
  const q=search.trim().toLocaleLowerCase('pt-BR');
  const filtered=(carts.data??[]).filter(item=>
    (item.name+' '+item.code+' '+String(item.capacity)).toLocaleLowerCase('pt-BR').includes(q)
  );
  return <div className="records-page">
    {screen==='list'?<>
      <RecordsHeader title="Carrinhos" description="Consulte os laboratórios móveis e suas capacidades configuradas."
        actionLabel="Cadastrar carrinho" onAction={addNew}/>
      {feedback&&<p className={'notice '+feedback.kind} role={feedback.kind==='error'?'alert':'status'}>{feedback.message}</p>}
      <section className="panel records-panel" aria-labelledby="carts-list-title">
        <div className="records-list-heading">
          <h2 id="carts-list-title">Carrinhos cadastrados</h2>
          <span className="records-count">{carts.isLoading?'…':(carts.data??[]).length} cadastrados</span>
        </div>
        <label className="field records-search" htmlFor="carts-search"><span>Buscar carrinho</span>
          <input id="carts-search" type="search" placeholder="Nome, código ou capacidade"
            value={search} onChange={event=>setSearch(event.target.value)}/>
        </label>
        {carts.isLoading?<p role="status">Carregando carrinhos…</p>:
          carts.error?<p role="alert" className="notice error">{errorMessage(carts.error)}</p>:
          !carts.data?.length?<div className="empty">Nenhum carrinho cadastrado. Use o botão “Cadastrar carrinho” para começar.</div>:
          !filtered.length?<p className="empty">Nenhum carrinho corresponde à busca.</p>:
          <div className="item-list">{filtered.map(item=><article className="item records-item" key={item.id}>
            <div><strong>{item.name}</strong>
              <span>{item.code} · {item.capacity} notebooks de capacidade</span>
              {!item.active&&<span className="records-inactive">Inativo</span>}
            </div>
            <button type="button" className="secondary" onClick={()=>edit(item)}>Editar</button>
          </article>)}</div>}
      </section>
    </>:<>
      <RecordsHeader editing title={editingId?'Editar carrinho':'Novo carrinho'}
        description="Informe o código, o nome e a capacidade configurada do laboratório móvel."
        actionLabel="Voltar para carrinhos" onAction={cancel}/>
      <section className="panel records-form-panel" aria-labelledby="cart-form-title">
        <h2 id="cart-form-title">Dados do carrinho</h2>
        <form className="form-stack" onSubmit={submit}>
          <label className="field" htmlFor="cart-code"><span>Código do carrinho</span>
            <input id="cart-code" required value={code} onChange={event=>setCode(event.target.value)}/>
          </label>
          <label className="field" htmlFor="cart-name"><span>Nome do laboratório móvel</span>
            <input id="cart-name" required value={name} onChange={event=>setName(event.target.value)}/>
          </label>
          <label className="field" htmlFor="cart-capacity"><span>Capacidade de notebooks</span>
            <input id="cart-capacity" type="number" min="1" required value={capacity}
              onChange={event=>setCapacity(event.target.value)}/>
          </label>
          <p className="form-hint">A capacidade informada determina a disponibilidade, mesmo que nem todos os notebooks possuam código cadastrado.</p>
          {feedback&&<p className={'notice '+feedback.kind} role={feedback.kind==='error'?'alert':'status'}>{feedback.message}</p>}
          <div className="records-form-actions">
            <button type="submit" className="primary" disabled={save.isPending}>
              {save.isPending?'Salvando…':editingId?'Salvar alterações':'Cadastrar carrinho'}
            </button>
            <button type="button" className="ghost" disabled={save.isPending} onClick={cancel}>Cancelar</button>
          </div>
        </form>
      </section>
    </>}
  </div>;
}
