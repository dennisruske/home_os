import { test, expect } from '@playwright/test';

test('energy consumption cards exist', async ({ page }) => {
  await page.goto('/');
  
  // Verify each card exists and is visible
  await expect(page.getByText('Grid Energy Consumption')).toBeVisible();
  await expect(page.getByText('Grid Energy Feed-In')).toBeVisible();
  await expect(page.getByText('Car Energy Consumption')).toBeVisible();
  await expect(page.getByText('Solar Energy Production')).toBeVisible();
});

