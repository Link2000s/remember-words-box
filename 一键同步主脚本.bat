@echo off
:: 设置编码为 UTF-8
chcp 65001 >nul
cls

echo ====================================================
echo 🚀 【摸鱼克星】开始全自动同步油猴主脚本至 GitHub...
echo ====================================================
echo.

:: 1. 追踪所有变动
echo 📦 正在打包最新脚本代码...
git add .
if %errorlevel% neq 0 goto error

:: 2. 提交更新
echo.
echo 📝 正在提交代码变更记录...
git commit -m "code: 升级油猴主脚本逻辑与核心架构 ( %date% %time% )"

:: 3. 强推上云
echo.
echo 📤 正在强制推送最新代码至 GitHub (git push) ...
git push github main -f
if %errorlevel% neq 0 goto error

echo.
echo ====================================================
echo 🎉 【大功告成】油猴主脚本已完美同步至 GitHub 仓库！
echo ====================================================
goto end

:error
echo.
echo ====================================================
echo ❌ 【同步失败】Git 运行遭遇阻碍，请检查网络连接或仓库状态。
echo ====================================================

:end
echo.
echo 按任意键退出...
pause >nul