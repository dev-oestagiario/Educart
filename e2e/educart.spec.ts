import { XLSX_FIXTURE_BASE64 } from './fixtures/workbook';
import { mkdir } from 'node:fs/promises';
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
    carts: [], requesters: [], notebook_codes: []
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
