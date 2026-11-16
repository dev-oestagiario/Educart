import {Moon,Sun} from 'lucide-react';
import {setTheme,useTheme} from '../lib/theme';

export default function ThemeToggle(){
  const theme=useTheme();
  const isLight=theme==='light';
  const label=isLight?'Ativar modo escuro':'Ativar modo claro';
  return <button type="button" className="theme-toggle" aria-label={label} title={label}
    onClick={()=>setTheme(isLight?'dark':'light')}>
    {isLight?<Moon size={18} aria-hidden="true"/>:<Sun size={18} aria-hidden="true"/>}
    <span>{isLight?'Escuro':'Claro'}</span>
  </button>;
}
