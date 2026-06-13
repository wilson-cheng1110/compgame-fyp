import { chromium } from '@playwright/test';

const baseURL = 'http://localhost:3000';
const testSID = 'BADGE' + Date.now();
const testPassword = 'BadgeTest123';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleLogs = [];

  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  try {

    console.log('=== SETUP: Signup & Onboarding ===');
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    const sidInput = await page.waitForSelector('input[placeholder*="22000000D"]');
    await sidInput.fill(testSID);
    const pwInput = await page.waitForSelector('input[type="password"]');
    await pwInput.fill(testPassword);
    let btn = await page.$('button:has-text("Sign Up for Free")');
    await btn.click();

    await page.waitForURL(/\/onboarding\/avatar/);
    const continueBtn = await page.waitForSelector('button:has-text("Continue")');
    await continueBtn.click();

    await page.waitForURL(/\/onboarding\/username/);
    const usernameInput = await page.waitForSelector('input[placeholder*="username"]');
    await usernameInput.fill('BadgeTester');
    const continueBtn2 = await page.waitForSelector('button:has-text("Continue")');
    await continueBtn2.click();

    await page.waitForURL(`${baseURL}/dashboard`);
    console.log('✅ User created and onboarded');

    console.log('\n=== STEP 1: Play Understanding Game ===');
    // Go to visual-perception-understanding (simpler than puzzle)
    await page.goto(`${baseURL}/games/visual-perception-understanding`);
    let startBtn = await page.waitForSelector('button:has-text("Explore the demos")', { timeout: 5000 });
    await startBtn.click();
    console.log('✅ Understanding game started');

    console.log('\n=== STEP 2: Complete Understanding & Go to Assessment ===');
    const assessBtn = await page.$('button:has-text("Take the Assessment")');
    if (assessBtn) {
      await assessBtn.click();
      await page.waitForURL(/\/games\/visual-perception-assessment/, { timeout: 5000 });
    } else {
      console.log('⚠️ Assessment button not found, navigating directly');
      await page.goto(`${baseURL}/games/visual-perception-assessment`);
    }
    console.log('✅ Navigated to assessment');

    console.log('\n=== STEP 3: Complete Assessment Quiz ===');
    startBtn = await page.waitForSelector('button:has-text("Start")', { timeout: 5000 });
    await startBtn.click();

    // Answer all 6 questions
    for (let i = 0; i < 6; i++) {
      const options = await page.$$('button[class*="bg-white"]');
      if (options.length > 0) {
        await options[Math.floor(Math.random() * options.length)].click();
        await page.waitForTimeout(200);

        // Handle both "Next" and "See Results →" buttons
        let btn = await page.$('button:has-text("Next")');
        if (!btn) btn = await page.$('button:has-text("See Results")');
        if (btn) {
          await btn.click();
          await page.waitForTimeout(500);
        }
      }
    }
    console.log('✅ Assessment completed');
    await page.waitForTimeout(1000); // Wait for render

    const pageText = await page.textContent('body');
    console.log('Page text after assessment:', pageText.substring(0, 200));

    console.log('\n=== STEP 4: Check Badge in Cookie (Before Reload) ===');
    let cookies = await page.context().cookies();
    let usersCookie = cookies.find(c => c.name === 'users');
    if (usersCookie) {
      try {
        const decodedValue = decodeURIComponent(usersCookie.value);
        const users = JSON.parse(decodedValue);
        const userData = users[testSID];
        console.log(`Users cookie exists: ✅`);
        console.log(`User badges: ${userData?.badges?.length || 0} badges`);
        if (userData?.badges && userData.badges.length > 0) {
          console.log(`First badge: ${userData.badges[0].name || userData.badges[0]}`);
          console.log('✅ Badge saved to users cookie');
        } else {
          console.log('❌ NO BADGE FOUND in users cookie after assessment');
        }
      } catch (e) {
        console.log(`❌ Failed to parse users cookie: ${e.message}`);
      }
    } else {
      console.log('❌ Users cookie not found');
    }

    console.log('\n=== STEP 5: Reload Page & Check Badge Persistence ===');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForURL(`${baseURL}/games/visual-perception-assessment`);

    cookies = await page.context().cookies();
    usersCookie = cookies.find(c => c.name === 'users');
    if (usersCookie) {
      try {
        const decodedValue = decodeURIComponent(usersCookie.value);
        const users = JSON.parse(decodedValue);
        const userData = users[testSID];
        if (userData?.badges && userData.badges.length > 0) {
          console.log('✅ Badge persisted after page reload');
        } else {
          console.log('❌ Badge lost after page reload');
        }
      } catch (e) {
        console.log(`❌ Failed to parse after reload: ${e.message}`);
      }
    }

    console.log('\n=== STEP 6: Navigate to Dashboard & Check Badge Display ===');
    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'networkidle' });

    const dashboardContent = await page.textContent('body');
    if (dashboardContent.includes('★') || dashboardContent.includes('Badge')) {
      console.log('✅ Badge visible on dashboard');
    } else {
      console.log('⚠️ Badge stars/badge label not found on dashboard');
    }

    console.log('\n=== STEP 7: Logout & Login, Check Badge Still There ===');
    const signoutBtn = await page.$('button:has-text("Sign Out")');
    if (signoutBtn) await signoutBtn.click();
    await page.waitForURL(`${baseURL}/`);
    console.log('✅ Logged out');

    // Login
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
    const sidLogin = await page.waitForSelector('input[placeholder*="22000000D"]');
    await sidLogin.fill(testSID);
    const pwLogin = await page.waitForSelector('input[type="password"]');
    await pwLogin.fill(testPassword);
    const loginBtn = await page.$('button:has-text("Log In")');
    await loginBtn.click();

    await page.waitForURL(`${baseURL}/dashboard`, { timeout: 5000 });
    console.log('✅ Logged back in');

    // Check badge on dashboard after re-login
    cookies = await page.context().cookies();
    usersCookie = cookies.find(c => c.name === 'users');
    if (usersCookie) {
      try {
        const decodedValue = decodeURIComponent(usersCookie.value);
        const users = JSON.parse(decodedValue);
        const userData = users[testSID];
        if (userData?.badges && userData.badges.length > 0) {
          console.log('✅ Badge persisted through logout/login');
          console.log(`Final badge count: ${userData.badges.length}`);
        } else {
          console.log('❌ Badge lost after logout/login');
        }
      } catch (e) {
        console.log(`❌ Failed to parse final cookie: ${e.message}`);
      }
    }

    console.log('\n=== CONSOLE LOGS ===');
    consoleLogs.forEach(log => console.log(log));

    console.log('\n✅ BADGE PERSISTENCE TEST COMPLETE');
    process.exit(0);

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.log('Current URL:', page.url());
    console.log('\n=== CONSOLE LOGS AT FAILURE ===');
    consoleLogs.forEach(log => console.log(log));
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
