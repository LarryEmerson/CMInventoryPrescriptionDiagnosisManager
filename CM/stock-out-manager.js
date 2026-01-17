/**
 * 药物出库管理模块
 * 负责先进先出金额计算、分类型出库（开方/作废/炮制）
 */
class StockOutManager {
    constructor() {
        this.storeName = "stockOuts";
        this.stockInManager = stockInManager;
        this.drugManager = drugManager;
    }

    /**
     * 先进先出计算出库总金额
     * @param {string} drugName 药物名称
     * @param {number} outGrams 出库克数
     * @returns {Promise} 总金额 + 扣减后的入库记录
     */
    async calculateFIFOAmount(drugName, outGrams) {
        try {
            console.log(`FIFO计算开始：药物=${drugName}, 出库克数=${outGrams}`);
            
            const outGramsNum = Number(outGrams);
            if (outGramsNum <= 0) {
                console.log("FIFO计算失败：出库克数必须大于0");
                return { success: false, totalAmount: 0, message: "出库克数必须大于0" };
            }

            // 获取药物入库记录（先进先出）
            const stockIns = await this.stockInManager.getStockInByDrugName(drugName);
            console.log(`获取到入库记录：${JSON.stringify(stockIns)}`);
            
            if (stockIns.length === 0) {
                console.log("FIFO计算失败：该药物无入库记录");
                return { success: false, totalAmount: 0, message: "该药物无入库记录，无法出库" };
            }

            // 计算当前库存
            const currentStock = await this.drugManager.calculateCurrentStock(drugName);
            console.log(`当前库存：${currentStock}g, 出库克数：${outGramsNum}g`);
            
            if (currentStock < outGramsNum) {
                console.log("FIFO计算失败：当前库存不足");
                return { success: false, totalAmount: 0, message: "当前库存不足，无法出库" };
            }

            let remainingOutGrams = outGramsNum;
            let totalOutAmount = 0;

            // 先进先出扣减
            console.log("开始先进先出扣减：");
            for (const stockIn of stockIns) {
                if (remainingOutGrams <= 0) break;
                
                console.log(`处理入库记录：ID=${stockIn.id}, 克数=${stockIn.grams}g, 单价=${stockIn.unitPrice}元/g`);

                const availableGrams = stockIn.grams; // 入库记录剩余克数（此处简化，实际可扩展为入库记录扣减后更新）
                const useGrams = Math.min(remainingOutGrams, availableGrams);
                const useAmount = Math.round((useGrams * stockIn.unitPrice) * 100) / 100;

                console.log(`使用克数：${useGrams}g, 使用金额：${useAmount}元`);
                
                totalOutAmount += useAmount;
                remainingOutGrams -= useGrams;
                
                console.log(`剩余出库克数：${remainingOutGrams}g, 当前总金额：${totalOutAmount}元`);
            }

            return {
                success: true,
                totalAmount: totalOutAmount,
                message: "金额计算成功"
            };
        } catch (error) {
            console.error("先进先出金额计算失败：", error);
            return { success: false, totalAmount: 0, message: error.message };
        }
    }

    /**
     * 新增出库记录
     * @param {object} stockOutInfo 出库信息
     * @returns {Promise} 操作结果
     */
    async addStockOut(stockOutInfo) {
        const { drugName, outType, grams, prescriptionId, remark } = stockOutInfo;

        if (!drugName || !outType || !grams) {
            return { success: false, message: "药物名称、出库类型、克数不能为空" };
        }

        try {
            // 计算出库金额
            const fifoResult = await this.calculateFIFOAmount(drugName, grams);
            console.log(`FIFO计算结果：${JSON.stringify(fifoResult)}`);
            
            if (!fifoResult.success) {
                return { success: false, message: fifoResult.message };
            }

            // 获取药物ID
            const drug = await this.drugManager.getDrugByName(drugName);
            if (!drug) {
                return { success: false, message: "药物不存在" };
            }

            // 新增出库记录
            const stockOut = {
                drugId: drug.id,
                drugName,
                outType,
                grams: Number(grams),
                totalAmount: fifoResult.totalAmount,
                outTime: new Date().toISOString(),
                prescriptionId: prescriptionId || null,
                remark: remark ? remark.trim() : ""
            };
            
            console.log(`创建出库记录：${JSON.stringify(stockOut)}`);

            await dbManager.addData(this.storeName, stockOut);

            // 更新药物使用数据（仅开方用药类型）
            if (outType === "开方用药") {
                await this.drugManager.updateDrugUseData(drugName, grams);
            }

            return { success: true, message: "出库成功", totalAmount: fifoResult.totalAmount };
        } catch (error) {
            console.error("新增出库记录失败：", error);
            return { success: false, message: `出库失败：${error.message}` };
        }
    }

    /**
     * 按时间范围和出库类型获取出库记录
     * @param {string} startDate 开始时间（ISO格式）
     * @param {string} endDate 结束时间（ISO格式）
     * @param {string} outType 出库类型
     * @returns {Promise} 出库记录数组
     */
    async getStockOutByTimeAndType(startDate, endDate, outType) {
        try {
            const stockOuts = await dbManager.filterData(this.storeName, (item) => {
                const outTime = new Date(item.outTime);
                const isInTimeRange = outTime >= new Date(startDate) && outTime <= new Date(endDate);
                const isMatchType = outType ? item.outType === outType : true;
                return isInTimeRange && isMatchType;
            });

            return stockOuts;
        } catch (error) {
            console.error("获取出库记录失败：", error);
            return [];
        }
    }
    
    /**
     * 获取所有出库记录（按时间倒序）
     */
    async getAllStockOuts() {
        try {
            const stockOuts = await dbManager.getAllData(this.storeName);
            // 按时间倒序排序
            return stockOuts.sort((a, b) => new Date(b.outTime) - new Date(a.outTime));
        } catch (error) {
            console.error("获取所有出库记录失败：", error);
            return [];
        }
    }
    
    /**
     * 更新出库记录
     * @param {number} id 出库记录ID
     * @param {object} stockOutInfo 出库信息
     * @returns {Promise} 操作结果
     */
    async updateData(id, stockOutInfo) {
        try {
            // 获取原始出库记录
            const stockOut = await dbManager.getData(this.storeName, id);
            if (!stockOut) {
                return { success: false, message: "出库记录不存在" };
            }
            
            // 更新出库记录
            const updatedStockOut = {
                ...stockOut,
                ...stockOutInfo
            };
            
            // 如果是炮制或开方用药，需要确保outType正确
            if (updatedStockOut.outType === "炮制" || updatedStockOut.outType === "开方用药") {
                // 可以添加额外的验证逻辑
            }
            
            // 保存更新后的出库记录
            await dbManager.updateData(this.storeName, updatedStockOut);
            return { success: true, message: "出库记录更新成功" };
        } catch (error) {
            console.error("更新出库记录失败：", error);
            return { success: false, message: `更新失败：${error.message}` };
        }
    }
}

// 暴露全局实例
const stockOutManager = new StockOutManager();