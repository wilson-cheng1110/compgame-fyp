import { chromium } from '@playwright/test';

(async () => {
  const context = await chromium.launchPersistentContext('', {
    headless: true
  });
  const page = await context.newPage();

  try {
    console.log('\n🔐 AUTH FIX TEST - Unauthorized Access Check\n');
    console.log('1. Clear all cookies...');
    await context.clearCookies();

    // Try to access game WITHOUT logging in (should redirect to login)
    console.log('2. Accessing game WITHOUT authentication...');
    const response = await page.goto('http://localhost:3004/games/fitts-law-understanding', { 
      timeout: 10000,
      waitUntil: 'domcontentloaded'
    });
    
    const url = page.url();
    const redirected = url.includes('/login') || url.includes('/signup');
    
    console.log(`Final URL: ${url}`);
    console.log(`Status: ${response ? response.status() : 'N/A'}`);
    
    if (redirected) {
      console.log(`✅ FIXED: Unauthorized access redirects to ${url}`);
    } else {
      console.log(`❌ FAILED: Unauthorized access was allowed (${url})`);
    }

  } catch (e) {
    console.error('❌ TEST ERROR:', e.message);
  } finally {
    await context.close();
    process.exit(0);
  }
})();
