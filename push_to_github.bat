@echo off
title Push MediMatch to GitHub
echo ========================================================
echo   Pushing MediMatch PS10 Platform to GitHub
echo   Repository: https://github.com/ajay3-prog/MediMatch-Emergency-Platform
echo ========================================================
echo.
set PATH=C:\Users\AJAY\mingit\cmd;C:\Users\AJAY\mingit\mingw64\bin;%PATH%

git push -u origin main
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed. If GitHub prompted you to sign in, please complete the browser login or provide a GitHub Personal Access Token.
) else (
    echo.
    echo ========================================================
    echo   [SUCCESS] Code successfully pushed to GitHub!
    echo   View at: https://github.com/ajay3-prog/MediMatch-Emergency-Platform
    echo ========================================================
)
echo.
pause
