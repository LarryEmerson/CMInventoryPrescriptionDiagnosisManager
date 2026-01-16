/**
 * 药物入库管理模块
 * 负责入库记录、关联药物/来源、单价计算
 */
class StockInManager {
    constructor() {
        this.storeName = "stockIns";
    }

    /**
     * 新增入库记录
     * @param {object} stockInInfo 入库信息
     * @returns {Promise} 操作结果
     */
    async addStockIn(stockInInfo) {
        const { drugId, drugName, sourceId, sourceName, grams, totalAmount, remark } = stockInInfo;

        if (!drugId || !sourceId || !grams || !totalAmount) {
            return { success: false, message: "药物、来源、克数、总金额不能为空" };
        }

        const gramsNum = Number(grams);
        const amountNum = Number(totalAmount);

        if (gramsNum <= 0 || amountNum <= 0) {
            return { success: false, message: "克数和总金额必须大于0" };
        }

        try {
            // 计算单价
            const unitPrice = Math.round((amountNum / gramsNum) * 100) / 100;

            // 新增入库记录
            const stockIn = {
                drugId: Number(drugId),
                drugName,
                sourceId: Number(sourceId),
                sourceName,
                grams: gramsNum,
                totalAmount: amountNum,
                unitPrice,
                inTime: new Date().toISOString(),
                remark: remark ? remark.trim() : ""
            };

            await dbManager.addData(this.storeName, stockIn);
            return { success: true, message: "药物入库成功" };
        } catch (error) {
            console.error("新增入库记录失败：", error);
            return { success: false, message: `入库失败：${error.message}` };
        }
    }

    /**
     * 根据药物名称获取入库记录（按入库时间升序）
     * @param {string} drugName 药物名称
     * @returns {Promise} 入库记录数组
     */
    async getStockInByDrugName(drugName) {
        try {
            const stockIns = await dbManager.filterData(this.storeName, (item) => item.drugName === drugName);
            // 按入库时间升序（先进先出）
            return stockIns.sort((a, b) => new Date(a.inTime) - new Date(b.inTime));
        } catch (error) {
            console.error("获取药物入库记录失败：", error);
            return [];
        }
    }

    /**
     * 获取所有入库记录（按入库时间降序）
     * @returns {Promise} 入库记录数组
     */
    async getAllStockIns() {
        try {
            const stockIns = await dbManager.getAllData(this.storeName);
            // 按入库时间降序排序
            return stockIns.sort((a, b) => new Date(b.inTime) - new Date(a.inTime));
        } catch (error) {
            console.error("获取所有入库记录失败：", error);
            return [];
        }
    }
}

// 暴露全局实例
const stockInManager = new StockInManager();