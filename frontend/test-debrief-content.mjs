import { chromium } from '@playwright/test';

const baseURL = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${baseURL}/games/visual-perception-understanding`);
    let btn = await page.waitForSelector('button:has-text("Explore the demos")', { timeout: 5000 });
    await btn.click();

    btn = await page.waitForSelector('button:has-text("Take Assessment")', { timeout: 5000 });
    await btn.click();

    // Get the full debrief section HTML
    await page.waitForSelector('text=Understanding Complete', { timeout: 5000 });
    const debriefHTML = await page.innerHTML('body');
    
    // Check for key debrief elements
    const hasTitle = debriefHTML.includes('Understanding Complete');
    const hasTopic = debriefHTML.includes('Visual Perception') || debriefHTML.includes('visual-perception');
    const hasPrinciple = debriefHTML.includes('principle') || debriefHTML.includes('Perception');
    const hasExamTip = debriefHTML.includes('exam') || debriefHTML.includes('Exam');

    console.log('Debrief content checks:');
    console.log(`  Has "Understanding Complete": ${hasTitle}`);
    console.log(`  Has "Visual Perception": ${hasTopic}`);
    console.log(`  Has principle/perception text: ${hasPrinciple}`);
    console.log(`  Has exam content: ${hasExamTip}`);

    // Extract a snippet of the debrief content
    const debriefStart = debriefHTML.indexOf('Understanding Complete');
    if (debriefStart > -1) {
      const snippet = debriefHTML.substring(debriefStart, debriefStart + 500);
      console.log(`\nDebrief snippet:\n${snippet.replace(/<[^>]*>/g, '').substring(0, 200)}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
