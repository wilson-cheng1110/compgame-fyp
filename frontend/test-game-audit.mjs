import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const baseURL = 'http://localhost:3005';
const screenshotDir = './audit-screenshots';

const GAMES = [
  { id: 'fitts-law-assessment', name: 'Fitts (A)', type: 'assessment' },
  { id: 'hicks-law-assessment', name: 'Hicks (A)', type: 'assessment' },
  { id: 'memory-assessment', name: "Miller (A)", type: 'assessment' },
  { id: 'gestalt-assessment', name: 'Gestalt (A)', type: 'assessment' },
  { id: 'stroop-assessment', name: 'Stroop (A)', type: 'assessment' },
  { id: 'webers-law-assessment', name: "Weber (A)", type: 'assessment' },
  { id: 'norman-assessment', name: 'Norman (A)', type: 'assessment' },
  { id: 'mental-model-assessment', name: 'Mental Model (A)', type: 'assessment' },
];

const issues = {
  navigation: [],
  stateManagement: [],
  scoring: [],
  ui: [],
  hci: [],
};

(async () => {
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('\n🔍 QUICK AUDIT - Assessment games\n');

    // Test each assessment game
    for (const game of GAMES) {
      console.log(`📌 ${game.name}...`);

      try {
        await page.goto(`${baseURL}/games/${game.id}`, { timeout: 10000, waitUntil: 'domcontentloaded' });

        // Check 1: Navigation works
        const onPage = page.url().includes(game.id);
        if (!onPage) {
          issues.navigation.push(`${game.name}: Can't load page`);
          console.log(`  ❌ Page load failed`);
          continue;
        }

        // Check 2: Start button visible
        const startBtn = await page.locator('button:has-text("Start")').first();
        if (await startBtn.count() === 0) {
          issues.navigation.push(`${game.name}: No Start button`);
          console.log(`  ❌ No Start button`);
          continue;
        }

        await startBtn.click();
        await page.waitForTimeout(800);

        // Check 3: Quiz question visible
        const content = await page.locator('body').textContent();
        const hasQuestion = content.includes('?') || content.toLowerCase().includes('which') || content.toLowerCase().includes('what');
        if (!hasQuestion) {
          issues.hci.push(`${game.name}: No quiz question visible`);
          console.log(`  ❌ Quiz question missing`);
          continue;
        }

        // Check 4: Answer options exist
        const options = await page.locator('button[class*="option"], button[class*="bg-"], [role="button"]');
        const optCount = await options.count();
        if (optCount < 2) {
          issues.hci.push(`${game.name}: No answer options (${optCount} found)`);
          console.log(`  ❌ No answer options`);
          continue;
        }

        // Check 5: Select first option and check if it registers
        const firstOpt = options.first();
        await firstOpt.click();
        await page.waitForTimeout(500);

        const nextBtn = await page.locator('button:has-text("Next"), button:has-text("Submit")').first();
        if (await nextBtn.count() === 0) {
          issues.ui.push(`${game.name}: No Next button after selecting answer`);
          console.log(`  ⚠️  No Next button`);
        } else {
          console.log(`  ✅ Quiz flow works`);
        }

        // Check 6: Can complete
        if (await nextBtn.count() > 0) {
          await nextBtn.click();
          await page.waitForTimeout(800);

          const completionText = await page.locator('body').textContent();
          const hasBadge = completionText.includes('Badge') || completionText.includes('score') || completionText.includes('completed');
          
          if (!hasBadge) {
            issues.scoring.push(`${game.name}: No completion/badge shown`);
            console.log(`  ❌ No score/badge`);
          } else {
            console.log(`  ✅ Completion detected`);
          }
        }

      } catch (e) {
        issues.navigation.push(`${game.name}: ${e.message.substring(0, 50)}`);
        console.log(`  ❌ Error: ${e.message.substring(0, 40)}`);
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 ISSUES FOUND');
    console.log('═══════════════════════════════════════════════════════════\n');

    Object.entries(issues).forEach(([category, items]) => {
      if (items.length > 0) {
        console.log(`${category.toUpperCase()} (${items.length}):`);
        items.forEach(item => console.log(`  - ${item}`));
        console.log();
      }
    });

    const report = {
      timestamp: new Date().toISOString(),
      issuesSummary: Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.length])),
      details: issues,
    };
    fs.writeFileSync(path.join(screenshotDir, 'ISSUES.json'), JSON.stringify(report, null, 2));

  } catch (err) {
    console.error('❌ AUDIT ERROR:', err.message);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
