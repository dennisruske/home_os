import { test, expect } from '@playwright/test';

test.describe('Aggregated Energy Routes', () => {
  test('should return aggregated grid data with default timeframe', async ({ request }) => {
    const response = await request.get('/api/energy/aggregated/grid');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Grid response should have consumption and feedIn
    expect(data).toHaveProperty('consumption');
    expect(data).toHaveProperty('feedIn');
    expect(data.consumption).toHaveProperty('data');
    expect(data.consumption).toHaveProperty('total');
    expect(data.feedIn).toHaveProperty('data');
    expect(data.feedIn).toHaveProperty('total');
  });

  test('should return aggregated grid data with custom timeframe', async ({ request }) => {
    const response = await request.get('/api/energy/aggregated/grid?timeframe=week');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('consumption');
    expect(data).toHaveProperty('feedIn');
  });

  test('should return aggregated car data', async ({ request }) => {
    const response = await request.get('/api/energy/aggregated/car?timeframe=day');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Car response should have data and total (not consumption/feedIn)
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.data)).toBeTruthy();
    expect(typeof data.total).toBe('number');
  });

  test('should return aggregated solar data', async ({ request }) => {
    const response = await request.get('/api/energy/aggregated/solar?timeframe=month');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Solar response should have data and total (not consumption/feedIn)
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.data)).toBeTruthy();
    expect(typeof data.total).toBe('number');
  });

  test('should return 400 for invalid energy type', async ({ request }) => {
    const response = await request.get('/api/energy/aggregated/invalid-type');
    
    expect(response.status()).toBe(400);
    const data = await response.json();
    
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Invalid energy type');
  });

  test('should handle custom start and end timestamps', async ({ request }) => {
    const start = Math.floor(new Date('2024-01-01').getTime() / 1000);
    const end = Math.floor(new Date('2024-01-02').getTime() / 1000);
    
    const response = await request.get(
      `/api/energy/aggregated/grid?start=${start}&end=${end}`
    );
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('consumption');
    expect(data).toHaveProperty('feedIn');
  });
});

