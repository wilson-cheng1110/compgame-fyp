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

console.log('=== 正確的截圖捕捉 (已登入) ===\n');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // STEP 1: 註冊新帳戶
    console.log('1. 創建測試帳戶...');
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const sidInput = await page.waitForSelector('input[placeholder*="22000000D"]', { timeout: 10000 });
    await sidInput.fill(testSID);
    await page.waitForTimeout(300);

    const pwInput = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await pwInput.fill(testPassword);
    await page.waitForTimeout(300);

    const signupBtn = await page.waitForSelector('button:has-text("Sign Up for Free")', { timeout: 10000 });
    await signupBtn.click();
    console.log('   ✅ 帳戶已創建');

    // STEP 2: 完成 Onboarding
    console.log('2. 完成 Onboarding...');
    await page.waitForURL(/\/onboarding/, { timeout: 15000 });
    await page.waitForTimeout(500);

    const continueBtn = await page.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
    await continueBtn.click();
    await page.waitForTimeout(500);

    const usernameInput = await page.waitForSelector('input[placeholder*="username"]', { timeout: 5000 });
    await usernameInput.fill('DemoUser');
    await page.waitForTimeout(300);

    const continueBtn2 = await page.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
    await continueBtn2.click();
    console.log('   ✅ Onboarding 完成');

    // STEP 3: 等待 Dashboard 加載
    console.log('3. 等待 Dashboard...');
    await page.waitForURL(`${baseURL}/dashboard`, { timeout: 15000 });
    await page.waitForTimeout(2000);

    // SCREENSHOT 1: 儀表板 - 所有遊戲
    console.log('\n📸 截圖 1: Dashboard (所有13個遊戲)');
    let path1 = path.join(screenshotDir, 'MAIN-01-Dashboard-All-13-Games.png');
    await page.screenshot({ path: path1, fullPage: true });
    console.log('   ✅ 已保存: MAIN-01-Dashboard-All-13-Games.png');
    console.log('   📊 內容: 所有13個HCI遊戲對選擇');
    console.log('   ✨ 特色: 可見遊戲卡片、進度追蹤、徽章系統');

    // STEP 4: 進入遊戲 (獲得RAG widget)
    console.log('\n4. 進入遊戲頁面以顯示 RAG Widget...');
    await page.goto(`${baseURL}/games/fitts-law-understanding`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // SCREENSHOT 2: RAG Chat Widget
    console.log('\n📸 截圖 2: RAG AI Tutor Widget');
    let path2 = path.join(screenshotDir, 'MAIN-02-RAG-AI-Tutor-Widget.png');
    await page.screenshot({ path: path2, fullPage: true });
    console.log('   ✅ 已保存: MAIN-02-RAG-AI-Tutor-Widget.png');
    console.log('   🤖 內容: 右下角藍色 AI Tutor 聊天泡泡');
    console.log('   💬 功能: RAG 整合 (Ollama + ChromaDB + COMP3423講義)');

    console.log('\n=== ✅ 正確的截圖已完成 ===\n');

    console.log('📁 文件位置:');
    console.log(`   C:\\Users\\User\\Downloads\\FYP_Final_Project\\FYP_Submission\\frontend\\${screenshotDir}\\\n`);

    console.log('✨ 兩幅關鍵截圖:');
    console.log('   1️⃣  MAIN-01-Dashboard-All-13-Games.png');
    console.log('       → 已登入的儀表板');
    console.log('       → 顯示所有13個遊戲對');
    console.log('       → 每個遊戲: Understanding (學習) + Assessment (測驗)');
    console.log('');
    console.log('   2️⃣  MAIN-02-RAG-AI-Tutor-Widget.png');
    console.log('       → 遊戲頁面');
    console.log('       → 右下角: 藍色 AI Tutor 聊天泡泡');
    console.log('       → RAG Backend: Ollama LLM + ChromaDB + 課程內容');

    console.log('\n🎉 準備分享給 JEFF!');

    process.exit(0);

  } catch (err) {
    console.error('❌ 錯誤:', err.message);
    console.log('Current URL:', page.url());
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
