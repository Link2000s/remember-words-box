@off
:: 设置编码为 UTF-8，防止终端里中文备注乱码
chcp 65001 >nul
cls

echo ====================================================
echo 🚀 【摸鱼克星】开始全自动同步词库至 GitHub...
echo ====================================================
echo.

:: 1. 追踪所有本地变动
echo 📦 正在打包本地最新修改 (git add) ...
git add .
if %errorlevel% neq 0 goto error

:: 2. 提交更新，并带上当前时间戳作为备注
echo.
echo 📝 正在提交本地记录 (git commit) ...
git commit -m "update: 自动化更新词库 ( %date% %time% )"
if %errorlevel% neq 0 (
    echo ℹ️ 没有检测到任何文件变动，无需提交。
)

:: 3. 强推上云
echo.
echo 📤 正在通过 CDN 渠道全速推送至 GitHub (git push) ...
git push github master -f
if %errorlevel% neq 0 goto error

echo.
echo ====================================================
echo 🎉 【大功告成】云端词库已完美合龙！jsDelivr CDN 将在不久后无感同步。
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