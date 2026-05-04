@echo off
chcp 65001
set "source=."
set "dest=F:\1\xiaoshuo"

echo 开始备份代码...

robocopy "." "%dest%" /E /Z /XD node_modules dist dist-electron .git .vscode .codebuddy /XF *.log

echo.
echo ======================
echo 备份完成！
echo ======================
pause