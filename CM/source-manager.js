/**
 * 药物来源管理模块
 * 负责来源的增删改查、重复校验
 */
class SourceManager {
    constructor() {
        this.storeName = "sources";
    }

    /**
     * 新增来源（校验重复）
     * @param {string} name 来源名称
     * @param {string} remark 来源备注
     * @returns {Promise} 操作结果
     */
    async addSource(name, remark) {
        if (!name || name.trim() === "") {
            return { success: false, message: "来源名称不能为空" };
        }

        try {
            // 校验重复
            const existingSource = await dbManager.getDataByIndex(this.storeName, "name", name.trim());
            if (existingSource) {
                return { success: false, message: "该来源已存在，不可重复新增" };
            }

            // 新增来源
            const source = {
                name: name.trim(),
                remark: remark ? remark.trim() : ""
            };

            await dbManager.addData(this.storeName, source);
            return { success: true, message: "来源新增成功" };
        } catch (error) {
            console.error("新增来源失败：", error);
            return { success: false, message: `新增失败：${error.message}` };
        }
    }

    /**
     * 获取所有来源
     * @returns {Promise} 来源数组
     */
    async getSourceList() {
        try {
            const sources = await dbManager.getAllData(this.storeName);
            // 按名称排序
            return sources.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error("获取来源列表失败：", error);
            return [];
        }
    }

    /**
     * 根据ID获取来源
     * @param {number} id 来源ID
     * @returns {Promise} 来源对象
     */
    async getSourceById(id) {
        try {
            return await dbManager.getData(this.storeName, id);
        } catch (error) {
            console.error("获取来源失败：", error);
            return null;
        }
    }
    
    /**
     * 更新来源信息
     * @param {number} id 来源ID
     * @param {object} sourceInfo 来源信息
     * @returns {Promise} 操作结果
     */
    async updateData(id, sourceInfo) {
        try {
            // 获取原始来源信息
            const source = await this.getSourceById(id);
            if (!source) {
                return { success: false, message: "来源不存在" };
            }
            
            // 更新来源信息
            const updatedSource = {
                ...source,
                ...sourceInfo
            };
            
            // 保存更新后的来源信息
            await dbManager.updateData(this.storeName, updatedSource);
            return { success: true, message: "来源信息更新成功" };
        } catch (error) {
            console.error("更新来源信息失败：", error);
            return { success: false, message: `更新失败：${error.message}` };
        }
    }
}

// 暴露全局实例
const sourceManager = new SourceManager();