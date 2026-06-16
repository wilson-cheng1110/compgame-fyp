# End-to-End Validation & Screenshot Capture Guide

This guide walks through running the complete COMPGame validation with screenshot capture for demo presentation.

## Prerequisites

Ensure you have:
- Node.js installed
- Python backend optional (AI tutor widget will show but may not respond)
- Browser to see the visual flow

## Setup (First Time Only)

```powershell
cd path\to\frontend
npm install
npm install -g @playwright/test
```

## Running the Validation

### Option 1: Full Validation with Screenshots (Recommended for Demo)

This script runs through the **entire user journey** with a visible browser window and captures 11 key screenshots.

```powershell
# Terminal 1: Start the dev server
cd frontend
npm run dev

# Terminal 2: Run the E2E validation (in a NEW terminal)
cd frontend
npm install -g @playwright/test  # if not already installed
node test-e2e-with-screenshots.mjs
```

**Expected Runtime:** ~60-90 seconds  
**Output:** `screenshots-e2e/` folder with 11 PNG files

### Option 2: Quick Test (Headless)

If you just want to verify functionality without screenshots:

```powershell
node test-badge-persistence.mjs
```

**Expected Runtime:** ~15 seconds

---

## What the Full Validation Tests

The `test-e2e-with-screenshots.mjs` script exercises the **complete flip-learning journey**:

### 1. **Signup Page** (screenshot: `01-signup-page.png`)
   - Form with SID + password fields
   - Pixel art aesthetic (Press Start 2P font)
   - Sign up button

### 2. **Onboarding - Avatar Selection** (screenshot: `02-onboarding-avatar.png`)
   - Avatar choice interface
   - Continue button

### 3. **Dashboard** (screenshot: `03-dashboard.png`)
   - Game launcher grid showing 13 HCI game pairs
   - Progress tracking
   - Badge collection view

### 4. **Understanding Game Start** (screenshot: `04-understanding-game-start.png`)
   - Fitts' Law introduction
   - Learning objectives
   - Start button

### 5. **Understanding Game Playing** (screenshot: `05-understanding-game-playing.png`)
   - Interactive demo/game in progress
   - Student exploration mode
   - Take Assessment CTA

### 6. **Assessment Game - Quiz Intro** (screenshot: `06-assessment-intro.png`)
   - Assessment introduction screen
   - Difficulty level (6 MCQ)
   - Start button

### 7. **Assessment Game - Question Example** (screenshot: `07-assessment-quiz-question.png`)
   - Sample quiz question
   - Multiple choice options
   - Question progress indicator

### 8. **Assessment Complete - Badge Awarded** (screenshot: `08-assessment-debrief-badge.png`)
   - Score display (e.g., "75%")
   - Badge earned with star rating
   - Principle explanation
   - Exam prep tip
   - AI tutor CTA
   - Next game button

### 9. **Dashboard with Badge** (screenshot: `09-dashboard-with-badge.png`)
   - Dashboard after returning from game
   - Badge visible on the game card
   - Other uncompleted games

### 10. **AI Tutor Widget** (screenshot: `10-ai-tutor-widget.png`)
   - Floating chat bubble (bottom-right)
   - Chat interface
   - Shows integration with RAG backend

### 11. **Dark Mode** (screenshot: `11-dark-mode.png`)
   - Dark mode toggle enabled
   - Dashboard in dark theme
   - Accessibility feature

---

## Screenshots Directory

All screenshots are saved to: `frontend/screenshots-e2e/`

```
frontend/
  screenshots-e2e/
    01-signup-page.png
    02-onboarding-avatar.png
    03-dashboard.png
    04-understanding-game-start.png
    05-understanding-game-playing.png
    06-assessment-intro.png
    07-assessment-quiz-question.png
    08-assessment-debrief-badge.png
    09-dashboard-with-badge.png
    10-ai-tutor-widget.png
    11-dark-mode.png
```

## Sharing Screenshots with Jeff

After running the validation:

1. **Check the screenshots:**
   ```powershell
   ls screenshots-e2e/
   ```

2. **View screenshots (in VS Code or browser):**
   - Open `screenshots-e2e/01-signup-page.png` etc.
   - Or open in image viewer

3. **Send to Jeff:**
   - Zip the `screenshots-e2e/` folder
   - Email with summary:
     ```
     Subject: COMPGame E2E Validation - Screenshots for Demo

     Hi Jeff,

     Completed end-to-end validation of COMPGame platform.
     All 11 key flows tested and captured:
     - User signup & onboarding
     - Dashboard with 13 HCI games
     - Flip-learning: Understanding → Assessment → Badge
     - Badge persistence verified
     - AI tutor widget (RAG integration)
     - Dark mode accessibility

     Screenshots attached: screenshots-e2e.zip
     All tests passing. Ready for June 24 EDC demo.
     ```

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Dev server not starting | Ensure port 3000 is free: `netstat -ano \| findstr :3000` |
| "Cannot find localhost:3000" | Run `npm run dev` first in terminal 1 |
| Screenshot folder not created | Playwright automatically creates it; check permissions |
| Browser window pops up and closes immediately | Headless mode issue; ensure Playwright is installed: `npm install -g @playwright/test` |
| AI tutor widget doesn't respond | Python backend not running (optional for demo); widget still shows in screenshots |

---

## Success Criteria

✅ All steps complete without errors  
✅ 11 screenshots captured  
✅ Browser visibly shows complete user journey  
✅ Badge awarded and visible on dashboard  
✅ Dark mode toggle working  
✅ Script reports: "Ready for EDC exhibition demo!"

---

## For Demo Day

Print or display these screenshots in order to show Jeff:
1. The complete flow (signup → onboarding → game → badge)
2. Visual polish (pixel art design, responsive layout)
3. 13 games available (dashboard view)
4. Badge system (visual star ratings)
5. Accessibility features (dark mode)
6. AI integration (RAG tutor widget)

**Total flow shows:** Modern, polished, fully-featured flip-learning platform ready for classroom use.
