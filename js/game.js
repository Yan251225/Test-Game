/**
 * game.js — 游戏初始化与全局状态管理
 */
class OtomeGame {
    constructor() {
        this.engine = new VNEngine();
        this.characters = {};
        this.scripts = {};

        // 游戏状态
        this.state = {
            currentScript: 'prologue',
            affection: { luchen: 0, guyan: 0, linxiao: 0 },
            completedEndings: [],
            playerName: '苏念念'
        };

        this.init();
    }

    async init() {
        // 加载数据
        await this.loadCharacters();
        await this.loadAllScripts();
        this.engine.setCharacters(this.characters);

        // 设置引擎回调
        this.engine.onAffectionChange = (charId, value) => this.changeAffection(charId, value);
        this.engine.onJump = (scriptId) => this.jumpToScript(scriptId);
        this.engine.onEnding = (node) => this.showEnding(node);
        this.engine.onScriptEnd = () => {};

        // 绑定 UI 事件
        this.bindEvents();

        // 生成樱花
        this.createSakura();
    }

    /** 检测自定义图片是否存在 */
    async checkCustomImage(charId) {
        const exts = ['png', 'jpg', 'webp'];
        for (const ext of exts) {
            const url = `img/custom/characters/${charId}.${ext}`;
            try {
                const resp = await fetch(url, { method: 'HEAD' });
                if (resp.ok) return url;
            } catch {}
        }
        return null;
    }

    /** 加载角色数据（自动检测自定义图片） */
    async loadCharacters() {
        try {
            const resp = await fetch('data/characters.json');
            this.characters = await resp.json();
            // 检测自定义图片，优先使用
            for (const char of Object.values(this.characters)) {
                const custom = await this.checkCustomImage(char.id);
                if (custom) {
                    char.sprite = custom;
                    console.log(`✨ 使用自定义图片: ${custom}`);
                }
            }
        } catch {
            console.error('加载角色数据失败');
        }
    }

    /** 加载所有剧情脚本 */
    async loadAllScripts() {
        const scriptNames = ['prologue', 'chapter1', 'route_luchen', 'route_guyan', 'route_linxiao'];
        for (const name of scriptNames) {
            try {
                const resp = await fetch(`data/${name}.json`);
                this.scripts[name] = await resp.json();
            } catch {
                console.error(`加载脚本 ${name} 失败`);
            }
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

        // 暂停菜单
        document.getElementById('btn-resume').addEventListener('click', () => this.closePauseMenu());
        document.getElementById('btn-pause-save').addEventListener('click', () => {
            this.closePauseMenu();
            this.openSaveScreen();
        });
        document.getElementById('btn-pause-load').addEventListener('click', () => {
            this.closePauseMenu();
            this.openLoadScreen();
        });
        document.getElementById('btn-affection').addEventListener('click', () => {
            this.closePauseMenu();
            this.toggleAffectionPanel();
        });
        document.getElementById('btn-back-title').addEventListener('click', () => {
            this.closePauseMenu();
            this.backToTitle();
        });

        // 存档/读档界面返回
        document.getElementById('btn-save-back').addEventListener('click', () => this.closeSaveScreen());

        // 角色图鉴返回
        document.getElementById('btn-gallery-back').addEventListener('click', () => this.closeGallery());

        // 结局返回标题
        document.getElementById('btn-ending-title').addEventListener('click', () => this.backToTitle());
    }

    /** 开始新游戏 */
    newGame() {
        this.state = {
            currentScript: 'prologue',
            affection: { luchen: 0, guyan: 0, linxiao: 0 },
            completedEndings: [],
            playerName: '苏念念'
        };
        this.switchScreen('game-screen');
        this.updateAffectionUI();
        this.engine.startScript(this.scripts['prologue']);
    }

    /** 跳转到指定脚本 */
    jumpToScript(scriptId) {
        if (this.scripts[scriptId]) {
            this.state.currentScript = scriptId;
            this.engine.startScript(this.scripts[scriptId]);
        }
    }

    /** 好感度变化 */
    changeAffection(charId, value) {
        if (this.state.affection[charId] !== undefined) {
            this.state.affection[charId] = Math.max(0, Math.min(100,
                this.state.affection[charId] + value));
            this.updateAffectionUI();
            this.showAffectionNotification(charId, value);
        }
    }

    /** 更新好感度 UI */
    updateAffectionUI() {
        for (const [charId, value] of Object.entries(this.state.affection)) {
            const item = document.getElementById(`aff-${charId}`);
            if (item) {
                item.querySelector('.aff-fill').style.width = `${value}%`;
                item.querySelector('.aff-value').textContent = value;
            }
        }
    }

    /** 显示好感度变化通知 */
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

        setTimeout(() => {
            notif.classList.add('hidden');
        }, 1500);
    }

    /** 显示结局 */
    showEnding(node) {
        const charId = node.charId;
        const aff = this.state.affection[charId] || 0;
        const char = this.characters[charId];

        let endingType, endingEmoji, endingTitle, endingText, endingClass;

        if (aff >= 80) {
            endingType = '好结局';
            endingEmoji = '💕';
            endingClass = 'ending-good';
            endingTitle = this.getGoodEndingTitle(charId);
            endingText = this.getGoodEndingText(charId, char);
        } else if (aff >= 40) {
            endingType = '普通结局';
            endingEmoji = '🌸';
            endingClass = 'ending-normal';
            endingTitle = this.getNormalEndingTitle(charId);
            endingText = this.getNormalEndingText(charId, char);
        } else {
            endingType = '坏结局';
            endingEmoji = '💔';
            endingClass = 'ending-bad';
            endingTitle = this.getBadEndingTitle(charId);
            endingText = this.getBadEndingText(charId, char);
        }

        const endingScreen = document.getElementById('ending-screen');
        endingScreen.className = `screen ${endingClass}`;
        document.getElementById('ending-type').textContent = endingEmoji;
        document.getElementById('ending-title').textContent = endingTitle;
        document.getElementById('ending-text').textContent = endingText;

        this.switchScreen('ending-screen');

        // 记录已完成的结局
        const endingKey = `${charId}_${aff >= 80 ? 'good' : aff >= 40 ? 'normal' : 'bad'}`;
        if (!this.state.completedEndings.includes(endingKey)) {
            this.state.completedEndings.push(endingKey);
        }
    }

    getGoodEndingTitle(charId) {
        const titles = {
            luchen: '心之归处',
            guyan: '星辰相伴',
            linxiao: '阳光永恒'
        };
        return titles[charId] || '好结局';
    }
    getNormalEndingTitle(charId) {
        const titles = {
            luchen: '温柔以待',
            guyan: '默默守望',
            linxiao: '朋友以上'
        };
        return titles[charId] || '普通结局';
    }
    getBadEndingTitle(charId) {
        const titles = {
            luchen: '擦肩而过',
            guyan: '沉默如初',
            linxiao: '渐行渐远'
        };
        return titles[charId] || '坏结局';
    }

    getGoodEndingText(charId, char) {
        const texts = {
            luchen: `陆辰逸终于摘下了"完美学生会长"的面具，在你面前展露了真正的自己。毕业那天，他在樱花树下对你说："谢谢你让我知道，不完美也可以被爱。"从此，你们手牵着手，走向属于两个人的未来。`,
            guyan: `顾晏时封闭已久的心门，终于为你缓缓打开。他带你去了姐姐最喜欢的星空观测点，说："她一定很高兴，因为我终于找到了想要守护的人。"夜空繁星闪烁，你们并肩而坐，从此不再孤独。`,
            linxiao: `林笑寒用最灿烂的笑容，最真挚的心意，温暖了你的每一天。毕业典礼上，他在全校面前大喊："苏念念，我喜欢你！"虽然粗心大意的他忘了准备花束——但谁在乎呢？你笑着跑向他的怀抱。`
        };
        return texts[charId] || '';
    }
    getNormalEndingText(charId, char) {
        const texts = {
            luchen: `你和陆辰逸成为了很好的朋友。他偶尔会摘下面具和你聊天，但那份特别的感情，始终停留在了友谊的边界。也许在某个未来的春天，故事会有不同的走向。`,
            guyan: `顾晏时愿意在图书馆为你留一个座位了。虽然他依旧安静，但你知道，他的世界里已经有了你的一角。这份静谧的情感，像星光一样微弱却恒久。`,
            linxiao: `林笑寒始终是你最好的朋友，他的笑容依旧灿烂如阳光。但每次看到你的时候，他的眼神里总有一丝说不清道不明的温柔。也许有一天，他会鼓起勇气……`
        };
        return texts[charId] || '';
    }
    getBadEndingText(charId, char) {
        const texts = {
            luchen: `陆辰逸依旧是那个完美的学生会长，而你只是他礼貌微笑的对象之一。也许，你从未真正走进过他的世界。`,
            guyan: `顾晏时依旧一个人坐在图书馆的角落。你们之间的距离，和第一天一样遥远。那扇紧闭的心门，终究没有为你打开。`,
            linxiao: `林笑寒还是那个对谁都热情的阳光少年，但你们的关系始终没有更进一步。渐渐地，你们各自有了新的朋友，那段短暂的交集成为了记忆中的一抹亮色。`
        };
        return texts[charId] || '';
    }

    /** 切换画面 */
    switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    /** 返回标题 */
    backToTitle() {
        this.engine.hideAllCharacters();
        this.switchScreen('title-screen');
    }

    /** 暂停菜单 */
    openPauseMenu() {
        document.getElementById('pause-menu').classList.add('active');
    }
    closePauseMenu() {
        document.getElementById('pause-menu').classList.remove('active');
    }

    /** 好感度面板 */
    toggleAffectionPanel() {
        const panel = document.getElementById('affection-panel');
        panel.classList.toggle('hidden');
    }

    /** 存档画面 */
    openSaveScreen() {
        document.getElementById('save-screen-title').textContent = '💾 存档';
        this.renderSaveSlots('save');
        document.getElementById('save-screen').classList.add('active');
    }

    /** 读档画面 */
    openLoadScreen() {
        document.getElementById('save-screen-title').textContent = '📖 读档';
        this.renderSaveSlots('load');
        document.getElementById('save-screen').classList.add('active');
    }

    closeSaveScreen() {
        document.getElementById('save-screen').classList.remove('active');
    }

    /** 渲染存档槽位 */
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
                    .map(([id, v]) => `${this.characters[id]?.emoji || ''}${v}`)
                    .join(' ');
                slot.innerHTML = `
                    <div class="slot-info">
                        <div class="slot-label">存档 ${i} — ${save.currentScript || '未知'}</div>
                        <div class="slot-detail">${save.dateStr || '未知时间'} | ${affStr}</div>
                    </div>
                `;
            } else {
                slot.innerHTML = `<div class="slot-info"><div class="slot-empty">存档 ${i} — 空</div></div>`;
            }

            slot.addEventListener('click', () => {
                if (mode === 'save') {
                    SaveSystem.save(slotId, {
                        ...this.state,
                        engineState: this.engine.getState()
                    });
                    this.renderSaveSlots('save');
                } else if (mode === 'load' && save) {
                    this.loadGameState(save);
                    this.closeSaveScreen();
                }
            });

            container.appendChild(slot);
        }
    }

    /** 快速存档 */
    quickSave() {
        SaveSystem.quickSave({
            ...this.state,
            engineState: this.engine.getState()
        });
        this.showAffectionNotification('luchen', 0);
        const text = document.getElementById('aff-notif-text');
        text.textContent = '⚡ 快速存档完成';
        const notif = document.getElementById('affection-notification');
        notif.className = 'affection-notification';
        notif.classList.remove('hidden');
        setTimeout(() => notif.classList.add('hidden'), 1200);
    }

    /** 加载游戏状态 */
    loadGameState(save) {
        this.state = {
            currentScript: save.currentScript,
            affection: { ...save.affection },
            completedEndings: save.completedEndings || [],
            playerName: save.playerName || '苏念念'
        };
        this.updateAffectionUI();
        this.switchScreen('game-screen');

        const script = this.scripts[this.state.currentScript];
        if (script && save.engineState) {
            this.engine.startScript(script, save.engineState.currentIndex);
        }
    }

    /** 角色图鉴 */
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

    /** 创建樱花动画 */
    createSakura() {
        const container = document.querySelector('.sakura-falling');
        if (!container) return;

        const petals = ['🌸', '✿', '❀', '🏵️'];
        for (let i = 0; i < 20; i++) {
            const petal = document.createElement('span');
            petal.textContent = petals[Math.floor(Math.random() * petals.length)];
            petal.style.cssText = `
                position: absolute;
                left: ${Math.random() * 100}%;
                top: -5%;
                font-size: ${0.8 + Math.random() * 1.2}rem;
                opacity: ${0.4 + Math.random() * 0.6};
                animation: sakuraFall ${5 + Math.random() * 10}s linear infinite;
                animation-delay: ${Math.random() * 10}s;
                pointer-events: none;
            `;
            container.appendChild(petal);
        }
    }
}

// 游戏启动
window.addEventListener('DOMContentLoaded', () => {
    window.game = new OtomeGame();
});
