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

    /** 角色配音映射 */
    getVoiceMap() {
        return {
            luchen: { greeting: 'audio/voice/luchen_greeting.mp3', date: 'audio/voice/luchen_date.mp3', confession: 'audio/voice/luchen_confession.mp3' },
            guyan: { greeting: 'audio/voice/guyan_greeting.mp3', date: 'audio/voice/guyan_date.mp3', confession: 'audio/voice/guyan_confession.mp3' },
            linxiao: { greeting: 'audio/voice/linxiao_greeting.mp3', date: 'audio/voice/linxiao_date.mp3', confession: 'audio/voice/linxiao_confession.mp3' },
            xinghe: { greeting: 'audio/voice/xinghe_greeting.mp3', date: 'audio/voice/xinghe_date.mp3', confession: 'audio/voice/xinghe_confession.mp3' },
            xuanmo: { greeting: 'audio/voice/xuanmo_greeting.mp3', date: 'audio/voice/xuanmo_date.mp3', confession: 'audio/voice/xuanmo_confession.mp3' },
            edwin: { greeting: 'audio/voice/edwin_greeting.mp3', date: 'audio/voice/edwin_date.mp3', confession: 'audio/voice/edwin_confession.mp3' }
        };
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

        // 文本匹配关键词
        const keywords = {
            greeting: ['小心', '你没事吧', '你很吵', '好险', '偷看', '让开', '大家好'],
            date: ['叫我辰逸', '送你', '有我在', '花送给你', '感谢你', '喝杯茶'],
            confession: ['不完美也可以被爱', '不会再一个人', '比任何比赛', '只唱给你', '站在我身边', '看遍世界']
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
