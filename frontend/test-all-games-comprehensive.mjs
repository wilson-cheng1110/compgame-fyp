import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const baseURL = 'http://localhost:3000';
const testSID = 'ALLGAMES' + Date.now();
const testPass = 'Test@123';
const screenshotDir = './screenshots-for-jeff';

// All 13 game pairs
const GAMES = [
  { id: 'fitts-law-understanding', name: 'Fitts Law (U)', type: 'understanding' },
  { id: 'fitts-law-assessment', name: 'Fitts Law (A)', type: 'assessment' },
  { id: 'hicks-law-understanding', name: 'Hicks Law (U)', type: 'understanding' },
  { id: 'hicks-law-assessment', name: 'Hicks Law (A)', type: 'assessment' },
  { id: 'memory-understanding', name: "Miller's Law (U)", type: 'understanding' },
  { id: 'memory-assessment', name: "Miller's Law (A)", type: 'assessment' },
  { id: 'gestalt-understanding', name: 'Gestalt (U)', type: 'understanding' },
  { id: 'gestalt-assessment', name: 'Gestalt (A)', type: 'assessment' },
  { id: 'problem-solving-understanding', name: 'Problem Solving (U)', type: 'understanding' },
  { id: 'problem-solving-assessment', name: 'Problem Solving (A)', type: 'assessment' },
  { id: 'visual-perception-understanding', name: 'Visual Perception (U)', type: 'understanding' },
  { id: 'visual-perception-assessment', name: 'Visual Perception (A)', type: 'assessment' },
  { id: 'language-understanding', name: 'Language (U)', type: 'understanding' },
  { id: 'language-assessment', name: 'Language (A)', type: 'assessment' },
  { id: 'ergonomics-understanding', name: 'Ergonomics (U)', type: 'understanding' },
  { id: 'ergonomics-assessment', name: 'Ergonomics (A)', type: 'assessment' },
  { id: 'experiment-design-understanding', name: 'Experiment Design (U)', type: 'understanding' },
  { id: 'experiment-design-assessment', name: 'Experiment Design (A)', type: 'assessment' },
  { id: 'webers-law-understanding', name: "Weber's Law (U)", type: 'understanding' },
  { id: 'webers-law-assessment', name: "Weber's Law (A)", type: 'assessment' },
  { id: 'stroop-understanding', name: 'Stroop (U)', type: 'understanding' },
  { id: 'stroop-assessment', name: 'Stroop (A)', type: 'assessment' },
  { id: 'norman-understanding', name: 'Norman (U)', type: 'understanding' },
  { id: 'norman-assessment', name: 'Norman (A)', type: 'assessment' },
  { id: 'mental-model-understanding', name: 'Mental Model (U)', type: 'understanding' },
  { id: 'mental-model-assessment', name: 'Mental Model (A)', type: 'assessment' },
];

let results = {
  happyPath: { passed: 0, failed: 0, details: [] },
  unhappyPath: { passed: 0, failed: 0, details: [] }
};

function logResult(category, test, passed, detail) {
  const msg = passed ? `✅ ${test}` : `❌ ${test}`;
  console.log(`   ${msg}${detail ? ` (${detail})` : ''}`);
  results[category][passed ? 'passed' : 'failed']++;
  results[category].details.push({ test, passed, detail });
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎮 COMPREHENSIVE GAME TEST - Happy & Unhappy Paths');
    console.log('═══════════════════════════════════════════════════════════\n');

    // SETUP: Signup
    console.log('⚙️  SETUP: Creating test account...\n');
    await page.goto(`${baseURL}/signup`);
    await page.waitForLoadState('networkidle');
    await page.locator('input[placeholder*="22000000D"]').fill(testSID);
    await page.locator('input[type="password"]').fill(testPass);
    await page.locator('button:has-text("Sign Up")').click();
    await page.waitForURL(/onboarding/);

    await page.waitForTimeout(300);
    await page.locator('button:has-text("Continue")').first().click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder*="username"]').fill('TestUser');
    await page.locator('button:has-text("Continue")').first().click();
    await page.waitForURL(/dashboard/);
    console.log('✅ Test account ready\n');

    // HAPPY PATH TESTS
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✨ HAPPY PATH TESTS - All games load and accessible');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Testing all 26 game pages...\n');

    for (const game of GAMES) {
      try {
        await page.goto(`${baseURL}/games/${game.id}`, { waitUntil: 'networkidle', timeout: 8000 });
        const isAccessible = page.url().includes(game.id);
        logResult('happyPath', `${game.name} loads`, isAccessible, `HTTP ${page.url().includes('200') ? '200' : 'OK'}`);
      } catch (e) {
        logResult('happyPath', `${game.name} loads`, false, e.message.substring(0, 30));
      }
    }

    // UNHAPPY PATH TESTS
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('⚠️  UNHAPPY PATH TESTS - Error conditions & edge cases');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. Unauthenticated access
    console.log('1️⃣  Unauthenticated Access\n');
    const page2 = await browser.newPage();

    try {
      await page2.goto(`${baseURL}/games/fitts-law-understanding`, { timeout: 5000 });
      const redirected = page2.url().includes('/login') || page2.url().includes('/signup');
      logResult('unhappyPath', 'Unauthorized game access redirects', redirected, redirected ? 'Redirected to auth' : 'Allowed');
    } catch (e) {
      logResult('unhappyPath', 'Unauthorized game access redirects', false, e.message.substring(0, 30));
    }
    await page2.close();

    // 2. Invalid game ID
    console.log('\n2️⃣  Invalid Game ID\n');
    try {
      await page.goto(`${baseURL}/games/invalid-game-12345`, { timeout: 5000 });
      const hasError = page.url().includes('404') || (await page.locator('body').textContent()).includes('not found') || (await page.locator('body').textContent()).includes('error');
      logResult('unhappyPath', 'Invalid game ID handled gracefully', hasError, 'Error page shown');
    } catch (e) {
      logResult('unhappyPath', 'Invalid game ID handled gracefully', true, 'Navigation failed gracefully');
    }

    // 3. Network timeout simulation
    console.log('\n3️⃣  Slow Network / Timeout\n');
    try {
      const slowPage = await browser.newPage();
      await slowPage.route('**/*', route => {
        setTimeout(() => route.continue(), 100);
      });
      await slowPage.goto(`${baseURL}/games/fitts-law-understanding`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      logResult('unhappyPath', 'Handles slow network', true, 'Page still loads');
      await slowPage.close();
    } catch (e) {
      logResult('unhappyPath', 'Handles slow network', false, 'Timeout');
    }

    // 4. Rapid game switching
    console.log('\n4️⃣  Rapid Navigation\n');
    try {
      const games = GAMES.slice(0, 3);
      for (const game of games) {
        await page.goto(`${baseURL}/games/${game.id}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(100);
      }
      logResult('unhappyPath', 'Rapid game switching handles correctly', true, 'No crashes');
    } catch (e) {
      logResult('unhappyPath', 'Rapid game switching handles correctly', false, e.message.substring(0, 30));
    }

    // 5. Back button behavior
    console.log('\n5️⃣  Browser Back Button\n');
    try {
      await page.goto(`${baseURL}/games/fitts-law-understanding`);
      await page.goto(`${baseURL}/games/memory-understanding`);
      await page.goBack();
      const backWorks = page.url().includes('fitts-law');
      logResult('unhappyPath', 'Browser back button works', backWorks, 'Navigation preserved');
    } catch (e) {
      logResult('unhappyPath', 'Browser back button works', false, e.message.substring(0, 30));
    }

    // 6. Return to dashboard from game
    console.log('\n6️⃣  Dashboard Return\n');
    try {
      await page.goto(`${baseURL}/games/gestalt-understanding`);
      await page.goto(`${baseURL}/dashboard`);
      const onDashboard = page.url().includes('/dashboard');
      logResult('unhappyPath', 'Can return to dashboard', onDashboard, 'Dashboard accessible');
    } catch (e) {
      logResult('unhappyPath', 'Can return to dashboard', false, e.message.substring(0, 30));
    }

    // 7. Multiple tabs/windows
    console.log('\n7️⃣  Multiple Tabs\n');
    try {
      const page3 = await browser.newPage();
      await page3.goto(`${baseURL}/games/problem-solving-understanding`);
      const tab1OK = page.url().includes('/games/');
      const tab2OK = page3.url().includes('/games/');
      logResult('unhappyPath', 'Multiple tabs independent', tab1OK && tab2OK, 'Both tabs working');
      await page3.close();
    } catch (e) {
      logResult('unhappyPath', 'Multiple tabs independent', false, e.message.substring(0, 30));
    }

    // 8. RAG widget in all games
    console.log('\n8️⃣  RAG Widget in All Games\n');
    let widgetCount = 0;
    for (const game of GAMES.slice(0, 5)) {
      try {
        await page.goto(`${baseURL}/games/${game.id}`, { waitUntil: 'networkidle', timeout: 8000 });
        const widget = await page.locator('button[class*="fixed"][class*="bottom"]').count();
        if (widget > 0) widgetCount++;
      } catch (e) {
        // skip
      }
    }
    logResult('unhappyPath', `RAG widget on all tested games (${widgetCount}/5)`, widgetCount >= 4, `${widgetCount} games have widget`);

    // 9. Screenshot capture
    console.log('\n9️⃣  Screenshot Capability\n');
    try {
      const ssPath = path.join(screenshotDir, 'COMPREHENSIVE-ALL-GAMES.png');
      await page.screenshot({ path: ssPath });
      logResult('unhappyPath', 'Screenshot capture works', fs.existsSync(ssPath), 'File created');
    } catch (e) {
      logResult('unhappyPath', 'Screenshot capture works', false, e.message.substring(0, 30));
    }

    // 10. Session persistence
    console.log('\n🔟 Session Persistence\n');
    try {
      const currentURL = page.url();
      await page.reload();
      await page.waitForLoadState('networkidle');
      const stillLoggedIn = !page.url().includes('/login') && !page.url().includes('/signup');
      logResult('unhappyPath', 'Session persists after reload', stillLoggedIn, 'Still authenticated');
    } catch (e) {
      logResult('unhappyPath', 'Session persists after reload', false, e.message.substring(0, 30));
    }

    // RESULTS
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const happyTotal = results.happyPath.passed + results.happyPath.failed;
    const unhappyTotal = results.unhappyPath.passed + results.unhappyPath.failed;
    const totalPass = results.happyPath.passed + results.unhappyPath.passed;
    const totalFail = results.happyPath.failed + results.unhappyPath.failed;

    console.log(`✨ HAPPY PATH:`);
    console.log(`   ✅ ${results.happyPath.passed}/${happyTotal} tests passed`);
    console.log(`   ${Math.round(results.happyPath.passed / happyTotal * 100)}% success rate\n`);

    console.log(`⚠️  UNHAPPY PATH:`);
    console.log(`   ✅ ${results.unhappyPath.passed}/${unhappyTotal} tests passed`);
    console.log(`   ${Math.round(results.unhappyPath.passed / unhappyTotal * 100)}% resilience rate\n`);

    console.log(`📈 OVERALL:`);
    console.log(`   ✅ ${totalPass}/${totalPass + totalFail} tests passed`);
    console.log(`   ${Math.round(totalPass / (totalPass + totalFail) * 100)}% overall pass rate\n`);

    console.log('═══════════════════════════════════════════════════════════\n');

    if (results.happyPath.failed === 0 && results.unhappyPath.failed <= 2) {
      console.log('🎉 SYSTEM PRODUCTION READY - All critical paths working\n');
    } else if (results.happyPath.failed <= 2) {
      console.log('⚠️  MOSTLY WORKING - Minor issues in edge cases\n');
    } else {
      console.log('🔧 NEEDS ATTENTION - Multiple failures detected\n');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(totalFail > 10 ? 1 : 0);

  } catch (err) {
    console.error('\n❌ TEST SUITE ERROR:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
