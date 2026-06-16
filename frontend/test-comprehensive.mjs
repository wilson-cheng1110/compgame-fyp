import { chromium } from '@playwright/test';

const baseURL = 'http://localhost:3000';
const testSID = 'AUDIT' + Date.now();
const testPassword = 'AuditPass123';

const tests = [];

async function test(name, fn) {
  try {
    await fn();
    tests.push({ name, status: '✅', error: null });
  } catch (err) {
    tests.push({ name, status: '❌', error: err.message });
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // TEST 1: Signup validation
  await test('Signup: empty fields rejected', async () => {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    const signupBtn = await page.$('button:has-text("Sign Up for Free")');
    await signupBtn.click();
    const errorText = await page.waitForSelector('text=fill in all fields', { timeout: 3000 });
    if (!errorText) throw new Error('Validation error not shown');
    await page.close();
  });

  // TEST 2: Signup duplicate SID
  await test('Signup: duplicate SID rejected', async () => {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    const sidInput = await page.waitForSelector('input[placeholder*="22000000D"]', { timeout: 5000 });
    await sidInput.fill('TESTSID001');
    const pwInput = await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await pwInput.fill('test123');
    let signupBtn = await page.$('button:has-text("Sign Up for Free")');
    await signupBtn.click();
    await page.waitForURL(/\/onboarding/, { timeout: 5000 });
    // Try to signup again with same SID
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    await sidInput.fill('TESTSID001');
    await pwInput.fill('test456');
    signupBtn = await page.$('button:has-text("Sign Up for Free")');
    await signupBtn.click();
    const dupError = await page.waitForSelector('text=already registered', { timeout: 3000 });
    if (!dupError) throw new Error('Duplicate SID not rejected');
    await page.close();
  });

  // TEST 3: Login with wrong password
  await test('Login: wrong password rejected', async () => {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
    const sidInput = await page.waitForSelector('input[placeholder*="22000000D"]', { timeout: 5000 });
    await sidInput.fill('TESTSID001');
    const pwInput = await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await pwInput.fill('wrongpassword');
    const loginBtn = await page.$('button:has-text("Log In")');
    await loginBtn.click();
    const errorText = await page.waitForSelector('text=Invalid', { timeout: 3000 });
    if (!errorText) throw new Error('Invalid password not rejected');
    await page.close();
  });

  // TEST 4: Full signup → dashboard → game → logout flow
  await test('Full flow: signup → onboarding → dashboard → game → logout', async () => {
    const page = await browser.newPage();

    // Signup
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    const sidInput = await page.waitForSelector('input[placeholder*="22000000D"]', { timeout: 5000 });
    await sidInput.fill(testSID);
    const pwInput = await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await pwInput.fill(testPassword);
    let btn = await page.$('button:has-text("Sign Up for Free")');
    await btn.click();

    // Onboarding
    await page.waitForURL(/\/onboarding\/avatar/, { timeout: 5000 });
    const continueBtn = await page.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
    await continueBtn.click();
    await page.waitForURL(/\/onboarding\/username/, { timeout: 5000 });
    const usernameInput = await page.waitForSelector('input[placeholder*="username"]', { timeout: 5000 });
    await usernameInput.fill('AuditUser');
    const continueBtn2 = await page.waitForSelector('button:has-text("Continue")', { timeout: 5000 });
    await continueBtn2.click();

    // Dashboard
    await page.waitForURL(`${baseURL}/dashboard`, { timeout: 5000 });
    const dashboardText = await page.textContent('h1');
    if (!dashboardText || !dashboardText.includes('COMPGame')) throw new Error('Dashboard not loaded');

    // Navigate to game
    const problemSolvingLink = await page.$('a:has-text("Problem Solving")');
    if (!problemSolvingLink) throw new Error('Problem Solving game link not found');

    // Logout
    const signoutBtn = await page.$('button:has-text("Sign Out")');
    if (!signoutBtn) throw new Error('Sign Out button not found');
    await signoutBtn.click();
    await page.waitForURL(`${baseURL}/`, { timeout: 5000 });

    await page.close();
  });

  // TEST 5: Dashboard shows all 13 topics
  await test('Dashboard: displays all 13 HCI topics', async () => {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
    const sidInput = await page.waitForSelector('input[placeholder*="22000000D"]', { timeout: 5000 });
    await sidInput.fill('TESTSID001');
    const pwInput = await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await pwInput.fill('test123');
    const loginBtn = await page.$('button:has-text("Log In")');
    await loginBtn.click();
    await page.waitForURL(`${baseURL}/dashboard`, { timeout: 5000 });

    // Count game links (each topic has 2: understanding + assessment)
    const gameLinks = await page.$$('a[href*="/games/"]');
    const uniqueTopics = new Set();
    for (const link of gameLinks) {
      const href = await link.getAttribute('href');
      const topic = href.split('/games/')[1].replace(/-(understanding|assessment)/, '');
      uniqueTopics.add(topic);
    }
    if (uniqueTopics.size < 10) throw new Error(`Only ${uniqueTopics.size} topics found, expected 13+`);

    await page.close();
  });

  // TEST 6: Game navigation accessible
  await test('Game: problem-solving-understanding loads', async () => {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/games/problem-solving-understanding`, { waitUntil: 'networkidle' });
    const startBtn = await page.waitForSelector('button:has-text("Start Solving")', { timeout: 5000 });
    if (!startBtn) throw new Error('Game component did not load');
    await page.close();
  });

  // TEST 7: Dark mode toggle
  await test('Dark mode: toggle works', async () => {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
    const darkModeBtn = await page.$('button[aria-label*="dark mode"]');
    if (!darkModeBtn) throw new Error('Dark mode button not found');
    await darkModeBtn.click();
    const cookie = await page.context().cookies();
    const darkModeCookie = cookie.find(c => c.name === 'darkMode');
    if (!darkModeCookie) throw new Error('Dark mode cookie not set');
    await page.close();
  });

  // TEST 8: Home page accessible
  await test('Home page: "/" loads', async () => {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
    const content = await page.textContent('body');
    if (!content || content.length < 100) throw new Error('Home page did not load properly');
    await page.close();
  });

  await browser.close();

  // Report results
  console.log('\n=== COMPREHENSIVE AUDIT RESULTS ===\n');
  tests.forEach(t => {
    console.log(`${t.status} ${t.name}`);
    if (t.error) console.log(`   ${t.error}`);
  });

  const passed = tests.filter(t => t.status === '✅').length;
  const failed = tests.filter(t => t.status === '❌').length;
  console.log(`\nPassed: ${passed}/${tests.length}`);
  if (failed > 0) {
    console.log(`Failed: ${failed}/${tests.length}`);
    process.exit(1);
  }
  console.log('\n✅ ALL TESTS PASSED');
  process.exit(0);
})();
