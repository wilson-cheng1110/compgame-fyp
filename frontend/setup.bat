@echo off
echo ===================================
echo Setting up COMPGame for Windows
echo ===================================
echo.

echo Checking Node.js installation...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Node.js is not installed or not in PATH.
  echo Please install Node.js from https://nodejs.org/
  echo and run this script again.
  pause
  exit /b 1
)

echo Node.js is installed.
echo.

echo Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo Failed to install dependencies.
  echo Try running as administrator or check your internet connection.
  pause
  exit /b 1
)
echo Dependencies installed successfully.
echo.

echo Creating required directories...
if not exist "public\images" mkdir "public\images"
echo Directories created.
echo.

echo Checking for required image files...
set MISSING_FILES=0

if not exist "public\images\fishhook.png" (
  echo Missing: public\images\fishhook.png
  set MISSING_FILES=1
)

if not exist "public\images\avatar_1.png" (
  echo Missing: public\images\avatar_1.png
  set MISSING_FILES=1
)

if not exist "public\images\avatar_2.png" (
  echo Missing: public\images\avatar_2.png
  set MISSING_FILES=1
)

if not exist "public\images\badge.png" (
  echo Missing: public\images\badge.png
  set MISSING_FILES=1
)

if not exist "public\images\star-badge.png" (
  echo Missing: public\images\star-badge.png
  set MISSING_FILES=1
)

if not exist "public\images\fitts-law-thumbnail.jpeg" (
  echo Missing: public\images\fitts-law-thumbnail.jpeg
  set MISSING_FILES=1
)

if not exist "public\images\fitts-law-assessment-thumbnail.jpeg" (
  echo Missing: public\images\fitts-law-assessment-thumbnail.jpeg
  set MISSING_FILES=1
)

if not exist "public\images\Lab 3-car.png" (
  echo Missing: public\images\Lab 3-car.png
  set MISSING_FILES=1
)
if not exist "public\images\Lab 3-road.png" (
  echo Missing: public\images\Lab 3-road.png
  set MISSING_FILES=1
)
if not exist "public\images\stop.png" (
  echo Missing: public\images\stop.png
  set MISSING_FILES=1
)
if not exist "public\images\person.png" (
  echo Missing: public\images\person.png
  set MISSING_FILES=1
)

if %MISSING_FILES% EQU 1 (
  echo.
  echo Some image files are missing. Please make sure to add them to the public\images directory.
)
echo.

echo Setting up Git configuration for Windows...
git config --global core.autocrlf true
echo Git configuration updated.
echo.

echo ===================================
echo Setup complete!
echo.
echo To start the development server, run:
echo npm run dev
echo.
echo Then open http://localhost:3000 in your browser.
echo ===================================
pause
