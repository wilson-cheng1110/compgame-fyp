import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('\n🔙 BACK BUTTON TEST\n');

    // First login
    console.log('1. Logging in...');
    await page.goto('http://localhost:3004/login', { waitUntil: 'domcontentloaded' });
    
    // Fill login form (using test credentials)
    const sidInput = await page.locator('input[placeholder*="22000000D"]');
    await sidInput.fill('TEST2024');
    
    const pwInput = await page.locator('input[type="password"]');
    await pwInput.fill('Test@123');
    
    const loginBtn = await page.locator('button:has-text("Login")');
    await loginBtn.click();
    
    await page.waitForURL(/dashboard/, { timeout: 10000 }).catch(() => {});
    
    // Navigate to two games
    console.log('2. Navigating to first game...');
    await page.goto('http://localhost:3004/games/fitts-law-understanding', { waitUntil: 'domcontentloaded' });
    const url1 = page.url();
    console.log(`   URL: ${url1}`);
    
    console.log('3. Navigating to second game...');
    await page.goto('http://localhost:3004/games/memory-understanding', { waitUntil: 'domcontentloaded' });
    const url2 = page.url();
    console.log(`   URL: ${url2}`);
    
    // Use browser back
    console.log('4. Clicking browser back button...');
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    const backUrl = page.url();
    console.log(`   Back URL: ${backUrl}`);
    
    const backWorks = backUrl.includes('fitts-law');
    if (backWorks) {
      console.log(`✅ FIXED: Back button works correctly (${backUrl})`);
    } else {
      console.log(`❌ FAILED: Back button didn't work (${backUrl})`);
    }

  } catch (e) {
    console.error('❌ TEST ERROR:', e.message);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
