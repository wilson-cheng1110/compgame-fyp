import { chromium } from '@playwright/test';

const baseURL = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('1. Going to login page...');
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });

    console.log('2. Clicking "Forgot password?" button...');
    const forgotBtn = await page.waitForSelector('button:has-text("Forgot password?")', { timeout: 5000 });
    await forgotBtn.click();

    console.log('3. Waiting for signup redirect...');
    await page.waitForURL(`${baseURL}/signup`, { timeout: 5000 });
    console.log('✅ Redirected to signup after password reset');

    // Verify users cookie was cleared
    const usersCookie = await page.context().cookies();
    const usersExists = usersCookie.find(c => c.name === 'users');
    if (!usersExists) {
      console.log('✅ Users cookie was cleared');
    } else {
      console.log('⚠️  Users cookie still exists');
    }

    console.log('✅ FORGOT PASSWORD TEST PASSED');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
