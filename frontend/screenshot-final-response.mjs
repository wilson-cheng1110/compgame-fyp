import { chromium } from '@playwright/test';
import path from 'path';

const baseURL = 'http://localhost:3000';
const screenshotDir = './screenshots-for-jeff';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto(`${baseURL}/games/memory-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click chat bubble
    const chatBubble = await page.$('button[class*="fixed"][class*="bottom"][class*="right"]');
    if (chatBubble) await chatBubble.click();
    
    await page.waitForTimeout(2000);

    // Take screenshot
    const screenshotPath = path.join(screenshotDir, 'LIVE-03-Final-AI-Response.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    console.log('✅ Final response screenshot captured: LIVE-03-Final-AI-Response.png');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
