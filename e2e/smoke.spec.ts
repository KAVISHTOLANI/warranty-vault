import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

test('add an item, log a claim, see it on the calendar', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Know what’s covered');
  await expect(page.locator('.hero .tl-bar').first()).toBeVisible();
  await page.waitForTimeout(1000);
  await snap(page, 'landing');
  await checkMobile(page, 'landing-mobile');

  await page.getByRole('link', { name: 'Open your items' }).click();
  await expect(page.getByText(/Showing 1–8 of 11/)).toBeVisible();
  await page.getByRole('button', { name: /Covered until/ }).click();
  await snap(page, 'items');
  await checkMobile(page);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Add item' }).click();
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByText(/Name the product/)).toBeVisible();
  await page.getByLabel('Product name').fill('Espresso machine');
  const d = new Date();
  d.setMonth(d.getMonth() - 11);
  await page.getByLabel('Purchase date').fill(d.toISOString().slice(0, 10));
  await page.getByLabel('Price paid').fill('420');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByText('Saved “Espresso machine”.')).toBeVisible();
  await expect(page.getByText('Expiring soon').first()).toBeVisible();

  await page.getByLabel('Issue').fill('Pump is noisy');
  await page.getByRole('button', { name: 'Log claim' }).click();
  await expect(page.getByText('Pump is noisy', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Pump is noisy', { exact: true })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Expiry calendar' }).click();
  await expect(page.getByRole('link', { name: 'Espresso machine' })).toBeVisible();
  await page.getByLabel(/Warn me/).selectOption('14');
  await snap(page, 'calendar');
  await checkMobile(page, 'calendar-mobile');
});
