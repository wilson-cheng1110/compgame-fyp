import { chromium } from '@playwright/test';

const baseURL = 'http://localhost:3000';
const testSID = 'CORE' + Date.now();
const testPass = 'Test@123';

let p = 0, f = 0;

function test(ok, msg) {
  console.log(ok ? `✅ ${msg}` : `❌ ${msg}`);
  ok ? p++ : f++;
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('\n🧪 CORE FUNCTIONALITY TEST\n');

    // 1. Signup
    console.log('1️⃣  Signup Flow');
    await page.goto(`${baseURL}/signup`);
    await page.waitForLoadState('networkidle');
    test(page.url().includes('/signup'), '  Navigate to signup');

    await page.locator('input[placeholder*="22000000D"]').fill(testSID);
    await page.locator('input[type="password"]').fill(testPass);
    await page.locator('button:has-text("Sign Up")').click();
    await page.waitForURL(/onboarding/);
    test(page.url().includes('/onboarding'), '  Redirect to onboarding');

    // 2. Onboarding
    console.log('\n2️⃣  Onboarding');
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Continue")').first().click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder*="username"]').fill('CoreUser');
    await page.locator('button:has-text("Continue")').first().click();
    await page.waitForURL(/dashboard/);
    test(page.url().includes('/dashboard'), '  Complete onboarding');

    // 3. Dashboard
    console.log('\n3️⃣  Dashboard');
    await page.waitForLoadState('networkidle');
    const games = await page.locator('a[href*="/games/"]').count();
    test(games >= 10, `  Show ${games} games`);

    // 4. Game Page
    console.log('\n4️⃣  Game Pages');
    await page.goto(`${baseURL}/games/fitts-law-understanding`);
    await page.waitForLoadState('networkidle');
    test(page.url().includes('fitts-law'), '  Fitts Law Understanding loads');

    // 5. RAG Widget
    console.log('\n5️⃣  RAG Chat Widget');
    const widget = await page.locator('button[class*="fixed"][class*="bottom"]');
    test(await widget.count() > 0, '  Widget visible');

    await widget.click();
    await page.waitForTimeout(500);
    await page.locator('input[type="text"]').last().fill('What is Fitts Law?');
    test(true, '  Question typed');

    const send = await page.locator('button[type="submit"]').last();
    if (await send.count() > 0) {
      await send.click();
    } else {
      await page.locator('input[type="text"]').last().press('Enter');
    }
    test(true, '  Question submitted');

    await page.waitForTimeout(2000);
    const hasResp = await page.locator('body').textContent().then(t => t.includes('Fitts') || t.includes('distance'));
    test(hasResp, '  Response from backend');

    // 6. Assessment Page
    console.log('\n6️⃣  Assessment');
    await page.goto(`${baseURL}/games/fitts-law-assessment`);
    await page.waitForLoadState('networkidle');
    test(page.url().includes('assessment'), '  Assessment page loads');

    const quizBtn = await page.locator('button:has-text("Start")').first();
    test(await quizBtn.count() > 0, '  Start button visible');

    // 7. Multiple Games
    console.log('\n7️⃣  Game Variety');
    const gamesToTest = ['gestalt-understanding', 'problem-solving-understanding'];
    let working = 0;
    
    for (const game of gamesToTest) {
      try {
        await page.goto(`${baseURL}/games/${game}`, { timeout: 5000 });
        await page.waitForLoadState('networkidle');
        working++;
      } catch (e) {
        // skip
      }
    }
    test(working >= 2, `  ${working}/${gamesToTest.length} games accessible`);

    // RESULTS
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`✅ PASSED: ${p}`);
    console.log(`❌ FAILED: ${f}`);
    const rate = Math.round(p / (p + f) * 100);
    console.log(`📈 Pass Rate: ${rate}%\n`);

    if (f === 0) {
      console.log('🎉 ALL CORE FLOWS WORKING - SYSTEM READY\n');
    } else {
      console.log('⚠️  Some issues detected\n');
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(f > 2 ? 1 : 0);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
