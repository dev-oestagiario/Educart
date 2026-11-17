import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import BrandLogo from './BrandLogo';

describe('Identidade Educart — conceito A',()=>{
  it('utiliza a versão reversa em superfícies escuras e mantém nome acessível',()=>{
    const html=renderToStaticMarkup(createElement(BrandLogo,{tone:'light'}));
    expect(html).toContain('educart-logo-light.svg');
    expect(html).toContain('alt="Educart"');
    expect(html).toContain('brand-lockup');
  });
  it('possui variante para fundo claro, sem depender de texto de fontes externas',()=>{
    const html=renderToStaticMarkup(createElement(BrandLogo,{tone:'dark'}));
    expect(html).toContain('educart-logo.svg');
    for(const name of ['educart-logo.svg','educart-logo-light.svg']){
      const svg=readFileSync('public/brand/'+name,'utf8');
      expect(svg).toContain('viewBox="0 0 1053 256"');
      expect(svg).toContain('<path');
      expect(svg).not.toMatch(/<text(?:\s|>)/);
      expect(svg).not.toMatch(/<filter(?:\s|>)/);
      expect(svg).not.toMatch(/<image(?:\s|>)/);
    }
  });
  it('usa marca simplificada e metadados corretos no favicon',()=>{
    const svg=readFileSync('public/favicon.svg','utf8');
    const manifest=JSON.parse(readFileSync('public/site.webmanifest','utf8'));
    expect(svg).toContain('viewBox="0 0 256 256"');
    expect(svg).toContain('#A88AF5');
    expect(manifest.name).toContain('Educart');
    expect(manifest.icons[0].src).toBe('./favicon.svg');
  });
});
