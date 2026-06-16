import { chromium } from '@playwright/test';

const baseURL = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Go straight to a game
    console.log('Going to visual-perception-understanding (simpler than puzzle game)...');
    await page.goto(`${baseURL}/games/visual-perception-understanding`);

    // Click Start
    let btn = await page.waitForSelector('button:has-text("Explore the demos")', { timeout: 5000 });
    await btn.click();

    // We're now in demos phase, skip to debrief
    console.log('Skipping to debrief...');
    btn = await page.waitForSelector('button:has-text("Take Assessment")', { timeout: 5000 });
    await btn.click();

    // Check if debrief rendered
    console.log('Checking for debrief content...');
    const debriefText = await page.textContent('text=Understanding Complete');
    if (debriefText) {
      console.log('✅ GameDebrief rendered');
      
      // Check for topic-specific content
      const topicText = await page.textContent('text=Visual Perception');
      if (topicText) {
        console.log('✅ Topic title found in debrief');
      }
    } else {
      console.log('❌ GameDebrief did not render');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
