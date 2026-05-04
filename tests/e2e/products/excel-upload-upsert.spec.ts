import { test, expect } from '@playwright/test';

/**
 * Excel Upload — Upsert by Barcode (Option 2) E2E Tests
 *
 * Tests run against deployed Vercel environment.
 * MASTER (admin.json) = default auth, SELLER (seller.json) for access control.
 */

test.describe('엑셀 업로드 — 페이지 접근', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('MASTER can access /products/upload page', async ({ page }) => {
    await page.goto('/products/upload');
    await expect(
      page.getByRole('heading', { name: '엑셀 상품 업로드' })
    ).toBeVisible({ timeout: 15000 });
  });

  test('upload page shows center selector and template download', async ({ page }) => {
    await page.goto('/products/upload');
    await expect(page.getByText('1. 센터 선택')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('2. 엑셀 파일')).toBeVisible();
    await expect(page.getByText('템플릿 다운로드')).toBeVisible();
    await expect(page.getByText('파일 선택')).toBeVisible();
  });

  test('upload page shows column guide', async ({ page }) => {
    await page.goto('/products/upload');
    await expect(page.getByText('컬럼 안내')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('바코드 * (매칭 키)')).toBeVisible();
    await expect(page.getByText('상품명 *')).toBeVisible();
    await expect(page.getByText('판매가 *')).toBeVisible();
  });

  test('upload page shows upsert mode description', async ({ page }) => {
    await page.goto('/products/upload');
    await expect(
      page.getByText('바코드 기준으로 상품을 일괄 갱신합니다')
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('엑셀 업로드 — 이력 페이지', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('MASTER can access /products/upload-history page', async ({ page }) => {
    await page.goto('/products/upload-history');
    await expect(
      page.getByRole('heading', { name: '엑셀 업로드 이력' })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('최근 30일')).toBeVisible();
  });

  test('history page shows 최근 30일 badge for MASTER', async ({ page }) => {
    await page.goto('/products/upload-history');
    await expect(page.getByText('엑셀 업로드 이력')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('최근 30일')).toBeVisible();
  });

  test('history page has navigation links', async ({ page }) => {
    await page.goto('/products/upload-history');
    await expect(page.getByText('새 업로드')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('엑셀 업로드 — 사이드바', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('sidebar shows 엑셀 업로드 menu for MASTER', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: '상품 관리', exact: true }).first()).toBeVisible({ timeout: 15000 });
    // Sidebar should have the upload link
    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('엑셀 업로드')).toBeVisible();
  });
});

test.describe('엑셀 업로드 — SELLER 접근 차단', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('SELLER cannot see 엑셀 업로드 in sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('엑셀 업로드')).not.toBeVisible();
  });
});

test.describe('엑셀 업로드 — API 테스트', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('preview API returns 400 without file', async ({ request }) => {
    const res = await request.post('/api/products/upload/preview', {
      headers: { Origin: 'https://live-commerce-opal.vercel.app' },
      multipart: {
        centerId: 'nonexistent',
      },
    });
    expect(res.status()).toBe(400);
  });

  test('upload API returns 400 without centerId', async ({ request }) => {
    // Create a minimal Excel buffer
    const res = await request.post('/api/products/upload', {
      headers: { Origin: 'https://live-commerce-opal.vercel.app' },
      multipart: {
        file: {
          name: 'test.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('empty'),
        },
      },
    });
    expect(res.status()).toBe(400);
  });

  test('history API returns paginated data', async ({ request }) => {
    const res = await request.get('/api/products/upload/history');
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    expect(json.data).toHaveProperty('items');
    expect(json.data).toHaveProperty('totalCount');
    expect(json.data).toHaveProperty('pageCount');
    expect(Array.isArray(json.data.items)).toBe(true);
  });

  test('rollback API returns 400 without auditLogId', async ({ request }) => {
    const res = await request.post('/api/products/upload/rollback', {
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://live-commerce-opal.vercel.app',
      },
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('rollback API returns 404 for nonexistent auditLogId', async ({ request }) => {
    const res = await request.post('/api/products/upload/rollback', {
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://live-commerce-opal.vercel.app',
      },
      data: { auditLogId: 'nonexistent-id-12345' },
    });
    // Should be 404 (not found)
    expect(res.status()).toBe(404);
  });
});

test.describe('엑셀 업로드 — SELLER API 접근 차단', () => {
  test.use({ storageState: 'playwright/.auth/seller.json' });

  test('SELLER cannot access upload preview API', async ({ request }) => {
    const res = await request.post('/api/products/upload/preview', {
      headers: { Origin: 'https://live-commerce-opal.vercel.app' },
      multipart: {
        centerId: 'any-center',
      },
    });
    // SELLER should get 403 (forbidden)
    expect(res.status()).toBe(403);
  });

  test('SELLER cannot access upload API', async ({ request }) => {
    const res = await request.post('/api/products/upload', {
      headers: { Origin: 'https://live-commerce-opal.vercel.app' },
      multipart: {
        centerId: 'any-center',
      },
    });
    expect(res.status()).toBe(403);
  });

  test('SELLER cannot access upload history API', async ({ request }) => {
    const res = await request.get('/api/products/upload/history');
    expect(res.status()).toBe(403);
  });

  test('SELLER cannot access rollback API', async ({ request }) => {
    const res = await request.post('/api/products/upload/rollback', {
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://live-commerce-opal.vercel.app',
      },
      data: { auditLogId: 'any-id' },
    });
    expect(res.status()).toBe(403);
  });
});
