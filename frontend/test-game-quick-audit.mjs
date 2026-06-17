import { chromium } from '@playwright/test';

const baseURL = 'http://localhost:3005';

const GAMES = [
  'fitts-law-assessment',
  'hicks-law-assessment',
  'memory-assessment',
  'gestalt-assessment',
  'stroop-assessment',
  'norman-assessment',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('\n🔍 AUDIT WITH LOGIN\n');

    // Login
    console.log('1. Logging in...');
    await page.goto(`${baseURL}/login`);
    await page.locator('input[placeholder*="22000000D"]').fill('AUDIT002');
    await page.locator('input[type="password"]').fill('Test@123');
    await page.locator('button:has-text("Login")').click();
    await page.waitForURL(/dashboard/, { timeout: 10000 });
    console.log('✅ Logged in\n');

    // Test each game
    for (const gameId of GAMES) {
      console.log(`📌 ${gameId}`);
      try {
        await page.goto(`${baseURL}/games/${gameId}`, { timeout: 8000 });
        
        if (!page.url().includes(gameId)) {
          console.log(`  ❌ Page load failed (redirected to ${page.url()})`);
          continue;
        }

        const startBtn = await page.locator('button:has-text("Start")').first();
        if (await startBtn.count() === 0) {
          console.log(`  ❌ No Start button`);
          continue;
        }

        console.log(`  ✅ Page loads, Start button present`);
      } catch (e) {
        console.log(`  ❌ ${e.message.substring(0, 50)}`);
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
