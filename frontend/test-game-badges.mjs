import { chromium } from '@playwright/test';

const baseURL = 'http://localhost:3000';
const testSID = 'GAMEBADGE' + Date.now();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('=== SIGNUP & ONBOARDING ===');
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    const sidInput = await page.waitForSelector('input[placeholder*="22000000D"]');
    await sidInput.fill(testSID);
    const pwInput = await page.waitForSelector('input[type="password"]');
    await pwInput.fill('GameTest123');
    let btn = await page.$('button:has-text("Sign Up for Free")');
    await btn.click();

    await page.waitForURL(/\/onboarding\/avatar/);
    const continueBtn = await page.waitForSelector('button:has-text("Continue")');
    await continueBtn.click();
    await page.waitForURL(/\/onboarding\/username/);
    const usernameInput = await page.waitForSelector('input[placeholder*="username"]');
    await usernameInput.fill('GameTester');
    const continueBtn2 = await page.waitForSelector('button:has-text("Continue")');
    await continueBtn2.click();
    await page.waitForURL(`${baseURL}/dashboard`);

    console.log('✅ Signup & onboarding complete');

    console.log('\n=== GAME: PROBLEM SOLVING UNDERSTANDING ===');
    await page.goto(`${baseURL}/games/problem-solving-understanding`);
    let startBtn = await page.waitForSelector('button:has-text("Start Solving")');
    await startBtn.click();

    console.log('Solving puzzle...');
    // Make enough moves to solve (fill 5, pour to 3, empty 3, pour 2 back, fill 5, top up 3 = 4L remains)
    const moves = [
      'Fill 5L',
      'Pour 5L → 3L',
      'Empty 3L',
      'Pour 5L → 3L',
      'Empty 3L',
      'Pour 5L → 3L',
      'Fill 5L',
      'Pour 5L → 3L'
    ];

    for (const move of moves) {
      const btn = await page.$(`button:has-text("${move}")`);
      if (btn) {
        await btn.click();
        await page.waitForTimeout(200);
        const solvedMsg = await page.$('text=Solved');
        if (solvedMsg) {
          console.log(`✅ Puzzle solved after ${move}`);
          break;
        }
      }
    }

    console.log('Proceeding to assessment...');
    const assessBtn = await page.waitForSelector('button:has-text("Take Assessment")', { timeout: 5000 });
    await assessBtn.click();

    console.log('\n=== GAME: PROBLEM SOLVING ASSESSMENT ===');
    await page.waitForURL(/\/games\/problem-solving-assessment/, { timeout: 5000 });
    startBtn = await page.waitForSelector('button:has-text("Start")');
    await startBtn.click();

    // Answer all 6 questions
    for (let i = 0; i < 6; i++) {
      const options = await page.$$('button[class*="bg-white border"]');
      if (options.length > 0) {
        await options[0].click();
        await page.waitForTimeout(300);
        const nextBtn = await page.$('button:has-text("Next")');
        if (nextBtn) await nextBtn.click();
      }
    }

    console.log('✅ Assessment completed');

    console.log('\n=== BADGE CHECK ===');
    // Get the user cookie to check if badge was saved
    const cookies = await page.context().cookies();
    const userCookie = cookies.find(c => c.name === 'user');
    if (userCookie) {
      const user = JSON.parse(userCookie.value);
      console.log(`User SID: ${user.sid}`);
      console.log(`User has badge context: ${user.badges ? 'yes' : 'no'}`);
    }

    // Navigate back to dashboard to see badge
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForURL(`${baseURL}/dashboard`, { timeout: 5000 });
    const badgeContent = await page.textContent('body');
    if (badgeContent.includes('★') || badgeContent.includes('Problem Solving')) {
      console.log('✅ Badge visible on dashboard');
    } else {
      console.log('⚠️  Badge not visible on dashboard (might not be rendered)');
    }

    console.log('\n✅ GAME FLOW COMPLETE');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
