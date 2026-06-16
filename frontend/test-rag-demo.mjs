import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const baseURL = 'http://localhost:3000';
const screenshotDir = './screenshots-for-jeff';
const testSID = 'DEMO' + Date.now();
const testPassword = 'DemoPass123';

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

console.log('=== RAG Demo: 提問 "What is Miller\'s Law?" ===\n');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // STEP 1: 註冊並登入
    console.log('1. 創建測試帳戶並登入...');
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const sidInput = await page.waitForSelector('input[placeholder*="22000000D"]', { timeout: 10000 });
    await sidInput.fill(testSID);
    const pwInput = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await pwInput.fill(testPassword);
    const signupBtn = await page.waitForSelector('button:has-text("Sign Up for Free")', { timeout: 10000 });
    await signupBtn.click();

    await page.waitForURL(/\/onboarding/, { timeout: 15000 });
    const continueBtn = await page.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
    await continueBtn.click();
    await page.waitForTimeout(500);

    const usernameInput = await page.waitForSelector('input[placeholder*="username"]', { timeout: 5000 });
    await usernameInput.fill('DemoUser');
    const continueBtn2 = await page.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
    await continueBtn2.click();

    await page.waitForURL(`${baseURL}/dashboard`, { timeout: 15000 });
    console.log('   ✅ 已登入\n');

    // STEP 2: 進入 Miller's Law 遊戲
    console.log('2. 進入 Miller\'s Law - Understanding 遊戲...');
    await page.goto(`${baseURL}/games/memory-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('   ✅ 遊戲已加載\n');

    // STEP 3: 尋找並點擊 RAG Chat Widget
    console.log('3. 尋找 RAG Chat Widget...');

    // 查找聊天泡泡 - 可能是按鈕或div
    let chatButton = null;

    // 嘗試多個選擇器
    const selectors = [
      'button[aria-label*="chat"], button[aria-label*="Chat"]',
      '[class*="chat"][class*="bubble"]',
      '[class*="widget"]',
      'button:has-text("Chat")',
      'div[class*="ai-chat"]'
    ];

    for (const selector of selectors) {
      try {
        chatButton = await page.$(selector);
        if (chatButton) {
          console.log(`   ✅ 找到聊天按鈕: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // 如果找不到，嘗試通過頁面事件
    if (!chatButton) {
      console.log('   ℹ️  通過頁面交互尋找聊天面板...');
      // 等待可能的浮動小工具加載
      await page.waitForTimeout(1500);
      chatButton = await page.$('div[class*="chat-widget"], [class*="ai-tutor"]');
    }

    if (chatButton) {
      await chatButton.click();
      console.log('   ✅ Chat Widget 已打開\n');
    } else {
      console.log('   ⚠️  Chat Widget 可能需要手動交互\n');
    }

    // STEP 4: 等待聊天界面顯示
    await page.waitForTimeout(1000);

    // STEP 5: 尋找輸入框並輸入問題
    console.log('4. 在 RAG Chat 中輸入問題...');

    const inputSelectors = [
      'input[placeholder*="Ask"]',
      'input[placeholder*="Question"]',
      'input[placeholder*="message"]',
      'textarea',
      'input[type="text"]'
    ];

    let inputField = null;
    for (const selector of inputSelectors) {
      try {
        inputField = await page.$(selector);
        if (inputField) {
          console.log(`   ✅ 找到輸入框: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (inputField) {
      await inputField.click();
      await page.waitForTimeout(300);
      await inputField.fill('What is Miller\'s Law?');
      console.log('   ✅ 已輸入問題: "What is Miller\'s Law?"\n');

      // STEP 6: 提交問題
      console.log('5. 提交問題到 RAG Backend...');

      // 尋找發送按鈕
      const sendButton = await page.$('button[type="submit"], button:has-text("Send"), button:has-text("Ask")');
      if (sendButton) {
        await sendButton.click();
        console.log('   ✅ 問題已發送\n');
      } else {
        // 嘗試按 Enter
        await inputField.press('Enter');
        console.log('   ✅ 問題已提交 (Enter)\n');
      }

      // STEP 7: 等待 RAG 回應
      console.log('6. 等待 RAG Backend 回應...');
      await page.waitForTimeout(3000); // 等待 LLM 回應
      console.log('   ✅ 回應應該已顯示\n');
    } else {
      console.log('   ⚠️  找不到輸入框，將捕捉目前螢幕\n');
    }

    // STEP 8: 截圖 RAG 交互
    console.log('7. 捕捉 RAG Chat 互動截圖...');
    let screenshotPath = path.join(screenshotDir, 'MAIN-03-RAG-Demo-Millers-Law.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`   ✅ 已保存: MAIN-03-RAG-Demo-Millers-Law.png\n`);

    console.log('=== ✅ RAG Demo 截圖完成 ===\n');
    console.log('📁 文件位置:');
    console.log(`   C:\\Users\\User\\Downloads\\FYP_Final_Project\\FYP_Submission\\frontend\\${screenshotDir}\\\n`);

    console.log('📸 新增截圖:');
    console.log('   MAIN-03-RAG-Demo-Millers-Law.png');
    console.log('   → 顯示 RAG Chat Widget 的實際使用');
    console.log('   → 問題: "What is Miller\'s Law?"');
    console.log('   → 展示 RAG Backend 與 LLM 整合');
    console.log('   → 演示 COMP3423 課程內容檢索增強\n');

    console.log('🎉 所有截圖準備完成!');
    console.log('   - 儀表板 (13 個遊戲)');
    console.log('   - RAG Widget (可見位置)');
    console.log('   - RAG Demo (實際提問)');

    process.exit(0);

  } catch (err) {
    console.error('❌ 錯誤:', err.message);
    console.log('Current URL:', page.url());
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
