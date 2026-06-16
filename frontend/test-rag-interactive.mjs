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

console.log('=== RAG Interactive Demo: Real Q&A with Backend ===\n');

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

    // STEP 2: 進入遊戲頁面 (顯示 RAG Widget)
    console.log('2. 進入遊戲頁面 (Miller\'s Law / Memory Game)...');
    await page.goto(`${baseURL}/games/memory-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('   ✅ 遊戲已加載\n');

    // STEP 3: 尋找並點擊 Chat Widget 開啟按鈕
    console.log('3. 尋找 RAG Chat Widget 開啟按鈕...');

    // 嘗試多個選擇器找開啟按鈕
    let openButton = null;
    const openButtonSelectors = [
      'button[aria-label*="chat"]',
      'button[aria-label*="AI"]',
      'button[class*="chat"]',
      'div[class*="widget"] button',
      '[class*="MessageCircle"]'
    ];

    // 首先嘗試通過頁面分析
    // 查找頁面上的所有按鈕
    const allButtons = await page.$$('button');
    console.log(`   ℹ️  找到 ${allButtons.length} 個按鈕，尋找 Chat Widget...`);

    // 嘗試找到固定位置的按鈕 (bottom-right 角)
    // Chat Widget 應該在 bottom-20 right-4
    // 先等待可能的動畫
    await page.waitForTimeout(1000);

    // 嘗試 1: 直接找聊天泡泡按鈕 (位置固定)
    try {
      // 聊天泡泡應該在頁面右下角，嘗試點擊那個區域
      const chatWidgetArea = await page.$('div[class*="fixed"][class*="bottom"]');
      if (chatWidgetArea) {
        console.log('   ✅ 找到固定位置的 Widget');
        await chatWidgetArea.click();
        await page.waitForTimeout(800);
        openButton = chatWidgetArea;
      }
    } catch (e) {
      console.log('   (方法1失敗)');
    }

    // 嘗試 2: 通過評估頁面查找
    if (!openButton) {
      console.log('   嘗試評估頁面上的 Widget...');
      const hasWidget = await page.evaluate(() => {
        // 查找包含聊天相關文本的元素
        const elements = document.querySelectorAll('*');
        for (let el of elements) {
          if (el.textContent && el.textContent.includes('AI') || el.textContent.includes('Chat')) {
            return true;
          }
        }
        return false;
      });
      console.log(`   ℹ️  Widget 頁面存在: ${hasWidget}`);
    }

    // STEP 4: 尋找輸入框
    console.log('\n4. 尋找 RAG Chat 輸入框...');

    // 聊天輸入框應該是 input[type="text"] 在固定面板內
    // 先等待它成為可見狀態
    const inputSelectors = [
      'input[type="text"]',
      'input[placeholder*="Ask"]',
      'input[placeholder*="ask"]',
      'textarea'
    ];

    let inputField = null;
    for (const selector of inputSelectors) {
      try {
        inputField = await page.waitForSelector(selector, { timeout: 3000 });
        if (inputField) {
          console.log(`   ✅ 找到輸入框: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!inputField) {
      console.log('   ⚠️  未找到輸入框，嘗試通過頁面交互...\n');

      // 嘗試點擊頁面右下角 (可能激活 Widget)
      await page.click('body');
      await page.waitForTimeout(500);

      // 再次嘗試找輸入框
      inputField = await page.$('input[type="text"]');
      if (inputField) {
        console.log('   ✅ 通過交互激活後找到輸入框\n');
      }
    }

    if (inputField) {
      // STEP 5: 輸入問題
      console.log('5. 在 RAG Chat 中輸入問題...');
      await inputField.focus();
      await page.waitForTimeout(300);

      const question = 'What is Miller\'s Law?';
      await inputField.fill(question);
      console.log(`   ✅ 已輸入: "${question}"\n`);

      // STEP 6: 提交問題
      console.log('6. 提交問題到 RAG Backend...');

      // 尋找發送按鈕
      let sendButton = await page.$('button[type="submit"]');
      if (!sendButton) {
        sendButton = await page.$('button:has-text("Send")');
      }
      if (!sendButton) {
        sendButton = await page.$('button:has-text("Ask")');
      }

      if (sendButton) {
        await sendButton.click();
        console.log('   ✅ 已點擊發送按鈕\n');
      } else {
        // 嘗試按 Enter
        await inputField.press('Enter');
        console.log('   ✅ 已按 Enter 發送\n');
      }

      // STEP 7: 等待 RAG 回應
      console.log('7. 等待 RAG Backend 回應 (需要 Ollama 正在運行)...');
      await page.waitForTimeout(4000);
      console.log('   ✅ 回應應該已顯示\n');

      // STEP 8: 驗證回應
      console.log('8. 驗證 RAG 回應...');

      // 檢查是否有 AI 消息
      const hasAiResponse = await page.evaluate(() => {
        const messages = document.querySelectorAll('[class*="message"], [class*="chat"]');
        for (let msg of messages) {
          const text = msg.textContent || '';
          // 檢查是否包含 Miller's Law 的回應內容
          if (text.includes('Miller') || text.includes('chunk') || text.includes('Thinking')) {
            return true;
          }
        }
        return false;
      });

      if (hasAiResponse) {
        console.log('   ✅ 偵測到 AI 回應\n');
      } else {
        console.log('   ℹ️  可能未檢測到回應，可能是 Ollama 未運行或響應格式不同\n');
      }

      // STEP 9: 截圖 RAG 交互
      console.log('9. 捕捉 RAG Chat 互動截圖...');
      let screenshotPath = path.join(screenshotDir, 'MAIN-03-RAG-Demo-Millers-Law-Interactive.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`   ✅ 已保存: MAIN-03-RAG-Demo-Millers-Law-Interactive.png\n`);

    } else {
      console.log('\n⚠️  找不到輸入框，將捕捉當前頁面狀態...\n');
      let screenshotPath = path.join(screenshotDir, 'MAIN-03-RAG-Demo-Widget-State.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`   已保存: MAIN-03-RAG-Demo-Widget-State.png\n`);
    }

    console.log('=== ✅ RAG 互動演示完成 ===\n');
    console.log('📁 文件位置:');
    console.log(`   C:\\Users\\User\\Downloads\\FYP_Final_Project\\FYP_Submission\\frontend\\${screenshotDir}\\\n`);

    console.log('📸 新增截圖:');
    console.log('   MAIN-03-RAG-Demo-Millers-Law-Interactive.png');
    console.log('   → RAG Chat Widget 實際互動');
    console.log('   → 問題: "What is Miller\'s Law?"');
    console.log('   → 展示後端整合 (需要 Ollama 運行)\n');

    console.log('💡 如果沒有看到 AI 回應:');
    console.log('   1. 確認 Ollama 正在本地運行 (localhost:11434)');
    console.log('   2. 確認 FastAPI RAG 後端正在運行 (localhost:8080)');
    console.log('   3. 檢查 ChromaDB 是否已加載課程內容\n');

    process.exit(0);

  } catch (err) {
    console.error('❌ 錯誤:', err.message);
    console.log('Current URL:', page.url());
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
