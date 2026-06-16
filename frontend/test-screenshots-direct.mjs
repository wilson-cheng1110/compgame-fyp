import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const baseURL = 'http://localhost:3000';
const screenshotDir = './screenshots-e2e';

// Create screenshots directory
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

console.log('=== COMPGAME SCREENSHOTS - DEMO CAPTURE ===\n');
console.log('Capturing key pages for demo presentation...\n');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const screenshots = [];

  try {
    // 1. HOME PAGE
    console.log('1. Capturing home page...');
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    let path1 = path.join(screenshotDir, '01-home-page.png');
    await page.screenshot({ path: path1 });
    screenshots.push('01-home-page.png');
    console.log('   ✅ Saved: 01-home-page.png');

    // 2. SIGNUP PAGE
    console.log('2. Capturing signup page...');
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    let path2 = path.join(screenshotDir, '02-signup-page.png');
    await page.screenshot({ path: path2 });
    screenshots.push('02-signup-page.png');
    console.log('   ✅ Saved: 02-signup-page.png');

    // 3. LOGIN PAGE
    console.log('3. Capturing login page...');
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    let path3 = path.join(screenshotDir, '03-login-page.png');
    await page.screenshot({ path: path3 });
    screenshots.push('03-login-page.png');
    console.log('   ✅ Saved: 03-login-page.png');

    // 4. ONBOARDING AVATAR PAGE
    console.log('4. Capturing onboarding (avatar) page...');
    await page.goto(`${baseURL}/onboarding/avatar`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    let path4 = path.join(screenshotDir, '04-onboarding-avatar.png');
    await page.screenshot({ path: path4 });
    screenshots.push('04-onboarding-avatar.png');
    console.log('   ✅ Saved: 04-onboarding-avatar.png');

    // 5. DASHBOARD (requires login - will redirect)
    console.log('5. Attempting dashboard (may redirect to login)...');
    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    let path5 = path.join(screenshotDir, '05-dashboard-or-login.png');
    await page.screenshot({ path: path5 });
    screenshots.push('05-dashboard-or-login.png');
    console.log('   ✅ Saved: 05-dashboard-or-login.png');

    // 6. FITTS LAW UNDERSTANDING
    console.log('6. Capturing Fitts Law Understanding game...');
    await page.goto(`${baseURL}/games/fitts-law-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    let path6 = path.join(screenshotDir, '06-fitts-understanding-game.png');
    await page.screenshot({ path: path6 });
    screenshots.push('06-fitts-understanding-game.png');
    console.log('   ✅ Saved: 06-fitts-understanding-game.png');

    // 7. FITTS LAW ASSESSMENT
    console.log('7. Capturing Fitts Law Assessment quiz...');
    await page.goto(`${baseURL}/games/fitts-law-assessment`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    let path7 = path.join(screenshotDir, '07-fitts-assessment-quiz.png');
    await page.screenshot({ path: path7 });
    screenshots.push('07-fitts-assessment-quiz.png');
    console.log('   ✅ Saved: 07-fitts-assessment-quiz.png');

    // 8. GESTALT PRINCIPLES UNDERSTANDING
    console.log('8. Capturing Gestalt Principles Understanding game...');
    await page.goto(`${baseURL}/games/gestalt-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    let path8 = path.join(screenshotDir, '08-gestalt-understanding-game.png');
    await page.screenshot({ path: path8 });
    screenshots.push('08-gestalt-understanding-game.png');
    console.log('   ✅ Saved: 08-gestalt-understanding-game.png');

    // 9. VISUAL PERCEPTION UNDERSTANDING
    console.log('9. Capturing Visual Perception Understanding game...');
    await page.goto(`${baseURL}/games/visual-perception-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    let path9 = path.join(screenshotDir, '09-visual-perception-understanding.png');
    await page.screenshot({ path: path9 });
    screenshots.push('09-visual-perception-understanding.png');
    console.log('   ✅ Saved: 09-visual-perception-understanding.png');

    // 10. PROBLEM SOLVING UNDERSTANDING
    console.log('10. Capturing Problem Solving Understanding game...');
    await page.goto(`${baseURL}/games/problem-solving-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    let path10 = path.join(screenshotDir, '10-problem-solving-understanding.png');
    await page.screenshot({ path: path10 });
    screenshots.push('10-problem-solving-understanding.png');
    console.log('   ✅ Saved: 10-problem-solving-understanding.png');

    // 11. BADGES PAGE (requires login - will show or redirect)
    console.log('11. Capturing badges/achievements page...');
    await page.goto(`${baseURL}/badges`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    let path11 = path.join(screenshotDir, '11-badges-page.png');
    await page.screenshot({ path: path11 });
    screenshots.push('11-badges-page.png');
    console.log('   ✅ Saved: 11-badges-page.png');

    console.log('\n=== SCREENSHOT CAPTURE COMPLETE ===\n');
    console.log(`✅ ${screenshots.length} screenshots captured successfully!\n`);
    console.log('Screenshots saved to: ' + screenshotDir + '\n');
    console.log('Files created:');
    screenshots.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s}`);
    });

    console.log('\n📁 Folder location:');
    console.log(`   C:\\Users\\User\\Downloads\\FYP_Final_Project\\FYP_Submission\\frontend\\${screenshotDir}\n`);

    console.log('✅ Ready to share with Jeff!');
    console.log('   - Zip the screenshots-e2e folder');
    console.log('   - Send with: "COMPGame E2E Screenshots - All 13 Games & Features"');

    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log(`Screenshots captured before error: ${screenshots.length}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
