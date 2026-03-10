/**
 * game.js — 游戏初始化与全局状态管理（含日程/属性/打扮系统）
 */
class OtomeGame {
    constructor() {
        this.engine = new VNEngine();
        this.schedule = new ScheduleSystem(this);
        this.dresser = new DresserSystem(this);
        this.audio = new AudioSystem();
        this.characters = {};
        this.scripts = {};

        // 游戏模式: 'vn' = 视觉小说, 'schedule' = 日程安排
        this.mode = 'vn';

        // 游戏状态
        this.state = {
            currentScript: 'prologue',
            affection: { luchen: 0, guyan: 0, linxiao: 0, xinghe: 0, xuanmo: 0, edwin: 0 },
            completedEndings: [],
            playerName: '苏念念'
        };

        this.init();
    }

    async init() {
        await this.loadCharacters();
        await this.loadAllScripts();
        await this.schedule.loadData();
        await this.dresser.loadData();

        this.engine.setCharacters(this.characters);

        // 引擎回调
        this.engine.onAffectionChange = (charId, value) => this.changeAffection(charId, value);
        this.engine.onJump = (scriptId) => this.jumpToScript(scriptId);
        this.engine.onEnding = (node) => this.showEnding(node);
        // 序章结束后进入日程模式
        this.engine.onScriptEnd = () => this.onScriptEnd();

        this.bindEvents();
        this.createSakura();
    }

    async checkCustomImage(charId) {
        const exts = ['png', 'jpg', 'webp'];
        for (const ext of exts) {
            const url = `img/custom/characters/${charId}.${ext}`;
            try { const r = await fetch(url, { method: 'HEAD' }); if (r.ok) return url; } catch {}
        }
        return null;
    }

    async loadCharacters() {
        try {
            const resp = await fetch('data/characters.json');
            this.characters = await resp.json();
            for (const char of Object.values(this.characters)) {
                const custom = await this.checkCustomImage(char.id);
                if (custom) { char.sprite = custom; }
            }
        } catch { console.error('加载角色数据失败'); }
    }

    async loadAllScripts() {
        const scriptNames = ['prologue', 'chapter1', 'route_luchen', 'route_guyan', 'route_linxiao'];
        for (const name of scriptNames) {
            try { const r = await fetch(`data/${name}.json`); this.scripts[name] = await r.json(); }
            catch { console.error(`加载脚本 ${name} 失败`); }
        }
    }

    /** 绑定 UI 事件 */
    bindEvents() {
        // 标题画面
        document.getElementById('btn-new-game').addEventListener('click', () => this.newGame());
        document.getElementById('btn-load-game').addEventListener('click', () => this.openLoadScreen());
        document.getElementById('btn-gallery').addEventListener('click', () => this.openGallery());

        // 游戏内按钮
        document.getElementById('btn-save').addEventListener('click', () => this.openSaveScreen());
        document.getElementById('btn-quick-save').addEventListener('click', () => this.quickSave());
        document.getElementById('btn-menu').addEventListener('click', () => this.openPauseMenu());
        document.getElementById('btn-bgm').addEventListener('click', () => {
            const on = this.audio.toggleBgm();
            document.getElementById('btn-bgm').textContent = on ? '🎵' : '🔇';
            if (on && this.mode === 'schedule') this.audio.playBgm('normal');
        });
        document.getElementById('btn-voice').addEventListener('click', () => {
            const on = this.audio.toggleVoice();
            document.getElementById('btn-voice').textContent = on ? '🎙️' : '🔕';
        });

        // 暂停菜单
        document.getElementById('btn-resume').addEventListener('click', () => this.closePauseMenu());
        document.getElementById('btn-pause-save').addEventListener('click', () => { this.closePauseMenu(); this.openSaveScreen(); });
        document.getElementById('btn-pause-load').addEventListener('click', () => { this.closePauseMenu(); this.openLoadScreen(); });
        document.getElementById('btn-affection').addEventListener('click', () => { this.closePauseMenu(); this.toggleAffectionPanel(); });
        document.getElementById('btn-stats').addEventListener('click', () => { this.closePauseMenu(); this.openStatsScreen(); });
        document.getElementById('btn-open-dresser').addEventListener('click', () => { this.closePauseMenu(); this.openDresserScreen(); });
        document.getElementById('btn-back-title').addEventListener('click', () => { this.closePauseMenu(); this.backToTitle(); });

        // 存档/图鉴
        document.getElementById('btn-save-back').addEventListener('click', () => this.closeSaveScreen());
        document.getElementById('btn-gallery-back').addEventListener('click', () => this.closeGallery());
        document.getElementById('btn-ending-title').addEventListener('click', () => this.backToTitle());

        // 日程界面
        document.getElementById('btn-next-period').addEventListener('click', () => this.nextPeriod());
        document.getElementById('btn-schedule-dresser').addEventListener('click', () => this.openDresserScreen());

        // 打扮界面
        document.getElementById('btn-dresser-back').addEventListener('click', () => this.closeDresserScreen());

        // 属性详情
        document.getElementById('btn-stats-back').addEventListener('click', () => this.closeStatsScreen());

        // 特殊事件
        document.getElementById('btn-event-continue').addEventListener('click', () => this.resolveEvent());
    }

    // ============================
    // 游戏流程
    // ============================

    /** 开始新游戏 */
    newGame() {
        this.state = {
            currentScript: 'prologue',
            affection: { luchen: 0, guyan: 0, linxiao: 0, xinghe: 0, xuanmo: 0, edwin: 0 },
            completedEndings: [],
            playerName: '苏念念'
        };
        this.schedule.week = 1;
        this.schedule.timeSlot = 'morning';
        this.schedule.stats = { intelligence: 30, fitness: 30, charm: 30, art: 30, social: 30 };
        this.schedule.stress = 0;
        this.dresser.currentOutfit = 'school-uniform';
        this.dresser.currentHairstyle = 'ponytail';
        this.dresser.shoppingCount = 0;
        // re-lock outfits
        this.dresser.outfits.forEach(o => { o.unlocked = o.id === 'school-uniform'; });
        this.dresser.hairstyles.forEach(h => { h.unlocked = ['ponytail','twintails','long-straight'].includes(h.id); });

        this.mode = 'vn';
        this.switchScreen('game-screen');
        this.updateAffectionUI();
        this.audio.playBgm('title');
        this.engine.startScript(this.scripts['prologue']);
    }

    /** 脚本结束回调 — 序章/chapter1 结束后进入日程 */
    onScriptEnd() {
        if (this.state.currentScript === 'prologue') {
            // 自动跳到 chapter1
            this.jumpToScript('chapter1');
        } else if (this.state.currentScript === 'chapter1') {
            // chapter1 结束后进入日程模式
            this.enterScheduleMode();
        } else {
            // 角色路线等其他脚本结束
        }
    }

    /** 进入日程安排模式 */
    enterScheduleMode() {
        this.mode = 'schedule';
        this.audio.playBgm('normal');
        // 先检查特殊事件
        const event = this.schedule.checkSpecialEvent();
        if (event) {
            this.showSpecialEvent(event);
        } else {
            this.showScheduleScreen();
        }
    }

    /** 显示日程界面 */
    showScheduleScreen() {
        if (this.schedule.isGameOver()) {
            this.triggerFinalEnding();
            return;
        }
        this.switchScreen('schedule-screen');
        this.updateScheduleUI();
    }

    /** 更新日程界面 */
    updateScheduleUI() {
        // 时间
        document.getElementById('schedule-time').textContent = this.schedule.getTimeSlotName();
        const progress = this.schedule.getProgress();
        document.getElementById('schedule-progress-fill').style.width = `${progress}%`;
        document.getElementById('schedule-progress-text').textContent = `${progress}%`;

        // 属性面板
        const stats = this.schedule.stats;
        const maxStat = 200;
        for (const [key, val] of Object.entries(stats)) {
            const fill = document.getElementById(`stat-${key}`);
            const valEl = document.getElementById(`stat-val-${key}`);
            if (fill) fill.style.width = `${Math.min(100, val / maxStat * 100)}%`;
            if (valEl) valEl.textContent = val;
        }
        document.getElementById('stat-stress').style.width = `${this.schedule.stress}%`;
        document.getElementById('stat-val-stress').textContent = this.schedule.stress;

        // 穿搭
        const outfit = this.dresser.getCurrentOutfit();
        const hair = this.dresser.getCurrentHairstyle();
        document.getElementById('current-outfit-display').textContent =
            `${outfit?.icon || '👔'} ${outfit?.name || '校服'} · ${hair?.icon || '🎀'} ${hair?.name || '马尾'}`;

        // 行动卡片
        this.renderActionCards();

        // 隐藏结果
        document.getElementById('action-result').classList.add('hidden');
        document.getElementById('action-grid').classList.remove('hidden');
        document.querySelector('.section-title').classList.remove('hidden');
    }

    /** 渲染行动卡片 */
    renderActionCards() {
        const grid = document.getElementById('action-grid');
        grid.innerHTML = '';
        const actions = this.schedule.getAvailableActions();
        const isForced = this.schedule.stress >= 90;

        for (const action of actions) {
            const card = document.createElement('div');
            card.className = 'action-card';
            if (isForced && action.id !== 'rest') card.classList.add('disabled');

            // 属性变化预览
            let statsHtml = '';
            for (const [stat, val] of Object.entries(action.stats || {})) {
                const icon = this.schedule.statIcons[stat] || '';
                const cls = val >= 0 ? 'stat-up' : 'stat-down';
                const sign = val >= 0 ? '+' : '';
                statsHtml += `<span class="${cls}">${icon}${sign}${val}</span> `;
            }
            if (action.stress) {
                const cls = action.stress > 0 ? 'stat-down' : 'stat-up';
                const sign = action.stress > 0 ? '+' : '';
                statsHtml += `<span class="${cls}">😰${sign}${action.stress}</span>`;
            }

            card.innerHTML = `
                <div class="action-icon">${action.icon}</div>
                <div class="action-name">${action.name}</div>
                <div class="action-desc">${action.description || ''}</div>
                <div class="action-stats">${statsHtml}</div>
            `;
            card.addEventListener('click', () => this.executeAction(action.id));
            grid.appendChild(card);
        }

        if (isForced) {
            const banner = document.createElement('div');
            banner.style.cssText = 'grid-column:1/-1;color:#ef5350;text-align:center;padding:10px;font-size:0.9rem;';
            banner.textContent = '⚠️ 压力过大！只能选择休息';
            grid.prepend(banner);
        }
    }

    /** 执行行动 */
    executeAction(actionId) {
        const results = this.schedule.executeAction(actionId);
        if (!results) return;

        if (results.forced) {
            this.showNotification(results.message);
            return;
        }

        // 显示结果
        document.getElementById('action-grid').classList.add('hidden');
        document.querySelector('.section-title').classList.add('hidden');

        let html = `<div style="font-size:1.4rem;margin-bottom:10px;">${results.action.icon} ${results.action.name}</div>`;

        for (const [stat, val] of Object.entries(results.statChanges)) {
            const name = this.schedule.statNames[stat] || stat;
            const icon = this.schedule.statIcons[stat] || '';
            const cls = val >= 0 ? 'result-stat' : 'result-stat negative';
            const sign = val >= 0 ? '+' : '';
            html += `<div class="${cls}">${icon} ${name} ${sign}${val}</div>`;
        }
        if (results.stressChange !== 0) {
            const cls = results.stressChange > 0 ? 'result-stat negative' : 'result-stat';
            const sign = results.stressChange > 0 ? '+' : '';
            html += `<div class="${cls}">😰 压力 ${sign}${results.stressChange}</div>`;
        }
        if (results.affGain) {
            const char = this.characters[results.affGain.charId];
            html += `<div class="result-encounter">${char?.emoji || '💕'} ${char?.name || ''} 好感度 +${results.affGain.value}</div>`;
        }
        if (results.encounter) {
            const char = this.characters[results.encounter.charId];
            html += `<div class="result-encounter">${char?.emoji || ''} ${results.encounter.dialogue}</div>`;
        }
        if (results.outfitUnlock) {
            html += `<div class="result-unlock">🎉 解锁了新${results.outfitUnlock.icon ? '服装' : '发型'}：${results.outfitUnlock.name}！</div>`;
        }

        document.getElementById('result-content').innerHTML = html;
        document.getElementById('action-result').classList.remove('hidden');

        // 更新属性面板
        this.updateScheduleUI_statsOnly();
    }

    /** 仅更新属性面板（不重渲染卡片） */
    updateScheduleUI_statsOnly() {
        const stats = this.schedule.stats;
        for (const [key, val] of Object.entries(stats)) {
            const fill = document.getElementById(`stat-${key}`);
            const valEl = document.getElementById(`stat-val-${key}`);
            if (fill) fill.style.width = `${Math.min(100, val / 200 * 100)}%`;
            if (valEl) valEl.textContent = val;
        }
        document.getElementById('stat-stress').style.width = `${this.schedule.stress}%`;
        document.getElementById('stat-val-stress').textContent = this.schedule.stress;
    }

    /** 进入下一个时间段 */
    nextPeriod() {
        const adv = this.schedule.advanceTime();
        this.audio.playBgm('normal');

        if (this.schedule.isGameOver()) {
            this.triggerFinalEnding();
            return;
        }

        // 检查特殊事件
        const event = this.schedule.checkSpecialEvent();
        if (event) {
            this.showSpecialEvent(event);
        } else {
            this.showScheduleScreen();
        }
    }

    // ============================
    // 特殊事件
    // ============================

    showSpecialEvent(event) {
        this._currentEvent = event;
        this._eventResolved = false;
        this.audio.playBgm(event.type === 'ending' ? 'romantic' : 'tension');
        const icons = { exam: '📝', sports: '🏅', culture: '🎭', ending: '💕' };
        document.getElementById('event-icon').textContent = icons[event.type] || '🌟';
        document.getElementById('event-title').textContent = event.name;
        document.getElementById('event-desc').textContent = event.description;
        document.getElementById('event-result').classList.add('hidden');
        document.getElementById('event-result').innerHTML = '';
        document.getElementById('btn-event-continue').textContent = event.type === 'ending' ? '迎接命运…' : '开始!';
        this.switchScreen('event-screen');
    }

    resolveEvent() {
        const event = this._currentEvent;
        if (!event) return;

        if (event.type === 'ending') {
            this.triggerFinalEnding();
            return;
        }

        // 如果已经显示了结果，点击继续进入日程
        if (this._eventResolved) {
            this._eventResolved = false;
            this._currentEvent = null;
            this.showScheduleScreen();
            return;
        }

        const result = this.schedule.resolveSpecialEvent(event);
        const resultEl = document.getElementById('event-result');
        const statName = this.schedule.statNames[result.stat] || result.stat;

        let html = `<div>你的${statName}：<strong>${result.statValue}</strong> / 需要：${result.threshold}</div>`;
        if (result.passed) {
            html += `<div class="pass">🎉 通过了！表现优异！</div>`;
            html += `<div style="color:rgba(255,255,255,0.6);font-size:0.85rem;margin-top:8px;">好感度有所提升~</div>`;
        } else {
            html += `<div class="fail">😰 没能通过…下次继续加油！</div>`;
        }

        resultEl.innerHTML = html;
        resultEl.classList.remove('hidden');
        document.getElementById('btn-event-continue').textContent = '继续 →';
        this._eventResolved = true;
    }

    // ============================
    // 结局系统
    // ============================

    triggerFinalEnding() {
        const result = this.schedule.getEndingResult();
        const charId = result.charId;
        const char = charId ? this.characters[charId] : null;

        let endingEmoji, endingTitle, endingText, endingClass;

        switch (result.type) {
            case 'perfect':
                endingEmoji = '💖';
                endingClass = 'ending-good';
                endingTitle = this.getEndingTitle(charId, 'perfect');
                endingText = this.getPerfectEndingText(charId, char);
                break;
            case 'good':
                endingEmoji = '💕';
                endingClass = 'ending-good';
                endingTitle = this.getEndingTitle(charId, 'good');
                endingText = this.getGoodEndingText(charId, char);
                break;
            case 'normal':
                endingEmoji = '🌸';
                endingClass = 'ending-normal';
                endingTitle = this.getEndingTitle(charId, 'normal');
                endingText = this.getNormalEndingText(charId, char);
                break;
            case 'friend':
                endingEmoji = '🤝';
                endingClass = 'ending-normal';
                endingTitle = this.getEndingTitle(charId, 'friend');
                endingText = this.getFriendEndingText(charId, char);
                break;
            case 'academic':
                endingEmoji = '📖';
                endingClass = 'ending-normal';
                endingTitle = '独立之路';
                endingText = '你没有特别亲近任何人，但在学业上取得了优异的成绩。' +
                    '毕业典礼上，你作为成绩优秀的代表上台发言。' +
                    '也许爱情还在远方等待，但此刻的你，闪闪发光。';
                break;
            default: // passby
                endingEmoji = '💔';
                endingClass = 'ending-bad';
                endingTitle = this.getEndingTitle(charId, 'passby');
                endingText = this.getPassbyEndingText(charId, char);
                break;
        }

        const endingScreen = document.getElementById('ending-screen');
        endingScreen.className = `screen ${endingClass}`;
        document.getElementById('ending-type').textContent = endingEmoji;
        document.getElementById('ending-title').textContent = endingTitle;
        document.getElementById('ending-text').textContent = endingText;
        this.switchScreen('ending-screen');
        this.audio.playBgm('ending');
        if (charId) this.audio.playVoice(charId, 'confession');
        const endingKey = `${charId || 'none'}_${result.type}`;
        if (!this.state.completedEndings.includes(endingKey)) {
            this.state.completedEndings.push(endingKey);
        }
    }

    /** 旧版 showEnding 保留兼容（VN模式的路线结局） */
    showEnding(node) {
        // 如果在日程模式，使用新结局系统
        if (this.mode === 'schedule') {
            this.triggerFinalEnding();
            return;
        }
        // VN模式旧结局
        const charId = node.charId;
        const aff = this.state.affection[charId] || 0;
        const char = this.characters[charId];
        let endingClass, endingTitle, endingText, endingEmoji;
        if (aff >= 80) {
            endingEmoji = '💕'; endingClass = 'ending-good';
            endingTitle = this.getEndingTitle(charId, 'good');
            endingText = this.getGoodEndingText(charId, char);
        } else if (aff >= 40) {
            endingEmoji = '🌸'; endingClass = 'ending-normal';
            endingTitle = this.getEndingTitle(charId, 'normal');
            endingText = this.getNormalEndingText(charId, char);
        } else {
            endingEmoji = '💔'; endingClass = 'ending-bad';
            endingTitle = this.getEndingTitle(charId, 'passby');
            endingText = this.getPassbyEndingText(charId, char);
        }
        const endingScreen = document.getElementById('ending-screen');
        endingScreen.className = `screen ${endingClass}`;
        document.getElementById('ending-type').textContent = endingEmoji;
        document.getElementById('ending-title').textContent = endingTitle;
        document.getElementById('ending-text').textContent = endingText;
        this.switchScreen('ending-screen');
    }

    getEndingTitle(charId, type) {
        const titles = {
            luchen: { perfect: '命运之约', good: '心之归处', normal: '温柔以待', friend: '并肩前行', passby: '擦肩而过' },
            guyan: { perfect: '星光永恒', good: '星辰相伴', normal: '默默守望', friend: '图书馆之友', passby: '沉默如初' },
            linxiao: { perfect: '阳光告白', good: '阳光永恒', normal: '朋友以上', friend: '运动搭档', passby: '渐行渐远' },
            xinghe: { perfect: '只为你歌唱', good: '心动旋律', normal: '玫瑰之约', friend: '音乐知己', passby: '花落无声' },
            xuanmo: { perfect: '王子与公主', good: '冰心融化', normal: '不经意的温柔', friend: '平等之友', passby: '云端之上' },
            edwin: { perfect: '跨越星海', good: '绅士之约', normal: '茶与诗', friend: '异国知己', passby: '礼貌的距离' }
        };
        return titles[charId]?.[type] || type;
    }

    getPerfectEndingText(charId) {
        const texts = {
            luchen: '陆辰逸在夕阳下向你伸出手："我不再是完美的学生会长了……在你面前，我只想做真正的自己。"你们十指相扣，樱花纷飞，整个星辰学院都在为你们祝福。',
            guyan: '顾晏时罕见地露出了温暖的笑容，带你去了天台看满天繁星。"谢谢你来到我的世界……从今以后，我不会再一个人了。"星光见证了这份永恒的约定。',
            linxiao: '林笑寒在全校面前握着你的手大喊："我喜欢你！比任何冠军都重要！"操场上响起热烈的掌声。他红着脸挠头："其实我紧张得要命……"你笑着扑进他的怀里。',
            xinghe: '沈星河站在舞台聚光灯下，不再对着所有人微笑——他只看着你。他弹起吉他唱了一首歌，歌词是你们相遇以来每一个瞬间。"从今以后，这首歌只唱给你。"',
            xuanmo: '慕容轩第一次在你面前红了脸。"我不需要你仰望我……我需要你站在我身边。"他摘下那枚家族戒指，郑重地放在你掌心。"这是我的心。请收好。"',
            edwin: '艾德温单膝跪下，以最标准的骑士礼仪，将一束英国玫瑰献给你。"My lady, would you be my partner for life? ——不，让我用中文说。苏念念，请和我一起，看遍世界的风景。"'
        };
        return texts[charId] || '';
    }
    getGoodEndingText(charId) {
        const texts = {
            luchen: '陆辰逸终于摘下了"完美学生会长"的面具，在你面前展露了真正的自己。毕业那天，他在樱花树下对你说："谢谢你让我知道，不完美也可以被爱。"',
            guyan: '顾晏时封闭已久的心门，终于为你缓缓打开。他带你去了姐姐最喜欢的星空观测点："她一定很高兴，因为我终于找到了想要守护的人。"',
            linxiao: '林笑寒用最灿烂的笑容，最真挚的心意，温暖了你的每一天。毕业典礼上，他大喊："苏念念，我喜欢你！"虽然忘了准备花束——但谁在乎呢？',
            xinghe: '沈星河不再是那个对所有人微笑的校草了。他轻轻握住你的手："以前我以为喜欢是表演，遇到你才知道，是心跳。"他为你写了一首歌，名字叫《星河》。',
            xuanmo: '慕容轩难得露出柔软的表情："我有很多东西，但都不重要……重要的是你还在这里。"他笨拙地递出一个小盒子："不许嘲笑我。这是我第一次自己挑礼物。"',
            edwin: '艾德温望着星辰学院的校门，微笑着说："母亲说来中国会找到珍贵的东西。她说得对。"他转向你，蓝色的眼睛里映着光："Thank you, for being my home."'
        };
        return texts[charId] || '';
    }
    getNormalEndingText(charId) {
        const texts = {
            luchen: '你和陆辰逸成为了很好的朋友。他偶尔会摘下面具和你聊天，但那份特别的感情，始终停留在了友谊的边界。',
            guyan: '顾晏时愿意在图书馆为你留一个座位了。虽然他依旧安静，但你知道，他的世界里已经有了你的一角。',
            linxiao: '林笑寒始终是你最好的朋友，他的笑容依旧灿烂。但每次看到你时，他的眼神里总有一丝说不清道不明的温柔。',
            xinghe: '沈星河还是那个万人迷校草，但他偶尔会只对你弹一首安静的曲子。那些不为人知的温柔，只有你看得到。',
            xuanmo: '慕容轩依旧高冷，但会在你生日时送来一整车的花。附带一张纸条："不要误会，只是花太多了。"',
            edwin: '艾德温回到了英国，但每个周末都会寄来一封手写信和一小盒英国红茶。信的结尾总是："Miss you. See you soon."'
        };
        return texts[charId] || '';
    }
    getFriendEndingText(charId) {
        const texts = {
            luchen: '你和陆辰逸成为了相互信赖的好友。友情，有时候也是一种珍贵的缘分。',
            guyan: '顾晏时开始愿意和你分享他在读的书了。这份默契的友情，比任何语言都温暖。',
            linxiao: '你和林笑寒成为了最好的运动搭档！这份阳光般的友谊，会一直延续下去。',
            xinghe: '你和沈星河成了互相吐槽的好朋友。他不再在你面前耍帅："在你面前可以做最真实的自己，真好。"',
            xuanmo: '慕容轩学会了说"谢谢"。虽然嘴上依旧毒舌，但你知道，在他冰冷的外表下，你是第一个被他当作朋友的人。',
            edwin: '艾德温回国前送你一个精致的怀表："这是霍华德家的传统。送给最重要的朋友。"'
        };
        return texts[charId] || '';
    }
    getPassbyEndingText(charId) {
        const texts = {
            luchen: '陆辰逸依旧是那个完美的学生会长，而你只是他礼貌微笑的对象之一。',
            guyan: '顾晏时依旧一个人坐在图书馆的角落。那扇心门，终究没有为你打开。',
            linxiao: '林笑寒还是那个对谁都热情的阳光少年，但你们的关系始终没有更进一步。',
            xinghe: '沈星河依旧在走廊上对每个女生微笑送花。你只是他的"观众"之一。',
            xuanmo: '慕容轩的豪车依旧每天准时出现又消失，你们之间隔着的距离从未缩短。',
            edwin: '艾德温礼貌地和你道别，回到了英国。也许在某个平行世界，故事会不一样。'
        };
        return texts[charId] || '';
    }

    // ============================
    // 打扮界面
    // ============================

    openDresserScreen() {
        this.renderDresserUI();
        document.getElementById('dresser-screen').classList.add('active');
    }
    closeDresserScreen() {
        document.getElementById('dresser-screen').classList.remove('active');
        if (this.mode === 'schedule') {
            this.updateScheduleUI();
        }
    }

    renderDresserUI() {
        // 服装
        const outfitGrid = document.getElementById('outfit-grid');
        outfitGrid.innerHTML = '';
        for (const o of this.dresser.getAllOutfits()) {
            const div = document.createElement('div');
            div.className = 'dresser-item';
            if (o.id === this.dresser.currentOutfit) div.classList.add('selected');
            if (!o.unlocked) div.classList.add('locked');
            div.innerHTML = `
                <div class="dresser-item-icon">${o.icon}</div>
                <div class="dresser-item-name">${o.name}</div>
                <div class="dresser-item-bonus">魅力 +${o.charmBonus}</div>
                ${!o.unlocked ? '<div class="dresser-item-lock">🔒 逛街解锁</div>' : ''}
            `;
            if (o.unlocked) {
                div.addEventListener('click', () => {
                    this.dresser.setOutfit(o.id);
                    this.renderDresserUI();
                });
            }
            outfitGrid.appendChild(div);
        }

        // 发型
        const hairGrid = document.getElementById('hairstyle-grid');
        hairGrid.innerHTML = '';
        for (const h of this.dresser.getAllHairstyles()) {
            const div = document.createElement('div');
            div.className = 'dresser-item';
            if (h.id === this.dresser.currentHairstyle) div.classList.add('selected');
            if (!h.unlocked) div.classList.add('locked');
            div.innerHTML = `
                <div class="dresser-item-icon">${h.icon}</div>
                <div class="dresser-item-name">${h.name}</div>
                <div class="dresser-item-bonus">魅力 +${h.charmBonus}</div>
                ${!h.unlocked ? '<div class="dresser-item-lock">🔒 逛街解锁</div>' : ''}
            `;
            if (h.unlocked) {
                div.addEventListener('click', () => {
                    this.dresser.setHairstyle(h.id);
                    this.renderDresserUI();
                });
            }
            hairGrid.appendChild(div);
        }

        // 预览
        document.getElementById('preview-charm-val').textContent = `+${this.dresser.getTotalCharmBonus()}`;
        const prefsHtml = ['luchen','guyan','linxiao','xinghe','xuanmo','edwin'].map(id => {
            const char = this.characters[id];
            const bonus = this.dresser.getCharPreferenceBonus(id);
            const emoji = bonus > 3 ? '❤️❤️' : bonus > 0 ? '❤️' : bonus < 0 ? '💔' : '—';
            return `${char?.emoji || ''} ${char?.name || id}: ${emoji}`;
        }).join(' &nbsp;|&nbsp; ');
        document.getElementById('preview-prefs').innerHTML = prefsHtml;
    }

    // ============================
    // 属性详情界面
    // ============================

    openStatsScreen() {
        this.renderStatsDetail();
        document.getElementById('stats-screen').classList.add('active');
    }
    closeStatsScreen() {
        document.getElementById('stats-screen').classList.remove('active');
    }

    renderStatsDetail() {
        const grid = document.getElementById('stats-detail-grid');
        grid.innerHTML = '';
        const stats = this.schedule.stats;
        const statKeys = ['intelligence','fitness','charm','art','social'];
        const colors = { intelligence: 'stat-int', fitness: 'stat-fit', charm: 'stat-chr', art: 'stat-art', social: 'stat-soc' };

        for (const key of statKeys) {
            const val = stats[key] || 0;
            const row = document.createElement('div');
            row.className = 'stat-detail-row';
            row.innerHTML = `
                <span class="stat-detail-icon">${this.schedule.statIcons[key]}</span>
                <span class="stat-detail-label">${this.schedule.statNames[key]}</span>
                <div class="stat-detail-bar"><div class="stat-fill ${colors[key]}" style="width:${Math.min(100, val/200*100)}%"></div></div>
                <span class="stat-detail-val">${val}/200</span>
            `;
            grid.appendChild(row);
        }
        // 压力
        const stressRow = document.createElement('div');
        stressRow.className = 'stat-detail-row';
        stressRow.innerHTML = `
            <span class="stat-detail-icon">😰</span>
            <span class="stat-detail-label">压力</span>
            <div class="stat-detail-bar"><div class="stat-fill stat-stress" style="width:${this.schedule.stress}%"></div></div>
            <span class="stat-detail-val">${this.schedule.stress}/100</span>
        `;
        grid.appendChild(stressRow);

        // 攻略条件
        const reqList = document.getElementById('stats-requirements-list');
        reqList.innerHTML = '';
        const reqs = {
            luchen: [['intelligence', 120, '学力'], ['art', 80, '艺术']],
            guyan: [['art', 120, '艺术'], ['intelligence', 80, '学力']],
            linxiao: [['fitness', 120, '体力'], ['social', 80, '社交']],
            xinghe: [['charm', 120, '魅力'], ['social', 80, '社交']],
            xuanmo: [['intelligence', 100, '学力'], ['charm', 100, '魅力']],
            edwin: [['intelligence', 100, '学力'], ['art', 100, '艺术']]
        };
        for (const [charId, charReqs] of Object.entries(reqs)) {
            const char = this.characters[charId];
            const div = document.createElement('div');
            div.className = 'req-char';
            const items = charReqs.map(([stat, threshold, label]) => {
                const met = stats[stat] >= threshold;
                return `<span class="${met ? 'req-met' : 'req-unmet'}">${label}≥${threshold}(${stats[stat]}) ${met ? '✅' : '❌'}</span>`;
            }).join(' &nbsp; ');
            const aff = this.state.affection[charId] || 0;
            const affMet = aff >= 80;
            div.innerHTML = `
                <div class="req-char-name">${char?.emoji || ''} ${char?.name || charId} <span class="${affMet ? 'req-met' : 'req-unmet'}">好感${aff}/80 ${affMet ? '✅' : '❌'}</span></div>
                <div class="req-char-items">${items}</div>
            `;
            reqList.appendChild(div);
        }
    }

    // ============================
    // 基础功能
    // ============================

    jumpToScript(scriptId) {
        if (this.scripts[scriptId]) {
            this.state.currentScript = scriptId;
            this.engine.startScript(this.scripts[scriptId]);
        }
    }

    changeAffection(charId, value) {
        if (this.state.affection[charId] !== undefined) {
            this.state.affection[charId] = Math.max(0, Math.min(100,
                this.state.affection[charId] + value));
            this.updateAffectionUI();
            if (Math.abs(value) > 0) this.showAffectionNotification(charId, value);
        }
    }

    updateAffectionUI() {
        for (const [charId, value] of Object.entries(this.state.affection)) {
            const item = document.getElementById(`aff-${charId}`);
            if (item) {
                item.querySelector('.aff-fill').style.width = `${value}%`;
                item.querySelector('.aff-value').textContent = value;
            }
        }
    }

    showAffectionNotification(charId, value) {
        const char = this.characters[charId];
        if (!char) return;
        const notif = document.getElementById('affection-notification');
        const text = document.getElementById('aff-notif-text');
        const sign = value > 0 ? '+' : '';
        text.textContent = `${char.emoji} ${char.name} 好感度 ${sign}${value}`;
        notif.className = 'affection-notification';
        notif.classList.add(value > 0 ? 'positive' : 'negative');
        notif.classList.remove('hidden');
        setTimeout(() => notif.classList.add('hidden'), 1500);
    }

    showNotification(msg) {
        const notif = document.getElementById('affection-notification');
        const text = document.getElementById('aff-notif-text');
        text.textContent = msg;
        notif.className = 'affection-notification';
        notif.classList.remove('hidden');
        setTimeout(() => notif.classList.add('hidden'), 2000);
    }

    switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    backToTitle() {
        this.engine.hideAllCharacters();
        this.mode = 'vn';
        this.switchScreen('title-screen');
    }

    openPauseMenu() {
        document.getElementById('pause-menu').classList.add('active');
    }
    closePauseMenu() {
        document.getElementById('pause-menu').classList.remove('active');
    }

    toggleAffectionPanel() {
        const panel = document.getElementById('affection-panel');
        panel.classList.toggle('hidden');
    }

    // ============================
    // 存档系统
    // ============================

    openSaveScreen() {
        document.getElementById('save-screen-title').textContent = '💾 存档';
        this.renderSaveSlots('save');
        document.getElementById('save-screen').classList.add('active');
    }
    openLoadScreen() {
        document.getElementById('save-screen-title').textContent = '📖 读档';
        this.renderSaveSlots('load');
        document.getElementById('save-screen').classList.add('active');
    }
    closeSaveScreen() {
        document.getElementById('save-screen').classList.remove('active');
    }

    _getSaveData() {
        return {
            ...this.state,
            mode: this.mode,
            engineState: this.engine.getState(),
            scheduleState: {
                week: this.schedule.week,
                timeSlot: this.schedule.timeSlot,
                stats: { ...this.schedule.stats },
                stress: this.schedule.stress
            },
            dresserState: this.dresser.serialize()
        };
    }

    renderSaveSlots(mode) {
        const container = document.getElementById('save-slots');
        container.innerHTML = '';
        const saves = SaveSystem.getAllSaves();

        for (let i = 1; i <= SaveSystem.MAX_SLOTS; i++) {
            const slotId = `slot_${i}`;
            const save = saves[slotId];
            const slot = document.createElement('div');
            slot.className = 'save-slot';

            if (save) {
                const affStr = Object.entries(save.affection || {})
                    .map(([id, v]) => `${this.characters[id]?.emoji || ''}${v}`).join(' ');
                const weekStr = save.scheduleState ? `第${save.scheduleState.week}周` : save.currentScript;
                slot.innerHTML = `<div class="slot-info">
                    <div class="slot-label">存档 ${i} — ${weekStr}</div>
                    <div class="slot-detail">${save.dateStr || ''} | ${affStr}</div>
                </div>`;
            } else {
                slot.innerHTML = `<div class="slot-info"><div class="slot-empty">存档 ${i} — 空</div></div>`;
            }

            slot.addEventListener('click', () => {
                if (mode === 'save') {
                    SaveSystem.save(slotId, this._getSaveData());
                    this.renderSaveSlots('save');
                } else if (mode === 'load' && save) {
                    this.loadGameState(save);
                    this.closeSaveScreen();
                }
            });
            container.appendChild(slot);
        }
    }

    quickSave() {
        SaveSystem.quickSave(this._getSaveData());
        this.showNotification('⚡ 快速存档完成');
    }

    loadGameState(save) {
        this.state = {
            currentScript: save.currentScript,
            affection: { ...save.affection },
            completedEndings: save.completedEndings || [],
            playerName: save.playerName || '苏念念'
        };
        this.mode = save.mode || 'vn';

        // 恢复日程状态
        if (save.scheduleState) {
            this.schedule.week = save.scheduleState.week;
            this.schedule.timeSlot = save.scheduleState.timeSlot;
            this.schedule.stats = { ...save.scheduleState.stats };
            this.schedule.stress = save.scheduleState.stress;
        }
        // 恢复打扮状态
        if (save.dresserState) {
            this.dresser.deserialize(save.dresserState);
        }

        this.updateAffectionUI();

        if (this.mode === 'schedule') {
            this.showScheduleScreen();
        } else {
            this.switchScreen('game-screen');
            const script = this.scripts[this.state.currentScript];
            if (script && save.engineState) {
                this.engine.startScript(script, save.engineState.currentIndex);
            }
        }
    }

    // ============================
    // 图鉴 & 视觉
    // ============================

    openGallery() {
        const container = document.getElementById('gallery-cards');
        container.innerHTML = '';
        for (const char of Object.values(this.characters)) {
            const card = document.createElement('div');
            card.className = 'gallery-card';
            card.style.borderColor = char.color + '40';
            card.innerHTML = `
                <div class="card-header">
                    <span class="card-emoji">${char.sprite ? `<img src="${char.sprite}" style="width:80px;height:auto;" alt="${char.name}"/>` : char.emoji}</span>
                    <div>
                        <div class="card-name" style="color:${char.accentColor}">${char.name}</div>
                        <div class="card-title">${char.title} · ${char.personality}</div>
                    </div>
                </div>
                <div class="card-desc">${char.description}</div>
                <div class="card-quote">「${char.quote}」</div>
            `;
            container.appendChild(card);
        }
        document.getElementById('gallery-screen').classList.add('active');
    }
    closeGallery() {
        document.getElementById('gallery-screen').classList.remove('active');
    }

    createSakura() {
        const container = document.querySelector('.sakura-falling');
        if (!container) return;
        const petals = ['🌸', '✿', '❀', '🏵️'];
        for (let i = 0; i < 20; i++) {
            const petal = document.createElement('span');
            petal.textContent = petals[Math.floor(Math.random() * petals.length)];
            petal.style.cssText = `
                position: absolute; left: ${Math.random()*100}%; top: -5%;
                font-size: ${0.8+Math.random()*1.2}rem; opacity: ${0.4+Math.random()*0.6};
                animation: sakuraFall ${5+Math.random()*10}s linear infinite;
                animation-delay: ${Math.random()*10}s; pointer-events: none;
            `;
            container.appendChild(petal);
        }
    }
}

// 游戏启动
window.addEventListener('DOMContentLoaded', () => {
    window.game = new OtomeGame();
});
