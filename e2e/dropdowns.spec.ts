import {test,expect} from '@playwright/test';

test('Dropdowns — tema, seleção, teclado e responsividade na consulta pública',async({page})=>{
 const names=['Laboratório A','Laboratório B com identificação longa para testar o espaço disponível'];
 await page.route('https://educart-e2e.supabase.co/rest/v1/rpc/public_cart_availability',async route=>{
  const {p_start}=route.request().postDataJSON() as {p_start:string};
  await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},json:names.map((name,i)=>({usage_date:p_start,cart_id:'cart-'+i,cart_name:name,capacity:20,shift:'MATUTINO',reserved:0,available:20}))});
 });
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/#/consulta-publica');
 const select=page.getByRole('combobox',{name:'Carrinho',exact:true});
 await expect(select.locator('option')).toHaveCount(3);
 const supported=await page.evaluate(()=>CSS.supports('appearance','base-select')&&CSS.supports('selector(select::picker(select))')&&matchMedia('(pointer:fine)').matches);
 for(const theme of ['dark','light']){
  if(theme==='light')await page.getByRole('button',{name:'Ativar modo claro'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await page.setViewportSize({width:1440,height:900});
  await expect(select).toHaveCSS('color-scheme',theme);
  if(supported){
   await expect(select).toHaveCSS('appearance','base-select');
   await select.click();
   await expect.poll(()=>select.evaluate(el=>el.matches(':open'))).toBe(true);
   await page.keyboard.press('Escape');
   await expect.poll(()=>select.evaluate(el=>el.matches(':open'))).toBe(false);
  }
  await select.focus();await expect(select).toBeFocused();
  await select.selectOption('cart-1');await expect(select).toHaveValue('cart-1');
  await expect(page.locator('.public-agenda-cart').getByText(names[1],{exact:true})).toBeVisible();
  await expect(page.locator('.public-agenda-cart').getByText(names[0],{exact:true})).toHaveCount(0);
  for(const width of [1440,1024,768,390,320]){
   await page.setViewportSize({width,height:844});
   const box=await select.boundingBox();expect(box).not.toBeNull();
   expect(box!.height).toBeGreaterThanOrEqual(44);
   expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   if(width<=768)await expect(select).toHaveCSS('font-size','16px');
  }
  await select.selectOption('');await expect(select).toHaveValue('');
 }
});
