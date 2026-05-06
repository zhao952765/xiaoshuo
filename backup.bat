@echo off
chcp 65001 >nul
title 小说项目 GitHub 精简备份

setlocal enabledelayedexpansion

:: ========== 已适配你的项目路径 ==========
set "SRC=F:\1\xiaoshuo"
set "DEST_ROOT=F:\1\上传"
:: ========================================

:: 生成纯数字时间戳（避免中文乱码）
set "y=%date:~0,4%"
set "m=%date:~5,2%"
set "d=%date:~8,2%"
set "h=%time:~0,2%"
set "mi=%time:~3,2%"
set "s=%time:~6,2%"
if "%h%"==" " set h=00
set "BAK_DIR=%DEST_ROOT%\xiaoshuo_github_bak_%y%%m%%d%_%h%%mi%%s%"

echo ==============================================
echo 正在执行 GitHub 精简备份
echo 源目录：%SRC%
echo 备份目录：%BAK_DIR%
echo ==============================================
echo 自动排除：node_modules、logs、out、.vscode 等无用文件
echo 自动保留：所有源码、配置文件、prompts.json 等
echo.

:: Robocopy 命令：只复制必要文件，自动过滤垃圾
robocopy "%SRC%" "%BAK_DIR%" /E /XD node_modules logs out .vscode /XF *.log *.tmp Thumbs.db .DS_Store /R:2 /W:2 /NDL /NFL

echo.
echo ==============================================
echo ✅ 备份完成！
echo 备份文件已保存到：%BAK_DIR%
echo 该目录已过滤无用文件，可直接上传 GitHub
echo ==============================================
echo.

:: 备份完成后自动打开备份文件夹
explorer "%BAK_DIR%"

pause
exit