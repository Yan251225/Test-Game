@echo off
echo ============================================
echo   星辰学院 - 乙女游戏 / Star Academy
echo ============================================
echo.
echo 正在启动游戏服务器...
echo Starting game server...
echo.
echo 游戏将在浏览器中打开，请稍候...
echo Game will open in browser, please wait...
echo.
start http://localhost:8080
python -m http.server 8080
pause
