// ==UserScript==
// @name         强制背单词解锁网站
// @version      12.5
// @description  纯净单词版：优化远程词库加载时序，增加延迟异步唤醒，彻底解决时序差导致的本地兜底问题。
// @author       linkgp
// @license      MIT
// @namespace    http://tampermonkey.net/
// @match        *://*.bilibili.com/*
// @match        *://*.weibo.com/*
// @match        *://*.zhihu.com/*
// @match        *://*.douyin.com/*
// @match        *://*.douyu.com/*
// @match        *://*.youtube.com/*
// @match        *://*.reddit.com/*
// @match        *://github.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// ⭕ 完美替换为 GreasyFork 官方白名单词库直链：
// @require      https://update.greasyfork.org/scripts/582772/code.js
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. 本地超强单词兜底数据库
    // ==========================================
    const localBackupWords = [
        { "en": "cancel", "zh": "取消，撤销；删去", "usphone": "'kænsl", "ukphone": "'kænsl" },
        { "en": "explosive", "zh": "爆炸的；极易引起争论的 / 炸药", "usphone": "ɪk'splosɪv", "ukphone": "ɪk'spləusɪv" },
        { "en": "snap", "zh": "咔嚓折断，啪地绷断；吧嗒一声；猛咬；厉声说话 / 仓促的 / 快照", "usphone": "snæp", "ukphone": "snæp" },
        { "en": "issue", "zh": "问题；发行物 / 发行；流出", "usphone": "'ɪʃu", "ukphone": "'ɪʃu" }
    ];

    // ==========================================
    // 2. 核心延时启动逻辑 (给大文件解析留出 200ms 时间)
    // ==========================================
    function startMoyuEngine() {
        let wordList = [];

        // 显式从全局或 window 上抓取变量
        const remoteData = (typeof moyu_cet4_data !== 'undefined') ? moyu_cet4_data : window.moyu_cet4_data;

        if (remoteData && Array.isArray(remoteData) && remoteData.length > 0) {
            console.log("【摸鱼克星】成功通过 CDN 加载 GitHub 云端词库，开始清洗数据...");
            wordList = remoteData.map(item => {
                let cleanZh = item.zh;
                if (Array.isArray(item.zh)) cleanZh = item.zh.join(' / ');
                return { en: item.en, zh: cleanZh, example: item.example || "" };
            });
        }

        // 如果 200ms 后依然没有就绪，说明可能真的断网或脚本被 CSP 拦截，启动本地兜底
        if (wordList.length < 4) {
            console.warn("【摸鱼克星】远程词库未响应，已启动本地核心词库兜底！！");
            wordList = localBackupWords;
        }

        console.log("【摸鱼克星】初始化完成，当前可用总单词量：", wordList.length);

        // 如果依然是本地的 4 个兜底单词，可以照常运行，但如果是 2607 就会异常爽快
        const DOM_ID = 'moyu-v8-blocker';
        const TODAY = new Date().toLocaleDateString('en-CA');
        const NOW = Date.now();

        let memoryData = GM_getValue('memoryData', {});
        let dailyPool = GM_getValue('dailyPool', { date: '', words: [] });

        // 清理旧缓存
        const GC_LIMIT = 180 * 24 * 60 * 60 * 1000;
        let isDataChanged = false;
        for (const key in memoryData) {
            if (NOW - memoryData[key].lastReview > GC_LIMIT) {
                delete memoryData[key];
                isDataChanged = true;
            }
        }
        if (isDataChanged) GM_setValue('memoryData', memoryData);

        // 生成今日新任务池（如果没有任务，或者天数变了，重新生成 10 个词）
        if (dailyPool.date !== TODAY || !dailyPool.words || dailyPool.words.length === 0) {
            let newWords = [];
            const wordKeys = new Set(wordList.map(w => w.en));
            let overdueWords = [];

            for (let key in memoryData) {
                if (memoryData[key].nextReview <= NOW && wordKeys.has(key)) {
                    overdueWords.push(key);
                }
            }

            overdueWords.sort((a, b) => memoryData[a].nextReview - memoryData[b].nextReview);
            newWords = overdueWords.slice(0, 10);

            if (wordList.length >= 4 && newWords.length < 10) {
                let shuffledList = fisherYatesShuffle([...wordList]);
                for (let w of shuffledList) {
                    if (newWords.length >= 10) break;
                    if (!memoryData[w.en] && !newWords.includes(w.en)) newWords.push(w.en);
                }
            }

            dailyPool = { date: TODAY, words: newWords };
            GM_setValue('dailyPool', dailyPool);
        }

        // SM-2 记忆曲线算法
        function calculateSM2(quality, memObj) {
            let reps = memObj.reps || 0;
            let ef = memObj.ef || 2.5;
            let interval = memObj.interval || 0;
            let newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
            if (newEF < 1.3) newEF = 1.3;
            let newReps = quality < 3 ? 0 : reps + 1;
            let newInterval = newReps === 0 || newReps === 1 ? 1 : (newReps === 2 ? 6 : Math.round(interval * newEF));
            return { reps: newReps, ef: newEF, interval: newInterval, lastReview: NOW, nextReview: NOW + newInterval * 86400000 };
        }

        function fisherYatesShuffle(arr) {
            let m = arr.length, t, i;
            while (m) {
                i = Math.floor(Math.random() * m--);
                t = arr[m]; arr[m] = arr[i]; arr[i] = t;
            }
            return arr;
        }

        // 拦截与 UI 渲染
        function checkAndBlock() {
            if (!document.body) return;

            dailyPool = GM_getValue('dailyPool', { date: '', words: [] });
            const wCount = dailyPool.words ? dailyPool.words.length : 0;

            if (wCount === 0) {
                if (!document.getElementById(DOM_ID)) {
                    let wLearned = 0;
                    const memoryKeys = Object.keys(memoryData);
                    const wordKeys = new Set(wordList.map(w => w.en));
                    memoryKeys.forEach(k => { if (wordKeys.has(k)) wLearned++; });

                    let completionFlag = 'moyu_lib_completed_' + TODAY;
                    if (wLearned >= wordList.length && !GM_getValue(completionFlag, false)) {
                        confirm(`🎉 恭喜达成全词库通关成就！\n\n当前词书所有单词均已收入囊中！`);
                        GM_setValue(completionFlag, true);
                    }
                }
                return;
            }

            if (document.getElementById(DOM_ID)) return;

            const targetWordEn = dailyPool.words[Math.floor(Math.random() * dailyPool.words.length)];
            const targetData = wordList.find(item => item.en === targetWordEn);

            if (!targetData) {
                dailyPool.words = dailyPool.words.filter(w => w !== targetWordEn);
                GM_setValue('dailyPool', dailyPool);
                setTimeout(checkAndBlock, 50);
                return;
            }

            let options = [targetData];
            let attempts = 0;
            while (options.length < 4 && attempts < 100) {
                attempts++;
                let rw = wordList[Math.floor(Math.random() * wordList.length)];
                if (!options.some(opt => opt.en === rw.en || opt.zh === rw.zh)) options.push(rw);
            }

            if (options.length < 4) return;
            options = fisherYatesShuffle(options);

            let wrongCount = 0;

            const overlay = document.createElement('div');
            overlay.id = DOM_ID;
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: rgba(15, 15, 15, 0.98); z-index: 2147483647;
                display: flex; flex-direction: column; justify-content: center; align-items: center;
                color: white; font-family: -apple-system, sans-serif;
                padding: 20px; box-sizing: border-box; overflow-y: auto;
            `;

            const title = document.createElement('div');
            title.innerHTML = `<span style="color:#ff5252;">■</span> 今日待解锁核心单词：<b>${wCount}</b> 个`;
            title.style.cssText = 'margin-bottom: 30px; font-size: 18px; color: #ccc;';

            const question = document.createElement('h2');
            question.innerText = targetData.en;
            question.style.cssText = 'margin-bottom: 10px; color: #4CAF50; letter-spacing: 1px; text-align: center; max-width: 900px; line-height: 1.4; font-size: clamp(36px, 8vw, 56px);';

            const exampleText = document.createElement('p');
            exampleText.innerText = targetData.example ? `"${targetData.example}"` : "";
            exampleText.style.cssText = `margin-bottom: 30px; color: #888; font-size: clamp(16px, 4vw, 20px); font-style: italic; max-width: 800px; text-align: center; line-height: 1.5; display: ${targetData.example ? 'block' : 'none'};`;

            const optionsContainer = document.createElement('div');
            optionsContainer.style.cssText = 'display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; width: 100%; max-width: 800px;';

            const errorMsg = document.createElement('p');
            errorMsg.style.cssText = 'color: #ff5252; margin-top: 25px; font-size: 16px; height: 24px; font-weight: bold;';

            const masteredBtn = document.createElement('button');
            masteredBtn.innerText = '🧠 斩！太简单了 / 已彻底掌握';
            masteredBtn.style.cssText = 'margin-top: 30px; padding: 12px 24px; font-size: 14px; border-radius: 6px; border: none; background-color: transparent; color: #666; cursor: pointer; text-decoration: underline; transition: opacity 0.3s;';

            function processAnswer(isMastered = false) {
                let quality = isMastered ? 5 : (wrongCount === 0 ? 4 : (wrongCount === 1 ? 3 : (wrongCount === 2 ? 2 : 1)));

                memoryData = GM_getValue('memoryData', {});
                let currentMem = memoryData[targetData.en] || {};
                memoryData[targetData.en] = calculateSM2(quality, currentMem);
                GM_setValue('memoryData', memoryData);

                if (quality >= 4) {
                    let currentPool = GM_getValue('dailyPool', { date: TODAY, words: [] });
                    currentPool.words = currentPool.words.filter(w => w !== targetData.en);
                    GM_setValue('dailyPool', currentPool);
                }

                document.body.style.overflow = '';
                overlay.remove();
            }

            masteredBtn.onclick = () => processAnswer(true);

            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.innerText = opt.zh;
                btn.style.cssText = 'flex: 1 1 calc(50% - 15px); min-width: 250px; padding: 18px 20px; font-size: 16px; line-height: 1.4; border-radius: 8px; border: 1px solid #333; background-color: #222; color: #eee; cursor: pointer; transition: all 0.2s; box-sizing: border-box; word-break: break-word;';

                btn.onclick = () => {
                    if (opt.en === targetData.en) {
                        btn.style.backgroundColor = '#1b5e20';
                        btn.style.borderColor = '#4CAF50';
                        btn.style.color = '#a5d6a7';
                        btn.style.fontWeight = 'bold';
                        errorMsg.innerText = `✅ 正确！ (2秒后自动关闭)`;
                        errorMsg.style.color = '#4CAF50';

                        const allBtns = optionsContainer.querySelectorAll('button');
                        allBtns.forEach(b => { if (b !== btn) b.style.opacity = '0.3'; });
                        masteredBtn.style.pointerEvents = 'none';
                        masteredBtn.style.opacity = '0.3';

                        setTimeout(() => {
                            errorMsg.style.color = '#ff5252';
                            processAnswer(false);
                        }, 2000);
                    } else {
                        wrongCount++;
                        btn.style.backgroundColor = '#4a1515';
                        btn.style.borderColor = '#ff5252';
                        btn.style.color = '#888';
                        btn.disabled = true;

                        if (wrongCount >= 2) {
                            errorMsg.innerText = '⚠️ 瞎点警告：锁定 3秒 强制记忆...';
                            const allBtns = optionsContainer.querySelectorAll('button');
                            allBtns.forEach(b => b.style.pointerEvents = 'none');
                            masteredBtn.style.pointerEvents = 'none';
                            masteredBtn.style.opacity = '0.3';

                            setTimeout(() => {
                                errorMsg.innerText = '请重新选择';
                                allBtns.forEach(b => { if (!b.disabled) b.style.pointerEvents = 'auto'; });
                                masteredBtn.style.pointerEvents = 'auto';
                                masteredBtn.style.opacity = '1';
                            }, 3000);
                        } else {
                            errorMsg.innerText = '❌ 释义错误，再想一想';
                        }
                    }
                };
                optionsContainer.appendChild(btn);
            });

            overlay.appendChild(title);
            overlay.appendChild(question);
            overlay.appendChild(exampleText);
            overlay.appendChild(optionsContainer);
            overlay.appendChild(errorMsg);
            overlay.appendChild(masteredBtn);
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';
        }

        checkAndBlock();

        // 监听前端路由变化
        const origPushState = history.pushState.bind(history);
        const origReplaceState = history.replaceState.bind(history);
        history.pushState = function() {
            origPushState.apply(history, arguments);
            setTimeout(checkAndBlock, 500);
        };
        history.replaceState = function() {
            origReplaceState.apply(history, arguments);
            setTimeout(checkAndBlock, 500);
        };
        window.addEventListener("popstate", () => setTimeout(checkAndBlock, 500));
    }

    // ⭐ 核心时序修复：等待 200 毫秒后再运行主程序，确保远程文件解析完毕挂载成功
    setTimeout(startMoyuEngine, 200);

})();