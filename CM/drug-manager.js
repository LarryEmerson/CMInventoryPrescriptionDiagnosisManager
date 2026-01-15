/**
 * 中药药物管理模块
 * 负责药物增删改查、预警统计、排序逻辑、库存计算
 */
class DrugManager {
    constructor() {
        this.drugStoreName = "drugs";
        this.stockInStoreName = "stockIns";
        this.stockOutStoreName = "stockOuts";
    }

    /**
     * 新增药物（校验重复）
     * @param {object} drugInfo 药物信息
     * @returns {Promise} 操作结果
     */
    async addDrug(drugInfo) {
        const { name, storageType, minStock, defaultEstimate } = drugInfo;

        if (!name || name.trim() === "") {
            return { success: false, message: "药物名称不能为空" };
        }

        try {
            // 校验重复
            const existingDrug = await dbManager.getDataByIndex(this.drugStoreName, "name", name.trim());
            if (existingDrug) {
                return { success: false, message: "该药物已存在，不可重复新增" };
            }

            // 新增药物
            const drug = {
                name: name.trim(),
                storageType,
                minStock: Number(minStock),
                defaultEstimate: Number(defaultEstimate),
                currentEstimate: Number(defaultEstimate), // 初始动态预估量等于默认值
                useCount: 0, // 使用次数
                totalUsedGrams: 0 // 总使用克数
            };

            await dbManager.addData(this.drugStoreName, drug);
            return { success: true, message: "药物新增成功" };
        } catch (error) {
            console.error("新增药物失败：", error);
            return { success: false, message: `新增失败：${error.message}` };
        }
    }

    /**
     * 获取所有药物
     * @returns {Promise} 药物数组
     */
    async getDrugList() {
        try {
            const drugs = await dbManager.getAllData(this.drugStoreName);
            // 按名称排序
            return drugs.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error("获取药物列表失败：", error);
            return [];
        }
    }

    /**
     * 根据名称获取药物
     * @param {string} name 药物名称
     * @returns {Promise} 药物对象
     */
    async getDrugByName(name) {
        try {
            return await dbManager.getDataByIndex(this.drugStoreName, "name", name);
        } catch (error) {
            console.error("获取药物失败：", error);
            return null;
        }
    }

    /**
     * 根据ID获取药物
     * @param {number} id 药物ID
     * @returns {Promise} 药物对象
     */
    async getDrugById(id) {
        try {
            return await dbManager.getData(this.drugStoreName, id);
        } catch (error) {
            console.error("获取药物失败：", error);
            return null;
        }
    }

    /**
     * 更新药物使用数据（计算动态预估量）
     * @param {string} drugName 药物名称
     * @param {number} usedGrams 本次使用克数
     * @returns {Promise} 操作结果
     */
    async updateDrugUseData(drugName, usedGrams) {
        try {
            const drug = await this.getDrugByName(drugName);
            if (!drug) {
                return { success: false, message: "药物不存在" };
            }

            // 更新使用数据
            drug.useCount += 1;
            drug.totalUsedGrams += Number(usedGrams);
            // 计算动态预估量（总使用克数/使用次数）
            drug.currentEstimate = Math.round((drug.totalUsedGrams / drug.useCount) * 100) / 100;

            await dbManager.updateData(this.drugStoreName, drug);
            return { success: true, message: "药物使用数据更新成功" };
        } catch (error) {
            console.error("更新药物使用数据失败：", error);
            return { success: false, message: `更新失败：${error.message}` };
        }
    }

    /**
     * 计算药物当前库存
     * @param {string} drugName 药物名称
     * @returns {Promise} 库存克数
     */
    async calculateCurrentStock(drugName) {
        try {
            const drug = await this.getDrugByName(drugName);
            if (!drug) {
                return 0;
            }

            // 总入库克数
            const stockIns = await dbManager.filterData(this.stockInStoreName, (item) => item.drugName === drugName);
            const totalInGrams = stockIns.reduce((sum, item) => sum + Number(item.grams), 0);

            // 总出库克数
            const stockOuts = await dbManager.filterData(this.stockOutStoreName, (item) => item.drugName === drugName);
            const totalOutGrams = stockOuts.reduce((sum, item) => sum + Number(item.grams), 0);

            // 当前库存 = 总入库 - 总出库
            return totalInGrams - totalOutGrams;
        } catch (error) {
            console.error("计算药物库存失败：", error);
            return 0;
        }
    }

    /**
     * 获取库存预警药物列表
     * @returns {Promise} 预警药物数组
     */
    async getWarningDrugList() {
        try {
            const drugs = await this.getDrugList();
            const warningList = [];

            for (const drug of drugs) {
                const currentStock = await this.calculateCurrentStock(drug.name);
                if (currentStock <= drug.minStock) {
                    warningList.push({
                        ...drug,
                        currentStock
                    });
                }
            }

            return warningList;
        } catch (error) {
            console.error("获取预警药物列表失败：", error);
            return [];
        }
    }

    /**
     * 药物排序（过滤已选药物 + 频率优先 + 剩余使用次数优先）
     * @param {array} selectedDrugs 已选药物名称数组
     * @returns {Promise} 排序后的药物数组
     */
    async sortDrugs(selectedDrugs) {
        try {
            const drugs = await this.getDrugList();
            const sortedDrugs = [];

            // 过滤已选药物
            const filterDrugs = drugs.filter(drug => !selectedDrugs.includes(drug.name));

            // 补充剩余使用次数并排序
            for (const drug of filterDrugs) {
                const currentStock = await this.calculateCurrentStock(drug.name);
                // 剩余使用次数 = 当前库存 / 动态预估量（避免除零）
                const remainingUses = drug.currentEstimate > 0 ? currentStock / drug.currentEstimate : 0;

                sortedDrugs.push({
                    ...drug,
                    currentStock,
                    remainingUses
                });
            }

            // 排序：1. 使用频率降序 2. 剩余使用次数降序
            return sortedDrugs.sort((a, b) => {
                if (b.useCount !== a.useCount) {
                    return b.useCount - a.useCount;
                } else {
                    return b.remainingUses - a.remainingUses;
                }
            });
        } catch (error) {
            console.error("药物排序失败：", error);
            return [];
        }
    }
}

// 暴露全局实例
const drugManager = new DrugManager();