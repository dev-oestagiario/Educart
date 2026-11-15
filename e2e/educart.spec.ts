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
    carts: [], requesters: [], notebook_codes: [], reservations: [], reservation_periods: [], reservation_notebooks: [], reservation_events: [], teacher_account_links: [], reservation_requests: [], reservation_request_events: [], user_notifications: []
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

    if (url.pathname === '/rest/v1/rpc/mark_notification_read') {
      const body=req.postDataJSON() as {p_notification_id:string};
      const item=database.user_notifications.find(x=>x.id===body.p_notification_id&&x.recipient_user_id===ADMIN_ID);
      if(item)item.read_at=item.read_at??new Date().toISOString();
      await respond(!!item);return;
    }
    if (url.pathname === '/rest/v1/rpc/mark_all_notifications_read') {
      let modified=0;
      for(const item of database.user_notifications){
        if(item.recipient_user_id===ADMIN_ID&&item.read_at===null){
          item.read_at=new Date().toISOString();modified++;
        }
      }
      await respond(modified);return;
    }

    // Fase 8: leitura agregada por dia/turno, sem nomes, códigos ou reservas individuais.
    if (url.pathname === '/rest/v1/rpc/preview_teacher_availability') {
      const body=req.postDataJSON() as {p_cart_id:string;p_dates:string[];p_shifts:string[]};
      const authorizedReader=authorized||database.teacher_account_links.some(l=>l.user_id===ADMIN_ID&&l.active);
      const cart=database.carts.find(c=>c.id===body.p_cart_id&&c.active);
      if(!authorizedReader){await respond({message:'Conta não autorizada'},403);return;}
      if(!cart){await respond({message:'Carrinho inativo ou inexistente'},400);return;}
      if(!body.p_dates?.length||!body.p_shifts?.length){
        await respond({message:'Escolha datas e turnos'},400);return;
      }
      const rows=body.p_dates.flatMap(date=>body.p_shifts.map(shift=>{
        const booked=database.reservation_periods.filter(p=>
          p.cart_id===cart.id&&p.usage_date===date&&p.shift===shift&&p.active
        ).reduce((sum,p)=>sum+Number(p.quantity),0);
        return {usage_date:date,shift,capacity:Number(cart.capacity),
          reserved:booked,remaining:Math.max(0,Number(cart.capacity)-booked)};
      }));
      await respond(rows);return;
    }
    // Fase 6: simulação dos endpoints protegidos. Não acessa o Supabase real.
    if (url.pathname === '/rest/v1/rpc/list_teacher_accounts') {
      if(!authorized){await respond({message:'Sem permissão'},403);return;}
      await respond(database.teacher_account_links.map(link=>{
        const teacher=database.requesters.find(x=>x.id===link.requester_id);
        return {...link,requester_name:teacher?.name??'',email:link.email??'professor@escola.example'};
      }));
      return;
    }
    if (url.pathname === '/rest/v1/rpc/link_teacher_account') {
      if(!authorized){await respond({message:'Sem permissão'},403);return;}
      const body=req.postDataJSON() as {p_requester_id:string;p_email:string};
      if(!database.requesters.find(t=>t.id===body.p_requester_id)){
        await respond({message:'Professor não encontrado'},400);return;
      }
      const linkedUserId=crypto.randomUUID();
      database.teacher_account_links.push({user_id:linkedUserId,requester_id:body.p_requester_id,
        email:body.p_email,active:true});
      await respond(linkedUserId);return;
    }
    if (url.pathname === '/rest/v1/rpc/unlink_teacher_account') {
      if(!authorized){await respond({message:'Sem permissão'},403);return;}
      const body=req.postDataJSON() as {p_user_id:string};
      const link=database.teacher_account_links.find(l=>l.user_id===body.p_user_id);
      if(link)link.active=false;
      await respond(!!link);return;
    }
    if (url.pathname === '/rest/v1/rpc/submit_teacher_request') {
      const body=req.postDataJSON() as {
        p_cart_id:string;p_mode:'COMPLETA'|'PARCIAL';p_quantity:number;
        p_dates:string[];p_shifts:string[];p_notes:string|null;p_needs_mouse:boolean
      };
      const link=database.teacher_account_links.find(l=>l.user_id===ADMIN_ID&&l.active);
      const cart=database.carts.find(c=>c.id===body.p_cart_id&&c.active);
      if(!link||!cart){await respond({message:'Conta não autorizada'},403);return;}
      if(body.p_quantity>Number(cart.capacity)){await respond({message:'Quantidade acima da capacidade'},400);return;}
      const id=crypto.randomUUID();
      database.reservation_requests.push({
        id,requester_id:link.requester_id,requested_by:ADMIN_ID,cart_id:cart.id,mode:body.p_mode,
        quantity:body.p_quantity,dates:body.p_dates,shifts:body.p_shifts,
        notes:body.p_notes,needs_mouse:body.p_needs_mouse,status:'PENDENTE',review_notes:null,
        reservation_id:null,created_at:new Date().toISOString()
      });
      database.reservation_request_events.push({request_id:id,event_type:'CRIACAO',actor_id:ADMIN_ID});
      await respond(id);return;
    }
    if (url.pathname === '/rest/v1/rpc/withdraw_teacher_request') {
      const body=req.postDataJSON() as {p_request_id:string};
      const item=database.reservation_requests.find(x=>x.id===body.p_request_id&&x.requested_by===ADMIN_ID&&x.status==='PENDENTE');
      if(!item){await respond({message:'Solicitação não autorizada'},403);return;}
      item.status='DESISTENCIA';
      database.reservation_request_events.push({request_id:item.id,event_type:'DESISTENCIA',actor_id:ADMIN_ID});
      await respond(true);return;
    }
    if (url.pathname === '/rest/v1/rpc/review_teacher_request') {
      if(!authorized){await respond({message:'Sem permissão'},403);return;}
      const body=req.postDataJSON() as {p_request_id:string;p_approve:boolean;p_review_notes:string|null};
      const item=database.reservation_requests.find(x=>x.id===body.p_request_id&&x.status==='PENDENTE');
      if(!item){await respond({message:'Pedido não está pendente'},409);return;}
      const cart=database.carts.find(c=>c.id===item.cart_id&&c.active);
      if(!cart){await respond({message:'Carrinho não encontrado'},400);return;}
      const capacity=Number(cart.capacity);
      if(body.p_approve){
        for(const date of item.dates as string[])for(const shift of item.shifts as string[]){
          const reserved=database.reservation_periods.filter(p=>p.cart_id===cart.id&&p.usage_date===date&&p.shift===shift&&p.active)
            .reduce((sum,p)=>sum+Number(p.quantity),0);
          if(reserved+Number(item.quantity)>capacity){
            await respond({message:'Sem disponibilidade no momento da aprovação'},409);return;
          }
        }
        const reservationId=crypto.randomUUID();
        database.reservations.push({id:reservationId,requester_id:item.requester_id,cart_id:cart.id,
          mode:item.mode,quantity:item.quantity,needs_mouse:item.needs_mouse,notes:item.notes,
          created_at:new Date().toISOString(),status:'CONFIRMADA'});
        for(const date of item.dates as string[])for(const shift of item.shifts as string[]){
          database.reservation_periods.push({id:crypto.randomUUID(),reservation_id:reservationId,
            cart_id:cart.id,usage_date:date,shift,quantity:item.quantity,active:true});
        }
        item.reservation_id=reservationId;
      }
      item.status=body.p_approve?'APROVADA':'REJEITADA';
      item.review_notes=body.p_review_notes;
      item.reviewed_at=new Date().toISOString();
      database.reservation_request_events.push({request_id:item.id,
        event_type:body.p_approve?'APROVACAO':'REJEICAO',actor_id:ADMIN_ID});
      await respond(item.reservation_id);return;
    }
    const table = url.pathname.slice('/rest/v1/'.length);
    if (Object.prototype.hasOwnProperty.call(database, table)) {
      if (req.method() === 'GET') {
        const rows=table==='user_notifications'?
          database[table].filter(item=>item.recipient_user_id===ADMIN_ID):database[table];
        await respond(rows); return;
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
  await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
  await page.getByLabel('Código do carrinho').fill('C-01');
  await page.getByLabel('Nome do laboratório móvel').fill('Laboratório 1');
  await page.getByLabel('Capacidade de notebooks').fill('30');
  await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
  await expect(page.getByText('C-01 · 30 notebooks de capacidade')).toBeVisible();
  await page.getByRole('button',{name:'Professores',exact:true}).click();
  await page.getByRole('button',{name:'Cadastrar professor'}).click();
  await page.getByLabel('Nome completo').fill('Professora Exemplo');
  await page.getByRole('button',{name:'Salvar professor'}).click();
  await expect(page.getByText('Professora Exemplo')).toBeVisible();
});

test('CSV mostra prévia editável e impede duplicação de notebook', async ({page}) => {
  await useFakeSupabase(page);
  await login(page);
  await page.getByRole('button',{name:'Carrinhos',exact:true}).click();
  await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
  await page.getByLabel('Código do carrinho').fill('C-01');
  await page.getByLabel('Nome do laboratório móvel').fill('Laboratório 1');
  await page.getByLabel('Capacidade de notebooks').fill('30');
  await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
  await expect(page.getByText('C-01 · 30 notebooks de capacidade')).toBeVisible();
  await page.getByRole('button',{name:'Notebooks',exact:true}).click();
  await page.getByLabel('Laboratório móvel').selectOption({label:'Laboratório 1 (C-01)'});
  await page.getByRole('button',{name:'Cadastrar notebooks'}).click();
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
  await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
  await page.getByLabel('Código do carrinho').fill('CXLSX');
  await page.getByLabel('Nome do laboratório móvel').fill('Carrinho de planilhas');
  await page.getByLabel('Capacidade de notebooks').fill('30');
  await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
  await expect(page.getByText('CXLSX · 30 notebooks de capacidade')).toBeVisible();
  await page.getByRole('button',{name:'Notebooks',exact:true}).click();
  await page.getByLabel('Laboratório móvel').selectOption({label:'Carrinho de planilhas (CXLSX)'});
  await page.getByRole('button',{name:'Cadastrar notebooks'}).click();
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
  const cartId=crypto.randomUUID(), requesterId=crypto.randomUUID();
  database.carts.push({id:cartId,name:'Carrinho de teste',code:'C-01',capacity:30,active:true,created_at:new Date().toISOString()});
  database.requesters.push({id:requesterId,name:'Professora Reserva',reference_code:'R-1',active:true,created_at:new Date().toISOString()});
  await login(page);
  await page.getByRole('button',{name:'Reservas',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Reservas',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Nova reserva'})).toHaveCount(0);
  await page.getByRole('button',{name:'Nova reserva'}).click();
  await expect(page.getByRole('heading',{name:'Nova reserva'})).toBeVisible();

  const monday=new Date(Date.now()+14*24*60*60*1000);
  while(monday.getUTCDay()!==1)monday.setUTCDate(monday.getUTCDate()+1);
  const iso=monday.toISOString().slice(0,10);
  await page.getByLabel('Professor solicitante').selectOption(requesterId);
  await page.locator('#reservation-cart').selectOption(cartId);
  await chooseReservationDate(page,iso);
  await page.getByRole('radio',{name:'Notebooks avulsos'}).check();
  await page.getByLabel('Quantidade de notebooks').fill('10');
  await expect(page.getByText('30/30')).toBeVisible();
  await page.getByRole('button',{name:'Confirmar reserva'}).click();
  await expect(page.getByText('Reserva confirmada para todos os períodos selecionados.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Reservas cadastradas'})).toBeVisible();
  expect(database.reservations).toHaveLength(1);
  expect(database.reservation_periods).toHaveLength(1);

  await page.getByRole('button',{name:'Nova reserva'}).click();
  await page.getByLabel('Professor solicitante').selectOption(requesterId);
  await page.locator('#reservation-cart').selectOption(cartId);
  await chooseReservationDate(page,iso);
  await expect(page.getByText('20/30')).toBeVisible();
  await expect(page.getByRole('button',{name:'Confirmar reserva'})).toBeDisabled();
  await expect(page.getByText('Conflito',{exact:true})).toBeVisible();
  await page.getByLabel('Manhã').uncheck();
  await page.getByLabel('Tarde').check();
  await expect(page.getByText('30/30')).toBeVisible();
  await expect(page.getByRole('button',{name:'Confirmar reserva'})).toBeEnabled();
});

test('Fase 2 — calendário visual desativa sábado e domingo', async ({page})=>{
  const database=await useFakeSupabase(page);
  const cartId=crypto.randomUUID(), requesterId=crypto.randomUUID();
  database.carts.push({id:cartId,name:'Carrinho 2',code:'C-02',capacity:30,active:true,created_at:new Date().toISOString()});
  database.requesters.push({id:requesterId,name:'Professora Data',active:true,created_at:new Date().toISOString()});
  await login(page);
  await page.getByRole('button',{name:'Reservas',exact:true}).click();
  await page.getByRole('button',{name:'Nova reserva'}).click();
  await page.getByLabel('Professor solicitante').selectOption(requesterId);
  await page.locator('#reservation-cart').selectOption(cartId);
  await page.locator('#reservation-date-trigger').click();
  await page.getByRole('button',{name:'Dias avulsos'}).click();
  const saturday=new Date(Date.now()+14*24*60*60*1000);
  while(saturday.getUTCDay()!==6)saturday.setUTCDate(saturday.getUTCDate()+1);
  const weekend=await findCalendarDay(page,saturday.toISOString().slice(0,10));
  await expect(weekend).toBeDisabled();
  await expect(page.getByRole('button',{name:'Concluir'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Escolha das datas'})).toHaveCount(0);
});

test('Fase 3 — cancelamento individual preserva outro período e edição registra histórico',async({page})=>{
  const database=await useFakeSupabase(page);
  const cartId=crypto.randomUUID(),teacherId=crypto.randomUUID();
  database.carts.push({id:cartId,name:'Carrinho gestão',code:'C-GESTAO',capacity:30,active:true,created_at:new Date().toISOString()});
  database.requesters.push({id:teacherId,name:'Professor Gestão',active:true,created_at:new Date().toISOString()});
  await login(page);
  await page.getByRole('button',{name:'Reservas',exact:true}).click();
  await page.getByRole('button',{name:'Nova reserva'}).click();

  const monday=new Date(Date.now()+14*24*60*60*1000);
  while(monday.getUTCDay()!==1)monday.setUTCDate(monday.getUTCDate()+1);
  const tuesday=new Date(monday.getTime()+24*60*60*1000);
  const start=monday.toISOString().slice(0,10),end=tuesday.toISOString().slice(0,10);

  await page.getByLabel('Professor solicitante').selectOption(teacherId);
  await page.locator('#reservation-cart').selectOption(cartId);
  await chooseReservationRange(page,start,end);
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
  await expect(page.getByText('Histórico de alterações')).toHaveCount(0);
  await page.getByLabel('Quantidade de notebooks').fill('5');
  await page.getByRole('button',{name:'Salvar alterações'}).click();
  await expect(page.getByText('Reserva editada e alteração registrada no histórico.')).toBeVisible();
  expect(database.reservations[0].quantity).toBe(5);
  expect(database.reservation_events.filter(e=>e.event_type==='EDICAO')).toHaveLength(1);

  await page.getByRole('button',{name:'Ver histórico'}).click();
  await expect(page.getByRole('heading',{name:'Auditoria de reservas'})).toBeVisible();
  await page.getByRole('button',{name:'Voltar à lista'}).click();
  await expect(page.getByRole('heading',{name:'Reservas cadastradas'})).toBeVisible();
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


test('Fase 6 — professor vinculado envia e retira pedido, sem ocupar capacidade',async({page})=>{
  const db=await useFakeSupabase(page,false);
  const cartId=crypto.randomUUID(),teacherId=crypto.randomUUID();
  db.carts.push({id:cartId,name:'Carrinho professor',code:'CT-01',capacity:30,active:true});
  db.requesters.push({id:teacherId,name:'Professora Vinculada',active:true});
  db.teacher_account_links.push({user_id:ADMIN_ID,requester_id:teacherId,active:true});
  await login(page);
  await expect(page.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Solicitações'})).toHaveCount(0);
  await page.getByRole('button',{name:'Nova solicitação'}).click();
  await page.locator('#teacher-cart').selectOption(cartId);
  await page.locator('#teacher-quantity').fill('7');
  const d=new Date(Date.now()+14*86400000);
  while(d.getUTCDay()===0||d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()+1);
  const day=d.toISOString().slice(0,10);
  await page.locator('#teacher-start').fill(day);
  await page.locator('#teacher-end').fill(day);
  await page.getByRole('button',{name:'Enviar solicitação para aprovação'}).click();
  await expect(page.getByText(/Solicitação enviada à TI/)).toBeVisible();
  expect(db.reservation_requests).toHaveLength(1);
  expect(db.reservation_requests[0].status).toBe('PENDENTE');
  expect(db.reservation_periods).toHaveLength(0);
  await page.getByRole('button',{name:'Retirar pedido pendente'}).click();
  await page.getByRole('button',{name:'Confirmar retirada'}).click();
  await expect(page.getByText('Retirada pelo professor')).toBeVisible();
  expect(db.reservation_requests[0].status).toBe('DESISTENCIA');
});

test('Fase 6 — TI vincula conta e aprova pedido gerando reserva',async({page})=>{
  const db=await useFakeSupabase(page);
  const cartId=crypto.randomUUID(),teacherId=crypto.randomUUID(),requestId=crypto.randomUUID();
  db.carts.push({id:cartId,name:'Carrinho Aprovado',code:'CA-01',capacity:30,active:true});
  db.requesters.push({id:teacherId,name:'Professora Aprovada',active:true});
  const d=new Date(Date.now()+14*86400000);
  while(d.getUTCDay()===0||d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()+1);
  db.reservation_requests.push({id:requestId,requester_id:teacherId,requested_by:crypto.randomUUID(),
    cart_id:cartId,mode:'PARCIAL',quantity:7,dates:[d.toISOString().slice(0,10)],shifts:['MATUTINO'],
    needs_mouse:true,notes:'Solicitar mouse',status:'PENDENTE',created_at:new Date().toISOString(),
    reservation_id:null,review_notes:null});
  await login(page);
  await page.getByRole('button',{name:'Solicitações',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Solicitações de professores'})).toBeVisible();
  await page.getByRole('button',{name:'Vincular conta'}).click();
  await expect(page.getByRole('heading',{name:'Vincular conta de professor'})).toBeVisible();
  await page.locator('#teacher-link-requester').selectOption(teacherId);
  await page.locator('#teacher-link-email').fill('professora@escola.example');
  await page.getByRole('button',{name:'Vincular professor'}).click();
  await expect(page.getByText('Conta vinculada. O professor já pode enviar solicitações.')).toBeVisible();
  expect(db.teacher_account_links).toHaveLength(1);
  await page.getByRole('button',{name:'Aprovar e confirmar reserva'}).click();
  await expect(page.getByText('Solicitação aprovada e reserva confirmada.')).toBeVisible();
  expect(db.reservation_requests[0].status).toBe('APROVADA');
  expect(db.reservations).toHaveLength(1);
  expect(db.reservation_periods).toHaveLength(1);
  expect(db.reservation_periods[0].quantity).toBe(7);
});

test('Fase 6 — TI recusa aprovação se saldo mudou e preserva pendência',async({page})=>{
  const db=await useFakeSupabase(page);
  const cartId=crypto.randomUUID(),teacherId=crypto.randomUUID(),requestId=crypto.randomUUID();
  const d=new Date(Date.now()+14*86400000);
  while(d.getUTCDay()===0||d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()+1);
  const day=d.toISOString().slice(0,10);
  db.carts.push({id:cartId,name:'Carrinho Lotado',code:'CL-01',capacity:10,active:true});
  db.requesters.push({id:teacherId,name:'Professor Esperando',active:true});
  db.reservation_requests.push({id:requestId,requester_id:teacherId,requested_by:crypto.randomUUID(),
    cart_id:cartId,mode:'PARCIAL',quantity:7,dates:[day],shifts:['MATUTINO'],
    needs_mouse:false,notes:null,status:'PENDENTE',created_at:new Date().toISOString()});
  db.reservation_periods.push({id:crypto.randomUUID(),reservation_id:crypto.randomUUID(),cart_id:cartId,
    usage_date:day,shift:'MATUTINO',quantity:9,active:true});
  await login(page);
  await page.getByRole('button',{name:'Solicitações',exact:true}).click();
  await page.getByRole('button',{name:'Aprovar e confirmar reserva'}).click();
  await expect(page.getByRole('alert')).toContainText('Sem disponibilidade');
  expect(db.reservation_requests[0].status).toBe('PENDENTE');
  expect(db.reservations).toHaveLength(0);
});


test('Fase 7 — admin recebe aviso, marca como lido e abre solicitações',async({page})=>{
  const db=await useFakeSupabase(page);
  db.user_notifications.push({
    id:crypto.randomUUID(),recipient_user_id:ADMIN_ID,request_id:crypto.randomUUID(),
    kind:'NOVO_PEDIDO',title:'Nova solicitação de reserva',
    body:'Um professor enviou uma solicitação. Acesse a fila para analisar.',
    read_at:null,created_at:new Date().toISOString()
  });
  await login(page);
  await expect(page.getByRole('heading',{name:'Visão geral'})).toBeVisible();
  const bell=page.getByRole('button',{name:/Notificações, 1 não lida/});
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByRole('heading',{name:'Notificações'})).toBeVisible();
  await expect(page.getByText('Nova solicitação de reserva')).toBeVisible();
  await page.getByRole('button',{name:'Marcar como lida',exact:true}).click();
  await expect(page.getByText('0 notificação(ões) não lida(s)')).toBeVisible();
  await expect(page.locator('.notifications-trigger')).toBeVisible();
  expect(db.user_notifications[0].read_at).not.toBeNull();
  await page.getByRole('button',{name:'Abrir solicitações'}).click();
  await expect(page.getByRole('heading',{name:'Solicitações de professores'})).toBeVisible();
});

test('Fase 7 — professor recebe decisão somente na própria caixa e volta ao portal',async({page})=>{
  await page.setViewportSize({width:360,height:780});
  const db=await useFakeSupabase(page,false);
  const requesterId=crypto.randomUUID();
  db.requesters.push({id:requesterId,name:'Professora das notificações',active:true});
  db.teacher_account_links.push({user_id:ADMIN_ID,requester_id:requesterId,active:true});
  for(const kind of ['PEDIDO_APROVADO','PEDIDO_REJEITADO']){
    db.user_notifications.push({
      id:crypto.randomUUID(),recipient_user_id:ADMIN_ID,request_id:crypto.randomUUID(),
      kind,title:kind==='PEDIDO_APROVADO'?'Solicitação aprovada':'Solicitação rejeitada',
      body:'Confira o status do pedido no portal.',
      read_at:null,created_at:new Date().toISOString()
    });
  }
  // Uma notificação de outra conta nunca deve ser exibida pelo backend RLS;
  // o fake filtra manualmente os dados da identidade autenticada.
  db.user_notifications.push({
    id:crypto.randomUUID(),recipient_user_id:crypto.randomUUID(),request_id:crypto.randomUUID(),
    kind:'PEDIDO_APROVADO',title:'Aviso de outra pessoa',body:'Mensagem privada',
    read_at:null,created_at:new Date().toISOString()
  });
  await login(page);
  await expect(page.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible();
  await page.getByRole('button',{name:/Notificações, 2 não lidas/}).click();
  await expect(page.getByRole('heading',{name:'Notificações'})).toBeVisible();
  await expect(page.getByText('Solicitação aprovada')).toBeVisible();
  await expect(page.getByText('Solicitação rejeitada')).toBeVisible();
  await expect(page.getByText('Aviso de outra pessoa')).toHaveCount(0);
  await page.getByRole('button',{name:'Marcar todas como lidas'}).click();
  await expect(page.getByText('0 notificação(ões) não lida(s)')).toBeVisible();
  expect(db.user_notifications.filter(x=>x.recipient_user_id===ADMIN_ID).every(x=>x.read_at!==null)).toBe(true);
  expect(db.user_notifications.find(x=>x.title==='Aviso de outra pessoa')?.read_at).toBeNull();
  await page.getByRole('button',{name:'Voltar ao portal'}).click();
  await expect(page.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible();
  const noOverflow=await page.evaluate(()=>
    document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);
  expect(noOverflow).toBe(true);
});

test('Fase 7 — não é possível marcar notificação de outro usuário',async({page})=>{
  const db=await useFakeSupabase(page);
  db.user_notifications.push({
    id:crypto.randomUUID(),recipient_user_id:crypto.randomUUID(),request_id:crypto.randomUUID(),
    kind:'NOVO_PEDIDO',title:'Privada',body:'Apenas outro destinatário',read_at:null,
    created_at:new Date().toISOString()
  });
  await login(page);
  await page.locator('.notifications-trigger').click();
  await expect(page.getByText('Não há notificações ainda. As atualizações aparecerão aqui quando houver solicitações ou decisões da TI.')).toBeVisible();
  expect(db.user_notifications[0].read_at).toBeNull();
});


test('Fase 8 — professor consulta saldo sem códigos físicos e sem contar pendências',async({page})=>{
  const db=await useFakeSupabase(page,false);
  const cartId=crypto.randomUUID(),teacherId=crypto.randomUUID();
  const d=new Date(Date.now()+14*86400000);
  while(d.getUTCDay()===0||d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()+1);
  const day=d.toISOString().slice(0,10);
  db.carts.push({id:cartId,code:'CAP-30',name:'Carrinho Capacidade',capacity:30,active:true});
  db.requesters.push({id:teacherId,name:'Professora Disponibilidade',active:true});
  db.teacher_account_links.push({user_id:ADMIN_ID,requester_id:teacherId,active:true});
  db.reservation_periods.push({
    id:crypto.randomUUID(),reservation_id:crypto.randomUUID(),cart_id:cartId,
    usage_date:day,shift:'MATUTINO',quantity:12,active:true
  });
  db.reservation_requests.push({
    id:crypto.randomUUID(),cart_id:cartId,requester_id:teacherId,requested_by:ADMIN_ID,
    quantity:5,mode:'PARCIAL',dates:[day],shifts:['MATUTINO'],
    status:'PENDENTE',needs_mouse:false,notes:null,review_notes:null,reservation_id:null,
    created_at:new Date().toISOString()
  });
  await page.setViewportSize({width:360,height:780});
  await login(page);
  await expect(page.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible();
  await page.getByRole('button',{name:'Nova solicitação'}).click();
  await page.locator('#teacher-cart').selectOption(cartId);
  await page.locator('#teacher-start').fill(day);
  await page.locator('#teacher-end').fill(day);
  await expect(page.getByText(/1 de 1 períodos possuem saldo estimado para 1 notebook/)).toBeVisible();
  await page.getByText(/Ver saldo por data e turno/).click();
  const detail=page.locator('.teacher-availability-table-wrap');
  await expect(detail.getByRole('row')).toHaveCount(2);
  await expect(detail.getByRole('cell',{name:'30'})).toBeVisible();
  await expect(detail.getByRole('cell',{name:'12'})).toBeVisible();
  await expect(detail.getByRole('cell',{name:'18'})).toBeVisible();
  await page.locator('#teacher-quantity').fill('20');
  await expect(page.getByText(/Saldo abaixo do solicitado em 1 período/)).toBeVisible();
  await expect(page.getByText(/18 disponível\(is\) de 30/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Enviar solicitação para aprovação'})).toBeEnabled();
  expect(db.notebook_codes).toHaveLength(0);
  expect(await page.evaluate(()=>
    document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});

test('Fase 8 — sem reservas confirmadas, capacidade permanece 30 e pedidos pendentes não ocupam',async({page})=>{
  const db=await useFakeSupabase(page,false);
  const cartId=crypto.randomUUID(),teacherId=crypto.randomUUID();
  db.carts.push({id:cartId,code:'L-30',name:'Carrinho Livre',capacity:30,active:true});
  db.requesters.push({id:teacherId,name:'Professor Livre',active:true});
  db.teacher_account_links.push({user_id:ADMIN_ID,requester_id:teacherId,active:true});
  const d=new Date(Date.now()+21*86400000);
  while(d.getUTCDay()===0||d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()+1);
  const day=d.toISOString().slice(0,10);
  db.reservation_requests.push({
    id:crypto.randomUUID(),cart_id:cartId,requester_id:teacherId,requested_by:ADMIN_ID,
    quantity:30,mode:'COMPLETA',dates:[day],shifts:['MATUTINO'],status:'PENDENTE',
    needs_mouse:false,notes:null,review_notes:null,reservation_id:null,
    created_at:new Date().toISOString()
  });
  await login(page);
  await page.getByRole('button',{name:'Nova solicitação'}).click();
  await page.locator('#teacher-cart').selectOption(cartId);
  await page.locator('#teacher-start').fill(day);
  await page.locator('#teacher-end').fill(day);
  await page.getByLabel('Carrinho completo').check();
  await expect(page.getByText(/1 de 1 períodos possuem saldo estimado para 30 notebook/)).toBeVisible();
  await page.getByText(/Ver saldo por data e turno/).click();
  await expect(page.locator('.teacher-availability-table-wrap').getByRole('cell',{name:'0',exact:true})).toBeVisible();
  await expect(page.locator('.teacher-availability-table-wrap').getByRole('cell',{name:'30'})).toHaveCount(2);
});

test('Fase 8 — indisponibilidade da consulta não inventa saldo nem bloqueia o pedido',async({page})=>{
  const db=await useFakeSupabase(page,false);
  const cartId=crypto.randomUUID(),teacherId=crypto.randomUUID();
  db.carts.push({id:cartId,code:'C-ERRO',name:'Carrinho Erro',capacity:20,active:true});
  db.requesters.push({id:teacherId,name:'Professor Erro',active:true});
  db.teacher_account_links.push({user_id:ADMIN_ID,requester_id:teacherId,active:true});
  await page.route('https://educart-e2e.supabase.co/rest/v1/rpc/preview_teacher_availability',
    route=>route.fulfill({status:500,headers:{
      'access-control-allow-origin':'*','content-type':'application/json'
    },json:{message:'Serviço temporariamente indisponível'}}));
  await login(page);
  await page.getByRole('button',{name:'Nova solicitação'}).click();
  await page.locator('#teacher-cart').selectOption(cartId);
  await expect(page.getByRole('alert')).toContainText('Não foi possível consultar o saldo agora');
  await expect(page.getByRole('button',{name:'Enviar solicitação para aprovação'})).toBeEnabled();
  await expect(page.getByText(/1 de 1 períodos possuem saldo estimado/)).toHaveCount(0);
});


async function findCalendarDay(page:Page,iso:string){
  const label=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric'})
    .format(new Date(iso+'T12:00:00Z'));
  const selector=page.getByRole('button',{name:'Selecionar '+label});
  for(let i=0;i<14;i++){
    if(await selector.isVisible().catch(()=>false))return selector;
    await page.getByRole('button',{name:'Próximo mês'}).click();
  }
  throw new Error('O calendário não mostrou o dia '+iso);
}
async function chooseReservationDate(page:Page,iso:string){
  await page.locator('#reservation-date-trigger').click();
  await (await findCalendarDay(page,iso)).click();
}
async function chooseReservationRange(page:Page,start:string,end:string){
  await page.locator('#reservation-date-trigger').click();
  await page.getByRole('button',{name:'Período',exact:true}).click();
  await (await findCalendarDay(page,start)).click();
  await (await findCalendarDay(page,end)).click();
}

test('UX de reservas — lista inicial, filtro e formulário limpo',async({page})=>{
  const database=await useFakeSupabase(page);
  const cartId=crypto.randomUUID(),teacherId=crypto.randomUUID(),resId=crypto.randomUUID();
  database.carts.push({id:cartId,name:'Carrinho de Informática',code:'CI-01',capacity:30,active:true});
  database.requesters.push({id:teacherId,name:'Professor de Informática',active:true});
  database.reservations.push({id:resId,requester_id:teacherId,cart_id:cartId,
    mode:'COMPLETA',quantity:30,needs_mouse:false,notes:null,status:'CONFIRMADA',
    created_at:new Date().toISOString()});
  await login(page);
  await page.getByRole('button',{name:'Reservas',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Reservas cadastradas'})).toBeVisible();
  await expect(page.getByText('Professor de Informática')).toBeVisible();
  await page.locator('#reservation-search').fill('não existe');
  await expect(page.getByText('Nenhuma reserva corresponde à busca ou ao filtro.')).toBeVisible();
  await page.locator('#reservation-search').fill('Informática');
  await expect(page.getByText('Professor de Informática')).toBeVisible();
  await page.getByRole('button',{name:'Nova reserva'}).click();
  await expect(page.getByRole('heading',{name:'Nova reserva'})).toBeVisible();
  await expect(page.locator('.reservation-form-panel')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'Reservas cadastradas'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Histórico de alterações'})).toHaveCount(0);
  await expect(page.getByText('Notebooks identificados (opcional)')).toHaveCount(0);
  await page.getByRole('radio',{name:'Notebooks avulsos'}).check();
  await expect(page.getByText('Notebooks identificados (opcional)')).toBeVisible();
  await page.getByRole('radio',{name:'Carrinho completo'}).check();
  await expect(page.getByText('Notebooks identificados (opcional)')).toHaveCount(0);
  await page.getByRole('button',{name:'Voltar para reservas'}).click();
  await expect(page.getByRole('heading',{name:'Reservas cadastradas'})).toBeVisible();
});

test('UX de reservas — calendário oferece dia, semana, mês e datas avulsas no celular',async({page})=>{
  await page.setViewportSize({width:360,height:780});
  await useFakeSupabase(page);
  await login(page);
  await page.getByRole('button',{name:'Abrir menu lateral'}).click();
  await page.getByRole('navigation',{name:'Menu principal'}).getByRole('button',{name:'Reservas',exact:true}).click();
  await page.getByRole('button',{name:'Nova reserva'}).click();
  await page.locator('#reservation-date-trigger').click();
  await expect(page.getByRole('button',{name:'1 dia'})).toBeVisible();
  await page.getByRole('button',{name:'1 semana'}).click();
  await expect(page.getByText('5 dia(s)')).toBeVisible();
  await page.locator('#reservation-date-trigger').click();
  await page.getByRole('button',{name:'1 mês'}).click();
  await expect(page.getByText(/\d+ dia\(s\)/).first()).toBeVisible();
  await page.locator('#reservation-date-trigger').click();
  await page.getByRole('button',{name:'Dias avulsos'}).click();
  await expect(page.getByRole('button',{name:'Concluir'})).toBeVisible();
  await expect(page.locator('.reservation-date-popover')).toBeVisible();
  expect(await page.evaluate(()=>
    document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});


test('Cadastros — todas as telas abrem primeiro na listagem e oferecem criar/editar separadamente',async({page})=>{
  const db=await useFakeSupabase(page);
  const cartId=crypto.randomUUID(),requesterId=crypto.randomUUID();
  db.carts.push({id:cartId,name:'Laboratório Móvel',code:'C-100',capacity:25,active:true,
    created_at:new Date().toISOString()});
  db.requesters.push({id:requesterId,name:'Professora Alfa',reference_code:'REF-01',active:true,
    created_at:new Date().toISOString()});
  db.notebook_codes.push({id:crypto.randomUUID(),cart_id:cartId,code:'NB-100',active:true,
    created_at:new Date().toISOString()});
  await login(page);

  await page.getByRole('button',{name:'Carrinhos',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Carrinhos',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Carrinhos cadastrados'})).toBeVisible();
  await expect(page.getByLabel('Código do carrinho')).toHaveCount(0);
  await page.getByLabel('Buscar carrinho').fill('não existe');
  await expect(page.getByText('Nenhum carrinho corresponde à busca.')).toBeVisible();
  await page.getByLabel('Buscar carrinho').fill('Móvel');
  await page.getByRole('button',{name:'Editar'}).click();
  await expect(page.getByRole('heading',{name:'Editar carrinho'})).toBeVisible();
  await expect(page.getByLabel('Capacidade de notebooks')).toHaveValue('25');
  await page.getByLabel('Nome do laboratório móvel').fill('Laboratório Móvel Atualizado');
  await page.getByRole('button',{name:'Salvar alterações'}).click();
  await expect(page.getByText('Carrinho atualizado.')).toBeVisible();
  await expect(page.getByText('Laboratório Móvel Atualizado')).toBeVisible();
  await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
  await expect(page.getByLabel('Código do carrinho')).toBeVisible();
  await page.getByRole('button',{name:'Voltar para carrinhos'}).click();
  await expect(page.getByLabel('Código do carrinho')).toHaveCount(0);

  await page.getByRole('button',{name:'Professores',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Professores cadastrados'})).toBeVisible();
  await expect(page.getByLabel('Nome completo')).toHaveCount(0);
  await page.getByLabel('Buscar professor').fill('Alfa');
  await expect(page.getByText('Professora Alfa')).toBeVisible();
  await page.getByRole('button',{name:'Editar'}).click();
  await expect(page.getByRole('heading',{name:'Editar professor'})).toBeVisible();
  await page.getByLabel('Nome completo').fill('Professora Alfa Atualizada');
  await page.getByRole('button',{name:'Salvar alterações'}).click();
  await expect(page.getByText('Professora Alfa Atualizada')).toBeVisible();
  await page.getByRole('button',{name:'Cadastrar professor'}).click();
  await expect(page.getByLabel('Nome completo')).toHaveValue('');
  await page.getByRole('button',{name:'Voltar para professores'}).click();
  await expect(page.getByLabel('Nome completo')).toHaveCount(0);

  await page.getByRole('button',{name:'Notebooks',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Notebooks cadastrados'})).toBeVisible();
  await expect(page.locator('#codes')).toHaveCount(0);
  await expect(page.getByText('NB-100',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cadastrar notebooks'}).click();
  await expect(page.getByLabel('Códigos (um por linha)')).toBeVisible();
  await page.getByRole('button',{name:'Voltar para notebooks'}).click();
  await expect(page.locator('#codes')).toHaveCount(0);
});

test('Cadastros — formulário não invade a listagem em telas pequenas',async({page})=>{
  await useFakeSupabase(page);
  await login(page);
  for(const width of [320,360,390]){
    await page.setViewportSize({width,height:780});
    const opener=page.getByRole('button',{name:'Abrir menu lateral'});
    const nav=page.getByRole('navigation',{name:'Menu principal'});
    for(const [section,button,form] of [
      ['Carrinhos','Cadastrar carrinho','#cart-code'],
      ['Professores','Cadastrar professor','#teacher-name'],
      ['Notebooks','Cadastrar notebooks','#codes']
    ]){
      await opener.click();
      await nav.getByRole('button',{name:section,exact:true}).click();
      await expect(page.locator(form)).toHaveCount(0);
      await page.getByRole('button',{name:button}).click();
      await expect(page.locator(form)).toBeVisible();
      const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);
      expect(noOverflow,'Sem rolagem horizontal em '+section+' a '+width+'px').toBe(true);
    }
  }
});


test('Cadastro de vínculos — formulário separado e retorno à lista da TI',async({page})=>{
  const db=await useFakeSupabase(page);
  db.requesters.push({id:crypto.randomUUID(),name:'Professor de teste',active:true});
  await login(page);
  await page.getByRole('button',{name:'Solicitações',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Solicitações de professores'})).toBeVisible();
  await expect(page.locator('#teacher-link-email')).toHaveCount(0);
  await page.getByRole('button',{name:'Vincular conta'}).click();
  await expect(page.locator('#teacher-link-email')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Solicitações de professores'})).toHaveCount(0);
  await page.getByRole('button',{name:'Voltar para solicitações'}).click();
  await expect(page.getByRole('heading',{name:'Solicitações de professores'})).toBeVisible();
  await expect(page.locator('#teacher-link-email')).toHaveCount(0);
});
test('Portal do professor — listagem inicial, formulário só sob demanda',async({page})=>{
  const db=await useFakeSupabase(page,false);
  const requesterId=crypto.randomUUID();
  db.requesters.push({id:requesterId,name:'Professor Listagem',active:true});
  db.teacher_account_links.push({user_id:ADMIN_ID,requester_id:requesterId,active:true});
  await login(page);
  await expect(page.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible();
  await expect(page.locator('#teacher-cart')).toHaveCount(0);
  await page.getByRole('button',{name:'Nova solicitação'}).click();
  await expect(page.getByRole('heading',{name:'Solicitar laboratório móvel'})).toBeVisible();
  await expect(page.locator('#teacher-cart')).toBeVisible();
  await page.getByRole('button',{name:'Voltar para solicitações'}).click();
  await expect(page.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible();
  await expect(page.locator('#teacher-cart')).toHaveCount(0);
});


// Regressão de viewport: dimensões de monitores/notebooks, incluindo baixa altura.
async function expectDesktopViewportFit(page:Page,width:number,height:number){
  const layout=await page.evaluate(()=>{
    const shell=document.querySelector<HTMLElement>('.app-shell');
    const sidebar=document.querySelector<HTMLElement>('.sidebar');
    const main=document.getElementById('main-content');
    const header=document.querySelector<HTMLElement>('.topbar');
    const content=document.querySelector<HTMLElement>('.content');
    if(!shell||!sidebar||!main||!header||!content)throw new Error('Estrutura principal não localizada');
    const r=(node:HTMLElement)=>node.getBoundingClientRect();
    const shellRect=r(shell),navRect=r(sidebar),mainRect=r(main),headerRect=r(header),contentRect=r(content);
    return {
      overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      shellTop:shellRect.top,shellBottom:shellRect.bottom,shellWidth:shellRect.width,
      sidebarHeight:navRect.height,sidebarTop:navRect.top,
      mainRight:mainRect.right,mainHeight:mainRect.height,
      headerBottom:headerRect.bottom,
      contentTop:contentRect.top,contentBottom:contentRect.bottom,
      contentClientHeight:content.clientHeight,contentScrollHeight:content.scrollHeight,
      bodyScrollY:window.scrollY
    };
  });
  expect(layout.overflowX,'Documento não deve ter rolagem horizontal').toBeLessThanOrEqual(1);
  expect(layout.shellWidth,'Shell deve preencher a largura disponível').toBeLessThanOrEqual(width+1);
  expect(layout.shellTop).toBeGreaterThanOrEqual(-1);
  expect(layout.shellBottom,'Shell não pode ultrapassar a altura do viewport').toBeLessThanOrEqual(height+1);
  expect(layout.sidebarHeight,'Menu deve ocupar só a altura da janela').toBeLessThanOrEqual(height+1);
  expect(layout.sidebarTop).toBeGreaterThanOrEqual(-1);
  expect(layout.mainRight,'Conteúdo principal não pode ficar fora do viewport').toBeLessThanOrEqual(width+1);
  expect(layout.mainHeight).toBeLessThanOrEqual(height+1);
  expect(layout.contentTop).toBeGreaterThanOrEqual(layout.headerBottom-1);
  expect(layout.contentBottom).toBeLessThanOrEqual(height+1);
  expect(layout.contentClientHeight).toBeGreaterThan(100);
  expect(layout.bodyScrollY).toBe(0);
}

test('Responsivo desktop — largura e altura se adaptam em oito tamanhos de monitor',async({page},testInfo)=>{
  test.setTimeout(100000);
  const db=await useFakeSupabase(page);
  for(let i=0;i<40;i++)db.carts.push({
    id:crypto.randomUUID(),code:'MON-'+i,name:'Carrinho laboratório '+String(i).padStart(2,'0'),
    capacity:30,active:true,created_at:new Date().toISOString()
  });
  await login(page);
  const sizes:Array<[number,number]>=[
    [768,600],[820,480],[1024,600],[1280,720],
    [1366,768],[1440,900],[1920,1080],[2560,1080]
  ];
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});
    await expect(page.getByRole('heading',{name:'Visão geral'})).toBeVisible();
    await expectDesktopViewportFit(page,width,height);
    await page.getByRole('button',{name:'Carrinhos',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Carrinhos cadastrados'})).toBeVisible();
    await expectDesktopViewportFit(page,width,height);
    const scrollInfo=await page.locator('.content').evaluate(el=>{
      const hasOverflow=el.scrollHeight>el.clientHeight+1;
      el.scrollTop=el.scrollHeight;
      return {hasOverflow,remaining:el.scrollHeight-el.clientHeight-el.scrollTop};
    });
    if(height<=720)expect(scrollInfo.hasOverflow,'Lista longa deve rolar dentro do painel').toBe(true);
    expect(scrollInfo.remaining).toBeLessThanOrEqual(2);
    await expect(page.locator('.topbar')).toBeVisible();
    await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
    await expect(page.getByLabel('Código do carrinho')).toBeVisible();
    await expectDesktopViewportFit(page,width,height);
    await page.getByRole('button',{name:'Voltar para carrinhos'}).click();
    if([820,1366,1920].includes(width)){
      const screenshot=await page.screenshot({fullPage:false,animations:'disabled'});
      await testInfo.attach('cadastros-'+width+'x'+height,{
        body:screenshot,contentType:'image/png'
      });
    }
    await page.getByRole('button',{name:'Visão geral'}).click();
  }
});

test('Responsivo desktop — calendário, reservas e 3D sem conteúdo cortado',async({page},testInfo)=>{
  test.setTimeout(90000);
  const db=await useFakeSupabase(page);
  db.carts.push({
    id:crypto.randomUUID(),code:'RES-01',name:'Carrinho de referência',
    capacity:30,active:true,created_at:new Date().toISOString()
  });
  db.requesters.push({id:crypto.randomUUID(),name:'Professor de teste',active:true});
  await login(page);
  for(const [width,height] of [[1024,600],[1280,720],[1366,768],[1920,900]]){
    await page.setViewportSize({width,height});
    for(const [button,heading] of [
      ['Reservas','Reservas'],['Calendário','Calendário e relatórios'],
      ['Visualização 3D','Laboratório móvel em 3D'],['Solicitações','Solicitações de professores']
    ]){
      await page.getByRole('button',{name:button,exact:true}).click();
      await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
      await expectDesktopViewportFit(page,width,height);
      if(button==='Calendário'){
        const styles=await page.locator('.calendar-grid').evaluate(el=>{
          const computed=getComputedStyle(el);
          return {scrollY:computed.overflowY,height:el.getBoundingClientRect().height};
        });
        expect(styles.height).toBeLessThanOrEqual(height);
        expect(styles.scrollY).toBe('auto');
      }
      if(button==='Visualização 3D'){
        await page.locator('#visual-cart').selectOption(db.carts[0].id);
        await expectDesktopViewportFit(page,width,height);
      }
    }
    if(width===1366){
      const screenshot=await page.screenshot({fullPage:false,animations:'disabled'});
      await testInfo.attach('solicitacoes-1366x768',{body:screenshot,contentType:'image/png'});
    }
  }
});

test('Responsivo professor — portal se ajusta à altura do notebook e ao celular',async({page})=>{
  test.setTimeout(70000);
  const db=await useFakeSupabase(page,false);
  const teacherId=crypto.randomUUID();
  db.requesters.push({id:teacherId,name:'Professor do teste de viewport',active:true});
  db.teacher_account_links.push({user_id:ADMIN_ID,requester_id:teacherId,active:true});
  await login(page);
  for(const [width,height] of [[360,640],[768,550],[1024,600],[1366,768],[1920,900]]){
    await page.setViewportSize({width,height});
    await expect(page.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible();
    const before=await page.evaluate(()=>{
      const shell=document.querySelector<HTMLElement>('.teacher-shell')!;
      const main=document.querySelector<HTMLElement>('.teacher-main')!;
      const top=document.querySelector<HTMLElement>('.teacher-topbar')!;
      return {
        shellBottom:shell.getBoundingClientRect().bottom,
        mainBottom:main.getBoundingClientRect().bottom,
        mainTop:main.getBoundingClientRect().top,
        headerBottom:top.getBoundingClientRect().bottom,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
      };
    });
    expect(before.shellBottom).toBeLessThanOrEqual(height+1);
    expect(before.mainBottom).toBeLessThanOrEqual(height+1);
    expect(before.mainTop).toBeGreaterThanOrEqual(before.headerBottom-1);
    expect(before.overflow).toBeLessThanOrEqual(1);
    await page.getByRole('button',{name:'Nova solicitação'}).click();
    await expect(page.getByRole('heading',{name:'Solicitar laboratório móvel'})).toBeVisible();
    const after=await page.evaluate(()=>
      document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(after).toBeLessThanOrEqual(1);
    await page.getByRole('button',{name:'Voltar para solicitações'}).click();
  }
});
