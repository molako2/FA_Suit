@echo off
echo ============================================
echo  Cloning and pushing to FA_Suit repository
echo ============================================
echo.

REM Navigate to a temp location
cd /d "%USERPROFILE%\Desktop"

REM Clean up if previous attempt exists
if exist FA_Suit (
    echo Removing previous FA_Suit folder...
    rmdir /s /q FA_Suit
)

echo [1/5] Cloning clean branch from solo-cabinet-flow...
git clone --branch claude/fix-password-validation-NH3Rd --single-branch https://github.com/molako2/solo-cabinet-flow.git FA_Suit
if %errorlevel% neq 0 (
    echo ERROR: Clone failed. Check your network and GitHub access.
    pause
    exit /b 1
)

cd FA_Suit

echo [2/5] Renaming branch to main...
git branch -m claude/fix-password-validation-NH3Rd main

echo [3/5] Switching remote to FA_Suit repo...
git remote set-url origin https://github.com/molako2/FA_Suit.git

echo [4/5] Pushing to FA_Suit main branch...
git push -u origin main
if %errorlevel% neq 0 (
    echo ERROR: Push failed. Make sure the FA_Suit repo exists and is empty.
    pause
    exit /b 1
)

echo [5/5] Cleaning up lock file...
echo.
echo ============================================
echo  SUCCESS! FA_Suit repo is now populated.
echo  Repo: https://github.com/molako2/FA_Suit
echo  Location: %USERPROFILE%\Desktop\FA_Suit
echo ============================================
echo.
pause
