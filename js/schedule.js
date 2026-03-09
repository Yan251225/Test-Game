/**
 * schedule.js — 日程安排系统（心跳回忆风格）
 */
class ScheduleSystem {
    constructor(game) {
        this.game = game;
        this.actions = [];
        this.specialEvents = [];
        this.encounters = [];

        // 时间状态
        this.week = 1;
        this.maxWeeks = 12;
        this.timeSlot = 'morning'; // morning / afternoon / weekend

        // 女主属性
        this.stats = {
            intelligence: 30,
            fitness: 30,
            charm: 30,
            art: 30,
            social: 30
        };
        this.stress = 0;
        this.maxStress = 100;

        // 属性中文名
        this.statNames = {
            intelligence: '学力', fitness: '体力',
            charm: '魅力', art: '艺术', social: '社交'
        };
        this.statIcons = {
            intelligence: '📖', fitness: '💪',
            charm: '✨', art: '🎨', social: '🗣️'
        };
    }

    async loadData() {
        try {
            const resp = await fetch('data/schedule-events.json');
            const data = await resp.json();
            this.actions = data.actions || [];
            this.specialEvents = data.specialEvents || [];
            this.encounters = data.encounters || [];
        } catch { console.error('加载日程数据失败'); }
    }

    /** 获取当前可用行动 */
    getAvailableActions() {
        const isWeekend = this.timeSlot === 'weekend';
        return this.actions.filter(a => {
            if (a.weekendOnly && !isWeekend) return false;
            if (!a.weekendOnly && a.charId) return false; // 约会仅周末
            return true;
        });
    }

    /** 执行行动 */
    executeAction(actionId) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action) return null;

        const results = { action, statChanges: {}, stressChange: 0, encounter: null, outfitUnlock: null };

        // 压力检查
        if (this.stress >= 90 && actionId !== 'rest') {
            return { forced: true, message: '你太累了，必须先休息！😫' };
        }

        // 计算属性变化（含随机波动±3）
        for (const [stat, base] of Object.entries(action.stats || {})) {
            const variance = Math.floor(Math.random() * 7) - 3;
            let change = base + variance;
            // 压力过高效率减半
            if (this.stress >= 70) change = Math.ceil(change / 2);
            this.stats[stat] = Math.max(0, Math.min(200, (this.stats[stat] || 0) + change));
            results.statChanges[stat] = change;
        }

        // 服装魅力加成
        if (this.game.dresser) {
            const bonus = this.game.dresser.getTotalCharmBonus();
            if (bonus > 0 && !results.statChanges.charm) {
                // 穿搭的被动魅力加成（每次行动少量）
            }
        }

        // 压力变化
        const stressChange = action.stress || 0;
        this.stress = Math.max(0, Math.min(this.maxStress, this.stress + stressChange));
        results.stressChange = stressChange;

        // 约会 → 好感度大幅提升
        if (action.charId) {
            let affGain = 12;
            // 穿搭加成
            if (this.game.dresser) {
                affGain += this.game.dresser.getCharPreferenceBonus(action.charId);
            }
            this.game.changeAffection(action.charId, affGain);
            results.affGain = { charId: action.charId, value: affGain };
        }

        // 随机好感
        if (action.affectionRandom) {
            const chars = ['luchen', 'guyan', 'linxiao', 'xinghe', 'xuanmo', 'edwin'];
            const randChar = chars[Math.floor(Math.random() * chars.length)];
            const randVal = Math.floor(Math.random() * action.affectionRandom) + 1;
            this.game.changeAffection(randChar, randVal);
            results.affGain = { charId: randChar, value: randVal };
        }

        // 随机遭遇
        if (action.encounter || Math.random() < 0.25) {
            const possible = this.encounters.filter(e =>
                e.locations.includes(action.location) || action.location === 'various'
            );
            if (possible.length > 0) {
                results.encounter = possible[Math.floor(Math.random() * possible.length)];
                this.game.changeAffection(results.encounter.charId, 3);
            }
        }

        // 购物解锁服装
        if (action.unlockOutfit && this.game.dresser) {
            results.outfitUnlock = this.game.dresser.unlockRandom();
        }

        return results;
    }

    /** 推进时间 */
    advanceTime() {
        if (this.timeSlot === 'morning') {
            this.timeSlot = 'afternoon';
            return { newSlot: 'afternoon', weekEnd: false };
        } else if (this.timeSlot === 'afternoon') {
            this.timeSlot = 'weekend';
            return { newSlot: 'weekend', weekEnd: false };
        } else {
            this.timeSlot = 'morning';
            this.week++;
            return { newSlot: 'morning', weekEnd: true, newWeek: this.week };
        }
    }

    /** 检查是否有特殊事件 */
    checkSpecialEvent() {
        return this.specialEvents.find(e => e.week === this.week && this.timeSlot === 'morning');
    }

    /** 执行特殊事件检定 */
    resolveSpecialEvent(event) {
        if (event.type === 'ending') return { type: 'ending' };

        const stat = this.stats[event.statCheck] || 0;
        const passed = stat >= event.threshold;
        const results = {
            event,
            passed,
            stat: event.statCheck,
            statValue: stat,
            threshold: event.threshold
        };

        // 考试/活动结果影响好感
        if (event.type === 'exam') {
            if (passed) {
                this.game.changeAffection('luchen', 8);
                this.game.changeAffection('edwin', 5);
                if (stat >= event.threshold + 30) this.game.changeAffection('guyan', 5);
            } else {
                this.game.changeAffection('luchen', -5);
            }
        } else if (event.type === 'sports') {
            if (passed) {
                this.game.changeAffection('linxiao', 10);
                this.game.changeAffection('xinghe', 3);
            } else {
                this.game.changeAffection('linxiao', -3);
            }
        } else if (event.type === 'culture') {
            if (passed) {
                this.game.changeAffection('guyan', 8);
                this.game.changeAffection('xinghe', 5);
                this.game.changeAffection('xuanmo', 3);
                this.game.changeAffection('edwin', 5);
            }
        }

        return results;
    }

    /** 获取结局判定 */
    getEndingResult() {
        const affs = this.game.state.affection;
        // 找好感最高的角色
        let topChar = null, topAff = 0;
        for (const [id, val] of Object.entries(affs)) {
            if (val > topAff) { topChar = id; topAff = val; }
        }

        if (!topChar || topAff < 20) {
            return { type: 'academic', charId: null };
        }

        const reqs = {
            luchen: { primary: ['intelligence', 120], secondary: ['art', 80] },
            guyan: { primary: ['art', 120], secondary: ['intelligence', 80] },
            linxiao: { primary: ['fitness', 120], secondary: ['social', 80] },
            xinghe: { primary: ['charm', 120], secondary: ['social', 80] },
            xuanmo: { primary: ['intelligence', 100], secondary: ['charm', 100] },
            edwin: { primary: ['intelligence', 100], secondary: ['art', 100] }
        };

        const req = reqs[topChar];
        const primaryMet = this.stats[req.primary[0]] >= req.primary[1];
        const secondaryMet = this.stats[req.secondary[0]] >= req.secondary[1];

        if (topAff >= 80 && primaryMet && secondaryMet) {
            return { type: 'perfect', charId: topChar };
        } else if (topAff >= 60) {
            return { type: 'normal', charId: topChar };
        } else if (topAff >= 40) {
            return { type: 'friend', charId: topChar };
        } else {
            return { type: 'passby', charId: topChar };
        }
    }

    /** 游戏是否结束 */
    isGameOver() {
        return this.week > this.maxWeeks;
    }

    /** 获取进度百分比 */
    getProgress() {
        const totalSlots = this.maxWeeks * 3;
        const current = (this.week - 1) * 3 + 
            (this.timeSlot === 'morning' ? 0 : this.timeSlot === 'afternoon' ? 1 : 2);
        return Math.min(100, Math.round(current / totalSlots * 100));
    }

    /** 获取时间段名称 */
    getTimeSlotName() {
        const names = { morning: '上午', afternoon: '下午', weekend: '周末' };
        return `第${this.week}周 · ${names[this.timeSlot]}`;
    }
}
