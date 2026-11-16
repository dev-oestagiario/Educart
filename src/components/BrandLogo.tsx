import {useTheme} from '../lib/theme';

type Props={tone?:'light'|'dark';className?:string};
export default function BrandLogo({tone='light',className=''}:Props){
  const theme=useTheme();
  const filename=tone==='dark'||theme==='light'?'educart-logo.svg':'educart-logo-light.svg';
  return <div className={'brand '+className}>
    <img className="brand-lockup" width="205" height="50" alt="Educart"
      draggable={false} src={import.meta.env.BASE_URL+'brand/'+filename}/>
  </div>;
}
