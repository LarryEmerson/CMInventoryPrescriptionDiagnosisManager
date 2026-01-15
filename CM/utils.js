/**
 * 通用工具函数集合
 */
class Utils {
    /**
     * 生成唯一ID（简化版，实际项目可使用uuid库）
     * @returns {string} 唯一ID
     */
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 日期格式化（yyyy-MM-dd）
     * @param {Date|number} date 日期对象/时间戳
     * @returns {string} 格式化后的日期字符串
     */
    static formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    /**
     * 获取指定日期的开始时间戳（00:00:00）
     * @param {Date} date 日期对象
     * @returns {number} 开始时间戳
     */
    static getDayStartTimestamp(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }

    /**
     * 获取指定日期的结束时间戳（23:59:59）
     * @param {Date} date 日期对象
     * @returns {number} 结束时间戳
     */
    static getDayEndTimestamp(date) {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d.getTime();
    }

    /**
     * 获取昨日日期对象
     * @returns {Date} 昨日日期
     */
    static getYesterday() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
    }

    /**
     * 金额格式化（保留两位小数）
     * @param {number} amount 金额
     * @returns {string} 格式化后的金额字符串
     */
    static formatAmount(amount) {
        return Number(amount).toFixed(2);
    }

    /**
     * 校验字符串是否为空
     * @param {string} str 待校验字符串
     * @returns {boolean} 是否为空
     */
    static isEmptyStr(str) {
        return str === null || str === undefined || str.trim() === "";
    }

    /**
     * 校验数值是否为正数
     * @param {number|string} num 待校验数值
     * @returns {boolean} 是否为正数
     */
    static isPositiveNumber(num) {
        const n = Number(num);
        return !isNaN(n) && n > 0;
    }

    /**
     * 数组去重（根据指定属性）
     * @param {Array} arr 待去重数组
     * @param {string} prop 去重属性名
     * @returns {Array} 去重后的数组
     */
    static uniqueArrayByProp(arr, prop) {
        const map = new Map();
        return arr.filter(item => {
            const key = item[prop];
            if (!map.has(key)) {
                map.set(key, true);
                return true;
            }
            return false;
        });
    }
}