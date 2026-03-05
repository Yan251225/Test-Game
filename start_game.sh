#!/bin/bash
echo "============================================"
echo "  星辰学院 - 乙女游戏 / Star Academy"
echo "============================================"
echo ""
echo "正在启动游戏... / Starting game..."
echo "请在浏览器中打开 http://localhost:8080"
echo ""

# Try to open browser
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8080 &
elif command -v open &> /dev/null; then
    open http://localhost:8080 &
fi

python3 -m http.server 8080 || python -m http.server 8080