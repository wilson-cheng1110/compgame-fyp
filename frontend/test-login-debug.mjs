import { chromium } from '@playwright/test';

const baseURL = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('1. Going to login...');
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });

    console.log('2. Filling login with TESTSID001...');
    const sidInput = await page.waitForSelector('input[placeholder*="22000000D"]', { timeout: 5000 });
    await sidInput.fill('TESTSID001');
    const pwInput = await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await pwInput.fill('test123');

    console.log('3. Clicking Log In...');
    const loginBtn = await page.$('button:has-text("Log In")');
    await loginBtn.click();

    console.log('4. Waiting for redirect (30s timeout)...');
    try {
      await page.waitForURL(`${baseURL}/dashboard`, { timeout: 30000 });
      console.log('✅ Reached dashboard');
    } catch (e) {
      console.log(`❌ Did not reach dashboard. Current URL: ${page.url()}`);
      const bodyText = await page.textContent('body');
      console.log('Page content (first 300 chars):', bodyText?.substring(0, 300));
      const userCookie = await page.context().cookies();
      console.log('Cookies:', userCookie.map(c => ({ name: c.name, value: c.value.substring(0, 50) })));
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await browser.close();
  }
})();
