/**
 * 开方管理模块
 * 负责开方记录、绑定诊疗日志、批量出库处理
 */
class PrescriptionManager {
    constructor() {
        this.storeName = "prescriptions";
        this.stockOutManager = stockOutManager;
        this.diagnosisLogManager = diagnosisLogManager;
    }

    /**
     * 新增开方记录（批量出库 + 绑定诊疗日志）
     * @param {array} drugList 开方药物列表 [{name, grams}]
     * @param {object} diagnosisLogInfo 诊疗日志信息
     * @returns {Promise} 操作结果
     */
    async addPrescription(drugList, diagnosisLogInfo) {
        if (!drugList || drugList.length === 0) {
            return { success: false, message: "开方药物列表不能为空" };
        }

        try {
            // 1. 先创建开方记录（临时，无诊疗日志ID）
            let totalGrams = 0;
            let totalAmount = 0;
            const drugDetailList = [];

            // 计算总克数，预计算总金额
            for (const drug of drugList) {
                const gramsNum = Number(drug.grams);
                totalGrams += gramsNum;

                const fifoResult = await this.stockOutManager.calculateFIFOAmount(drug.name, gramsNum);
                if (!fifoResult.success) {
                    return { success: false, message: `${drug.name}：${fifoResult.message}` };
                }

                totalAmount += fifoResult.totalAmount;
                drugDetailList.push({
                    ...drug,
                    grams: gramsNum,
                    amount: fifoResult.totalAmount
                });
            }

            // 2. 新增开方记录
            const prescription = {
                drugList: drugDetailList,
                totalGrams,
                totalAmount: Math.round(totalAmount * 100) / 100,
                createTime: new Date().toISOString(),
                diagnosisLogId: null
            };

            const savedPrescription = await dbManager.addData(this.storeName, prescription);

            // 3. 批量处理出库（开方用药类型）
            for (const drug of drugList) {
                const stockOutResult = await this.stockOutManager.addStockOut({
                    drugName: drug.name,
                    outType: "开方用药",
                    grams: drug.grams,
                    prescriptionId: savedPrescription.id,
                    remark: "开方诊疗出库"
                });

                if (!stockOutResult.success) {
                    // 回滚（简化处理，实际可增加事务回滚逻辑）
                    await dbManager.deleteData(this.storeName, savedPrescription.id);
                    return { success: false, message: `${drug.name}出库失败：${stockOutResult.message}` };
                }
            }

            // 4. 新增并绑定诊疗日志
            const logResult = await this.diagnosisLogManager.addDiagnosisLog(
                diagnosisLogInfo,
                savedPrescription.id
            );

            if (!logResult.success) {
                // 回滚
                await dbManager.deleteData(this.storeName, savedPrescription.id);
                return { success: false, message: `诊疗日志绑定失败：${logResult.message}` };
            }

            // 5. 更新开方记录的诊疗日志ID
            savedPrescription.diagnosisLogId = logResult.log.id;
            await dbManager.updateData(this.storeName, savedPrescription);

            return {
                success: true,
                message: "开方提交成功，诊疗日志已绑定",
                prescription: savedPrescription
            };
        } catch (error) {
            console.error("新增开方记录失败：", error);
            return { success: false, message: `开方失败：${error.message}` };
        }
    }

    /**
     * 获取最后一条开方记录（用于快速开方）
     * @returns {Promise} 开方记录对象
     */
    async getLastPrescription() {
        try {
            const prescriptions = await dbManager.getAllData(this.storeName);
            if (prescriptions.length === 0) {
                return null;
            }

            // 按创建时间降序，取第一条
            return prescriptions.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))[0];
        } catch (error) {
            console.error("获取最后一条开方记录失败：", error);
            return null;
        }
    }

    /**
     * 按时间范围获取开方记录
     * @param {string} startDate 开始时间（ISO格式）
     * @param {string} endDate 结束时间（ISO格式）
     * @returns {Promise} 开方记录数组
     */
    async getPrescriptionsByTime(startDate, endDate) {
        try {
            const prescriptions = await dbManager.filterData(this.storeName, (item) => {
                const createTime = new Date(item.createTime);
                return createTime >= new Date(startDate) && createTime <= new Date(endDate);
            });

            return prescriptions;
        } catch (error) {
            console.error("获取开方记录失败：", error);
            return [];
        }
    }
}

// 暴露全局实例
const prescriptionManager = new PrescriptionManager();