/**
 * 数据统计管理模块
 * 负责昨日/今日开方数据汇总、预警统计
 */
class StatsManager {
    constructor() {
        this.prescriptionManager = prescriptionManager;
        this.drugManager = drugManager;
        this.stockOutManager = stockOutManager;
    }

    /**
     * 获取日期范围（昨日/今日）
     * @param {string} type 日期类型（yesterday/today）
     * @returns {object} 开始时间和结束时间（ISO格式）
     */
    getDateRange(type) {
        const now = new Date();
        let startDate, endDate;

        if (type === "yesterday") {
            // 昨日：00:00:00 到 23:59:59
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        } else {
            // 今日：00:00:00 到 当前时间
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = now;
        }

        return {
            start: startDate.toISOString(),
            end: endDate.toISOString()
        };
    }

    /**
     * 获取指定日期的开方统计数据
     * @param {string} type 日期类型（yesterday/today）
     * @returns {Promise} 统计数据
     */
    async getDailyPrescriptionStats(type) {
        try {
            const { start, end } = this.getDateRange(type);
            const prescriptions = await this.prescriptionManager.getPrescriptionsByTime(start, end);

            // 汇总数据
            const drugMap = new Map();
            let totalGrams = 0;
            let totalAmount = 0;

            for (const prescription of prescriptions) {
                for (const drug of prescription.drugList) {
                    const drugName = drug.name;
                    const grams = drug.grams;
                    const amount = drug.amount;

                    if (drugMap.has(drugName)) {
                        const existing = drugMap.get(drugName);
                        drugMap.set(drugName, {
                            grams: existing.grams + grams,
                            amount: existing.amount + amount
                        });
                    } else {
                        drugMap.set(drugName, { grams, amount });
                    }

                    totalGrams += grams;
                    totalAmount += amount;
                }
            }

            // 转换为详情列表
            const drugList = Array.from(drugMap.entries()).map(([name, data]) => ({
                name,
                grams: data.grams,
                amount: Math.round(data.amount * 100) / 100
            }));

            return {
                totalGrams: Math.round(totalGrams * 100) / 100,
                totalTypes: drugList.length,
                totalAmount: Math.round(totalAmount * 100) / 100,
                drugList
            };
        } catch (error) {
            console.error("获取每日统计数据失败：", error);
            return {
                totalGrams: 0,
                totalTypes: 0,
                totalAmount: 0,
                drugList: []
            };
        }
    }

    /**
     * 获取库存预警统计
     * @returns {Promise} 预警统计数据
     */
    async getWarningStats() {
        try {
            const warningDrugs = await this.drugManager.getWarningDrugList();
            return {
                count: warningDrugs.length,
                list: warningDrugs.map(drug => ({
                    name: drug.name,
                    currentStock: Math.round(drug.currentStock * 100) / 100,
                    minStock: drug.minStock
                }))
            };
        } catch (error) {
            console.error("获取预警统计数据失败：", error);
            return { count: 0, list: [] };
        }
    }
}

// 暴露全局实例
const statsManager = new StatsManager();