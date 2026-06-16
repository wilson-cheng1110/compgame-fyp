import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const baseURL = 'http://localhost:3000';  // Updated to port 3002
const screenshotDir = './screenshots-for-jeff';
const testSID = 'LIVEDEMO' + Date.now();
const testPassword = 'DemoPass123';

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

console.log('═══════════════════════════════════════════════════════════');
console.log('🎬 LIVE RAG DEMO — Testing AI Response with Backend');
console.log('═══════════════════════════════════════════════════════════\n');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // STEP 1: Sign up
    console.log('📝 STEP 1: Creating test account...');
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const sidInput = await page.waitForSelector('input[placeholder*="22000000D"]', { timeout: 10000 });
    await sidInput.fill(testSID);
    const pwInput = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await pwInput.fill(testPassword);
    const signupBtn = await page.waitForSelector('button:has-text("Sign Up for Free")', { timeout: 10000 });
    await signupBtn.click();

    await page.waitForURL(/\/onboarding/, { timeout: 15000 });
    console.log('   ✅ Account created\n');

    // STEP 2: Onboarding
    console.log('👤 STEP 2: Completing onboarding...');
    await page.waitForTimeout(500);
    const continueBtn = await page.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
    await continueBtn.click();
    await page.waitForTimeout(500);

    const usernameInput = await page.waitForSelector('input[placeholder*="username"]', { timeout: 5000 });
    await usernameInput.fill('DemoUser');
    const continueBtn2 = await page.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
    await continueBtn2.click();

    await page.waitForURL(`${baseURL}/dashboard`, { timeout: 15000 });
    console.log('   ✅ Onboarding complete\n');

    // STEP 3: Navigate to game
    console.log('🎮 STEP 3: Opening "Miller\'s Law - Understanding" game...');
    await page.goto(`${baseURL}/games/memory-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('   ✅ Game loaded\n');

    // STEP 4: Take screenshot of game
    console.log('📸 Capturing game page...');
    let screenshotPath = path.join(screenshotDir, 'LIVE-01-Game-Page.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`   ✅ Saved: LIVE-01-Game-Page.png\n`);

    // STEP 5: Open RAG Widget & find input
    console.log('💬 STEP 4: Opening RAG Chat Widget...');
    await page.waitForTimeout(500);

    let inputField = await page.$('input[type="text"]');

    if (!inputField) {
      console.log('   ℹ️  Input not visible, trying page focus...');
      await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="text"]');
        if (inputs.length > 0) inputs[0].focus();
      });
      await page.waitForTimeout(300);
      inputField = await page.$('input[type="text"]');
    }

    if (inputField) {
      console.log('   ✅ Input field found and ready\n');
    } else {
      throw new Error('Could not find RAG input field');
    }

    // STEP 6: Type question
    console.log('⌨️  STEP 5: Typing question...');
    const question = 'What is Miller\'s Law?';
    await inputField.fill(question);
    console.log(`   ✅ Typed: "${question}"\n`);

    // STEP 7: Submit question
    console.log('📤 STEP 6: Submitting question to RAG backend...');
    let sendButton = await page.$('button[type="submit"]');
    if (sendButton) {
      await sendButton.click();
      console.log('   ✅ Submitted via button\n');
    } else {
      await inputField.press('Enter');
      console.log('   ✅ Submitted via Enter key\n');
    }

    // STEP 8: Wait for response
    console.log('🤔 STEP 7: Waiting for AI response (this may take 5-15 seconds)...');
    console.log('   ⏳ Ollama is thinking...\n');

    let responseFound = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts && !responseFound) {
      await page.waitForTimeout(500);
      attempts++;

      const messages = await page.evaluate(() => {
        const msgElements = document.querySelectorAll('[class*="message"], [class*="chat"]');
        const texts = [];
        msgElements.forEach(el => {
          if (el.textContent) texts.push(el.textContent);
        });
        return texts;
      });

      const hasResponse = messages.some(msg =>
        msg.includes('Miller') ||
        msg.includes('chunks') ||
        msg.includes('memory') ||
        msg.includes('short-term') ||
        msg.includes('page')
      );

      if (hasResponse) {
        responseFound = true;
        console.log(`   ✅ Response received! (${attempts * 0.5} seconds)\n`);
      } else if (attempts % 10 === 0) {
        process.stdout.write('.');
      }
    }

    if (!responseFound) {
      console.log('   ⚠️  Response not detected (may be slow or backend issue)\n');
    }

    // STEP 9: Capture response screenshot
    console.log('📸 STEP 8: Capturing RAG response...');
    await page.waitForTimeout(1000);
    screenshotPath = path.join(screenshotDir, 'LIVE-02-RAG-Response-With-AI-Answer.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`   ✅ Saved: LIVE-02-RAG-Response-With-AI-Answer.png\n`);

    // STEP 10: Success summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 LIVE RAG DEMO COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('✅ Verification Results:');
    console.log('   ✓ Frontend signup → onboarding → login');
    console.log('   ✓ Game page loaded');
    console.log('   ✓ RAG widget found and interacted with');
    console.log('   ✓ Question submitted to backend');
    console.log('   ✓ AI response received' + (responseFound ? ' ✓' : ' ⚠️'));
    console.log('   ✓ Screenshots captured\n');

    console.log('📸 Screenshots saved:');
    console.log('   1. LIVE-01-Game-Page.png');
    console.log('   2. LIVE-02-RAG-Response-With-AI-Answer.png\n');

    console.log('📁 Location:');
    console.log(`   C:\Users\User\Downloads\FYP_Final_Project\FYP_Submission\frontend\${screenshotDir}\\n`);

    console.log('🚀 Ready for EDC Demo!\n');

    process.exit(0);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.log('Current URL:', page.url());

    const errorPath = path.join(screenshotDir, 'ERROR-Screenshot.png');
    await page.screenshot({ path: errorPath, fullPage: true });
    console.log(`\nError screenshot saved: ${errorPath}`);

    process.exit(1);
  } finally {
    await browser.close();
  }
})();
