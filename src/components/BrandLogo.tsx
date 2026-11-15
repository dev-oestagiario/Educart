type Props={tone?:'light'|'dark';className?:string};
export default function BrandLogo({tone='light',className=''}:Props){
  const filename=tone==='light'?'educart-logo-light.svg':'educart-logo.svg';
  return <div className={'brand '+className}>
    <img className="brand-lockup" width="205" height="50" alt="Educart"
      draggable={false} src={import.meta.env.BASE_URL+'brand/'+filename}/>
  </div>;
}
