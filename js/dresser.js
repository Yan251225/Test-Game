/**
 * dresser.js — 打扮系统
 */
class DresserSystem {
    constructor(game) {
        this.game = game;
        this.outfits = [];
        this.hairstyles = [];
        this.currentOutfit = 'school-uniform';
        this.currentHairstyle = 'ponytail';
        this.shoppingCount = 0; // 累计逛街次数，影响解锁
    }

    async loadData() {
        try {
            const resp = await fetch('data/outfits.json');
            const data = await resp.json();
            this.outfits = data.outfits || [];
            this.hairstyles = data.hairstyles || [];
        } catch { console.error('加载服装数据失败'); }
    }

    /** 获取当前服装 */
    getCurrentOutfit() {
        return this.outfits.find(o => o.id === this.currentOutfit) || this.outfits[0];
    }

    /** 获取当前发型 */
    getCurrentHairstyle() {
        return this.hairstyles.find(h => h.id === this.currentHairstyle) || this.hairstyles[0];
    }

    /** 设置服装 */
    setOutfit(outfitId) {
        const outfit = this.outfits.find(o => o.id === outfitId);
        if (outfit && outfit.unlocked) {
            this.currentOutfit = outfitId;
            return true;
        }
        return false;
    }

    /** 设置发型 */
    setHairstyle(hairstyleId) {
        const hs = this.hairstyles.find(h => h.id === hairstyleId);
        if (hs && hs.unlocked) {
            this.currentHairstyle = hairstyleId;
            return true;
        }
        return false;
    }

    /** 总魅力加成 */
    getTotalCharmBonus() {
        const outfit = this.getCurrentOutfit();
        const hair = this.getCurrentHairstyle();
        return (outfit?.charmBonus || 0) + (hair?.charmBonus || 0);
    }

    /** 获取对特定角色的好感加成 */
    getCharPreferenceBonus(charId) {
        const outfit = this.getCurrentOutfit();
        const hair = this.getCurrentHairstyle();
        const outfitPref = outfit?.charPrefs?.[charId] || 0;
        const hairPref = hair?.charPrefs?.[charId] || 0;
        return outfitPref + hairPref;
    }

    /** 逛街后随机解锁一件服装或发型 */
    unlockRandom() {
        this.shoppingCount++;
        const locked = [
            ...this.outfits.filter(o => !o.unlocked && o.cost <= this.shoppingCount),
            ...this.hairstyles.filter(h => !h.unlocked)
        ];
        if (locked.length === 0) return null;

        const item = locked[Math.floor(Math.random() * locked.length)];
        item.unlocked = true;
        return item;
    }

    /** 获取已解锁服装列表 */
    getUnlockedOutfits() {
        return this.outfits.filter(o => o.unlocked);
    }

    /** 获取已解锁发型列表 */
    getUnlockedHairstyles() {
        return this.hairstyles.filter(h => h.unlocked);
    }

    /** 获取所有服装（含锁定状态） */
    getAllOutfits() {
        return this.outfits;
    }

    /** 获取所有发型（含锁定状态） */
    getAllHairstyles() {
        return this.hairstyles;
    }

    /** 序列化（存档用） */
    serialize() {
        return {
            currentOutfit: this.currentOutfit,
            currentHairstyle: this.currentHairstyle,
            shoppingCount: this.shoppingCount,
            unlockedOutfits: this.outfits.filter(o => o.unlocked).map(o => o.id),
            unlockedHairstyles: this.hairstyles.filter(h => h.unlocked).map(h => h.id)
        };
    }

    /** 反序列化（读档用） */
    deserialize(data) {
        if (!data) return;
        this.currentOutfit = data.currentOutfit || 'school-uniform';
        this.currentHairstyle = data.currentHairstyle || 'ponytail';
        this.shoppingCount = data.shoppingCount || 0;
        if (data.unlockedOutfits) {
            this.outfits.forEach(o => { o.unlocked = data.unlockedOutfits.includes(o.id); });
        }
        if (data.unlockedHairstyles) {
            this.hairstyles.forEach(h => { h.unlocked = data.unlockedHairstyles.includes(h.id); });
        }
    }
}
