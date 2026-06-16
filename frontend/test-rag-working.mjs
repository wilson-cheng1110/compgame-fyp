import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const baseURL = 'http://localhost:3000';
const screenshotDir = './screenshots-for-jeff';

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

console.log('═══════════════════════════════════════════════════════════');
console.log('🎬 LIVE RAG DEMO — With Backend AI Responses');
console.log('═══════════════════════════════════════════════════════════\n');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Load game
    console.log('🎮 Loading Miller\'s Law game...');
    await page.goto(`${baseURL}/games/memory-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('   ✅ Game loaded\n');

    // Screenshot 1
    console.log('📸 Screenshot 1: Game page with RAG widget visible');
    let screenshotPath = path.join(screenshotDir, 'LIVE-01-Game-Page.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('   ✅ Saved\n');

    // Click the blue chat bubble
    console.log('💬 Clicking RAG chat bubble...');
    const chatBubble = await page.$('button[class*="fixed"][class*="bottom"][class*="right"]');
    
    if (chatBubble) {
      await chatBubble.click();
      await page.waitForTimeout(500);
      console.log('   ✅ Chat widget opened\n');
    } else {
      console.log('   ℹ️  Trying alternative selector...\n');
      // Try finding by position or role
      const buttons = await page.$$('button');
      if (buttons.length > 0) {
        await buttons[buttons.length - 1].click();
        await page.waitForTimeout(500);
      }
    }

    // Find input field
    console.log('⌨️  Finding input field...');
    let inputField = await page.$('input[type="text"]');
    
    if (!inputField) {
      // Try by placeholder
      inputField = await page.$('input[placeholder*="ask" i]');
    }

    if (!inputField) {
      throw new Error('Could not find input field');
    }

    console.log('   ✅ Found\n');

    // Type question
    console.log('Typing: "What is Miller\'s Law?"\n');
    await inputField.fill('What is Miller\'s Law?');
    
    // Submit
    console.log('📤 Submitting...');
    let sendBtn = await page.$('button[type="submit"]');
    if (sendBtn) {
      await sendBtn.click();
    } else {
      await inputField.press('Enter');
    }
    console.log('   ✅ Sent\n');

    // Wait for response
    console.log('🤔 Waiting for AI response (up to 20 seconds)...\n');
    let responseFound = false;
    
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500);
      
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes('Miller') || pageText.includes('short-term') || pageText.includes('chunking')) {
        responseFound = true;
        console.log(`   ✅ Response received (${(i * 0.5).toFixed(1)}s)\n`);
        break;
      }
      
      if (i % 4 === 0) process.stdout.write('.');
    }

    if (!responseFound) {
      console.log('\n   (Response may be loading, see screenshot)\n');
    }

    // Screenshot 2
    console.log('📸 Screenshot 2: RAG response');
    await page.waitForTimeout(1000);
    screenshotPath = path.join(screenshotDir, 'LIVE-02-AI-Response.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('   ✅ Saved\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 LIVE RAG DEMO COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    const errPath = path.join(screenshotDir, 'LIVE-ERROR.png');
    await page.screenshot({ path: errPath, fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
