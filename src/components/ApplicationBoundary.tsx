import {Component,type ReactNode} from 'react';
import {diagnostics} from '../lib/observability';
import {reportFailure} from '../lib/sentry';
export default class ApplicationBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){diagnostics.record('frontend','failure',0);reportFailure('boundary');}
 render(){return this.state.failed?<main className="setup"><h1>Não foi possível abrir o Educart</h1><p>Recarregue a página. Se a falha persistir, contate a TI. Confira operações pendentes antes de repeti-las.</p><button className="primary" onClick={()=>window.location.reload()}>Recarregar aplicação</button></main>:this.props.children;}
}
