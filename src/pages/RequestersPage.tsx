import {CatalogStatusFilter,matchesStatus,useCatalogLifecycle,type StatusFilter} from '../components/CatalogLifecycle';
import {Feedback} from '../components/Feedback';
import {useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import RecordsHeader from '../components/RecordsHeader';
import {supabase,type Requester} from '../lib/supabase';
import {fetchCatalogRows} from '../lib/catalog';
import {requesterSchema,errorMessage} from '../lib/validation';

type FeedbackState={kind:'success'|'error';message:string};
export default function RequestersPage(){
  const qc=useQueryClient();
  const teachers=useQuery({queryKey:['requesters'],queryFn:()=>fetchCatalogRows<Requester>('requesters')});
  const [screen,setScreen]=useState<'list'|'form'>('list');
  const [search,setSearch]=useState('');
  const [editingId,setEditingId]=useState<string|null>(null);
  const [name,setName]=useState(''),[code,setCode]=useState('');
  const [feedback,setFeedback]=useState<FeedbackState|null>(null);
  const [status,setStatus]=useState<StatusFilter>('active');
  const lifecycle=useCatalogLifecycle(setFeedback);
  const save=useMutation({
    mutationFn:async(values:{name:string;reference_code:string|null})=>{
      const req=editingId
        ?supabase.from('requesters').update(values).eq('id',editingId)
        :supabase.from('requesters').insert(values);
      const {error}=await req;
      if(error)throw error;
    },
    onSuccess:()=>{
      void qc.invalidateQueries({queryKey:['requesters']});
      setFeedback({kind:'success',message:editingId?'Professor atualizado.':'Professor cadastrado.'});
      setEditingId(null);setScreen('list');
    },
    onError:err=>setFeedback({kind:'error',message:errorMessage(err)})
  });
  function newTeacher(){setName('');setCode('');setFeedback(null);setEditingId(null);setScreen('form');}
  function edit(item:Requester){
    setEditingId(item.id);setName(item.name);setCode(item.reference_code??'');
    setFeedback(null);setScreen('form');
  }
  function cancel(){if(save.isPending)return;setScreen('list');setEditingId(null);setFeedback(null);}
  function submit(event:FormEvent){
    event.preventDefault();setFeedback(null);
    const parsed=requesterSchema.safeParse({name,reference_code:code});
    if(!parsed.success){setFeedback({kind:'error',message:parsed.error.issues[0].message});return;}
    save.mutate({name:parsed.data.name,reference_code:parsed.data.reference_code||null});
  }
  const searchTerm=search.trim().toLocaleLowerCase('pt-BR');
  const filtered=(teachers.data??[]).filter(item=>
    matchesStatus(item.active,status)&&(item.name+' '+(item.reference_code??'')).toLocaleLowerCase('pt-BR').includes(searchTerm)
  );
  return <div className="records-page">{lifecycle.dialog}
    {screen==='list'?<>
      <RecordsHeader title="Professores" description="Consulte os professores responsáveis pela solicitação dos equipamentos."
        actionLabel="Cadastrar professor" onAction={newTeacher}/>
      {feedback&&<Feedback kind={feedback.kind}>{feedback.message}</Feedback>}
      <section className="panel records-panel" aria-labelledby="teachers-list-title">
        <div className="records-list-heading"><h2 id="teachers-list-title">Professores cadastrados</h2>
          <span className="records-count">{teachers.isLoading?'…':(teachers.data??[]).length} cadastrados</span></div>
        <label className="field records-search" htmlFor="teachers-search"><span>Buscar professor</span>
          <input id="teachers-search" type="search" placeholder="Nome ou identificador"
            value={search} onChange={event=>setSearch(event.target.value)}/>
        </label>
        <CatalogStatusFilter value={status} onChange={setStatus}/>
        {teachers.isLoading?<p role="status">Carregando professores…</p>:
          teachers.error?<Feedback kind="error">{errorMessage(teachers.error)}</Feedback>:
          !teachers.data?.length?<p className="empty">Nenhum professor cadastrado. Use o botão “Cadastrar professor” para começar.</p>:
          !filtered.length?<p className="empty">Nenhum professor corresponde à busca.</p>:
          <div className="item-list">{filtered.map(item=><article className="item records-item" key={item.id}>
            <div><strong>{item.name}</strong><span>{item.reference_code||'Sem identificador interno'}</span>
              {!item.active&&<span className="records-inactive">Inativo</span>}
            </div>
            <div className="record-row-actions"><button type="button" className="secondary" onClick={()=>edit(item)}>Editar</button><button type="button" className="secondary" disabled={lifecycle.busy} onClick={()=>lifecycle.request({table:'requesters',id:item.id,active:item.active,label:item.name})}>{item.active?'Inativar':'Reativar'}</button></div>
          </article>)}</div>}
      </section>
    </>:<>
      <RecordsHeader editing title={editingId?'Editar professor':'Novo professor'}
        description="Os dados do professor serão usados para identificar quem solicita reservas."
        actionLabel="Voltar para professores" onAction={cancel}/>
      <section className="panel records-form-panel" aria-labelledby="teacher-form-title">
        <h2 id="teacher-form-title">Dados do professor</h2>
        <form className="form-stack" onSubmit={submit}>
          <label className="field" htmlFor="teacher-name"><span>Nome completo</span>
            <input id="teacher-name" required value={name} onChange={event=>setName(event.target.value)}/>
          </label>
          <label className="field" htmlFor="teacher-code"><span>Identificador interno (opcional)</span>
            <input id="teacher-code" value={code} onChange={event=>setCode(event.target.value)}/>
          </label>
          {feedback&&<Feedback kind={feedback.kind}>{feedback.message}</Feedback>}
          <div className="records-form-actions">
            <button type="submit" className="primary" disabled={save.isPending}>
              {save.isPending?'Salvando…':editingId?'Salvar alterações':'Salvar professor'}
            </button>
            <button type="button" className="ghost" disabled={save.isPending} onClick={cancel}>Cancelar</button>
          </div>
        </form>
      </section>
    </>}
  </div>;
}
