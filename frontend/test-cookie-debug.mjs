import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('\n🍪 COOKIE DEBUG TEST\n');

    // Load a page and check cookies
    console.log('1. Loading homepage...');
    await page.goto('http://localhost:3001/', { 
      timeout: 10000,
      waitUntil: 'domcontentloaded'
    });
    
    const cookies = await page.context().cookies();
    console.log(`Cookies on fresh page: ${JSON.stringify(cookies)}`);
    
    // Now try to access a game page
    console.log('\n2. Accessing game page...');
    await page.goto('http://localhost:3001/games/fitts-law-understanding', { 
      timeout: 10000,
      waitUntil: 'domcontentloaded'
    });
    
    const url = page.url();
    console.log(`Final URL: ${url}`);
    
    // Check if the component rendered
    const content = await page.locator('body').textContent();
    console.log(`Page content includes "Loading": ${content.includes('Loading')}`);
    console.log(`Page content includes "game": ${content.toLowerCase().includes('game')}`);

  } catch (e) {
    console.error('❌ TEST ERROR:', e.message);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
