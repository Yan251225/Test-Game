/**
 * audio.js — 音频系统（BGM + 配音）
 */
class AudioSystem {
    constructor() {
        this.bgm = null;
        this.voice = null;
        this.bgmVolume = 0.3;
        this.voiceVolume = 0.8;
        this.currentBgm = null;
        this.bgmEnabled = true;
        this.voiceEnabled = true;

        // BGM 合成器（Web Audio API 程序化音乐）
        this.audioCtx = null;
        this.bgmNodes = [];
    }

    _ensureContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    // ============================
    // BGM 系统（程序化合成）
    // ============================

    /** 播放BGM */
    playBgm(trackName) {
        if (!this.bgmEnabled || this.currentBgm === trackName) return;
        this.stopBgm();
        this.currentBgm = trackName;
        this._ensureContext();

        const tracks = {
            title: { notes: [60,64,67,72,67,64,60,62,65,69,65,62], tempo: 0.5, wave: 'sine', filter: 800 },
            normal: { notes: [60,62,64,65,67,65,64,62,60,59,57,59], tempo: 0.4, wave: 'triangle', filter: 1200 },
            romantic: { notes: [60,64,67,72,71,69,67,69,72,76,72,69], tempo: 0.6, wave: 'sine', filter: 600 },
            tension: { notes: [48,51,53,48,51,55,53,51,48,46,48,51], tempo: 0.3, wave: 'sawtooth', filter: 400 },
            happy: { notes: [60,64,67,72,74,72,67,69,72,76,74,72], tempo: 0.35, wave: 'triangle', filter: 1500 },
            ending: { notes: [60,63,67,72,75,72,67,63,60,65,69,72], tempo: 0.7, wave: 'sine', filter: 500 }
        };

        const track = tracks[trackName] || tracks.normal;
        this._synthLoop(track);
    }

    _synthLoop(track) {
        if (!this.audioCtx || !this.bgmEnabled) return;
        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        // 主旋律
        const gainNode = ctx.createGain();
        gainNode.gain.value = this.bgmVolume * 0.15;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = track.filter;
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        const loopDuration = track.notes.length * track.tempo;

        track.notes.forEach((note, i) => {
            const osc = ctx.createOscillator();
            osc.type = track.wave;
            osc.frequency.value = 440 * Math.pow(2, (note - 69) / 12);

            const noteGain = ctx.createGain();
            const start = now + i * track.tempo;
            noteGain.gain.setValueAtTime(0, start);
            noteGain.gain.linearRampToValueAtTime(1, start + 0.05);
            noteGain.gain.linearRampToValueAtTime(0.6, start + track.tempo * 0.5);
            noteGain.gain.linearRampToValueAtTime(0, start + track.tempo * 0.95);

            osc.connect(noteGain);
            noteGain.connect(filter);
            osc.start(start);
            osc.stop(start + track.tempo);
            this.bgmNodes.push(osc);
        });

        // 柔和的和弦垫底
        const pad = ctx.createOscillator();
        pad.type = 'sine';
        pad.frequency.value = 440 * Math.pow(2, (track.notes[0] - 69 - 12) / 12);
        const padGain = ctx.createGain();
        padGain.gain.value = this.bgmVolume * 0.06;
        pad.connect(padGain);
        padGain.connect(ctx.destination);
        pad.start(now);
        pad.stop(now + loopDuration);
        this.bgmNodes.push(pad);

        // 循环
        this._bgmTimer = setTimeout(() => this._synthLoop(track), loopDuration * 1000 - 100);
    }

    /** 停止BGM */
    stopBgm() {
        this.currentBgm = null;
        if (this._bgmTimer) clearTimeout(this._bgmTimer);
        this.bgmNodes.forEach(n => { try { n.stop(); } catch {} });
        this.bgmNodes = [];
    }

    /** 切换BGM开关 */
    toggleBgm() {
        this.bgmEnabled = !this.bgmEnabled;
        if (!this.bgmEnabled) this.stopBgm();
        return this.bgmEnabled;
    }

    // ============================
    // 配音系统
    // ============================

    /** 角色配音映射（每角色5种台词） */
    getVoiceMap() {
        const types = ['greeting', 'date', 'confession', 'jealous', 'comfort'];
        const chars = ['luchen', 'guyan', 'linxiao', 'xinghe', 'xuanmo', 'edwin'];
        const map = {};
        chars.forEach(c => {
            map[c] = {};
            types.forEach(t => { map[c][t] = `audio/voice/${c}_${t}.mp3`; });
        });
        return map;
    }

    /** 播放角色配音 */
    playVoice(charId, lineType) {
        if (!this.voiceEnabled) return;
        this.stopVoice();
        const map = this.getVoiceMap();
        const file = map[charId]?.[lineType];
        if (!file) return;

        this.voice = new Audio(file);
        this.voice.volume = this.voiceVolume;
        this.voice.play().catch(() => {});
    }

    /** 根据对话文本自动匹配配音 */
    playVoiceForDialogue(charId, text) {
        if (!this.voiceEnabled || !charId) return;

        const keywords = {
            greeting: ['小心', '你没事吧', '好险', '偷看', '让开', '大家好', '欢迎', '转学生',
                        '认识', '早安', '你好', '迟到', 'Good morning', '自我介绍'],
            date:     ['图书馆', '自习', '一起', '请客', '弹吉他', '红茶', '散步', '比赛',
                        '包场', '约会', '送你', '听我弹', '品尝', '跑步'],
            confession: ['喜欢你', '爱你', '重要', '一个人', '比成绩', '只想给', 'I love you',
                          '一辈子', '不缺', '唯独缺', '最想见到'],
            jealous:  ['走得很近', '别人', '那个家伙', '那么开心', '亲近', 'jealous',
                        '在意', '围着', '只看我', '允许'],
            comfort:  ['靠在我', '别哭', '抱一下', '没关系', '欺负', '拥抱',
                        'Come here', '画给你', '买给你', '我在']
        };

        for (const [lineType, words] of Object.entries(keywords)) {
            if (words.some(w => text.includes(w))) {
                this.playVoice(charId, lineType);
                return;
            }
        }
    }

    /** 停止配音 */
    stopVoice() {
        if (this.voice) {
            this.voice.pause();
            this.voice.currentTime = 0;
            this.voice = null;
        }
    }

    /** 切换配音开关 */
    toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;
        if (!this.voiceEnabled) this.stopVoice();
        return this.voiceEnabled;
    }
}
