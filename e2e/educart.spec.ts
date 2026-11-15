import { XLSX_FIXTURE_BASE64 } from './fixtures/workbook';
import { mkdir, readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

type Row = Record<string, unknown>;
const ADMIN_ID = 'ae246078-d0ed-4b32-a4f4-ce96e459c628';
const user = {
  id: ADMIN_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test-admin@educart.example',
  created_at: '2026-11-15T10:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {}
};
const token = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: ADMIN_ID, role: 'authenticated', exp: 4102444800 })).toString('base64url'),
  'mock-signature'
].join('.');

async function useFakeSupabase(page: Page, authorized = true) {
  const database: Record<string, Row[]> = {
    carts: [], requesters: [], notebook_codes: [], reservations: [], reservation_periods: [], reservation_notebooks: [], reservation_events: []
  };
  await page.route('https://educart-e2e.supabase.co/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS, DELETE'
    };
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers }); return;
    }
    const respond = (data: unknown, status = 200) =>
      route.fulfill({ status, headers, json: data });
    if (url.pathname === '/auth/v1/token' && req.method() === 'POST') {
      await respond({
        access_token: token, token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now()/1000)+3600,
        refresh_token: 'test-refresh-token', user
      });
      return;
    }
    if (url.pathname === '/auth/v1/user') { await respond(user); return; }
    if (url.pathname.startsWith('/auth/v1/logout')) { await respond({}); return; }
    if (url.pathname === '/rest/v1/admin_users') {
      await respond(authorized ? [{user_id:ADMIN_ID,display_name:'Administrador de teste'}] : []); return;
    }
    if (url.pathname === '/rest/v1/rpc/cancel_reservation_period' && req.method()==='POST') {
      const body=req.postDataJSON() as {p_period_id:string};
      const period=database.reservation_periods.find(p=>p.id===body.p_period_id&&p.active);
      if(!period){await respond({message:'Período não encontrado'},404);return;}
      period.active=false;
      for(const a of database.reservation_notebooks.filter(a=>a.period_id===period.id))a.active=false;
      const booking=database.reservations.find(b=>b.id===period.reservation_id);
      if(!database.reservation_periods.some(p=>p.reservation_id===period.reservation_id&&p.active)&&booking)booking.status='CANCELADA';
      database.reservation_events.push({id:crypto.randomUUID(),reservation_id:period.reservation_id,
        event_type:'CANCELAMENTO',admin_id:ADMIN_ID,occurred_at:new Date().toISOString(),
        before_data:{period_id:period.id,active:true},after_data:{period_id:period.id,active:false}});
      await respond(period.reservation_id);return;
    }
    if (url.pathname === '/rest/v1/rpc/cancel_reservation' && req.method()==='POST') {
      const body=req.postDataJSON() as {p_reservation_id:string};
      const booking=database.reservations.find(b=>b.id===body.p_reservation_id);
      if(!booking){await respond({message:'Reserva não encontrada'},404);return;}
      booking.status='CANCELADA';
      for(const period of database.reservation_periods.filter(p=>p.reservation_id===booking.id))period.active=false;
      database.reservation_events.push({id:crypto.randomUUID(),reservation_id:booking.id,
        event_type:'CANCELAMENTO',admin_id:ADMIN_ID,occurred_at:new Date().toISOString(),
        before_data:{status:'CONFIRMADA'},after_data:{status:'CANCELADA'}});
      await respond(booking.id);return;
    }
    if (url.pathname === '/rest/v1/rpc/update_reservation' && req.method()==='POST') {
      const body=req.postDataJSON() as {
        p_reservation_id:string;p_requester_id:string;p_cart_id:string;p_mode:'COMPLETA'|'PARCIAL';
        p_quantity:number;p_dates:string[];p_shifts:string[];
        p_needs_mouse:boolean;p_notes:string|null;p_notebook_ids:string[];
      };
      const booking=database.reservations.find(b=>b.id===body.p_reservation_id);
      const cart=database.carts.find(c=>c.id===body.p_cart_id);
      if(!booking||!cart){await respond({message:'Reserva ou carrinho não encontrado'},404);return;}
      const quantity=body.p_mode==='COMPLETA'?Number(cart.capacity):body.p_quantity;
      for(const date of body.p_dates)for(const shift of body.p_shifts) {
        const other=database.reservation_periods.filter(p=>p.cart_id===cart.id&&p.usage_date===date&&p.shift===shift&&p.active&&p.reservation_id!==booking.id)
          .reduce((sum,p)=>sum+Number(p.quantity),0);
        if(other+quantity>Number(cart.capacity)) {
          await respond({message:'Sem disponibilidade para alterar'},409);return;
        }
      }
      const previous={...booking};
      Object.assign(booking,{requester_id:body.p_requester_id,cart_id:body.p_cart_id,mode:body.p_mode,
        quantity,needs_mouse:body.p_needs_mouse,notes:body.p_notes});
      for(const p of database.reservation_periods.filter(p=>p.reservation_id===booking.id))p.active=false;
      for(const date of body.p_dates)for(const shift of body.p_shifts)database.reservation_periods.push({
        id:crypto.randomUUID(),reservation_id:booking.id,cart_id:cart.id,
        usage_date:date,shift,quantity,active:true
      });
      database.reservation_events.push({id:crypto.randomUUID(),reservation_id:booking.id,
        event_type:'EDICAO',admin_id:ADMIN_ID,occurred_at:new Date().toISOString(),
        before_data:previous,after_data:{...booking}});
      await respond(booking.id);return;
    }
    if (url.pathname === '/rest/v1/rpc/create_reservation' && req.method() === 'POST') {
      const body = req.postDataJSON() as {
        p_requester_id:string;p_cart_id:string;p_mode:'COMPLETA'|'PARCIAL';
        p_quantity:number;p_dates:string[];p_shifts:string[];
        p_needs_mouse:boolean;p_notes:string|null;p_notebook_ids:string[];
      };
      const cart=database.carts.find(x=>x.id===body.p_cart_id);
      const quantity=body.p_mode==='COMPLETA'?Number(cart?.capacity):body.p_quantity;
      if(!cart||!database.requesters.find(x=>x.id===body.p_requester_id)||!authorized){
        await respond({message:'Sem permissão ou cadastro inexistente'},403);return;
      }
      for(const date of body.p_dates){
        for(const shift of body.p_shifts){
          const used=database.reservation_periods.filter(p=>p.cart_id===cart.id&&p.usage_date===date&&p.shift===shift&&p.active)
            .reduce((sum,p)=>sum+Number(p.quantity),0);
          if(used+quantity>Number(cart.capacity)){
            await respond({message:'Sem disponibilidade neste turno'},409);return;
          }
          if(database.reservation_notebooks.some(p=>p.active&&p.usage_date===date&&p.shift===shift&&body.p_notebook_ids.includes(String(p.notebook_id)))){
            await respond({message:'Notebook já reservado neste turno'},409);return;
          }
        }
      }
      const reservationId=crypto.randomUUID();
      database.reservations.push({
        id:reservationId,requester_id:body.p_requester_id,cart_id:body.p_cart_id,
        mode:body.p_mode,quantity,needs_mouse:body.p_needs_mouse,notes:body.p_notes,
        status:'CONFIRMADA',created_at:new Date().toISOString()
      });
      for(const date of body.p_dates)for(const shift of body.p_shifts){
        const periodId=crypto.randomUUID();
        database.reservation_periods.push({
          id:periodId,reservation_id:reservationId,cart_id:body.p_cart_id,
          usage_date:date,shift,quantity,active:true
        });
        for(const notebook_id of body.p_notebook_ids)database.reservation_notebooks.push({
          period_id:periodId,notebook_id,usage_date:date,shift,active:true
        });
      }
      await respond(reservationId);return;
    }
    const table = url.pathname.slice('/rest/v1/'.length);
    if (Object.prototype.hasOwnProperty.call(database, table)) {
      if (req.method() === 'GET') {
        await respond(database[table]); return;
      }
      if (req.method() === 'POST') {
        const body = req.postDataJSON() as Row | Row[];
        const rows = Array.isArray(body) ? body : [body];
        for (const record of rows) {
          database[table].push({
            ...record, id: crypto.randomUUID(), active: true,
            created_at: '2026-11-15T10:00:00Z'
          });
        }
        await respond([], 201); return;
      }
      if (req.method() === 'PATCH') {
        const id = url.searchParams.get('id')?.replace('eq.', '');
        const record = database[table].find(row => row.id === id);
        if (record) Object.assign(record, req.postDataJSON());
        await respond([]); return;
      }
    }
    await respond({ message: 'Rota não simulada: ' + url.pathname }, 404);
  });
  return database;
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('E-mail').fill('test-admin@educart.example');
  await page.getByLabel('Senha').fill('senha-de-teste-sem-uso-real');
  await page.getByRole('button', {name: 'Entrar no Educart'}).click();
}

test('usuário não autorizado não acessa os cadastros', async ({page}) => {
  await useFakeSupabase(page, false);
  await login(page);
  await expect(page.getByRole('heading', {name:'Conta criada, aguardando autorização'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Gerenciar carrinhos'})).toHaveCount(0);
});

test('administrador cadastra carrinho e professor', async ({page}) => {
  await useFakeSupabase(page);
  await login(page);
  await expect(page.getByRole('heading', {name:'Visão geral'})).toBeVisible();
  await page.getByRole('button', {name:'Carrinhos', exact:true}).click();
  await page.getByLabel('Código do carrinho').fill('C-01');
  await page.getByLabel('Nome do laboratório móvel').fill('Laboratório 1');
  await page.getByLabel('Capacidade de notebooks').fill('30');
  await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
  await expect(page.getByText('C-01 · 30 notebooks de capacidade')).toBeVisible();
  await page.getByRole('button',{name:'Professores',exact:true}).click();
  await page.getByLabel('Nome completo').fill('Professora Exemplo');
  await page.getByRole('button',{name:'Salvar professor'}).click();
  await expect(page.getByText('Professora Exemplo')).toBeVisible();
});

test('CSV mostra prévia editável e impede duplicação de notebook', async ({page}) => {
  await useFakeSupabase(page);
  await login(page);
  await page.getByRole('button',{name:'Carrinhos',exact:true}).click();
  await page.getByLabel('Código do carrinho').fill('C-01');
  await page.getByLabel('Nome do laboratório móvel').fill('Laboratório 1');
  await page.getByLabel('Capacidade de notebooks').fill('30');
  await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
  await expect(page.getByText('C-01 · 30 notebooks de capacidade')).toBeVisible();
  await page.getByRole('button',{name:'Notebooks',exact:true}).click();
  await page.getByLabel('Laboratório móvel').selectOption({label:'Laboratório 1 (C-01)'});
  await page.locator('#csv-import').setInputFiles({
    name:'codigos.csv', mimeType:'text/csv',
    buffer:Buffer.from('codigo;descricao\nNT-001;primeiro\nNT-002;segundo','utf8')
  });
  await expect(page.getByText(/Prévia: 2 código/)).toBeVisible();
  await page.getByLabel('Códigos (um por linha)').fill('NT-001\nnt-001');
  await page.getByRole('button',{name:'Salvar códigos revisados'}).click();
  await expect(page.getByRole('alert')).toContainText('repetidos');
  await page.getByLabel('Códigos (um por linha)').fill('NT-001\nNT-002');
  await page.getByRole('button',{name:'Salvar códigos revisados'}).click();
  await expect(page.getByText('NT-001',{exact:true})).toBeVisible();
  await expect(page.getByText('NT-002',{exact:true})).toBeVisible();
  await expect(page.getByText('Capacidade configurada:')).toBeVisible();
});

// XLSX real, com uma coluna "codigo" e duas células inlineStr.
// O arquivo de teste é pequeno e não contém informações de usuários reais.
test('importa arquivo XLSX real com prévia antes de salvar', async ({page}) => {
  await useFakeSupabase(page);
  await login(page);
  await page.getByRole('button',{name:'Carrinhos',exact:true}).click();
  await page.getByLabel('Código do carrinho').fill('CXLSX');
  await page.getByLabel('Nome do laboratório móvel').fill('Carrinho de planilhas');
  await page.getByLabel('Capacidade de notebooks').fill('30');
  await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
  await expect(page.getByText('CXLSX · 30 notebooks de capacidade')).toBeVisible();
  await page.getByRole('button',{name:'Notebooks',exact:true}).click();
  await page.getByLabel('Laboratório móvel').selectOption({label:'Carrinho de planilhas (CXLSX)'});
  const workbook = Buffer.from(XLSX_FIXTURE_BASE64,'base64');
  await page.locator('#csv-import').setInputFiles({
    name:'notebooks.xlsx',
    mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer:workbook
  });
  await expect(page.getByText(/Importados 2 código/)).toBeVisible();
  await expect(page.getByLabel('Códigos (um por linha)')).toHaveValue('NT-XLSX-01\nNT-XLSX-02');
  await page.getByRole('button',{name:'Salvar códigos revisados'}).click();
  await expect(page.getByText('NT-XLSX-01',{exact:true})).toBeVisible();
  await expect(page.getByText('NT-XLSX-02',{exact:true})).toBeVisible();
});

test('menu permanece lateral e navegável no celular, sem rolagem horizontal', async ({page}) => {
  await page.setViewportSize({width:360,height:780});
  await useFakeSupabase(page);
  await login(page);
  await expect(page.getByRole('heading',{name:'Visão geral'})).toBeVisible();
  const opener=page.getByRole('button',{name:'Abrir menu lateral'});
  const navigation=page.getByRole('navigation',{name:'Menu principal'});
  await expect(opener).toBeVisible();
  await expect(navigation).toBeHidden();
  await opener.click();
  await expect(navigation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await navigation.getByRole('button',{name:'Carrinhos'}).click();
  await expect(page.getByRole('heading',{name:'Carrinhos',exact:true})).toBeVisible();
  await expect(navigation).toBeHidden();
  const doesNotOverflow=await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(doesNotOverflow).toBe(true);
});


test('layout responsivo, navegação e área de toque em seis larguras', async ({page}, testInfo) => {
  await useFakeSupabase(page);
  await login(page);
  await expect(page.getByRole('heading', {name:'Visão geral'})).toBeVisible();

  await mkdir('test-results/screenshots',{recursive:true});
  for(const width of [320,360,390,768,1024,1280]) {
    await page.setViewportSize({width, height:800});
    const opener=page.getByRole('button',{name:'Abrir menu lateral'});
    const nav=page.getByRole('navigation',{name:'Menu principal'});
    if(width<=690) {
      await expect(opener).toBeVisible();
      const size=await opener.boundingBox();
      expect(size?.width).toBeGreaterThanOrEqual(44);
      expect(size?.height).toBeGreaterThanOrEqual(44);
      await opener.click();
      await expect(nav).toBeVisible();
      await nav.getByRole('button',{name:'Notebooks'}).click();
      await expect(page.getByRole('heading',{name:'Notebooks',exact:true})).toBeVisible();
      await expect(nav).toBeHidden();
    } else {
      await expect(opener).toBeHidden();
      await expect(nav).toBeVisible();
      await nav.getByRole('button',{name:'Notebooks'}).click();
    }
    await expect(page.getByLabel('Laboratório móvel')).toBeVisible();
    const noOverflow=await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    );
    expect(noOverflow, 'A tela não deve gerar rolagem horizontal em '+width+'px').toBe(true);
    const screenshot=await page.screenshot({path:`test-results/screenshots/educart-${width}px.png`,fullPage:true,animations:'disabled'});
    await testInfo.attach('educart-'+width+'px',{body:screenshot,contentType:'image/png'});
  }
});

test('gaveta lateral permite fechar tocando fora e mantém foco no menu ao usar Tab', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await useFakeSupabase(page);
  await login(page);
  const opener=page.getByRole('button',{name:'Abrir menu lateral'});
  const nav=page.getByRole('navigation',{name:'Menu principal'});
  await opener.click();
  await expect(nav).toBeVisible();
  await expect(page.getByRole('button',{name:'Fechar menu lateral'})).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button',{name:'Sair'})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Fechar menu lateral'})).toBeFocused();
  await page.locator('.mobile-menu-backdrop').click({position:{x:380,y:100}});
  await expect(nav).toBeHidden();
  await expect(opener).toBeFocused();
});


test('Fase 2 — reserva parcial por turno preserva saldo e bloqueia reserva completa', async ({page})=>{
  const database=await useFakeSupabase(page);
  const cartId=crypto.randomUUID();
  const requesterId=crypto.randomUUID();
  database.carts.push({id:cartId,name:'Carrinho de teste',code:'C-01',capacity:30,active:true,created_at:new Date().toISOString()});
  database.requesters.push({id:requesterId,name:'Professora Reserva',reference_code:'R-1',active:true,created_at:new Date().toISOString()});
  await login(page);
  await page.getByRole('button',{name:'Reservas',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Nova reserva'})).toBeVisible();

  const monday=new Date(Date.now()+14*24*60*60*1000);
  while(monday.getUTCDay()!==1)monday.setUTCDate(monday.getUTCDate()+1);
  const iso=monday.toISOString().slice(0,10);

  await page.getByLabel('Professor solicitante').selectOption(requesterId);
  await page.locator('#reservation-cart').selectOption(cartId);
  await page.getByLabel('Data inicial').fill(iso);
  await page.getByLabel('Data final').fill(iso);
  await page.getByRole('radio',{name:'Notebooks avulsos'}).check();
  await page.getByLabel('Quantidade de notebooks').fill('10');
  await expect(page.getByText('30/30')).toBeVisible();
  await page.getByRole('button',{name:'Confirmar reserva'}).click();
  await expect(page.getByText('Reserva confirmada para todos os períodos selecionados.')).toBeVisible();
  await expect(page.getByText('20/30')).toBeVisible();
  expect(database.reservations).toHaveLength(1);
  expect(database.reservation_periods).toHaveLength(1);
  await page.getByRole('radio',{name:'Carrinho completo'}).check();
  await expect(page.getByRole('button',{name:'Confirmar reserva'})).toBeDisabled();
  await expect(page.getByText('Conflito',{exact:true})).toBeVisible();
  await page.getByLabel('Manhã').uncheck();
  await page.getByLabel('Tarde').check();
  await expect(page.getByText('30/30')).toBeVisible();
  await expect(page.getByRole('button',{name:'Confirmar reserva'})).toBeEnabled();
});

test('Fase 2 — datas avulsas recusam sábado e domingo', async ({page})=>{
  const database=await useFakeSupabase(page);
  const cartId=crypto.randomUUID(), requesterId=crypto.randomUUID();
  database.carts.push({id:cartId,name:'Carrinho 2',code:'C-02',capacity:30,active:true,created_at:new Date().toISOString()});
  database.requesters.push({id:requesterId,name:'Professora Data',active:true,created_at:new Date().toISOString()});
  await login(page);
  await page.getByRole('button',{name:'Reservas',exact:true}).click();
  await page.getByLabel('Professor solicitante').selectOption(requesterId);
  await page.locator('#reservation-cart').selectOption(cartId);
  await page.getByLabel('Escolha das datas').selectOption('avulsas');
  const saturday=new Date(Date.now()+14*24*60*60*1000);
  while(saturday.getUTCDay()!==6)saturday.setUTCDate(saturday.getUTCDate()+1);
  await page.getByLabel('Adicionar dia').fill(saturday.toISOString().slice(0,10));
  await page.getByRole('button',{name:'Adicionar data'}).click();
  await expect(page.getByText('Só é possível selecionar datas de segunda a sexta.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Confirmar reserva'})).toBeDisabled();
});


test('Fase 3 — cancelamento individual preserva outro período e edição registra histórico',async({page})=>{
  const database=await useFakeSupabase(page);
  const cartId=crypto.randomUUID(),teacherId=crypto.randomUUID();
  database.carts.push({id:cartId,name:'Carrinho gestão',code:'C-GESTAO',capacity:30,active:true,created_at:new Date().toISOString()});
  database.requesters.push({id:teacherId,name:'Professor Gestão',active:true,created_at:new Date().toISOString()});
  await login(page);
  await page.getByRole('button',{name:'Reservas',exact:true}).click();

  const monday=new Date(Date.now()+14*24*60*60*1000);
  while(monday.getUTCDay()!==1)monday.setUTCDate(monday.getUTCDate()+1);
  const tuesday=new Date(monday.getTime()+24*60*60*1000);
  const start=monday.toISOString().slice(0,10),end=tuesday.toISOString().slice(0,10);

  await page.getByLabel('Professor solicitante').selectOption(teacherId);
  await page.locator('#reservation-cart').selectOption(cartId);
  await page.locator('#reservation-start').fill(start);
  await page.locator('#reservation-end').fill(end);
  await page.getByRole('radio',{name:'Notebooks avulsos'}).check();
  await page.getByLabel('Quantidade de notebooks').fill('10');
  await page.getByRole('button',{name:'Confirmar reserva'}).click();
  await expect(page.getByText('Reserva confirmada para todos os períodos selecionados.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Cancelar período'})).toHaveCount(2);

  await page.getByRole('button',{name:'Cancelar período'}).first().click();
  await page.getByRole('button',{name:'Confirmar cancelamento'}).click();
  await expect(page.getByRole('button',{name:'Cancelar período'})).toHaveCount(1);
  expect(database.reservation_periods.filter(p=>p.active)).toHaveLength(1);
  expect(database.reservation_events.filter(e=>e.event_type==='CANCELAMENTO')).toHaveLength(1);

  await page.getByRole('button',{name:'Editar',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Editar reserva'})).toBeVisible();
  await page.getByLabel('Quantidade de notebooks').fill('5');
  await page.getByRole('button',{name:'Salvar alterações'}).click();
  await expect(page.getByText('Reserva editada e alteração registrada no histórico.')).toBeVisible();
  expect(database.reservations[0].quantity).toBe(5);
  expect(database.reservation_events.filter(e=>e.event_type==='EDICAO')).toHaveLength(1);
});

test('Fase 3 — cancelamento total desativa os períodos e preserva evento',async({page})=>{
  const database=await useFakeSupabase(page);
  const cartId=crypto.randomUUID(),teacherId=crypto.randomUUID(),reservationId=crypto.randomUUID();
  database.carts.push({id:cartId,name:'Carrinho cancelamento',code:'C-CANCEL',capacity:20,active:true,created_at:new Date().toISOString()});
  database.requesters.push({id:teacherId,name:'Professora Cancelamento',active:true,created_at:new Date().toISOString()});
  const monday=new Date(Date.now()+14*24*60*60*1000);
  while(monday.getUTCDay()!==1)monday.setUTCDate(monday.getUTCDate()+1);
  database.reservations.push({id:reservationId,requester_id:teacherId,cart_id:cartId,
    mode:'COMPLETA',quantity:20,needs_mouse:false,notes:null,status:'CONFIRMADA',created_at:new Date().toISOString()});
  database.reservation_periods.push({id:crypto.randomUUID(),reservation_id:reservationId,
    cart_id:cartId,usage_date:monday.toISOString().slice(0,10),shift:'MATUTINO',quantity:20,active:true});
  await login(page);
  await page.getByRole('button',{name:'Reservas',exact:true}).click();
  await page.getByRole('button',{name:'Cancelar reserva'}).click();
  await page.getByRole('button',{name:'Confirmar cancelamento'}).click();
  await expect(page.getByText(/Cancelamento registrado/)).toBeVisible();
  expect(database.reservations[0].status).toBe('CANCELADA');
  expect(database.reservation_periods[0].active).toBe(false);
  expect(database.reservation_events.some(e=>e.event_type==='CANCELAMENTO')).toBe(true);
});


test('Fase 4 — filtros semanais, contagem correta e exportação CSV/PDF',async({page})=>{
  const db=await useFakeSupabase(page);
  const cartId=crypto.randomUUID(),teacherId=crypto.randomUUID(),bookingId=crypto.randomUUID();
  db.carts.push({id:cartId,name:'Carrinho relatório',code:'C-REL',capacity:30,active:true});
  db.requesters.push({id:teacherId,name:'Professora Relatório',active:true});
  const monday=new Date(Date.now()+14*86400000);
  while(monday.getUTCDay()!==1)monday.setUTCDate(monday.getUTCDate()+1);
  const tuesday=new Date(monday.getTime()+86400000);
  const date1=monday.toISOString().slice(0,10),date2=tuesday.toISOString().slice(0,10);
  db.reservations.push({id:bookingId,requester_id:teacherId,cart_id:cartId,
    mode:'PARCIAL',quantity:10,needs_mouse:true,notes:'Teste de relatório',
    status:'CONFIRMADA',created_by:ADMIN_ID,created_at:new Date().toISOString()});
  db.reservation_periods.push(
    {id:crypto.randomUUID(),reservation_id:bookingId,cart_id:cartId,
      usage_date:date1,shift:'MATUTINO',quantity:10,active:true},
    {id:crypto.randomUUID(),reservation_id:bookingId,cart_id:cartId,
      usage_date:date2,shift:'VESPERTINO',quantity:10,active:false}
  );
  await login(page);
  await page.getByRole('button',{name:'Calendário',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Calendário e relatórios'})).toBeVisible();
  await page.locator('#calendar-focus').fill(date1);
  await page.locator('#calendar-cart').selectOption(cartId);
  await page.locator('#calendar-requester').selectOption(teacherId);
  await expect(page.locator('.calendar-event').getByText('Professora Relatório').first()).toBeVisible();
  const stats=page.locator('.calendar-stats');
  await expect(stats.getByText('Reservas agrupadas').locator('..').locator('strong')).toHaveText('1');
  await expect(stats.getByText('Períodos ocupados').locator('..').locator('strong')).toHaveText('1');
  await expect(stats.getByText('Linhas no relatório').locator('..').locator('strong')).toHaveText('1');
  await page.getByLabel('Incluir períodos cancelados nos resultados').check();
  await expect(stats.getByText('Linhas no relatório').locator('..').locator('strong')).toHaveText('2');
  const csvWait=page.waitForEvent('download');
  await page.getByRole('button',{name:'Planilha CSV'}).click();
  const csv=await csvWait;
  expect(csv.suggestedFilename()).toMatch(/educart.*\.csv$/);
  const csvContent=await readFile(await csv.path()!,'utf8');
  expect(csvContent).toContain('Professora Relatório');
  expect(csvContent).toContain('Cancelada');
  const pdfWait=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportar PDF'}).click();
  const pdf=await pdfWait;
  expect(pdf.suggestedFilename()).toMatch(/educart.*\.pdf$/);
  const pdfContent=await readFile(await pdf.path()!);
  expect(pdfContent.subarray(0,4).toString('ascii')).toBe('%PDF');
});

test('Fase 4 — calendário responsivo sem rolagem horizontal',async({page})=>{
  await page.setViewportSize({width:360,height:780});
  await useFakeSupabase(page);
  await login(page);
  await page.getByRole('button',{name:'Abrir menu lateral'}).click();
  await page.getByRole('navigation',{name:'Menu principal'})
    .getByRole('button',{name:'Calendário'}).click();
  await expect(page.getByRole('heading',{name:'Calendário e relatórios'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.locator('#calendar-mode').selectOption('mes');
  await expect(page.locator('.calendar-grid')).toBeVisible();
});


test('Fase 5 — ocupação 3D mantém capacidade e revela detalhes também via lista',async({page})=>{
  const db=await useFakeSupabase(page);
  const cartId=crypto.randomUUID(),teacherId=crypto.randomUUID();
  const periodId=crypto.randomUUID(),bookingId=crypto.randomUUID(), notebookId=crypto.randomUUID();
  const date=new Date(Date.now()+14*86400000);
  while(date.getUTCDay()===0||date.getUTCDay()===6)date.setUTCDate(date.getUTCDate()+1);
  const day=date.toISOString().slice(0,10);
  db.carts.push({id:cartId,name:'Carrinho 3D',code:'TRINTA',capacity:30,active:true});
  db.requesters.push({id:teacherId,name:'Professora 3D',active:true});
  db.notebook_codes.push({id:notebookId,cart_id:cartId,code:'NT-CONHECIDO',active:true});
  db.reservations.push({id:bookingId,requester_id:teacherId,cart_id:cartId,needs_mouse:true,notes:'Separar acessórios'});
  db.reservation_periods.push({id:periodId,reservation_id:bookingId,cart_id:cartId,usage_date:day,shift:'MATUTINO',quantity:10,active:true});
  db.reservation_notebooks.push({id:crypto.randomUUID(),period_id:periodId,notebook_id:notebookId,active:true});
  await login(page);
  await page.getByRole('button',{name:'Visualização 3D',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Laboratório móvel em 3D'})).toBeVisible();
  await page.locator('#visual-cart').selectOption(cartId);
  await page.locator('#visual-date').fill(day);
  await page.locator('#visual-shift').selectOption('MATUTINO');
  const stats=page.locator('.visual3d-stats');
  await expect(stats.getByText('Capacidade configurada').locator('..').locator('strong')).toHaveText('30');
  await expect(stats.getByText('Reservados').locator('..').locator('strong')).toHaveText('10');
  await expect(stats.getByText('Disponíveis').locator('..').locator('strong')).toHaveText('20');
  await expect(page.locator('.visual3d-slot')).toHaveCount(30);
  await page.getByLabel('Exibir modelo 3D').uncheck();
  await page.locator('.visual3d-slot').filter({hasText:'NT-CONHECIDO'}).click();
  await expect(page.locator('.visual3d-details')).toContainText('Professora 3D');
  await expect(page.locator('.visual3d-details')).toContainText('Confirmada');
  await expect(page.locator('.visual3d-details')).toContainText('Separar acessórios');
});

test('Fase 5 — navegação mobile e alternativa textual sem WebGL',async({page})=>{
  await page.setViewportSize({width:360,height:780});
  const db=await useFakeSupabase(page);
  db.carts.push({id:'cart-mobile',name:'Carrinho mobile',code:'C-M',capacity:4,active:true});
  await login(page);
  await page.getByRole('button',{name:'Abrir menu lateral'}).click();
  await page.getByRole('navigation',{name:'Menu principal'}).getByRole('button',{name:'Visualização 3D'}).click();
  await page.locator('#visual-cart').selectOption('cart-mobile');
  await page.getByLabel('Exibir modelo 3D').uncheck();
  await expect(page.locator('.visual3d-slot')).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});
