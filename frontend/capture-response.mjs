import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const baseURL = 'http://localhost:3000';
const screenshotDir = './screenshots-for-jeff';

console.log('═══════════════════════════════════════════════════════════');
console.log('LIVE RAG RESPONSE CAPTURE');
console.log('═══════════════════════════════════════════════════════════\n');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Loading game...');
    await page.goto(`${baseURL}/games/memory-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('Opening RAG widget...');
    const chatBubble = await page.$('button[class*="fixed"][class*="bottom"][class*="right"]');
    if (!chatBubble) throw new Error('Widget not found');
    
    await chatBubble.click();
    await page.waitForTimeout(800);

    console.log('Finding input...');
    let inputField = await page.$('input[type="text"]');
    if (!inputField) throw new Error('Input not found');

    console.log('Submitting question...\n');
    await inputField.fill('What is Miller\'s Law?');
    
    let sendBtn = await page.$('button[type="submit"]');
    if (sendBtn) {
      await sendBtn.click();
    } else {
      await inputField.press('Enter');
    }

    console.log('WAITING FOR AI RESPONSE (up to 30 seconds)...\n');

    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(500);
      if (i % 10 === 0) process.stdout.write('.');
      
      if (i === 14) {
        let ssPath = path.join(screenshotDir, 'RESPONSE-After-7sec.png');
        await page.screenshot({ path: ssPath });
      }
      if (i === 30) {
        let ssPath = path.join(screenshotDir, 'RESPONSE-After-15sec.png');
        await page.screenshot({ path: ssPath });
      }
    }

    console.log('\n\nCapturing FINAL response...');
    let finalPath = path.join(screenshotDir, 'FINAL-RESPONSE-COMPLETE.png');
    await page.screenshot({ path: finalPath, fullPage: true });
    
    console.log('\n✅ Saved: FINAL-RESPONSE-COMPLETE.png\n');
    process.exit(0);

  } catch (err) {
    console.error('\nError:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
