/**
 * save.js — 存档/读档系统
 */
const SaveSystem = {
    SAVE_KEY: 'otome_game_saves',
    MAX_SLOTS: 6,

    /** 获取所有存档 */
    getAllSaves() {
        try {
            const data = localStorage.getItem(this.SAVE_KEY);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    },

    /** 保存到指定槽位 */
    save(slotId, gameState) {
        const saves = this.getAllSaves();
        saves[slotId] = {
            ...gameState,
            timestamp: Date.now(),
            dateStr: new Date().toLocaleString('zh-CN')
        };
        localStorage.setItem(this.SAVE_KEY, JSON.stringify(saves));
    },

    /** 从指定槽位读取 */
    load(slotId) {
        const saves = this.getAllSaves();
        return saves[slotId] || null;
    },

    /** 删除指定槽位 */
    deleteSave(slotId) {
        const saves = this.getAllSaves();
        delete saves[slotId];
        localStorage.setItem(this.SAVE_KEY, JSON.stringify(saves));
    },

    /** 快速存档 */
    quickSave(gameState) {
        this.save('quick', gameState);
    },

    /** 快速读档 */
    quickLoad() {
        return this.load('quick');
    }
};
