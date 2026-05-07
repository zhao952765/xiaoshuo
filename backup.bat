@echo off
chcp 65001 >nul
title 小说项目 GitHub 精简备份（优化版）

setlocal enabledelayedexpansion

:: ========== 路径配置（按你本地实际路径修改） ==========
set "SRC=F:\1\xiaoshuo"
set "DEST_ROOT=F:\1\上传"
:: =====================================================

:: 生成纯数字时间戳
set "y=%date:~0,4%"
set "m=%date:~5,2%"
set "d=%date:~8,2%"
set "h=%time:~0,2%"
set "mi=%time:~3,2%"
set "s=%time:~6,2%"
if "%h%"==" " set h=00
set "BAK_DIR=%DEST_ROOT%\xiaoshuo_github_bak_%y%%m%%d%_%h%%mi%%s%"

echo ==============================================
echo 正在执行 GitHub 精简备份（优化版）
echo 源目录：%SRC%
echo 备份目录：%BAK_DIR%
echo ==============================================
echo 自动排除：node_modules、构建产物、缓存、日志等
echo 仅保留：源码、配置、文档、静态资源
echo.

:: Robocopy 优化过滤规则
robocopy "%SRC%" "%BAK_DIR%" /E ^
/XD node_modules dist out logs .vscode .idea .git .github ^
/XF *.log *.tmp *.bak *.swp Thumbs.db .DS_Store *.tsbuildinfo ^
/R:2 /W:2 /NDL /NFL

echo.
echo ==============================================
echo ✅ 备份完成！
echo 备份文件已保存到：%BAK_DIR%
echo 该目录已过滤所有无用文件，可直接上传 GitHub
echo ==============================================
echo.

:: 备份完成后自动打开备份文件夹
explorer "%BAK_DIR%"

pause
exit