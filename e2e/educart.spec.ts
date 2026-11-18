import { XLSX_FIXTURE_BASE64 } from './fixtures/workbook';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

test.use({launchOptions:{args:['--enable-unsafe-swiftshader']}});

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
    asset_models: [], spatial_scenes: [], cart_scene_placements: [], cart_model_slots: [], notebook_slot_links: [], carts: [], campuses: [], campus_blocks: [], campus_rooms: [], cart_storage_locations: [], maintenance_windows: [], equipment_movements: [], requesters: [], notebook_codes: [], reservations: [], reservation_periods: [], reservation_notebooks: [], reservation_events: [], teacher_account_links: [], reservation_requests: [], reservation_request_events: [], user_notifications: []
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

    if (url.pathname === '/rest/v1/rpc/get_email_preference') {
      await respond({enabled:false,channel_enabled:false}); return;
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
        let rows=table==='user_notifications'?
          database[table].filter(item=>item.recipient_user_id===ADMIN_ID):database[table];
        // Model server-side pagination and ID batches for the large-data flows.
        for(const field of ['id','reservation_id','period_id']){
          const value=url.searchParams.get(field);
          if(value?.startsWith('in.(')){const ids=value.slice(4,-1).split(',').map(x=>x.replace(/^"|"$/g,''));rows=rows.filter(r=>ids.includes(String(r[field])));}
        }
        if(table==='notebook_codes'&&url.searchParams.get('cart_id')?.startsWith('eq.'))rows=rows.filter(r=>r.cart_id===url.searchParams.get('cart_id')?.slice(3));
        if(table==='reservation_periods'&&url.searchParams.get('select')?.includes('reservations('))rows=rows.map(r=>({...r,reservations:r.reservations??database.reservations.find(b=>b.id===r.reservation_id)??null}));
        const offset=Number(url.searchParams.get('offset')??0),limit=url.searchParams.get('limit');
        await respond(limit===null?rows.slice(offset):rows.slice(offset,offset+Number(limit))); return;
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
  const pdfSource=pdfContent.toString('latin1');
  // A4 vertical como a agenda SENAI: 595 x 842 pt (não mais A4 paisagem).
  expect(pdfSource).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+595[\d.]*\s+841[\d.]*\s*\]/);
  expect(pdfContent.byteLength).toBeGreaterThan(4000);
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


test.skip('Fase 5 — ocupação 3D mantém capacidade e revela detalhes também via lista',async({page})=>{
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

test.skip('Fase 5 — navegação mobile e alternativa textual sem WebGL',async({page})=>{
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
      ['Solicitações','Solicitações de professores']
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


test('Identidade visual — símbolo A carrega no login, painel e favicon',async({page})=>{
  await useFakeSupabase(page);
  await page.goto('/');
  const loginLogo=page.locator('.auth-panel .brand-lockup');
  await expect(loginLogo).toBeVisible();
  await expect.poll(()=>loginLogo.evaluate((img:HTMLImageElement)=>
    img.complete&&img.naturalWidth>0)).toBe(true);
  await expect(page.locator('.auth-panel')).toHaveCSS('background-color','rgb(37, 30, 49)');
  const favicon=page.locator('link[rel="icon"]');
  await expect(favicon).toHaveAttribute('href',/favicon\.svg$/);
  const href=await favicon.getAttribute('href');
  const result=await page.request.get(new URL(href!,page.url()).href);
  expect(result.status()).toBe(200);
  expect(await result.text()).toContain('<svg');

  await login(page);
  const sidebarLogo=page.locator('.sidebar .brand-lockup');
  await expect(sidebarLogo).toBeVisible();
  await expect.poll(()=>sidebarLogo.evaluate((img:HTMLImageElement)=>
    img.complete&&img.naturalWidth>0)).toBe(true);
  await expect(page.getByText(/Fase \d+ •/)).toHaveCount(0);
});

test('Identidade visual — logo permanece íntegra em tela estreita',async({page})=>{
  await page.setViewportSize({width:360,height:640});
  await useFakeSupabase(page);
  await page.goto('/');
  const logo=page.locator('.auth-panel .brand-lockup');
  await expect(logo).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await login(page);
  await page.getByRole('button',{name:'Abrir menu lateral'}).click();
  await expect(page.locator('.sidebar .brand-lockup')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});


test('Identidade visual — menu hambúrguer usa tema violeta em todos os celulares', async ({page},testInfo)=>{
  await useFakeSupabase(page);
  await login(page);
  for(const width of [320,360,390,690]){
    await page.setViewportSize({width,height:650});
    const opener=page.getByRole('button',{name:'Abrir menu lateral'});
    await expect(opener).toBeVisible();
    await expect(opener).toHaveCSS('background-color','rgb(52, 41, 67)');
    await expect(opener).toHaveCSS('color','rgb(229, 215, 255)');
    await expect(opener).toHaveCSS('border-top-color','rgb(90, 71, 109)');
    await expect(opener).toHaveCSS('border-top-left-radius','12px');
    const rect=await opener.boundingBox();
    expect(rect?.width).toBeGreaterThanOrEqual(44);
    expect(rect?.height).toBeGreaterThanOrEqual(44);
    const topbar=await page.locator('.topbar').boundingBox();
    expect(rect!.y+rect!.height).toBeLessThanOrEqual((topbar?.y??0)+(topbar?.height??0)+1);
    await opener.focus();
    await expect(opener).toBeFocused();
    await opener.click();
    const closer=page.getByRole('button',{name:'Fechar menu lateral'});
    await expect(closer).toBeVisible();
    await page.mouse.move(width-2,2);
    await expect(closer).toHaveCSS('background-color','rgb(52, 41, 67)');
    await expect(closer).toHaveCSS('border-top-left-radius','12px');
    await expect(page.getByRole('navigation',{name:'Menu principal'})).toBeVisible();
    await closer.click();
    await expect(opener).toBeFocused();
    await expect(page.getByRole('navigation',{name:'Menu principal'})).toBeHidden();
    expect(await page.evaluate(()=>
      document.documentElement.scrollWidth-document.documentElement.clientWidth
    )).toBeLessThanOrEqual(1);
    if(width===360){
      await testInfo.attach('educart-menu-violeta-360px',{
        body:await page.screenshot({fullPage:false,animations:'disabled'}),
        contentType:'image/png'
      });
    }
  }
  await page.setViewportSize({width:768,height:650});
  await expect(page.getByRole('button',{name:'Abrir menu lateral'})).toBeHidden();
});


test('Tema violeta — nenhum texto visível mantém a cor azul legada',async({page})=>{
  test.setTimeout(80000);
  await useFakeSupabase(page);
  await page.goto('/');
  async function checkTextColors(context:string){
    const blueText=await page.evaluate(()=>{
      const result:{selector:string,text:string,color:string,hue:number}[]=[];
      for(const el of document.querySelectorAll<HTMLElement>('body *')){
        if(el.closest('svg,script,style,noscript'))continue;
        const hasOwnText=[...el.childNodes].some(node=>node.nodeType===Node.TEXT_NODE&&Boolean(node.textContent?.trim()));
        if(!hasOwnText)continue;
        const style=getComputedStyle(el);
        if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)continue;
        const box=el.getBoundingClientRect();
        if(box.width===0||box.height===0||box.bottom<0||box.top>innerHeight)continue;
        const rgb=style.color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if(!rgb)continue;
        const values=rgb.slice(1,4).map(v=>Number(v)/255);
        const max=Math.max(...values),min=Math.min(...values);
        const delta=max-min;
        const saturation=max===0?0:delta/max;
        if(delta===0||saturation<0.13)continue;
        let angle=max===values[0]?(values[1]-values[2])/delta:
          max===values[1]?(values[2]-values[0])/delta+2:
            (values[0]-values[1])/delta+4;
        const hue=((angle*60)%360+360)%360;
        if(hue>=190&&hue<=245){
          result.push({
            selector:el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.trim().replace(/\s+/g,'.'):''),
            text:el.textContent?.trim().slice(0,62)??'',
            color:style.color,hue:Math.round(hue)
          });
        }
      }
      return result.slice(0,25);
    });
    expect(blueText,context+' ainda contém texto com cor azul: '+JSON.stringify(blueText)).toEqual([]);
  }
  await checkTextColors('Login');
  await login(page);
  await checkTextColors('Visão geral');
  for(const section of ['Carrinhos','Professores','Notebooks','Reservas','Calendário','Solicitações','Notificações']){
    await page.getByRole('navigation',{name:'Menu principal'}).getByRole('button',{name:section,exact:true}).click();
    await page.locator('.content .page-header h1').waitFor({state:'visible'});
    await checkTextColors(section);
    if(section==='Carrinhos'){
      await page.getByRole('button',{name:'Cadastrar carrinho'}).click();
      await checkTextColors('Cadastro carrinhos');
    }else if(section==='Professores'){
      await page.getByRole('button',{name:'Cadastrar professor'}).click();
      await checkTextColors('Cadastro professores');
    }else if(section==='Notebooks'){
      await page.getByRole('button',{name:'Cadastrar notebooks'}).click();
      await checkTextColors('Cadastro notebooks');
    }else if(section==='Reservas'){
      await page.getByRole('button',{name:'Nova reserva'}).click();
      await checkTextColors('Cadastro reservas');
      await page.locator('#reservation-date-trigger').click();
      await checkTextColors('Calendário de datas');
    }
  }
});


test('Consulta pública — acesso sem conta, disponibilidade e alternância de tema',async({page})=>{
  await useFakeSupabase(page,false);
  const cartId='bd3ec811-562d-496c-951a-28c9f5145e0c';
  await page.route('https://educart-e2e.supabase.co/rest/v1/rpc/public_cart_availability',async route=>{
    const body=route.request().postDataJSON() as {p_start:string;p_end:string};
    const data=[
      {usage_date:body.p_start,cart_id:cartId,cart_name:'Carrinho público',capacity:20,shift:'MATUTINO',reserved:10,available:10},
      {usage_date:body.p_start,cart_id:cartId,cart_name:'Carrinho público',capacity:20,shift:'VESPERTINO',reserved:20,available:0},
      {usage_date:body.p_start,cart_id:cartId,cart_name:'Carrinho público',capacity:20,shift:'NOTURNO',reserved:0,available:20}
    ];
    await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},json:data});
  });
  await page.goto('/#/consulta-publica');
  await expect(page.getByRole('heading',{name:'Disponibilidade dos carrinhos'})).toBeVisible();
  await expect(page.getByLabel('E-mail')).toHaveCount(0);
  await expect(page.getByText('Parcialmente reservado')).toBeVisible();
  await expect(page.getByText('Totalmente reservado')).toBeVisible();
  await expect(page.getByText('20 disponíveis')).toBeVisible();
  await expect(page.getByRole('button',{name:'Visualização 3D'})).toHaveCount(0);
  await page.getByRole('button',{name:'Ativar modo claro'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await expect(page.locator('.public-agenda .panel').first()).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Disponibilidade dos carrinhos'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByRole('button',{name:'Ativar modo escuro'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByRole('link',{name:'Acesso ao sistema'}).click();
  await expect(page.getByLabel('E-mail')).toBeVisible();
});

test('Consulta pública — atualizar fica ao lado dos três filtros no desktop',async({page})=>{
  await useFakeSupabase(page,false);
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/#/consulta-publica');
  const filter=page.locator('#public-cart');
  const action=page.getByRole('button',{name:'Atualizar disponibilidade'});
  await expect(filter).toBeVisible();
  await expect(action).toBeVisible();
  for(const width of [1440,1280,1024]){
    await page.setViewportSize({width,height:900});
    const filterBox=await filter.boundingBox();
    const buttonBox=await action.boundingBox();
    expect(filterBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    expect(Math.abs((buttonBox?.y??0)+(buttonBox?.height??0)-(filterBox?.y??0)-(filterBox?.height??0)),
      'O botão e o filtro devem compartilhar a mesma linha de base em '+width+'px').toBeLessThanOrEqual(4);
    expect(buttonBox!.x,'O botão deve estar à direita dos filtros').toBeGreaterThan(filterBox!.x+filterBox!.width-2);
  }
  await page.setViewportSize({width:375,height:812});
  const mobileFilter=await filter.boundingBox();
  const mobileButton=await action.boundingBox();
  expect(mobileFilter).not.toBeNull();
  expect(mobileButton).not.toBeNull();
  expect(mobileButton!.y).toBeGreaterThanOrEqual(mobileFilter!.y+mobileFilter!.height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});


test('Consulta pública — três indicadores ocupam toda a largura em diferentes telas',async({page})=>{
  await useFakeSupabase(page,false);
  await page.goto('/#/consulta-publica');
  await expect(page.getByText('Datas consultadas')).toBeVisible();
  const stats=page.locator('.public-agenda .calendar-stats');
  const cards=stats.locator('.stat');
  await expect(cards).toHaveCount(3);
  for(const width of [1440,1280,1024,768,390]){
    await page.setViewportSize({width,height:900});
    const panel=await stats.boundingBox();
    const bounds=await cards.evaluateAll(nodes=>nodes.map(node=>{
      const r=node.getBoundingClientRect();
      return {x:r.left,y:r.top,right:r.right,bottom:r.bottom,width:r.width};
    }));
    expect(panel,'Grade dos indicadores visível').not.toBeNull();
    const right=Math.max(...bounds.map(b=>b.right));
    expect(Math.abs(right-(panel!.x+panel!.width)),
      'Os indicadores devem alcançar a borda direita em '+width+'px').toBeLessThanOrEqual(2);
    const last=bounds[2];
    if(width>=851){
      expect(Math.abs(bounds[0].width-bounds[1].width)).toBeLessThanOrEqual(2);
      expect(Math.abs(bounds[1].width-last.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(bounds[0].y-last.y)).toBeLessThanOrEqual(2);
    }else if(width>550){
      expect(last.width).toBeGreaterThan(bounds[0].width*1.9);
    }else{
      expect(Math.abs(bounds[0].width-last.width)).toBeLessThanOrEqual(2);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  }
  const period=cards.nth(2).locator('strong');
  await expect(period).toHaveText(/\d{2}\/\d{2}\/\d{4}/);
});


test('Consulta pública — datas escolhidas são reconhecidas automaticamente, sem seletor de modo',async({page})=>{
  await useFakeSupabase(page,false);
  const calls:{start:string;end:string}[]=[];
  await page.route('https://educart-e2e.supabase.co/rest/v1/rpc/public_cart_availability',async route=>{
    const body=route.request().postDataJSON() as {p_start:string;p_end:string};
    calls.push({start:body.p_start,end:body.p_end});
    const rows:{usage_date:string;cart_id:string;cart_name:string;capacity:number;shift:string;reserved:number;available:number}[]=[];
    const d=new Date(body.p_start+'T12:00:00Z');
    const last=new Date(body.p_end+'T12:00:00Z');
    for(let index=0;index<35&&d<=last;index++){
      const day=d.toISOString().slice(0,10);
      if(d.getUTCDay()>=1&&d.getUTCDay()<=5)
        rows.push({usage_date:day,cart_id:'37a27188-0ea8-4998-b530-6e1f5fa8f181',cart_name:'Carrinho demo',capacity:20,shift:'MATUTINO',reserved:0,available:20});
      d.setUTCDate(d.getUTCDate()+1);
    }
    await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},json:rows});
  });
  await page.goto('/#/consulta-publica');
  await expect(page.locator('#public-mode')).toHaveCount(0);
  await expect(page.getByText('Consultar por')).toHaveCount(0);
  const first=page.getByLabel('Dia da consulta'),last=page.getByLabel('Data final (opcional)');
  await expect(last).toHaveValue('');
  await first.fill('2026-11-18');
  await expect(page.locator('.calendar-day')).toHaveCount(1);
  await expect(page.locator('.calendar-stats .stat').last().locator('strong')).toHaveText('1 dia · 18/11/2026');
  await expect.poll(()=>calls.some(c=>c.start==='2026-11-18'&&c.end==='2026-11-18')).toBe(true);

  await first.fill('2026-11-16');
  await last.fill('2026-11-20');
  await expect(page.locator('.calendar-day')).toHaveCount(5);
  await expect(page.locator('.calendar-stats .stat').last().locator('strong')).toHaveText('1 semana · 16/11/2026 a 20/11/2026');

  await first.fill('2026-11-01');
  await last.fill('2026-11-30');
  await expect(page.locator('.calendar-stats .stat').last().locator('strong')).toHaveText('1 mês · 01/11/2026 a 30/11/2026');
  await expect(page.locator('.calendar-day')).toHaveCount(21);

  await page.getByRole('button',{name:'Limpar data final'}).click();
  await expect(last).toHaveValue('');
  await expect(page.getByRole('alert')).toContainText('O período não possui dias úteis');
  await expect(page.locator('.calendar-day')).toHaveCount(0);
  await first.fill('2026-11-19');
  await expect(page.locator('.calendar-day')).toHaveCount(1);
  await expect(page.locator('.calendar-stats .stat').last().locator('strong')).toHaveText('1 dia · 19/11/2026');
});

test('Consulta pública — até um ano é consultado por blocos e navegado em páginas',async({page})=>{
  await useFakeSupabase(page,false);
  const calls:{start:string;end:string}[]=[];
  await page.route('https://educart-e2e.supabase.co/rest/v1/rpc/public_cart_availability',async route=>{
    const body=route.request().postDataJSON() as {p_start:string;p_end:string};
    calls.push({start:body.p_start,end:body.p_end});
    const rows:{usage_date:string;cart_id:string;cart_name:string;capacity:number;shift:string;reserved:number;available:number}[]=[];
    const date=new Date(body.p_start+'T12:00:00Z');
    const end=new Date(body.p_end+'T12:00:00Z');
    for(let i=0;i<35&&date<=end;i++){
      if(date.getUTCDay()>0&&date.getUTCDay()<6)rows.push({
        usage_date:date.toISOString().slice(0,10),cart_id:'37a27188-0ea8-4998-b530-6e1f5fa8f181',
        cart_name:'Carrinho demo',capacity:20,shift:'MATUTINO',reserved:1,available:19
      });
      date.setUTCDate(date.getUTCDate()+1);
    }
    await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},json:rows});
  });
  await page.goto('/#/consulta-publica');
  await page.getByLabel('Dia da consulta').fill('2026-01-01');
  await page.getByLabel('Data final (opcional)').fill('2026-12-31');
  await expect(page.locator('.calendar-stats .stat').last().locator('strong')).toHaveText('1 ano · 01/01/2026 a 31/12/2026');
  await expect(page.getByText(/Exibindo 1–25 de \d+ dias úteis/)).toBeVisible();
  await expect(page.locator('.calendar-day')).toHaveCount(25);
  await expect.poll(()=>calls.some(c=>c.start==='2026-01-01'&&c.end==='2026-02-04')).toBe(true);
  await expect.poll(()=>calls.some(c=>c.end==='2026-12-31')).toBe(true);
  await page.getByRole('button',{name:'Próximos'}).click();
  await expect(page.getByText(/Exibindo 26–50 de \d+ dias úteis/)).toBeVisible();
  await expect(page.locator('.calendar-day')).toHaveCount(25);
  await page.getByLabel('Data final (opcional)').fill('2027-02-10');
  await expect(page.getByRole('alert')).toContainText('Selecione no máximo um ano');
  await expect(page.getByRole('button',{name:'Atualizar disponibilidade'})).toBeDisabled();
});

test('Consulta pública — filtros sem modo mantêm alinhamento desktop e celular',async({page})=>{
  await useFakeSupabase(page,false);
  await page.goto('/#/consulta-publica');
  const filter=page.locator('#public-cart');
  const refresh=page.getByRole('button',{name:'Atualizar disponibilidade'});
  for(const width of [1440,1280,1024]){
    await page.setViewportSize({width,height:900});
    const a=await filter.boundingBox(),b=await refresh.boundingBox();
    expect(a).not.toBeNull();expect(b).not.toBeNull();
    expect(b!.x).toBeGreaterThan(a!.x+a!.width-2);
    expect(Math.abs((b!.y+b!.height)-(a!.y+a!.height))).toBeLessThanOrEqual(4);
  }
  for(const width of [375,390,768]){
    await page.setViewportSize({width,height:812});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  }
});


test('Recuperação de senha — resposta neutra para e-mails conhecidos e desconhecidos',async({page})=>{
  await useFakeSupabase(page,false);
  const requests:string[]=[];
  const redirects:string[]=[];
  await page.route('https://educart-e2e.supabase.co/auth/v1/recover**',async route=>{
    const url=new URL(route.request().url());
    if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'}});return;}
    const body=route.request().postDataJSON() as {email:string};
    requests.push(body.email);redirects.push(url.searchParams.get('redirect_to')??'');
    await route.fulfill({status:body.email.startsWith('unknown')?400:200,headers:{'access-control-allow-origin':'*'},json:body.email.startsWith('unknown')?{message:'User not found',code:'user_not_found'}:{}});
  });
  await page.setViewportSize({width:375,height:812});
  await page.goto('/');
  await page.getByRole('button',{name:'Esqueci minha senha'}).click();
  await expect(page.getByRole('heading',{name:'Recuperar senha'})).toBeVisible();
  await expect(page.getByLabel('Senha',{exact:true})).toHaveCount(0);
  for(const address of ['test-admin@educart.example','unknown@educart.example']){
    await page.getByLabel('E-mail').fill(address);
    await page.getByRole('button',{name:'Enviar instruções'}).click();
    await expect(page.getByRole('status')).toContainText('Se o e-mail estiver cadastrado');
  }
  expect(requests).toEqual(['test-admin@educart.example','unknown@educart.example']);
  expect(redirects.every(value=>value==='http://127.0.0.1:4173/')).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Voltar ao login'}).click();
  await expect(page.getByRole('heading',{name:'Acesso ao Educart'})).toBeVisible();
});

test('Recuperação de senha — link válido, confirmação, mudança e retorno ao login',async({page})=>{
  await useFakeSupabase(page,true);
  let writes=0;
  let logout=0;
  await page.route('https://educart-e2e.supabase.co/auth/v1/user',async route=>{
    const method=route.request().method();
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, PUT, OPTIONS'};
    if(method==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    if(method==='PUT'){
      expect(route.request().postDataJSON()).toMatchObject({password:'new-test-password'});
      writes++;
    }
    await route.fulfill({status:200,headers,json:user});
  });
  await page.route('https://educart-e2e.supabase.co/auth/v1/logout**',async route=>{
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};
    if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    logout++;
    await route.fulfill({status:200,headers,json:{}});
  });
  await page.goto('/#access_token='+token+'&refresh_token=test-refresh-token&expires_in=3600&token_type=bearer&type=recovery');
  await expect(page.getByRole('heading',{name:'Redefinir senha'})).toBeVisible();
  await expect(page.getByLabel('Nova senha',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Visão geral'})).toHaveCount(0);
  await page.getByLabel('Nova senha',{exact:true}).fill('short');
  await page.getByLabel('Confirmar nova senha').fill('short');
  await page.getByRole('button',{name:'Salvar nova senha'}).click();
  await expect(page.getByRole('alert')).toContainText('pelo menos 8 caracteres');
  await page.getByLabel('Nova senha',{exact:true}).fill('new-test-password');
  await page.getByLabel('Confirmar nova senha').fill('different-password');
  await page.getByRole('button',{name:'Salvar nova senha'}).click();
  await expect(page.getByRole('alert')).toContainText('não coincidem');
  expect(writes).toBe(0);
  await page.getByLabel('Confirmar nova senha').fill('new-test-password');
  await page.getByRole('button',{name:'Salvar nova senha'}).click();
  await expect(page.getByRole('heading',{name:'Acesso ao Educart'})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Senha alterada com sucesso');
  expect(writes).toBe(1);expect(logout).toBe(1);
  expect(page.url()).not.toContain('access_token');
});

test('Recuperação de senha — link expirado e rota direta não autorizam redefinição',async({page})=>{
  await useFakeSupabase(page);
  for(const path of ['/#error=access_denied&error_code=otp_expired','/#/redefinir-senha']){
    await page.goto(path);
    await expect(page.getByRole('heading',{name:'Redefinir senha'})).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Link inválido, expirado ou já utilizado');
    await expect(page.getByLabel('Nova senha',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Voltar ao login'}).click();
    await expect(page.getByRole('heading',{name:'Acesso ao Educart'})).toBeVisible();
  }
});


test('Segurança Auth — cadastro exige senha mínima e não altera a regra de login',async({page})=>{
  await useFakeSupabase(page,false);
  let signups=0;
  await page.route('https://educart-e2e.supabase.co/auth/v1/signup**',async route=>{
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};
    if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    signups++;
    await route.fulfill({status:200,headers,json:{user,session:null}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Ainda não tem conta? Criar conta'}).click();
  await page.getByLabel('E-mail').fill('test-admin@educart.example');
  await page.getByLabel('Senha',{exact:true}).fill('short');
  await page.getByRole('button',{name:'Criar minha conta'}).click();
  await expect(page.getByRole('alert')).toContainText('pelo menos 8 caracteres');
  expect(signups).toBe(0);
  await expect(page.getByLabel('Senha',{exact:true})).toHaveAttribute('autocomplete','new-password');
  await page.getByRole('button',{name:'Já tem conta? Fazer login'}).click();
  await expect(page.getByLabel('Senha',{exact:true})).toHaveAttribute('autocomplete','current-password');
  await page.getByLabel('Senha',{exact:true}).fill('short');
  await page.getByRole('button',{name:'Entrar no Educart'}).click();
  await expect(page.getByRole('heading',{name:'Conta criada, aguardando autorização'})).toBeVisible();
});


test('Manutenção — TI programa janela e encerra com justificativa',async({page})=>{
  const database=await useFakeSupabase(page);
  const cart={id:'c1000000-0000-4000-8000-000000000001',code:'M-01',name:'Carrinho teste manutenção',capacity:10,active:true,created_at:'2026-11-15T10:00:00Z'};
  database.carts.push(cart);
  const id='c1000000-0000-4000-8000-000000000002';
  await page.route('https://educart-e2e.supabase.co/rest/v1/rpc/schedule_maintenance',async route=>{
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};
    if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    const body=route.request().postDataJSON();
    expect(body).toMatchObject({p_cart_id:cart.id,p_reason:'Revisão preventiva',p_shifts:['MATUTINO','VESPERTINO','NOTURNO']});
    database.maintenance_windows.push({id,cart_id:cart.id,start_date:body.p_start,end_date:body.p_end,shifts:body.p_shifts,reason:body.p_reason,closed_at:null,close_reason:null});
    await route.fulfill({status:200,headers,json:id});
  });
  await page.route('https://educart-e2e.supabase.co/rest/v1/rpc/close_maintenance',async route=>{
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};
    if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    expect(route.request().postDataJSON()).toEqual({p_id:id,p_reason:'Revisão concluída'});
    Object.assign(database.maintenance_windows[0],{closed_at:'2026-11-17T12:00:00Z',close_reason:'Revisão concluída'});
    await route.fulfill({status:200,headers,json:id});
  });
  await login(page);
  await page.getByRole('button',{name:'Manutenção',exact:true}).click();
  await page.getByRole('button',{name:'Nova manutenção'}).click();
  await page.getByRole('combobox',{name:'Carrinho',exact:true}).selectOption(cart.id);
  await page.getByLabel('Motivo interno').fill('Revisão preventiva');
  await page.getByRole('button',{name:'Programar manutenção',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Manutenção programada');
  await page.getByRole('button',{name:'Ver detalhes',exact:true}).click();
  await expect(page.getByText('Revisão preventiva',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Encerrar',exact:true}).click();
  await page.getByLabel('Motivo do encerramento').fill('Revisão concluída');
  await page.getByRole('button',{name:'Confirmar encerramento'}).click();
  await expect(page.getByRole('status')).toContainText('Manutenção encerrada');
  await expect(page.locator('.record-detail')).toContainText('Revisão concluída');
  await expect(page.getByRole('button',{name:'Encerrar',exact:true})).toHaveCount(0);
});


test('Movimentações — retirada com códigos e devolução integral com ressalva',async({page})=>{
 const db=await useFakeSupabase(page);
 const id='c2000000-0000-4000-8000-000000000001',rid='c2000000-0000-4000-8000-000000000002',pid='c2000000-0000-4000-8000-000000000003';
 const teacher='c2000000-0000-4000-8000-000000000004',code='c2000000-0000-4000-8000-000000000005',mid='c2000000-0000-4000-8000-000000000006';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 db.carts.push({id,code:'MOV-1',name:'Carrinho movimentação',capacity:10,active:true});
 db.requesters.push({id:teacher,name:'Professor de teste',active:true});
 db.notebook_codes.push({id:code,code:'NB-MOV-01',cart_id:id,active:true});
 db.reservation_periods.push({id:pid,reservation_id:rid,cart_id:id,usage_date:parts,shift:'MATUTINO',quantity:3,active:true,reservations:{requester_id:teacher,status:'CONFIRMADA',destination_label:null}});
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};
 let pickups=0,returns=0;
 await page.route('https://educart-e2e.supabase.co/rest/v1/rpc/register_equipment_pickup',async route=>{
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  const body=route.request().postDataJSON();
  expect(body).toMatchObject({p_period_id:pid,p_quantity:2,p_notebook_ids:[code],p_responsible:'Responsável teste',p_condition:'BOA',p_notes:null});
  expect(body.p_key).toMatch(/^[\da-f-]{36}$/);pickups++;
  db.equipment_movements.push({id:mid,period_id:pid,reservation_id:rid,cart_id:id,requester_id:teacher,usage_date:parts,shift:'MATUTINO',quantity:2,notebook_ids:[code],notebook_codes:['NB-MOV-01'],pickup_at:new Date().toISOString(),pickup_responsible:body.p_responsible,pickup_condition:'BOA',pickup_notes:null,return_at:null,return_responsible:null,return_condition:null,return_notes:null});
  await route.fulfill({status:200,headers,json:mid});
 });
 await page.route('https://educart-e2e.supabase.co/rest/v1/rpc/register_equipment_return',async route=>{
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  const body=route.request().postDataJSON();
  expect(body).toMatchObject({p_movement_id:mid,p_responsible:'Responsável devolução',p_condition:'RESSALVA',p_notes:'Conferência registrada'});
  returns++;Object.assign(db.equipment_movements[0],{return_at:new Date().toISOString(),return_responsible:body.p_responsible,return_condition:body.p_condition,return_notes:body.p_notes});
  await route.fulfill({status:200,headers,json:mid});
 });
 await login(page);
 await page.getByRole('button',{name:'Retirada e devolução',exact:true}).click();
 await page.getByRole('button',{name:'Ver detalhes',exact:true}).click();
 await page.getByRole('button',{name:'Registrar retirada',exact:true}).click();
 await page.getByLabel('Quantidade entregue').fill('2');
 await page.getByRole('checkbox',{name:'NB-MOV-01'}).check();
 await page.getByLabel('Responsável que recebeu').fill('Responsável teste');
 await page.getByRole('button',{name:'Confirmar retirada'}).click();
 await expect(page.getByRole('status')).toContainText('Retirada registrada');
 await page.getByRole('button',{name:'Ver detalhes',exact:true}).click();
 await expect(page.getByText('1 sem código registrado')).toBeVisible();
 await page.getByRole('button',{name:'Registrar devolução'}).click();
 await page.getByLabel('Responsável que devolveu').fill('Responsável devolução');
 await page.getByLabel('Condição dos equipamentos').selectOption('RESSALVA');
 await expect(page.getByRole('button',{name:'Confirmar devolução'})).toBeDisabled();
 await page.getByLabel('Observação (obrigatória)').fill('Conferência registrada');
 await page.getByRole('button',{name:'Confirmar devolução'}).click();
 await expect(page.getByRole('status')).toContainText('Devolução registrada');
 await page.getByRole('button',{name:'Ver detalhes',exact:true}).click();
 await expect(page.locator('.record-detail')).toContainText('Conferência registrada');
 await expect(page.getByRole('button',{name:'Registrar devolução'})).toHaveCount(0);
 expect(pickups).toBe(1);expect(returns).toBe(1);
});


test('Dashboard operacional — recortes, pendências antigas, filtros e atalhos',async({page})=>{
 const db=await useFakeSupabase(page);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const offset=(n:number)=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const c1='c3000000-0000-4000-8000-000000000001',c2='c3000000-0000-4000-8000-000000000002',p='c3000000-0000-4000-8000-000000000003';
 db.carts.push({id:c1,name:'Carrinho Alfa',code:'D-A',capacity:10,active:true},{id:c2,name:'Carrinho Beta',code:'D-B',capacity:8,active:true});
 db.requesters.push({id:p,name:'Professor sintético',active:true});
 const row=(id:string,cart:string,date:string,shift:string,active=true)=>({id,reservation_id:id,cart_id:cart,usage_date:date,shift,quantity:2,active,reservations:{requester_id:p,status:'CONFIRMADA',destination_label:null}});
 db.reservation_periods.push(row('p1',c1,today,'MATUTINO'),row('p2',c2,today,'VESPERTINO'),row('p3',c1,offset(12),'MATUTINO'),row('p4',c1,today,'NOTURNO',false));
 db.equipment_movements.push({id:'m1',period_id:'old',cart_id:c1,requester_id:p,usage_date:offset(-12),shift:'MATUTINO',quantity:3,notebook_ids:[],notebook_codes:[],pickup_responsible:'Responsável sintético',pickup_condition:'BOA',pickup_notes:null,return_responsible:null,return_condition:null,return_notes:null,pickup_at:offset(-12)+'T10:00:00Z',return_at:null});
 db.maintenance_windows.push({id:'m2',cart_id:c2,start_date:today,end_date:today,shifts:['NOTURNO'],closed_at:null});
 db.reservation_requests.push({id:'r1',cart_id:c1,requester_id:p,dates:[offset(25)],shifts:['MATUTINO'],quantity:2,status:'PENDENTE',created_at:today});
 await login(page);
 const metric=(label:string)=>page.locator('.dashboard-metrics .stat').filter({has:page.getByText(label,{exact:true})}).locator('strong');
 await expect(metric('Períodos de hoje')).toHaveText('2');
 await expect(metric('Aguardando retirada')).toHaveText('2');
 await expect(metric('Pendentes de devolução')).toHaveText('1');
 await expect(metric('Manutenções de hoje')).toHaveText('1');
 await expect(metric('Solicitações pendentes')).toHaveText('1');
 await expect(page.getByText('De data anterior',{exact:true})).toBeVisible();
 await expect(page.getByText('Nenhum período confirmado no intervalo.')).toBeVisible();
 await page.getByLabel('Próximos dias').selectOption('14');
 await expect(page.getByText('Nenhum período confirmado no intervalo.')).toHaveCount(0);
 await page.getByRole('combobox',{name:'Carrinho',exact:true}).selectOption(c1);
 await expect(metric('Períodos de hoje')).toHaveText('1');
 await expect(metric('Manutenções de hoje')).toHaveText('0');
 await page.getByRole('combobox',{name:'Turno',exact:true}).selectOption('VESPERTINO');
 await expect(metric('Períodos de hoje')).toHaveText('0');
 await expect(metric('Pendentes de devolução')).toHaveText('0');
 await page.getByRole('button',{name:'Limpar filtros'}).click();
 await expect(metric('Períodos de hoje')).toHaveText('2');
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 }
 await page.getByRole('button',{name:'Abrir movimentações'}).click();
 await expect(page.getByRole('heading',{name:'Retirada e devolução',exact:true})).toBeVisible();
});

test('Dashboard operacional — falha de consulta não vira indicador zero',async({page})=>{
 await useFakeSupabase(page);
 await page.route('https://educart-e2e.supabase.co/rest/v1/equipment_movements?**',async route=>{
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, OPTIONS'};
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  await route.fulfill({status:503,headers,json:{message:'Serviço indisponível'}});
 });
 await login(page);
 await expect(page.getByRole('alert')).toContainText('Não foi possível carregar o painel operacional');
 await expect(page.locator('.dashboard-metrics .stat')).toHaveCount(0);
 await page.unroute('https://educart-e2e.supabase.co/rest/v1/equipment_movements?**');
 await page.getByRole('button',{name:'Atualizar painel'}).click();
 await expect(page.locator('.dashboard-metrics .stat')).toHaveCount(6);
});


function futureMondays(){
 const d=new Date(Date.now()+14*86400000);while(d.getUTCDay()!==1)d.setUTCDate(d.getUTCDate()+1);
 return [0,7,14].map(n=>{const e=new Date(d);e.setUTCDate(e.getUTCDate()+n);return e.toISOString().slice(0,10)});
}
function brDate(d:string){return d.split('-').reverse().join('/');}
async function setWeekly(page:Page,prefix:string,dates:string[]){
 await page.locator('#'+prefix+'-start').fill(dates[0]);
 await page.locator('#'+prefix+'-end').fill(dates[2]);
 const group=page.getByRole('group',{name:'Dias da semana'});
 await group.getByRole('checkbox',{name:'Segunda-feira'}).check();
 for(const day of ['Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira'])await group.getByRole('checkbox',{name:day}).uncheck();
 await page.getByRole('button',{name:/Revisar datas e exceções/}).click();
}
test('F3.5 — TI revisa recorrência, exclui conflito e confirma um agrupamento',async({page})=>{
 const db=await useFakeSupabase(page);
 const cart=crypto.randomUUID(),teacher=crypto.randomUUID(),dates=futureMondays();
 db.carts.push({id:cart,code:'REC-A',name:'Carrinho recorrência',capacity:10,active:true});
 db.requesters.push({id:teacher,name:'Professor recorrência',active:true});
 db.reservation_periods.push({id:crypto.randomUUID(),reservation_id:crypto.randomUUID(),cart_id:cart,usage_date:dates[1],shift:'MATUTINO',quantity:10,active:true});
 await login(page);
 await page.getByRole('button',{name:'Reservas',exact:true}).click();
 await page.getByRole('button',{name:'Nova reserva'}).click();
 await page.locator('#reservation-cart').selectOption(cart);
 await page.locator('#reservation-requester').selectOption(teacher);
 await page.getByRole('button',{name:'Repetir semanalmente'}).click();
 await setWeekly(page,'reservation-weekly',dates);
 await expect(page.locator('.weekly-summary')).toContainText('3 ocorrência(s)');
 await expect(page.getByRole('button',{name:'Confirmar reserva'})).toBeDisabled();
 await expect(page.getByText('Conflito',{exact:true})).toBeVisible();
 const skip=page.getByRole('checkbox',{name:'Incluir '+brDate(dates[1])});
 await skip.uncheck();
 await expect(page.locator('.weekly-summary')).toContainText('2 ocorrência(s)');
 await expect(page.getByRole('button',{name:'Confirmar reserva'})).toBeEnabled();
 await skip.check();
 await expect(page.getByRole('button',{name:'Confirmar reserva'})).toBeDisabled();
 await skip.uncheck();
 await page.getByRole('button',{name:'Confirmar reserva'}).click();
 await expect(page.getByText('Reserva confirmada para todos os períodos selecionados.')).toBeVisible();
 expect(db.reservations).toHaveLength(1);
 const reservationId=db.reservations[0].id;
 expect(db.reservation_periods.filter(p=>p.reservation_id===reservationId).map(p=>p.usage_date)).toEqual([dates[0],dates[2]]);
 await page.getByRole('button',{name:'Editar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Editar reserva'})).toBeVisible();
 await expect(page.locator('#reservation-date-trigger')).toContainText('2 dias selecionados');
 await page.getByRole('button',{name:'Salvar alterações'}).click();
 await expect(page.getByText('Reserva editada e alteração registrada no histórico.')).toBeVisible();
 expect(db.reservation_periods.filter(p=>p.reservation_id===reservationId&&p.active).map(p=>p.usage_date)).toEqual([dates[0],dates[2]]);
});

test('F3.5 — professor solicita série semanal pelo celular sem ocupar capacidade',async({page})=>{
 const db=await useFakeSupabase(page,false);
 const cart=crypto.randomUUID(),teacher=crypto.randomUUID(),dates=futureMondays();
 db.carts.push({id:cart,code:'REC-B',name:'Série professor',capacity:10,active:true});
 db.requesters.push({id:teacher,name:'Professor sintético',active:true});
 db.teacher_account_links.push({user_id:ADMIN_ID,requester_id:teacher,active:true});
 await page.setViewportSize({width:320,height:780});
 await login(page);
 await page.getByRole('button',{name:'Nova solicitação'}).click();
 await page.locator('#teacher-cart').selectOption(cart);
 await page.locator('#teacher-date-mode').selectOption('weekly');
 await setWeekly(page,'teacher-weekly',dates);
 await page.getByRole('checkbox',{name:'Incluir '+brDate(dates[1])}).uncheck();
 await expect(page.locator('.weekly-summary')).toContainText('2 ocorrência(s)');
 await expect(page.getByText(/2 de 2 períodos possuem saldo estimado/)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Enviar solicitação para aprovação'}).click();
 await expect(page.getByText(/Solicitação enviada à TI/)).toBeVisible();
 expect(db.reservation_requests).toHaveLength(1);
 expect(db.reservation_requests[0].dates).toEqual([dates[0],dates[2]]);
 expect(db.reservation_requests[0].status).toBe('PENDENTE');
 expect(db.reservation_periods).toHaveLength(0);
});


test('F3.5 — edição não recria um turno cancelado de uma série',async({page})=>{
 const db=await useFakeSupabase(page),cart=crypto.randomUUID(),teacher=crypto.randomUUID(),booking=crypto.randomUUID(),dates=futureMondays();
 db.carts.push({id:cart,code:'REC-C',name:'Carrinho exceção',capacity:10,active:true});
 db.requesters.push({id:teacher,name:'Professor exceção',active:true});
 db.reservations.push({id:booking,cart_id:cart,requester_id:teacher,mode:'PARCIAL',quantity:2,needs_mouse:false,notes:null,status:'CONFIRMADA',created_at:new Date().toISOString()});
 for(const day of dates.slice(0,2))for(const shift of ['MATUTINO','VESPERTINO'])db.reservation_periods.push({id:crypto.randomUUID(),reservation_id:booking,cart_id:cart,usage_date:day,shift,quantity:2,active:!(day===dates[1]&&shift==='VESPERTINO')});
 await login(page);
 await page.getByRole('button',{name:'Reservas',exact:true}).click();
 await page.getByRole('button',{name:'Editar',exact:true}).click();
 await expect(page.getByText(/Este agrupamento possui exceções por turno/)).toBeVisible();
 await expect(page.getByRole('heading',{name:'Editar reserva'})).toHaveCount(0);
 expect(db.reservation_periods.filter(p=>p.active)).toHaveLength(3);
});


test('F3.6 — preferências de e-mail opcionais, canal desativado e avisos internos',async({page})=>{
 const db=await useFakeSupabase(page,false);
 const teacher=crypto.randomUUID();
 db.requesters.push({id:teacher,name:'Professor sintético',active:true});
 db.teacher_account_links.push({user_id:ADMIN_ID,requester_id:teacher,active:true});
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};
 let enabled=false;
 await page.route('https://educart-e2e.supabase.co/rest/v1/rpc/get_email_preference',async route=>{
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  await route.fulfill({status:200,headers,json:{enabled,channel_enabled:false}});
 });
 await page.route('https://educart-e2e.supabase.co/rest/v1/rpc/set_email_preference',async route=>{
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  enabled=route.request().postDataJSON().p_enabled;
  await route.fulfill({status:200,headers,json:{enabled,channel_enabled:false}});
 });
 await page.setViewportSize({width:320,height:780});
 await login(page);
 await page.getByRole('button',{name:/^Notificações/}).click();
 const panel=page.getByRole('region',{name:'Preferências de e-mail'});
 const toggle=panel.getByRole('checkbox',{name:'Receber avisos no e-mail confirmado da minha conta'});
 await expect(toggle).not.toBeChecked();
 await expect(panel.getByText(/O envio externo ainda não está habilitado/)).toBeVisible();
 await toggle.click();await expect(toggle).toBeChecked();await expect(panel.getByText('Preferência salva.')).toBeVisible();
 expect(enabled).toBe(true);
 await toggle.click();await expect(toggle).not.toBeChecked();expect(enabled).toBe(false);
 await expect(page.getByRole('heading',{name:'Seus avisos'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});


test('F4.1 — controles e feedback compartilham tokens nos dois temas',async({page})=>{
 const db=await useFakeSupabase(page);
 db.carts.push({id:crypto.randomUUID(),code:'DS-01',name:'Carrinho design system',capacity:10,active:true});
 await page.setViewportSize({width:1440,height:900});await login(page);
 const menu=page.getByRole('navigation',{name:'Menu principal'});
 async function checkContrast(selector:string,min:number){
  const ratio=await page.locator(selector).first().evaluate(el=>{
   const luminance=(color:string)=>{const values=color.match(/\d+(\.\d+)?/g)!.slice(0,3).map(Number).map(x=>{const n=x/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*values[0]+.7152*values[1]+.0722*values[2];};
   const style=getComputedStyle(el),a=luminance(style.color),b=luminance(style.backgroundColor);
   return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  expect(ratio,selector+' contrast').toBeGreaterThanOrEqual(min);
 }
 for(const theme of ['dark','light']){
  if(theme==='light')await page.getByRole('button',{name:'Ativar modo claro'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await menu.getByRole('button',{name:'Manutenção',exact:true}).click();
  await page.getByRole('button',{name:'Nova manutenção'}).click();
  await expect(page.getByRole('button',{name:'Voltar para manutenção'})).toHaveClass(/ghost records-back/);
  await expect(page.locator('.ds-fieldset')).toBeVisible();
  await expect(page.locator('.field textarea')).toHaveCSS('border-top-left-radius','10px');
  await expect(page.locator('.field select')).toHaveCSS('min-height','44px');
  await checkContrast('.records-form-panel .field select',4.5);
  await checkContrast('.records-form-panel .primary',4.5);
  await page.getByRole('button',{name:'Voltar para manutenção'}).click();
  await expect(page.locator('.records-panel .empty')).toBeVisible();
  await menu.getByRole('button',{name:'Localizações',exact:true}).click();
  await expect(page.getByRole('group',{name:'Tipo de localização'})).toBeVisible();
  await page.getByRole('button',{name:'Local de guarda',exact:true}).click();
  await expect(page.getByRole('button',{name:'Atualizar listagem'})).toHaveClass(/secondary/);
  await menu.getByRole('button',{name:'Retirada e devolução',exact:true}).click();
  await expect(page.getByRole('group',{name:'Recorte das movimentações'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Atualizar listagem'})).toHaveClass(/secondary/);
  await menu.getByRole('button',{name:'Reservas',exact:true}).click();
  await page.getByRole('button',{name:'Nova reserva'}).click();
  await page.getByRole('button',{name:'Repetir semanalmente'}).click();
  const date=page.locator('#reservation-weekly-start');
  await expect(date).toHaveCSS('min-height','44px');
  expect(await date.evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(100);
  await date.focus();await expect(date).toHaveCSS('outline-width','3px');
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:800});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),theme+' '+width).toBe(true);
  }
 }
});


test('F4.2 — localizações com busca, detalhe, formulário separado e vínculo de guarda',async({page})=>{
 const db=await useFakeSupabase(page),campus=crypto.randomUUID(),block=crypto.randomUUID(),room=crypto.randomUUID(),cart=crypto.randomUUID();
 db.campuses.push({id:campus,name:'Campus sintético',active:true},{id:crypto.randomUUID(),name:'Campus desativado',active:false});
 db.campus_blocks.push({id:block,campus_id:campus,name:'Bloco A',active:true});
 db.campus_rooms.push({id:room,block_id:block,name:'Sala teste',active:true});
 db.carts.push({id:cart,code:'LOC-A',name:'Carrinho sintético',capacity:10,active:true});
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};
 await page.route('https://educart-e2e.supabase.co/rest/v1/cart_storage_locations',async route=>{
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  if(route.request().method()!=='POST'){await route.fallback();return;}
  expect(route.request().postDataJSON()).toMatchObject({cart_id:cart,room_id:room});
  db.cart_storage_locations.push({cart_id:cart,room_id:room});await route.fulfill({status:201,headers,json:[]});
 });
 await login(page);
 await page.getByRole('navigation',{name:'Menu principal'}).getByRole('button',{name:'Localizações'}).click();
 await page.getByLabel('Buscar registro').fill('sintético');
 await expect(page.getByRole('button',{name:'Ver detalhes'})).toHaveCount(1);
 await page.getByRole('button',{name:'Ver detalhes'}).click();
 await expect(page.getByRole('heading',{name:'Detalhes da localização'})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Caminho de navegação'})).toContainText('Campus');
 await page.getByRole('button',{name:'Editar',exact:true}).click();
 await expect(page.getByRole('group',{name:'Tipo de localização'})).toHaveCount(0);
 await page.getByLabel('Nome',{exact:true}).fill('Nome descartado');
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await expect(page.locator('.record-detail')).toContainText('Campus sintético');
 expect(db.campuses[0].name).toBe('Campus sintético');
 await page.getByRole('button',{name:'Voltar à listagem'}).click();
 await expect(page.getByLabel('Buscar registro')).toHaveValue('sintético');
 await page.getByRole('button',{name:'Local de guarda',exact:true}).click();
 await expect(page.getByText('LOC-A · Não informada')).toBeVisible();
 await page.getByRole('button',{name:'Ver detalhes'}).click();
 await page.getByRole('button',{name:'Alterar local de guarda'}).click();
 await page.getByRole('combobox',{name:'Sala de guarda'}).selectOption(room);
 await page.getByRole('button',{name:'Salvar localização'}).click();
 await expect(page.getByRole('status')).toContainText('Localização salva');
 await expect(page.locator('.record-detail')).toContainText('Campus sintético / Bloco A / Sala teste');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 expect(db.cart_storage_locations).toHaveLength(1);
});


test('F4.3 — auditoria axe de telas e temas',async({page})=>{
 test.setTimeout(120000);
 test.skip(!existsSync('.local-sql-test/node_modules/axe-core/axe.min.js'),'Instale axe-core isolado conforme docs/f4-3-acessibilidade.md');
 const db=await useFakeSupabase(page);
 db.carts.push({id:crypto.randomUUID(),code:'A11Y',name:'Carrinho acessível',capacity:10,active:true});
 const scan=async(label:string)=>{
  await page.addScriptTag({path:'.local-sql-test/node_modules/axe-core/axe.min.js'});
  const results=await page.evaluate(async()=> (await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations);
  console.log('AXE '+label+' '+JSON.stringify(results.map((r:any)=>({id:r.id,nodes:r.nodes.map((n:any)=>({target:n.target,summary:n.failureSummary?.slice(0,400)}))}))));
  return results.length;
 };
 await page.goto('/');
 let failures=await scan('login dark');
 await login(page);
 for(const theme of ['dark','light']){
  if(theme==='light')await page.getByRole('button',{name:'Ativar modo claro'}).click();
  for(const name of ['Visão geral','Localizações','Manutenção','Retirada e devolução','Carrinhos','Professores','Notebooks','Reservas','Calendário','Solicitações','Notificações']){
   await page.getByRole('navigation',{name:'Menu principal'}).getByRole('button',{name,exact:true}).click();
   await page.locator('main h1').waitFor();await page.waitForTimeout(150);
   failures+=await scan(theme+' '+name);
  }
  for(const [module,action] of [['Localizações','Cadastrar campus'],['Manutenção','Nova manutenção'],['Reservas','Nova reserva']]){
   await page.getByRole('navigation',{name:'Menu principal'}).getByRole('button',{name:module,exact:true}).click();
   await page.getByRole('button',{name:action,exact:true}).click();
   await page.locator('main h1').waitFor();
   failures+=await scan(theme+' formulário '+module);
   if(module==='Reservas'){await page.locator('#reservation-date-trigger').click();failures+=await scan(theme+' calendário aberto');await page.keyboard.press('Escape');}
  }
 }
 await page.goto('/#/consulta-publica');await page.getByRole('heading',{name:'Disponibilidade dos carrinhos'}).waitFor();
 failures+=await scan('public light');
 expect(failures).toBe(0);
});


test('F4.3 — teclado e foco no menu, calendário e formulários',async({page})=>{
 await useFakeSupabase(page);
 await page.setViewportSize({width:390,height:500});
 await login(page);
 const skip=page.getByRole('link',{name:'Pular para o conteúdo'});
 await skip.focus();await page.keyboard.press('Enter');
 await expect(page.locator('#main-content')).toBeFocused();
 const opener=page.getByRole('button',{name:'Abrir menu lateral'});
 await opener.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('button',{name:'Fechar menu lateral'})).toBeFocused();
 await expect(page.locator('#main-content')).toHaveAttribute('inert','');
 await page.keyboard.press('Shift+Tab');
 await expect(page.getByRole('button',{name:'Sair',exact:true})).toBeFocused();
 await page.keyboard.press('Tab');
 await expect(page.getByRole('button',{name:'Fechar menu lateral'})).toBeFocused();
 await page.keyboard.press('Escape');await expect(opener).toBeFocused();
 await expect(page.locator('#main-content')).not.toHaveAttribute('inert','');
 await opener.press('Enter');await page.getByRole('button',{name:'Reservas',exact:true}).click();
 await expect(page.locator('#main-content')).toBeFocused();
 await page.getByRole('button',{name:'Nova reserva'}).click();
 const trigger=page.locator('#reservation-date-trigger');
 await trigger.focus();await trigger.press('Enter');
 await page.getByRole('button',{name:'1 semana',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false');
 await trigger.press('Enter');await page.getByRole('button',{name:'Concluir',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(trigger).toBeFocused();
 await trigger.press('Enter');await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
});

test('F4.3 — reflow e ampliação de 200% simulada, temas persistidos',async({page})=>{
 await useFakeSupabase(page);
 await login(page);
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:450});
  await expect(page.getByRole('heading',{name:'Visão geral',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'viewport '+width).toBe(true);
 }
 await page.getByRole('button',{name:'Ativar modo claro'}).click();
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'zoom CSS 200%').toBe(true);
 await page.evaluate(()=>document.documentElement.style.zoom='');
 // Reduced CSS viewport equivalent to 1440x900 at 200% browser zoom.
 await page.setViewportSize({width:720,height:450});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'zoom reflow').toBe(true);
});


test('F4.3 — auditoria do professor e consulta pública em telas pequenas',async({page})=>{
 test.setTimeout(90000);
 test.skip(!existsSync('.local-sql-test/node_modules/axe-core/axe.min.js'),'Instale axe-core isolado conforme docs/f4-3-acessibilidade.md');
 const db=await useFakeSupabase(page,false),teacher=crypto.randomUUID(),cart=crypto.randomUUID();
 db.requesters.push({id:teacher,name:'Professor de teste',active:true});
 db.teacher_account_links.push({user_id:ADMIN_ID,requester_id:teacher,active:true});
 db.carts.push({id:cart,name:'Carrinho sintético',code:'A11Y-P',capacity:10,active:true});
 await page.setViewportSize({width:320,height:450});await login(page);
 const scan=async(label:string)=>{
  await page.addScriptTag({path:'.local-sql-test/node_modules/axe-core/axe.min.js'});
  const result=await page.evaluate(async()=> (await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations);
  console.log('AXE '+label+' '+JSON.stringify(result.map((r:any)=>({id:r.id,nodes:r.nodes.map((n:any)=>({target:n.target,summary:n.failureSummary?.slice(0,400)}))}))));
  expect(result,label).toHaveLength(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' reflow').toBe(true);
 };
 for(const theme of ['dark','light']){
  if(theme==='light')await page.getByRole('button',{name:'Ativar modo claro'}).click();
  await expect(page.getByRole('heading',{name:'Pedidos de reserva'})).toBeVisible();
  await scan(theme+' professor lista');
  const skip=page.getByRole('link',{name:'Ir ao conteúdo'});
  await skip.focus();await page.keyboard.press('Enter');await expect(page.locator('#teacher-main')).toBeFocused();
  await page.getByRole('button',{name:'Nova solicitação'}).click();
  await page.locator('#teacher-cart').selectOption(cart);
  await page.locator('#teacher-date-mode').selectOption('weekly');
  await scan(theme+' professor recorrência');
  await page.getByRole('button',{name:'Voltar para solicitações'}).click();
 }
 await page.goto('/#/consulta-publica');
 await page.getByRole('heading',{name:'Disponibilidade dos carrinhos'}).waitFor();
 await scan('light consulta pública 320');
 await page.getByRole('button',{name:'Ativar modo escuro'}).click();await scan('dark consulta pública 320');
});


test('F4.4 — pedido antigo não desaparece após 250 solicitações',async({page})=>{
 const db=await useFakeSupabase(page),teacher=crypto.randomUUID(),cart=crypto.randomUUID();
 db.requesters.push({id:teacher,name:'Professor pendência antiga',active:true});
 db.carts.push({id:cart,name:'Carrinho histórico',code:'HIST',capacity:10,active:true});
 const day=futureMondays()[0];
 for(let i=0;i<251;i++)db.reservation_requests.push({id:crypto.randomUUID(),requester_id:teacher,cart_id:cart,mode:'PARCIAL',quantity:1,dates:[day],shifts:['MATUTINO'],needs_mouse:false,notes:null,status:i===250?'PENDENTE':'REJEITADA',created_at:new Date().toISOString()});
 await login(page);
 await page.getByRole('button',{name:'Solicitações',exact:true}).click();
 const metric=(label:string)=>page.locator('.teacher-approval-stats .stat').filter({has:page.getByText(label,{exact:true})}).locator('strong');
 await expect(metric('Pedidos pendentes')).toHaveText('1');await expect(metric('Solicitações registradas')).toHaveText('251');
 await expect(page.getByRole('button',{name:'Aprovar e confirmar reserva'})).toHaveCount(1);
 await page.locator('#approval-filter').selectOption('TODAS');
 await expect(page.locator('.teacher-request-list article')).toHaveCount(50);
 await page.getByRole('button',{name:'Carregar mais solicitações'}).click();
 await expect(page.locator('.teacher-request-list article')).toHaveCount(100);
 await page.locator('#approval-filter').selectOption('PENDENTE');
 await expect(page.locator('.teacher-request-list article')).toHaveCount(1);
});

test('F4.4 — recorte incompleto bloqueia exportação e atualização recupera dados',async({page})=>{
 const db=await useFakeSupabase(page),teacher=crypto.randomUUID(),cart=crypto.randomUUID(),booking=crypto.randomUUID();
 const day=futureMondays()[0];
 db.requesters.push({id:teacher,name:'Professor relatório',active:true});
 db.carts.push({id:cart,name:'Carrinho relatório',code:'REL',capacity:10,active:true});
 db.reservations.push({id:booking,requester_id:teacher,cart_id:cart,mode:'PARCIAL',quantity:2,needs_mouse:false,notes:null,status:'CONFIRMADA',created_by:ADMIN_ID});
 db.reservation_periods.push({id:crypto.randomUUID(),reservation_id:booking,cart_id:cart,usage_date:day,shift:'MATUTINO',quantity:2,active:true});
 const pattern='https://educart-e2e.supabase.co/rest/v1/reservations?**';
 await page.route(pattern,async route=>{
  if(!new URL(route.request().url()).searchParams.get('id')?.startsWith('in.(')){await route.fallback();return;}
  await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},json:[]});
 });
 await login(page);await page.getByRole('button',{name:'Calendário',exact:true}).click();
 await page.locator('#calendar-focus').fill(day);
 await expect(page.getByRole('alert')).toContainText('Falha ao carregar o recorte completo');
 await expect(page.getByRole('button',{name:'Planilha CSV'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Exportar PDF'})).toBeDisabled();
 await page.unroute(pattern);
 await page.getByRole('button',{name:'Atualizar relatório'}).click();
 await expect(page.getByRole('button',{name:'Planilha CSV'})).toBeEnabled();
 await expect(page.locator('.calendar-event')).toContainText('Professor relatório');
});

test('F4.4 — aprovação invalida relatório e painel sem aguardar expiração do cache',async({page})=>{
 const db=await useFakeSupabase(page),teacher=crypto.randomUUID(),cart=crypto.randomUUID(),request=crypto.randomUUID();
 const day=futureMondays()[0];
 db.requesters.push({id:teacher,name:'Professor integração',active:true});
 db.carts.push({id:cart,name:'Carrinho integração',code:'INT',capacity:10,active:true});
 db.reservation_requests.push({id:request,requester_id:teacher,cart_id:cart,mode:'PARCIAL',quantity:2,dates:[day],shifts:['MATUTINO'],needs_mouse:false,notes:null,status:'PENDENTE',created_at:new Date().toISOString()});
 await login(page);await page.getByRole('button',{name:'Calendário',exact:true}).click();
 await page.locator('#calendar-focus').fill(day);
 const metric=()=>page.locator('.calendar-stats .stat').filter({has:page.getByText('Períodos ocupados',{exact:true})}).locator('strong');
 await expect(metric()).toHaveText('0');
 await page.getByRole('button',{name:'Solicitações',exact:true}).click();
 await page.getByRole('button',{name:'Aprovar e confirmar reserva'}).click();
 await expect(page.getByText('Solicitação aprovada e reserva confirmada.')).toBeVisible();
 await page.getByRole('button',{name:'Calendário',exact:true}).click();
 await page.locator('#calendar-focus').fill(day);
 await expect(metric()).toHaveText('1');
 await page.getByRole('button',{name:'Visão geral',exact:true}).click();
 await page.getByLabel('Próximos dias').selectOption('30');
 await expect(page.getByText('Professor integração',{exact:false}).first()).toBeVisible();
});


test('F4.4 — períodos são consultados por lote e códigos somente quando necessários',async({page})=>{
 const db=await useFakeSupabase(page),cart=crypto.randomUUID(),teacher=crypto.randomUUID(),booking=crypto.randomUUID(),day=futureMondays()[0];
 db.carts.push({id:cart,name:'Carrinho desempenho',code:'PERF',capacity:10,active:true});
 db.requesters.push({id:teacher,name:'Professor desempenho',active:true});
 db.notebook_codes.push({id:crypto.randomUUID(),cart_id:cart,code:'PERF-NB',active:true});
 db.reservations.push({id:booking,cart_id:cart,requester_id:teacher,mode:'PARCIAL',quantity:1,status:'CONFIRMADA',needs_mouse:false,notes:null});
 db.reservation_periods.push({id:crypto.randomUUID(),reservation_id:booking,cart_id:cart,usage_date:day,shift:'MATUTINO',quantity:1,active:true});
 await login(page);await expect(page.getByRole('heading',{name:'Visão geral'})).toBeVisible();
 await expect(page.locator('.dashboard-metrics .stat')).toHaveCount(6);
 const urls:URL[]=[];
 page.on('request',r=>{if(r.method()==='GET'&&r.url().startsWith('https://educart-e2e.supabase.co/rest/v1/'))urls.push(new URL(r.url()));});
 await page.getByRole('button',{name:'Reservas',exact:true}).click();
 await expect(page.getByRole('button',{name:'Editar',exact:true})).toBeEnabled();
 const periodQueries=urls.filter(u=>u.pathname.endsWith('/reservation_periods'));
 expect(periodQueries.length).toBeGreaterThan(0);
 expect(periodQueries.every(u=>u.searchParams.get('reservation_id')?.startsWith('in.('))).toBe(true);
 expect(urls.some(u=>u.pathname.endsWith('/notebook_codes'))).toBe(false);
 await page.getByRole('button',{name:'Nova reserva'}).click();
 await page.locator('#reservation-requester').selectOption(teacher);await page.locator('#reservation-cart').selectOption(cart);
 await expect(page.getByRole('radio',{name:'Carrinho completo'})).toBeChecked();
 expect(urls.some(u=>u.pathname.endsWith('/notebook_codes'))).toBe(false);
 await page.getByRole('radio',{name:'Notebooks avulsos'}).check();
 await expect(page.getByText('PERF-NB',{exact:true})).toBeVisible();
 expect(urls.filter(u=>u.pathname.endsWith('/notebook_codes')).every(u=>u.searchParams.get('cart_id')==='eq.'+cart)).toBe(true);
});

test.describe('F5.0 — protótipo de ambiente 3D',()=>{
  test('cena, inspeção, porta, busca e fallback acessível',async({page},testInfo)=>{
    await useFakeSupabase(page);
    await page.goto('/?prototype3d=1');
    await page.getByLabel('E-mail').fill('test-admin@educart.example');
    await page.getByLabel('Senha').fill('senha-de-teste-sem-uso-real');
    await page.getByRole('button',{name:'Entrar no Educart'}).click();
    await page.getByRole('button',{name:'Protótipo 3D'}).click();
    await expect(page.getByRole('heading',{name:'Ambiente 3D · Protótipo'})).toBeVisible();
    await expect(page.locator('.dt-cart')).toHaveCount(4);
    await expect(page.locator('.dt-stage canvas')).toBeVisible();
    const sceneMetrics=await page.locator('.dt-stage canvas').evaluate(el=>({drawCalls:Number(el.getAttribute('data-draw-calls')),triangles:Number(el.getAttribute('data-triangles'))}));
    expect(sceneMetrics.drawCalls).toBeGreaterThan(0);expect(sceneMetrics.drawCalls).toBeLessThan(200);expect(sceneMetrics.triangles).toBeLessThan(10000);
    console.log('F5.0 metricas da cena:',sceneMetrics);
    await page.screenshot({path:testInfo.outputPath('visao-geral.png')});
    await testInfo.attach('visao-geral',{path:testInfo.outputPath('visao-geral.png'),contentType:'image/png'});
    await page.getByRole('button',{name:/DEMO-02/}).click();
    await expect(page.locator('.dt-details')).toContainText('18');
    await page.getByRole('button',{name:'Inspecionar carrinho'}).click();
    await expect(page.getByRole('heading',{name:'Inspeção: DEMO-02'})).toBeVisible();
    await page.getByRole('button',{name:'Abrir porta'}).click();
    await expect(page.getByRole('button',{name:'Fechar porta'})).toHaveAttribute('aria-pressed','true');
    await page.screenshot({path:testInfo.outputPath('inspecao.png')});
    await testInfo.attach('inspecao',{path:testInfo.outputPath('inspecao.png'),contentType:'image/png'});
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading',{name:'Sala de TI — visão geral'})).toBeVisible();
    await page.getByLabel('Exibir ambiente 3D').uncheck();
    await expect(page.locator('.dt-stage canvas')).toHaveCount(0);
    await page.getByLabel('Buscar carrinho na lista').fill('delta');
    await expect(page.locator('.dt-cart')).toHaveCount(1);
    await page.getByRole('button',{name:/DEMO-04/}).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.dt-details')).toContainText('Sem localização definida');
    await expect(page.locator('.dt-details')).toContainText('Em manutenção');
    await page.getByLabel('Buscar carrinho na lista').fill('');
    await expect(page.locator('.dt-cart')).toHaveCount(4);
    await page.setViewportSize({width:390,height:844});
    await page.getByLabel('Exibir ambiente 3D').check();
    await expect(page.locator('.dt-stage canvas')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('mobile.png')});
    await testInfo.attach('mobile',{path:testInfo.outputPath('mobile.png'),contentType:'image/png'});
  });
  test('lista permanece funcional sem WebGL',async({page})=>{
    await page.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){
        if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;
        return Reflect.apply(original,this,[type,...args]);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await useFakeSupabase(page);
    await page.goto('/?prototype3d=1');
    await page.getByLabel('E-mail').fill('test-admin@educart.example');
    await page.getByLabel('Senha').fill('senha-de-teste-sem-uso-real');
    await page.getByRole('button',{name:'Entrar no Educart'}).click();
    await page.getByRole('button',{name:'Protótipo 3D'}).click();
    await expect(page.getByText('WebGL indisponível.',{exact:false})).toBeVisible();
    await page.getByRole('button',{name:/DEMO-03/}).click();
    await expect(page.locator('.dt-details')).toContainText('Totalmente reservado');
  });
  test('flag não libera a demonstração a conta não autorizada',async({page})=>{
    await useFakeSupabase(page,false);
    await page.goto('/?prototype3d=1');
    await page.getByLabel('E-mail').fill('test-admin@educart.example');
    await page.getByLabel('Senha').fill('senha-de-teste-sem-uso-real');
    await page.getByRole('button',{name:'Entrar no Educart'}).click();
    await expect(page.getByRole('heading',{name:'Conta criada, aguardando autorização'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Protótipo 3D'})).toHaveCount(0);
  });
});

test.describe('F5.1 — configuração espacial',()=>{
 test('admin consulta e cadastra metadados, com resumo sem posição e detalhe sob demanda',async({page})=>{
  const db=await useFakeSupabase(page);
  const cartId='00000000-0000-4000-8000-000000000051';
  const roomId='00000000-0000-4000-8000-000000000052';
  const blockId='00000000-0000-4000-8000-000000000053';
  const campusId='00000000-0000-4000-8000-000000000054';
  db.carts.push({id:cartId,code:'F51',name:'Carrinho teste',capacity:10,active:true});
  db.campuses.push({id:campusId,name:'Campus',active:true});
  db.campus_blocks.push({id:blockId,campus_id:campusId,name:'Bloco',active:true});
  db.campus_rooms.push({id:roomId,block_id:blockId,name:'Sala',active:true});
  const summary={cart_id:cartId,code:'F51',name:'Carrinho teste',active:true,storage_room_id:null,scene_id:null,model_id:null,position_x:null,position_y:null,position_z:null,yaw:null,placement_version:null,nominal_capacity:10,effective_capacity:10,reserved:3,available:7,maintenance_count:0,availability_status:'PARTIAL',snapshot_at:new Date().toISOString()};
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS,PATCH,DELETE'};
  let details=0;
  await page.route('**/rest/v1/rpc/spatial_cart_summary*',r=>r.fulfill({headers,json:r.request().method()==='OPTIONS'?{}:[summary]}));
  await page.route('**/rest/v1/rpc/spatial_cart_details*',r=>{if(r.request().method()!=='OPTIONS')details++;return r.fulfill({headers,json:{summary,reservations:[],confirmed_slots:[]}});});
  await page.goto('/?spatial3d=1');
  await page.getByLabel('E-mail').fill('test-admin@educart.example');
  await page.getByLabel('Senha').fill('senha-de-teste-sem-uso-real');
  await page.getByRole('button',{name:'Entrar no Educart'}).click();
  await page.getByRole('button',{name:'Configuração espacial'}).click();
  await expect(page.getByRole('heading',{name:'Configuração espacial · F5.1'})).toBeVisible();
  await expect(page.getByRole('button',{name:/F51 — Carrinho teste/})).toContainText('7/10 disponíveis');
  expect(details).toBe(0);
  await page.getByLabel('Nome do modelo').fill('Modelo sintético');
  await page.getByLabel('Autoria').fill('Equipe TI');
  await page.getByLabel('Licença').fill('Interno');
  await page.getByRole('button',{name:'Salvar modelo'}).click();
  await expect(page.getByText('Modelo salvo.',{exact:true})).toBeVisible();
  expect(db.asset_models).toHaveLength(1);
  await page.getByLabel('Nome do ambiente').fill('Ambiente sintético');
  await page.getByLabel('Sala de referência').selectOption(roomId);
  await page.getByRole('button',{name:'Salvar ambiente'}).click();
  await expect(page.getByText('Ambiente salvo.',{exact:true})).toBeVisible();
  expect(db.spatial_scenes).toHaveLength(1);
  await page.getByRole('button',{name:/F51 — Carrinho teste/}).click();
  await expect(page.getByText('0 reservas confirmadas · 0 vínculos físicos ativos')).toBeVisible();
  expect(details).toBeGreaterThan(0);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 });
});

test.describe('F5.2 — visão geral administrativa 3D',()=>{
 test('todos os carrinhos, GLB e corte, detalhe sob demanda, turno, erro sem saldo, lista alternativa',async({page})=>{
  const db=await useFakeSupabase(page);
  const uid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const cartA=uid(521),cartB=uid(522),roomId=uid(523),blockId=uid(524),campusId=uid(525),sceneId=uid(526),modelId=uid(527);
  db.carts.push({id:cartA,code:'F52A',name:'Carrinho A',capacity:10,active:true},{id:cartB,code:'F52B',name:'Carrinho B',capacity:20,active:true});
  db.campuses.push({id:campusId,name:'Campus sintético',active:true});
  db.campus_blocks.push({id:blockId,campus_id:campusId,name:'Bloco A',active:true});
  db.campus_rooms.push({id:roomId,block_id:blockId,name:'Sala 1',active:true});
  db.spatial_scenes.push({id:sceneId,room_id:roomId,name:'Ambiente A',width_m:8,depth_m:6,active:true});
  db.asset_models.push({id:modelId,kind:'CART',width_m:1,depth_m:.8,active:true});
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
  let fail=false,detailCalls=0,historyCalls=0;
  const notebookId=uid(528),reservationId=uid(529),periodId=uid(530);
  const reservation={id:reservationId,period_id:periodId,requester:'Docente sintético',quantity:3,mode:'PARCIAL',destination_room_id:roomId,destination_label:null,needs_mouse:false,notes:null};
  const slot={slot_key:'POS-FISICA-7',notebook_id:notebookId,code:'F54-NB-01',confirmed_at:'2026-11-17T10:00:00Z',reservation_period_id:periodId};
  await page.route('**/rest/v1/equipment_movements*',async route=>{
   const url=new URL(route.request().url());
   if(route.request().method()==='OPTIONS'){await route.fulfill({headers,status:204});return;}
   if(!url.searchParams.has('notebook_ids')){await route.fulfill({headers,json:[]});return;}
   historyCalls++;expect(url.searchParams.get('cart_id')).toBe('eq.'+cartA);expect(url.searchParams.get('notebook_ids')).toContain(notebookId);
   await route.fulfill({headers,json:[{id:uid(531),cart_id:cartA,notebook_ids:[notebookId],pickup_at:'2026-11-17T10:00:00Z',return_at:'2026-11-17T11:00:00Z',pickup_condition:'BOA',return_condition:'RESSALVA'}]});
  });
  const summary=(shift:string)=>{
   const reserved=shift==='VESPERTINO'?8:3;
   return [{cart_id:cartA,code:'F52A',name:'Carrinho A',active:true,storage_room_id:roomId,scene_id:sceneId,model_id:modelId,position_x:1,position_y:0,position_z:-1,yaw:0,placement_version:1,nominal_capacity:10,effective_capacity:10,reserved,available:10-reserved,maintenance_count:0,availability_status:'PARTIAL',snapshot_at:new Date().toISOString()},
   {cart_id:cartB,code:'F52B',name:'Carrinho B',active:true,storage_room_id:null,scene_id:null,model_id:null,position_x:null,position_y:null,position_z:null,yaw:null,placement_version:null,nominal_capacity:20,effective_capacity:0,reserved:0,available:0,maintenance_count:1,availability_status:'MAINTENANCE',snapshot_at:new Date().toISOString()}];
  };
  await page.route('**/rest/v1/rpc/spatial_cart_summary*',async r=>{
   if(r.request().method()==='OPTIONS'){await r.fulfill({headers,status:204});return;}
   const body=r.request().postDataJSON();
   await r.fulfill(fail?{headers,status:503,json:{message:'consulta indisponível'}}:{headers,json:summary(body.p_shift)});
  });
  await page.route('**/rest/v1/rpc/spatial_cart_details*',async r=>{
   if(r.request().method()==='OPTIONS'){await r.fulfill({headers,status:204});return;}
   detailCalls++;const body=r.request().postDataJSON();const row=summary(body.p_shift).find(c=>c.cart_id===body.p_cart_id)!;
   await r.fulfill({headers,json:{summary:row,reservations:row.cart_id===cartA?[reservation]:[],confirmed_slots:row.cart_id===cartA?[slot]:[]}});
  });
  await page.goto('/?environment3d=1');
  await page.getByLabel('E-mail').fill('test-admin@educart.example');
  await page.getByLabel('Senha').fill('senha-de-teste-sem-uso-real');
  await page.getByRole('button',{name:'Entrar no Educart'}).click();
  await page.getByRole('button',{name:'Ambiente 3D',exact:true}).click();
  const list=page.locator('.dt-list');
  await expect(list.getByRole('button')).toHaveCount(2);
  await expect(list.getByRole('button',{name:/F52A/})).toContainText('Sala 1');
  await expect(list.getByRole('button',{name:/F52B/})).toContainText('Sem localização definida');
  expect(detailCalls).toBe(0);
  const canvas=page.locator('.dt-stage canvas');
  await expect(canvas).toHaveAttribute('data-asset-mode','detailed',{timeout:15000});
  await expect(canvas).toHaveAttribute('data-cart-count','2');
  await list.getByRole('button',{name:/F52A/}).click();
  await expect(page.getByRole('button',{name:/F54-NB-01/})).toBeVisible();
  expect(historyCalls).toBe(0);
  await page.getByRole('button',{name:/F54-NB-01/}).click();
  await expect(page.getByText(/Reserva vinculada: Docente sintético/)).toBeVisible();
  await expect(page.getByText(/Devolução: .*Com ressalva/)).toBeVisible();
  expect(historyCalls).toBeGreaterThan(0);
  expect(detailCalls).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Focalizar carrinho'}).click();
  await expect(canvas).toHaveAttribute('data-cutaway-cart','');
  await page.getByRole('button',{name:'Abrir porta virtual'}).click();
  await expect(canvas).toHaveAttribute('data-cutaway-cart',cartA);
  await page.getByRole('button',{name:'Notebook ilustrativo',exact:true}).click();
  await expect(page.getByText('Exemplo visual sem patrimônio, posição física ou reserva individual associada.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Fechar porta virtual'}).click();
  await expect(canvas).toHaveAttribute('data-cutaway-cart','');
  await list.getByRole('button',{name:/F52B/}).click();
  await expect(page.getByRole('button',{name:/F54-NB-01/})).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-cutaway-cart','');
  await page.getByLabel('Qualidade visual').selectOption('low');
  await expect(canvas).toHaveAttribute('data-asset-mode','economical');
  await page.route('**/cart-illustrative-v1.glb*',r=>r.fulfill({status:503,body:'asset unavailable'}));
  await page.getByLabel('Qualidade visual').selectOption('high');
  await expect(canvas).toHaveAttribute('data-asset-mode','fallback',{timeout:15000});
  await expect(list.getByRole('button')).toHaveCount(2);
  await page.unroute('**/cart-illustrative-v1.glb*');
  await list.getByRole('button',{name:/F52A/}).click();
  await page.getByLabel('Turno',{exact:true}).selectOption('VESPERTINO');
  await expect(list.getByRole('button',{name:/F52A/})).toContainText('2 disponíveis');
  await page.getByLabel('Buscar carrinho na lista').fill('F52B');
  await expect(list.getByRole('button')).toHaveCount(1);
  await page.getByLabel('Buscar carrinho na lista').clear();
  await page.getByLabel('Exibir ambiente 3D').uncheck();
  await expect(list.getByRole('button')).toHaveCount(2);
  fail=true;
  await page.getByRole('button',{name:'Atualizar dados'}).click();
  await expect(page.getByText('Não foi possível confirmar a ocupação deste período.',{exact:false})).toBeVisible();
  await expect(list.getByRole('button',{name:/F52A/})).toContainText('Não confirmado');
  await expect(list.getByRole('button',{name:/F52A/})).not.toContainText('disponíveis');
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 });
 test('sem autorização administrativa não expõe ambiente mesmo com flag DEV',async({page})=>{
  await useFakeSupabase(page,false);
  await page.goto('/?environment3d=1');
  await page.getByLabel('E-mail').fill('test-admin@educart.example');
  await page.getByLabel('Senha').fill('senha-de-teste-sem-uso-real');
  await page.getByRole('button',{name:'Entrar no Educart'}).click();
  await expect(page.getByRole('heading',{name:'Conta criada, aguardando autorização'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Ambiente 3D',exact:true})).toHaveCount(0);
 });
});
