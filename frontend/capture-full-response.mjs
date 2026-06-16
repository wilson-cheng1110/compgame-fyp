import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const baseURL = 'http://localhost:3000';
const screenshotDir = './screenshots-for-jeff';

console.log('═══════════════════════════════════════════════════════════');
console.log('🎬 CAPTURING FULL RAG AI RESPONSE');
console.log('═══════════════════════════════════════════════════════════\n');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Load game
    console.log('📖 Loading Miller\'s Law game...');
    await page.goto(`${baseURL}/games/memory-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('   ✅ Game loaded\n');

    // Open widget
    console.log('💬 Opening RAG chat widget...');
    const chatBubble = await page.$('button[class*="fixed"][class*="bottom"][class*="right"]');
    if (!chatBubble) throw new Error('Chat bubble not found');
    
    await chatBubble.click();
    await page.waitForTimeout(800);
    console.log('   ✅ Widget opened\n');

    // Find input
    console.log('⌨️  Finding input field...');
    let inputField = await page.$('input[type="text"]');
    if (!inputField) throw new Error('Input field not found');
    console.log('   ✅ Found\n');

    // Submit question
    console.log('📤 Submitting: "What is Miller\'s Law?"\n');
    await inputField.fill('What is Miller\'s Law?');
    
    let sendBtn = await page.$('button[type="submit"]');
    if (sendBtn) {
      await sendBtn.click();
    } else {
      await inputField.press('Enter');
    }

    console.log('⏳ WAITING FOR AI RESPONSE (up to 30 seconds)...\n');
    console.log('Progress:');

    // Wait up to 60 * 500ms = 30 seconds
    let responseFound = false;
    let responseContent = '';

    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(500);
      
      // Extract current content
      const allText = await page.evaluate(() => document.body.innerText);
      
      // Check if we have a response (more than just "Thinking...")
      if (allText.includes('George Miller') || 
          allText.includes('chunk') || 
          allText.includes('memory') ||
          allText.includes('seven') ||
          allText.includes('information')) {
        
        if (!responseFound) {
          responseFound = true;
          console.log(`\n   ✅ RESPONSE DETECTED AT ${(i * 0.5).toFixed(1)}s\n`);
        }
      }

      // Print progress every 5 seconds
      if (i % 10 === 0 && i > 0) {
        console.log(`   ⏳ ${(i * 0.5).toFixed(1)}s elapsed...`);
      }

      // Take screenshots at key moments
      if (i === 10) {
        console.log('   📸 Snapshot at 5 seconds...');
        let ssPath = path.join(screenshotDir, 'FINAL-01-At-5sec.png');
        await page.screenshot({ path: ssPath, fullPage: true });
      }

      if (i === 20) {
        console.log('   📸 Snapshot at 10 seconds...');
        let ssPath = path.join(screenshotDir, 'FINAL-02-At-10sec.png');
        await page.screenshot({ path: ssPath, fullPage: true });
      }

      if (i === 40) {
        console.log('   📸 Snapshot at 20 seconds...');
        let ssPath = path.join(screenshotDir, 'FINAL-03-At-20sec.png');
        await page.screenshot({ path: ssPath, fullPage: true });
      }

      // If we have good response, we can finish early
      if (responseFound && i > 20) {
        const msgCount = await page.evaluate(() => {
          return document.querySelectorAll('[class*="message"]').length;
        });
        
        if (msgCount > 2) {
          console.log(`   ✨ Response appears complete (${msgCount} messages)\n`);
          break;
        }
      }
    }

    // FINAL screenshot
    console.log('📸 CAPTURING FINAL RESPONSE...');
    await page.waitForTimeout(2000);
    let finalPath = path.join(screenshotDir, 'FINAL-04-COMPLETE-RESPONSE.png');
    await page.screenshot({ path: finalPath, fullPage: true });
    console.log('   ✅ Saved: FINAL-04-COMPLETE-RESPONSE.png\n');

    // Extract response text
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 EXTRACTED RESPONSE TEXT:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const pageText = await page.evaluate(() => {
      const messages = document.querySelectorAll('[class*="message"], [class*="text"]');
      let text = '';
      messages.forEach(msg => {
        const content = msg.textContent?.trim();
        if (content && content.length > 20) {
          text += content + '\n\n';
        }
      });
      return text;
    });

    if (pageText.length > 100) {
      console.log(pageText.substring(0, 1000));
      if (pageText.length > 1000) console.log('\n[... response continues ...]');
    } else {
      console.log('(Response text extraction incomplete, see screenshot)');
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 CAPTURE COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('✅ Screenshots saved:');
    console.log('   • FINAL-01-At-5sec.png');
    console.log('   • FINAL-02-At-10sec.png');
    console.log('   • FINAL-03-At-20sec.png');
    console.log('   • FINAL-04-COMPLETE-RESPONSE.png ⭐\n');

    console.log('📁 Location: ./screenshots-for-jeff/\n');

    process.exit(0);

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    const errPath = path.join(screenshotDir, 'FINAL-ERROR.png');
    await page.screenshot({ path: errPath, fullPage: true });
    console.log(`Error screenshot: ${errPath}\n`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
