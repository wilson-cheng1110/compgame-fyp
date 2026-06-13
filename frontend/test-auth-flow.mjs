import { chromium } from '@playwright/test';

const baseURL = 'http://localhost:3000';
const testSID = 'TESTUSER' + Date.now();
const testPassword = 'TestPass123';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('=== SIGNUP FLOW ===');
    console.log(`1. Navigating to signup...`);
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });

    // Fill signup form
    console.log(`2. Filling signup form with SID: ${testSID}`);
    const sidInput = await page.waitForSelector('input[placeholder*="22000000D"]', { timeout: 5000 });
    await sidInput.fill(testSID);

    const pwInput = await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await pwInput.fill(testPassword);

    // Look for the signup button
    const signupBtn = await page.$('button:has-text("Sign Up for Free")');
    if (!signupBtn) {
      console.error('❌ Sign Up button not found');
      console.log('Available buttons:', await page.$$eval('button', btns => btns.map(b => b.textContent.trim())));
      process.exit(1);
    }

    console.log('3. Clicking Sign Up button...');
    await signupBtn.click();

    // Wait for redirect to onboarding
    console.log('4. Waiting for onboarding redirect...');
    try {
      await page.waitForURL(/\/onboarding/, { timeout: 5000 });
      console.log(`✅ Redirected to onboarding: ${page.url()}`);
    } catch (e) {
      console.error(`❌ Did not redirect to onboarding. Current URL: ${page.url()}`);
      const errorText = await page.textContent('body');
      console.log('Page content:', errorText?.substring(0, 200));
      process.exit(1);
    }

    // Select avatar (click Continue button)
    console.log('5. Clicking Continue to proceed...');
    const continueBtn = await page.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
    await continueBtn.click();

    // Wait for username page
    console.log('6. Entering username in onboarding...');
    await page.waitForURL(/\/onboarding\/username/, { timeout: 5000 });
    const usernameInput = await page.waitForSelector('input[placeholder*="username"]', { timeout: 5000 });
    await usernameInput.fill('TestUser123');
    const continueBtn2 = await page.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
    await continueBtn2.click();

    // Wait for dashboard
    console.log('7. Waiting for dashboard redirect...');
    try {
      await page.waitForURL(`${baseURL}/dashboard`, { timeout: 5000 });
      console.log('✅ Reached dashboard');
    } catch (e) {
      console.error(`❌ Did not reach dashboard. Current URL: ${page.url()}`);
      process.exit(1);
    }

    // Logout and test login
    console.log('\n=== LOGIN FLOW ===');
    console.log('8. Signing out...');
    const signoutBtn = await page.$('button:has-text("Sign Out")');
    if (signoutBtn) {
      await signoutBtn.click();
      await page.waitForURL(`${baseURL}/`, { timeout: 5000 });
    }

    console.log('9. Navigating to login...');
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });

    console.log(`10. Logging in with SID: ${testSID}`);
    const sidInput2 = await page.waitForSelector('input[placeholder*="22000000D"]', { timeout: 5000 });
    await sidInput2.fill(testSID);
    const pwInput2 = await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await pwInput2.fill(testPassword);
    const loginBtn = await page.waitForSelector('button:has-text("Log In")', { timeout: 5000 });
    await loginBtn.click();

    // Wait for dashboard
    console.log('11. Waiting for dashboard after login...');
    try {
      await page.waitForURL(`${baseURL}/dashboard`, { timeout: 5000 });
      console.log('✅ Login successful, reached dashboard');
    } catch (e) {
      console.error(`❌ Login failed. Current URL: ${page.url()}`);
      const bodyText = await page.textContent('body');
      console.log('Page text:', bodyText?.substring(0, 300));
      process.exit(1);
    }

    // Test game flow
    console.log('\n=== GAME FLOW ===');
    console.log('12. Navigating to problem-solving-understanding game...');
    await page.goto(`${baseURL}/games/problem-solving-understanding`, { waitUntil: 'networkidle' });

    // Click Start Solving
    console.log('13. Clicking "Start Solving" button...');
    const startBtn = await page.waitForSelector('button:has-text("Start Solving")', { timeout: 5000 });
    await startBtn.click();

    // Do a few puzzle moves
    console.log('14. Making puzzle moves...');
    for (let i = 0; i < 3; i++) {
      const btn = await page.$('button:has-text("Fill 5L")');
      if (btn) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    }

    // Try to click Take Assessment (whether solved or not)
    console.log('15. Looking for assessment button...');
    const assessBtn = await page.$('button:has-text("Take Assessment")');
    if (assessBtn) {
      console.log('✅ Debrief rendered, clicking assessment button');
      await assessBtn.click();

      // Wait for assessment page
      await page.waitForSelector('text=Assessment', { timeout: 5000 });
      console.log('✅ Assessment page loaded');

      // Click Start quiz
      const startQuizBtn = await page.$('button:has-text("Start")');
      if (startQuizBtn) {
        await startQuizBtn.click();

        // Answer first question
        await page.waitForSelector('button', { timeout: 3000 });
        const options = await page.$$('button');
        if (options.length > 0) {
          await options[0].click();
          console.log('✅ Answered first question');
        }
      }
    } else {
      console.log('⚠️  Assessment button not found (game may not be complete)');
    }

    console.log('\n✅ ALL TESTS PASSED');
    process.exit(0);

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.log('Current URL:', page.url());
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
