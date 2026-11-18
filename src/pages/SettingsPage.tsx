import {Settings2,Bell,Monitor} from 'lucide-react';
import EmailPreference from '../components/EmailPreference';
import ThemeToggle from '../components/ThemeToggle';
export default function SettingsPage({userId}:{userId:string}){
 return <div className="records-page settings-page">
 <header className="page-header"><span className="eyebrow">SUA CONTA</span><h1><Settings2 size={22} aria-hidden="true"/> Configurações</h1><p>Gerencie as preferências da sua conta.</p></header>
 <section className="panel" aria-label="Aparência"><h2><Monitor size={19} aria-hidden="true"/> Aparência</h2><div className="settings-option"><div><strong>Tema da interface</strong><p className="form-hint">Alterne entre os modos claro e escuro.</p></div><ThemeToggle/></div></section>
 <section className="panel" aria-label="Avisos internos"><h2><Bell size={19} aria-hidden="true"/> Notificações internas</h2><p className="form-hint">Os avisos do sistema permanecem disponíveis para acompanhar os pedidos de reserva.</p></section>
 <EmailPreference userId={userId}/>
 </div>;
}
