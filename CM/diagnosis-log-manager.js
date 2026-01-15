/**
 * 诊疗日志管理模块
 * 负责日志增删改查、绑定开方、默认值拉取
 */
class DiagnosisLogManager {
    constructor() {
        this.storeName = "diagnosisLogs";
        this.prescriptionStoreName = "prescriptions";
    }

    /**
     * 新增诊疗日志（绑定开方ID）
     * @param {object} logInfo 诊疗日志信息
     * @param {number} prescriptionId 开方ID
     * @returns {Promise} 操作结果
     */
    async addDiagnosisLog(logInfo, prescriptionId) {
        if (!prescriptionId) {
            return { success: false, message: "开方ID不能为空，无法绑定诊疗日志" };
        }

        try {
            // 校验开方是否存在
            const prescription = await dbManager.getData(this.prescriptionStoreName, prescriptionId);
            if (!prescription) {
                return { success: false, message: "对应的开方记录不存在" };
            }

            // 新增诊疗日志
            const diagnosisLog = {
                ...logInfo,
                prescriptionId: Number(prescriptionId),
                createTime: new Date().toISOString()
            };

            const result = await dbManager.addData(this.storeName, diagnosisLog);
            return { success: true, message: "诊疗日志新增成功", log: result };
        } catch (error) {
            console.error("新增诊疗日志失败：", error);
            return { success: false, message: `新增失败：${error.message}` };
        }
    }

    /**
     * 根据开方ID获取诊疗日志
     * @param {number} prescriptionId 开方ID
     * @returns {Promise} 诊疗日志对象
     */
    async getDiagnosisLogByPrescriptionId(prescriptionId) {
        try {
            return await dbManager.getDataByIndex(this.storeName, "prescriptionId", prescriptionId);
        } catch (error) {
            console.error("获取诊疗日志失败：", error);
            return null;
        }
    }

    /**
     * 获取最后一条诊疗日志（用于开方默认值）
     * @returns {Promise} 诊疗日志对象
     */
    async getLastDiagnosisLog() {
        try {
            const logs = await dbManager.getAllData(this.storeName);
            if (logs.length === 0) {
                return null;
            }

            // 按创建时间降序，取第一条
            return logs.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))[0];
        } catch (error) {
            console.error("获取最后一条诊疗日志失败：", error);
            return null;
        }
    }
}

// 暴露全局实例
const diagnosisLogManager = new DiagnosisLogManager();