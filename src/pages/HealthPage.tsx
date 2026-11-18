import {useEffect,useState,useSyncExternalStore} from 'react';
import {diagnostics,type Service} from '../lib/observability';
import './health.css';
const labels:Record<Service,string>={auth:'Autenticação',rest:'Consultas e cadastros',rpc:'Funções do banco (RPC)',functions:'Edge Functions',frontend:'Interface',operation:'Operações da aplicação'};
export default function HealthPage(){
 useSyncExternalStore(diagnostics.subscribe,diagnostics.version,diagnostics.version);
 const [,tick]=useState(0);
 const [online,setOnline]=useState(navigator.onLine);
 useEffect(()=>{const timer=window.setInterval(()=>tick(x=>x+1),5000);const refresh=()=>setOnline(navigator.onLine);window.addEventListener('online',refresh);window.addEventListener('offline',refresh);return()=>{window.clearInterval(timer);window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);};},[]);
 const report=diagnostics.summary(),transport=report.rows.filter(r=>!['frontend','operation'].includes(r.service));
 const alerts=transport.filter(r=>r.alert);
 return <section className="health-page">
  <header className="page-header"><h1>Saúde da aplicação</h1><p>Diagnóstico local dos últimos 15 minutos nesta aba. Não representa disponibilidade global nem monitoramento contínuo.</p></header>
  <div className="health-metrics">
   <article className="panel"><h2>Rede do dispositivo</h2><strong>{online?'Online (indicador do navegador)':'Offline'}</strong></article>
   <article className="panel"><h2>Chamadas observadas</h2><strong>{transport.reduce((sum,r)=>sum+r.total,0)}</strong></article>
   <article className="panel"><h2>Falhas da interface</h2><strong>{report.frontendIssues}</strong></article>
   <article className="panel"><h2>Operações com erro</h2><strong>{report.operationFailures}</strong></article>
  </div>
  {!online?<p className="notice warning" role="status">Dispositivo informa conexão indisponível. Confira a rede antes de repetir operações.</p>:null}
  {report.truncated&&<p className="notice warning" role="status">Janela limitada a 1.000 registros recentes; parte da amostra foi descartada.</p>}
  {alerts.length>0?<p className="notice warning" role="status">Atenção: falhas de transporte ou latência elevada em {alerts.map(r=>labels[r.service]).join(', ')}.</p>:<p className="notice" role="status">{transport.some(r=>r.total)?'Sem alerta de transporte na amostra atual.':'Sem amostra suficiente para avaliar a saúde dos serviços.'}</p>}
  {report.frontendIssues>0&&<p className="notice warning">Falhas da interface observadas nesta aba. Se persistirem, contate a TI.</p>}
  <div className="panel"><h2>Serviços observados</h2><p className="form-hint">HTTP 2xx indica resposta bem-sucedida, não confirma resultado de negócio. P95 é a latência das respostas 2xx; cancelamentos não contam como falhas de serviço.</p>
   <div className="health-services">{transport.map(r=><article key={r.service} className="health-service"><h3>{labels[r.service]}</h3>
    <p>{r.total===0?'Sem amostra':r.alert?'Atenção':'Sem alerta na amostra'}</p>
    <dl><div><dt>Respostas 2xx</dt><dd>{r.ok}</dd></div><div><dt>Rejeitadas / HTTP não 2xx</dt><dd>{r.rejected}</dd></div><div><dt>Limite de requisições (429)</dt><dd>{r.limited}</dd></div><div><dt>Servidor / rede</dt><dd>{r.server+r.network}</dd></div><div><dt>Canceladas</dt><dd>{r.cancelled}</dd></div><div><dt>P95 (2xx)</dt><dd>{r.p95===null?'—':r.p95+' ms'}</dd></div></dl>
   </article>)}</div>
  </div>
  <div className="panel"><h2>Privacidade e limites</h2><p>Somente contagens e durações em memória. Não coletamos URL, conteúdo, mensagens de erro, identificador, senha ou token neste diagnóstico. A janela é apagada ao trocar de conta ou recarregar. Não há envio externo, persistência nem alerta fora desta aba.</p><p>Backup, disponibilidade do deploy e serviços externos precisam de verificação institucional independente. Operações com erro podem incluir recusas de regra de negócio e não devem ser somadas às falhas HTTP como incidentes distintos.</p><button type="button" className="secondary" onClick={()=>diagnostics.reset()}>Limpar diagnóstico local</button></div>
 </section>;
}
