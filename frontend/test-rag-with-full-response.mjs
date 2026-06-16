import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const baseURL = 'http://localhost:3000';
const screenshotDir = './screenshots-for-jeff';

console.log('🎯 RAG Test with Full Response Capture\n');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Load game
    console.log('Loading game...');
    await page.goto(`${baseURL}/games/memory-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click chat bubble
    console.log('Opening chat widget...');
    const chatBubble = await page.$('button[class*="fixed"][class*="bottom"][class*="right"]');
    if (chatBubble) await chatBubble.click();
    await page.waitForTimeout(800);

    // Find input
    let inputField = await page.$('input[type="text"]');
    if (!inputField) throw new Error('No input field');

    // Type and submit
    console.log('Submitting question...');
    await inputField.fill('What is Miller\'s Law?');
    
    let sendBtn = await page.$('button[type="submit"]');
    if (sendBtn) {
      await sendBtn.click();
    } else {
      await inputField.press('Enter');
    }

    // WAIT MUCH LONGER for response
    console.log('\n⏳ Waiting 25 seconds for complete response...\n');
    
    for (let i = 0; i < 50; i++) {
      await page.waitForTimeout(500);
      process.stdout.write('.');
      
      if (i === 25) {
        console.log('\n📸 Checkpoint 1 (12.5 seconds)');
        let ssPath = path.join(screenshotDir, 'RESPONSE-01-12sec.png');
        await page.screenshot({ path: ssPath, fullPage: true });
      }
      
      if (i === 40) {
        console.log('📸 Checkpoint 2 (20 seconds)');
        let ssPath = path.join(screenshotDir, 'RESPONSE-02-20sec.png');
        await page.screenshot({ path: ssPath, fullPage: true });
      }
    }

    console.log('\n\n✅ Done');
    
    // Final screenshot
    console.log('📸 Capturing final response...');
    let finalPath = path.join(screenshotDir, 'RESPONSE-03-FINAL.png');
    await page.screenshot({ path: finalPath, fullPage: true });
    
    console.log('✅ Saved: RESPONSE-03-FINAL.png\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
