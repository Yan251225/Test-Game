/**
 * engine.js — 视觉小说引擎核心
 */
class VNEngine {
    constructor() {
        // DOM 元素
        this.sceneBg = document.getElementById('scene-bg');
        this.sceneName = document.getElementById('scene-name');
        this.speakerName = document.getElementById('speaker-name');
        this.dialogueText = document.getElementById('dialogue-text');
        this.clickIndicator = document.getElementById('click-indicator');
        this.choicesPanel = document.getElementById('choices-panel');
        this.charLeft = document.getElementById('char-left');
        this.charCenter = document.getElementById('char-center');
        this.charRight = document.getElementById('char-right');
        this.dialogueBox = document.getElementById('dialogue-box');
        this.affNotification = document.getElementById('affection-notification');
        this.affNotifText = document.getElementById('aff-notif-text');

        // 状态
        this.currentScript = [];
        this.currentIndex = 0;
        this.isTyping = false;
        this.typeTimer = null;
        this.fullText = '';
        this.typeSpeed = 40;
        this.characters = {};
        this.waitingForChoice = false;
        this.onScriptEnd = null;

        // 绑定点击事件
        this.dialogueBox.addEventListener('click', () => this.handleClick());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') this.handleClick();
        });
    }

    /** 加载角色数据 */
    setCharacters(chars) {
        this.characters = chars;
    }

    /** 加载并开始剧情脚本 */
    startScript(script, startIndex = 0) {
        this.currentScript = script;
        this.currentIndex = startIndex;
        this.waitingForChoice = false;
        this.processNode();
    }

    /** 处理当前节点 */
    processNode() {
        if (this.currentIndex >= this.currentScript.length) {
            if (this.onScriptEnd) this.onScriptEnd();
            return;
        }

        const node = this.currentScript[this.currentIndex];

        switch (node.type) {
            case 'dialogue':
                this.showDialogue(node);
                break;
            case 'narration':
                this.showNarration(node);
                break;
            case 'choice':
                this.showChoices(node);
                break;
            case 'scene':
                this.changeScene(node);
                this.currentIndex++;
                this.processNode();
                break;
            case 'character':
                this.showCharacter(node);
                this.currentIndex++;
                this.processNode();
                break;
            case 'hide_character':
                this.hideCharacter(node);
                this.currentIndex++;
                this.processNode();
                break;
            case 'affection':
                this.changeAffection(node);
                this.currentIndex++;
                // 短暂延迟后继续
                setTimeout(() => this.processNode(), 800);
                break;
            case 'jump':
                if (node.scriptId) {
                    if (this.onJump) this.onJump(node.scriptId);
                }
                break;
            case 'ending':
                if (this.onEnding) this.onEnding(node);
                break;
            default:
                this.currentIndex++;
                this.processNode();
        }
    }

    /** 显示对话 */
    showDialogue(node) {
        const charId = node.speaker;
        const char = this.characters[charId];

        // 设置说话者名字和颜色
        this.speakerName.textContent = char ? char.name : (node.speakerName || '');
        this.speakerName.className = 'speaker-name';
        if (charId) {
            this.speakerName.classList.add(`color-${charId}`);
        }

        // 自动播放配音
        if (charId && window.game?.audio) {
            window.game.audio.playVoiceForDialogue(charId, node.text);
        }

        // 逐字显示文字
        this.typeText(node.text);
    }

    /** 显示旁白 */
    showNarration(node) {
        this.speakerName.textContent = '';
        this.speakerName.className = 'speaker-name color-narration';

        if (node.asThought) {
            // 内心独白
            this.speakerName.textContent = node.speakerName || '（内心）';
            this.speakerName.classList.add('color-heroine');
        }

        this.typeText(node.text);
    }

    /** 逐字打字效果 */
    typeText(text) {
        this.isTyping = true;
        this.fullText = text;
        this.dialogueText.textContent = '';
        this.clickIndicator.style.opacity = '0';

        let i = 0;
        clearInterval(this.typeTimer);

        this.typeTimer = setInterval(() => {
            if (i < text.length) {
                this.dialogueText.textContent += text[i];
                i++;
            } else {
                clearInterval(this.typeTimer);
                this.isTyping = false;
                this.clickIndicator.style.opacity = '1';
            }
        }, this.typeSpeed);
    }

    /** 处理点击 */
    handleClick() {
        if (this.waitingForChoice) return;

        if (this.isTyping) {
            // 跳过打字效果
            clearInterval(this.typeTimer);
            this.dialogueText.textContent = this.fullText;
            this.isTyping = false;
            this.clickIndicator.style.opacity = '1';
        } else {
            // 下一句
            this.currentIndex++;
            this.processNode();
        }
    }

    /** 显示选项 */
    showChoices(node) {
        this.waitingForChoice = true;
        this.choicesPanel.innerHTML = '';
        this.choicesPanel.classList.remove('hidden');
        this.dialogueBox.style.display = 'none';

        node.choices.forEach((choice, idx) => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = choice.text;
            btn.addEventListener('click', () => {
                this.choicesPanel.classList.add('hidden');
                this.dialogueBox.style.display = '';
                this.waitingForChoice = false;

                // 处理好感度变化
                if (choice.affection) {
                    for (const [charId, value] of Object.entries(choice.affection)) {
                        if (this.onAffectionChange) {
                            this.onAffectionChange(charId, value);
                        }
                    }
                }

                // 如果选项有跳转
                if (choice.jumpTo) {
                    if (this.onJump) this.onJump(choice.jumpTo);
                } else if (choice.nextIndex !== undefined) {
                    this.currentIndex = choice.nextIndex;
                    this.processNode();
                } else {
                    this.currentIndex++;
                    this.processNode();
                }
            });
            this.choicesPanel.appendChild(btn);
        });
    }

    /** 切换场景 */
    changeScene(node) {
        // 移除所有背景类
        this.sceneBg.className = 'scene-background';

        if (node.bg) {
            // 检测自定义背景图
            const exts = ['png', 'jpg', 'webp'];
            let found = false;
            for (const ext of exts) {
                const url = `img/custom/backgrounds/${node.bg}.${ext}`;
                const img = new Image();
                img.src = url;
                img.onload = () => {
                    if (!found) {
                        found = true;
                        this.sceneBg.style.backgroundImage = `url('${url}')`;
                        this.sceneBg.style.backgroundSize = 'cover';
                        this.sceneBg.style.backgroundPosition = 'center';
                    }
                };
            }
            // 同时设置CSS类作为回退
            this.sceneBg.classList.add(`bg-${node.bg}`);
        }

        if (node.name) {
            this.sceneName.textContent = node.name;
        }

        // 切换场景时隐藏所有角色
        if (node.clearCharacters) {
            this.hideAllCharacters();
        }

        // 根据场景自动切换BGM
        if (window.game?.audio && node.bg) {
            const bgmMap = {
                rooftop: 'romantic', playground: 'happy', park: 'happy',
                exam: 'tension', night: 'romantic', sunset: 'romantic'
            };
            const bgm = bgmMap[node.bg];
            if (bgm) window.game.audio.playBgm(bgm);
        }
    }

    /** 显示角色 */
    showCharacter(node) {
        const char = this.characters[node.charId];
        if (!char) return;

        let slot;
        switch (node.position) {
            case 'left': slot = this.charLeft; break;
            case 'right': slot = this.charRight; break;
            default: slot = this.charCenter;
        }

        if (char.sprite) {
            slot.innerHTML = `
                <img class="char-img" src="${char.sprite}" alt="${char.name}" />
                <span class="char-label" style="color:${char.accentColor}">${char.name}</span>
            `;
        } else {
            slot.innerHTML = `
                <span class="char-emoji">${char.emoji}</span>
                <span class="char-label" style="color:${char.accentColor}">${char.name}</span>
            `;
        }
        slot.classList.add('visible');
    }

    /** 隐藏角色 */
    hideCharacter(node) {
        let slot;
        switch (node.position) {
            case 'left': slot = this.charLeft; break;
            case 'right': slot = this.charRight; break;
            default: slot = this.charCenter;
        }
        slot.classList.remove('visible');
        setTimeout(() => { slot.innerHTML = ''; }, 500);
    }

    /** 隐藏所有角色 */
    hideAllCharacters() {
        [this.charLeft, this.charCenter, this.charRight].forEach(el => {
            el.classList.remove('visible');
            setTimeout(() => { el.innerHTML = ''; }, 500);
        });
    }

    /** 好感度变化（触发通知） */
    changeAffection(node) {
        if (this.onAffectionChange) {
            this.onAffectionChange(node.charId, node.value);
        }
    }

    /** 获取当前状态（用于存档） */
    getState() {
        return {
            currentIndex: this.currentIndex
        };
    }

    /** 恢复状态（用于读档） */
    restoreState(state) {
        this.currentIndex = state.currentIndex;
    }
}
