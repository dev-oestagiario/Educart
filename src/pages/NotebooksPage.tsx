import {CatalogStatusFilter,matchesStatus,useCatalogLifecycle,type StatusFilter} from '../components/CatalogLifecycle';
import {Feedback} from '../components/Feedback';
import {useState,type ChangeEvent,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {FileSpreadsheet,Settings2} from 'lucide-react';
import RecordsHeader from '../components/RecordsHeader';
import {supabase,type Cart,type Notebook} from '../lib/supabase';
import {fetchCatalogRows} from '../lib/catalog';
import {errorMessage,notebookSchema,validateCodes} from '../lib/validation';
import {parseImportFile} from '../lib/importSpreadsheet';

type FeedbackState={kind:'success'|'error';message:string};
export default function NotebooksPage(){
  const qc=useQueryClient();
  const carts=useQuery({queryKey:['carts'],queryFn:()=>fetchCatalogRows<Cart>('carts')});
  const notebooks=useQuery({queryKey:['notebooks'],queryFn:()=>fetchCatalogRows<Notebook>('notebook_codes')});
  const [screen,setScreen]=useState<'list'|'form'>('list');
  const [cartFilter,setCartFilter]=useState(''),[search,setSearch]=useState('');
  const [editorCartId,setEditorCartId]=useState('');
  const [codes,setCodes]=useState(''),[generateCount,setGenerateCount]=useState('5');
  const [feedback,setFeedback]=useState<FeedbackState|null>(null);
  const [status,setStatus]=useState<StatusFilter>('active');
  const lifecycle=useCatalogLifecycle(setFeedback);
  const formCart=carts.data?.find(c=>c.id===editorCartId&&c.active);
  const filterCart=carts.data?.find(c=>c.id===cartFilter);
  const registered=notebooks.data??[];
  const activeInForm=registered.filter(n=>n.cart_id===editorCartId&&n.active);
  const activeInFilter=registered.filter(n=>n.cart_id===cartFilter&&n.active);
  const previewCount=codes.split(/\r?\n/).filter(line=>line.trim()).length;
  const filtered=registered.filter(n=>{
    const matchesCart=!cartFilter||n.cart_id===cartFilter;
    const cartName=carts.data?.find(c=>c.id===n.cart_id)?.name??'';
    const term=search.trim().toLocaleLowerCase('pt-BR');
    return matchesStatus(n.active,status)&&matchesCart&&(n.code+' '+cartName).toLocaleLowerCase('pt-BR').includes(term);
  });
  const save=useMutation({
    mutationFn:async(values:string[])=>{
      const {error}=await supabase.from('notebook_codes')
        .insert(values.map(code=>({code,cart_id:editorCartId})));
      if(error)throw error;
    },
    onSuccess:()=>{
      void qc.invalidateQueries({queryKey:['notebooks']});
      void qc.invalidateQueries({queryKey:['spatial']});
      setCartFilter(editorCartId);
      setCodes('');setScreen('list');
      setFeedback({kind:'success',message:'Códigos cadastrados.'});
    },
    onError:err=>setFeedback({kind:'error',message:errorMessage(err)})
  });
  function addNew(){
    setEditorCartId(cartFilter);
    setCodes('');setGenerateCount('5');setFeedback(null);
    setScreen('form');
  }
  function cancel(){
    if(save.isPending)return;
    setScreen('list');setCodes('');setFeedback(null);
  }
  function generate(){
    setFeedback(null);
    const count=Number(generateCount);
    if(!Number.isInteger(count)||count<1||count>200){
      setFeedback({kind:'error',message:'Informe uma quantidade de 1 a 200.'});return;
    }
    if(!formCart){
      setFeedback({kind:'error',message:'Selecione um carrinho ativo antes de gerar códigos.'});return;
    }
    const draft=codes.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const remaining=formCart.capacity-activeInForm.length-draft.length;
    if(count>remaining){
      setFeedback({kind:'error',message:'O carrinho possui apenas '+Math.max(0,remaining)+' posições disponíveis para novos códigos.'});return;
    }
    const taken=new Set([...registered.map(x=>x.code.toLocaleLowerCase('pt-BR')),
      ...draft.map(x=>x.toLocaleLowerCase('pt-BR'))]);
    const generated:string[]=[];
    while(generated.length<count){
      const code='EDU-'+crypto.randomUUID().slice(0,8).toUpperCase();
      if(!taken.has(code.toLowerCase())){
        taken.add(code.toLowerCase());generated.push(code);
      }
    }
    setCodes([codes.trim(),...generated].filter(Boolean).join('\n'));
  }
  function submit(e:FormEvent){
    e.preventDefault();setFeedback(null);
    if(!formCart){
      setFeedback({kind:'error',message:'Escolha um carrinho ativo para cadastrar códigos.'});return;
    }
    try{
      const values=validateCodes(codes);
      for(const code of values)notebookSchema.parse({code});
      const registeredCodes=new Set(registered.map(x=>x.code.toLocaleLowerCase('pt-BR')));
      const duplicate=values.find(code=>registeredCodes.has(code.toLocaleLowerCase('pt-BR')));
      if(duplicate){setFeedback({kind:'error',message:'O código '+duplicate+' já está cadastrado.'});return;}
      if(activeInForm.length+values.length>formCart.capacity){
        setFeedback({kind:'error',message:'A quantidade de códigos ultrapassaria a capacidade do carrinho.'});return;
      }
      save.mutate(values);
    }catch(err){setFeedback({kind:'error',message:errorMessage(err)});}
  }
  async function upload(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];
    if(!file)return;
    setFeedback(null);
    try{
      const values=await parseImportFile(file);
      const parsed=validateCodes(values.join('\n'));
      setCodes(parsed.join('\n'));
      const existingCodes=new Set(registered.map(x=>x.code.toLocaleLowerCase('pt-BR')));
      const duplicate=parsed.find(code=>existingCodes.has(code.toLocaleLowerCase('pt-BR')));
      if(duplicate)setFeedback({kind:'error',message:'O código '+duplicate+' já está cadastrado. Corrija antes de salvar.'});
      else if(formCart&&activeInForm.length+parsed.length>formCart.capacity)
        setFeedback({kind:'error',message:'A importação excede a capacidade do carrinho. Corrija antes de salvar.'});
      else setFeedback({kind:'success',message:'Importados '+parsed.length+' código(s). Revise a lista antes de salvar.'});
    }catch(err){setFeedback({kind:'error',message:errorMessage(err)});}
    e.target.value='';
  }
  return <div className="records-page">{lifecycle.dialog}
    {screen==='list'?<>
      <RecordsHeader title="Notebooks" description="Consulte os códigos individuais de equipamentos, organizados por carrinho."
        actionLabel="Cadastrar notebooks" onAction={addNew}/>
      {feedback&&<Feedback kind={feedback.kind}>{feedback.message}</Feedback>}
      <section className="panel records-panel" aria-labelledby="notebook-list-title">
        <div className="records-list-heading"><h2 id="notebook-list-title">Notebooks cadastrados</h2>
          <span className="records-count">{notebooks.isLoading?'…':registered.length} códigos</span>
        </div>
        <div className="records-filters"><CatalogStatusFilter value={status} onChange={setStatus}/>
          <label className="field" htmlFor="cart-selector"><span>Laboratório móvel</span>
            <select id="cart-selector" value={cartFilter} onChange={e=>setCartFilter(e.target.value)}>
              <option value="">Todos os carrinhos</option>
              {(carts.data??[]).map(cart=><option value={cart.id} key={cart.id}>
                {cart.name} ({cart.code})
              </option>)}
            </select>
          </label>
          <label className="field" htmlFor="notebook-search"><span>Buscar notebook</span>
            <input type="search" id="notebook-search" value={search}
              placeholder="Código ou nome do carrinho" onChange={e=>setSearch(e.target.value)}/>
          </label>
        </div>
        {filterCart&&<div className="capacity-line records-capacity">
          <span>Capacidade configurada: <strong>{filterCart.capacity}</strong></span>
          <span>Códigos ativos: <strong>{activeInFilter.length}</strong></span>
          <span>Sem código informado: <strong>{Math.max(0,filterCart.capacity-activeInFilter.length)}</strong></span>
        </div>}
        {notebooks.isLoading||carts.isLoading?<p role="status">Carregando notebooks…</p>:
          notebooks.error||carts.error?<Feedback kind="error">Não foi possível consultar os equipamentos cadastrados.</Feedback>:
          !registered.length?<p className="empty">Nenhum notebook identificado. Use “Cadastrar notebooks” para adicionar códigos. A capacidade dos carrinhos não depende desses códigos.</p>:
          !filtered.length?<p className="empty">Nenhum notebook corresponde ao carrinho ou à busca.</p>:
          <div className="item-list">{filtered.map(item=>{
            const cart=carts.data?.find(c=>c.id===item.cart_id);
            return <article className="item records-item" key={item.id}>
              <div><strong>{item.code}</strong><span>{cart?.name??'Carrinho não encontrado'} · {cart?.code??'Sem código'}</span>
                {!item.active&&<span className="records-inactive">Inativo</span>}
              </div>
              <button type="button" className="secondary" disabled={lifecycle.busy} onClick={()=>lifecycle.request({table:'notebook_codes',id:item.id,active:item.active,label:item.code})}>{item.active?'Inativar':'Reativar'}</button>
            </article>;
          })}</div>}
      </section>
    </>:<>
      <RecordsHeader editing title="Cadastrar notebooks"
        description="Adicione, gere ou importe os códigos e revise a lista antes de salvar."
        actionLabel="Voltar para notebooks" onAction={cancel}/>
      <section className="panel records-form-panel records-notebook-form" aria-labelledby="notebooks-form-title">
        <h2 id="notebooks-form-title">Identificação de equipamentos</h2>
        <form className="form-stack" onSubmit={submit}>
          <label className="field" htmlFor="notebook-cart"><span>Laboratório móvel</span>
            <select id="notebook-cart" required value={editorCartId}
              onChange={e=>{setEditorCartId(e.target.value);setCodes('');setFeedback(null);}}>
              <option value="">Selecione um carrinho</option>
              {(carts.data??[]).filter(cart=>cart.active).map(cart=><option value={cart.id} key={cart.id}>
                {cart.name} ({cart.code})
              </option>)}
            </select>
          </label>
          {formCart&&<div className="capacity-line">
            <span>Capacidade configurada: <strong>{formCart.capacity}</strong></span>
            <span>Códigos ativos: <strong>{activeInForm.length}</strong></span>
            <span>Posições para novos códigos: <strong>{Math.max(0,formCart.capacity-activeInForm.length)}</strong></span>
          </div>}
          <label className="field" htmlFor="codes"><span>Códigos (um por linha)</span>
            <textarea id="codes" rows={7} value={codes} onChange={e=>setCodes(e.target.value)}
              placeholder={'NT-001\nNT-002'}/>
          </label>
          <div className="records-form-tools">
            <div className="records-tool-title"><Settings2 size={17} aria-hidden="true"/><strong>Geração de códigos</strong></div>
            <div className="actions">
              <label className="field compact" htmlFor="generate-count"><span>Gerar quantidade</span>
                <input id="generate-count" type="number" min="1" max="200" value={generateCount}
                  onChange={e=>setGenerateCount(e.target.value)}/></label>
              <button className="secondary" type="button" onClick={generate}>Gerar códigos</button>
            </div>
          </div>
          <div className="records-form-tools">
            <div className="records-tool-title"><FileSpreadsheet size={17} aria-hidden="true"/><strong>Importar planilha</strong></div>
            <label className="file-label" htmlFor="csv-import">Importar CSV ou XLSX (coluna <code>codigo</code>)
              <input id="csv-import" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                type="file" onChange={upload}/>
            </label>
            <p className="form-hint">Use a primeira aba, com coluna “codigo”, “código” ou “code”. Para códigos com zeros à esquerda, formate a coluna como texto no Excel.</p>
          </div>
          {previewCount>0&&<p role="status" className="form-hint"><strong>Prévia: {previewCount} código(s).</strong> Revise os valores antes de cadastrar.</p>}
          {feedback&&<Feedback kind={feedback.kind}>{feedback.message}</Feedback>}
          <div className="records-form-actions">
            <button type="submit" className="primary" disabled={save.isPending}>
              {save.isPending?'Salvando…':'Salvar códigos revisados'}
            </button>
            <button type="button" className="ghost" disabled={save.isPending} onClick={cancel}>Cancelar</button>
          </div>
        </form>
      </section>
    </>}
  </div>;
}
