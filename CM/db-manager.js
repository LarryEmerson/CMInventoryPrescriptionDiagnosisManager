/**
 * 中药系统IndexedDB核心管理模块
 * 负责数据库生命周期、仓库创建、并发处理、通用CRUD
 */
class DBManager {
    static instance = null; // 单例模式
    static DB_NAME = "ChineseMedicineDB";
    static DB_VERSION = 1;
    static STORES = [
        { name: "sources", keyPath: "id", autoIncrement: true, indexes: [{ name: "name", unique: true }] },
        { name: "drugs", keyPath: "id", autoIncrement: true, indexes: [{ name: "name", unique: true }] },
        { name: "stockIns", keyPath: "id", autoIncrement: true, indexes: [{ name: "drugId", unique: false }, { name: "inTime", unique: false }] },
        { name: "stockOuts", keyPath: "id", autoIncrement: true, indexes: [{ name: "drugId", unique: false }, { name: "outType", unique: false }, { name: "outTime", unique: false }] },
        { name: "prescriptions", keyPath: "id", autoIncrement: true, indexes: [{ name: "createTime", unique: false }] },
        { name: "diagnosisLogs", keyPath: "id", autoIncrement: true, indexes: [{ name: "prescriptionId", unique: true }] }
    ];

    // 单例获取
    static getInstance() {
        if (!DBManager.instance) {
            DBManager.instance = new DBManager();
        }
        return DBManager.instance;
    }

    constructor() {
        this.db = null;
        this.transactionQueue = []; // 事务队列，处理并发
        this.isProcessing = false; // 是否正在处理事务
    }

    /**
     * 打开数据库并初始化仓库
     */
    async openDB() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            const request = indexedDB.open(DBManager.DB_NAME, DBManager.DB_VERSION);

            // 数据库升级/创建
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // 创建所有仓库
                DBManager.STORES.forEach(storeConfig => {
                    if (!db.objectStoreNames.contains(storeConfig.name)) {
                        const objectStore = db.createObjectStore(
                            storeConfig.name,
                            { keyPath: storeConfig.keyPath, autoIncrement: storeConfig.autoIncrement }
                        );
                        // 创建索引
                        storeConfig.indexes.forEach(index => {
                            objectStore.createIndex(index.name, index.name, { unique: index.unique });
                        });
                    }
                });
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                // 监听数据库关闭事件
                this.db.onclose = () => {
                    console.log("数据库连接已关闭");
                    this.db = null;
                };
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(new Error(`打开数据库失败：${event.target.error.message}`));
            };

            request.onblocked = () => {
                reject(new Error("数据库被其他连接阻塞，请关闭其他窗口后重试"));
            };
        });
    }

    /**
     * 关闭数据库
     */
    closeDB() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * 通用数据新增
     * @param {string} storeName 仓库名称
     * @param {object} data 新增数据
     * @returns {Promise} 新增结果
     */
    async addData(storeName, data) {
        return this.processTransaction({
            storeName,
            mode: "readwrite",
            operation: (objectStore) => {
                return new Promise((resolve, reject) => {
                    // 补充创建时间
                    data.createTime = new Date().toISOString();
                    const request = objectStore.add(data);

                    request.onsuccess = () => {
                        resolve({ id: request.result, ...data });
                    };

                    request.onerror = (event) => {
                        reject(new Error(`新增数据失败：${event.target.error.message}`));
                    };
                });
            }
        });
    }

    /**
     * 通用数据更新
     * @param {string} storeName 仓库名称
     * @param {object} data 更新数据（必须包含keyPath）
     * @returns {Promise} 更新结果
     */
    async updateData(storeName, data) {
        return this.processTransaction({
            storeName,
            mode: "readwrite",
            operation: (objectStore) => {
                return new Promise((resolve, reject) => {
                    // 补充更新时间
                    data.updateTime = new Date().toISOString();
                    const request = objectStore.put(data);

                    request.onsuccess = () => {
                        resolve(data);
                    };

                    request.onerror = (event) => {
                        reject(new Error(`更新数据失败：${event.target.error.message}`));
                    };
                });
            }
        });
    }

    /**
     * 通用数据删除
     * @param {string} storeName 仓库名称
     * @param {*} key 数据主键
     * @returns {Promise} 删除结果
     */
    async deleteData(storeName, key) {
        console.log('deleteData',storeName,key)
        return this.processTransaction({
            storeName,
            mode: "readwrite",
            operation: (objectStore) => {
                return new Promise((resolve, reject) => {
                    const request = objectStore.delete(key);

                    request.onsuccess = () => {
                        resolve(true);
                    };

                    request.onerror = (event) => {
                        reject(new Error(`删除数据失败：${event.target.error.message}`));
                    };
                });
            }
        });
    }

    /**
     * 根据主键获取单条数据
     * @param {string} storeName 仓库名称
     * @param {*} key 数据主键
     * @returns {Promise} 数据结果
     */
    async getData(storeName, key) {
        return this.processTransaction({
            storeName,
            mode: "readonly",
            operation: (objectStore) => {
                return new Promise((resolve, reject) => {
                    const request = objectStore.get(key);

                    request.onsuccess = () => {
                        resolve(request.result);
                    };

                    request.onerror = (event) => {
                        reject(new Error(`查询数据失败：${event.target.error.message}`));
                    };
                });
            }
        });
    }

    /**
     * 获取所有数据
     * @param {string} storeName 仓库名称
     * @returns {Promise} 数据数组
     */
    async getAllData(storeName) {
        return this.processTransaction({
            storeName,
            mode: "readonly",
            operation: (objectStore) => {
                return new Promise((resolve, reject) => {
                    const request = objectStore.getAll();

                    request.onsuccess = () => {
                        resolve(request.result);
                    };

                    request.onerror = (event) => {
                        reject(new Error(`查询所有数据失败：${event.target.error.message}`));
                    };
                });
            }
        });
    }

    /**
     * 删除所有数据
     * @param {string} storeName 仓库名称
     * @returns {Promise} 删除结果
     */
    async deleteAllData(storeName) {
        return this.processTransaction({
            storeName,
            mode: "readwrite",
            operation: (objectStore) => {
                return new Promise((resolve, reject) => {
                    const request = objectStore.clear();

                    request.onsuccess = () => {
                        resolve(true);
                    };

                    request.onerror = (event) => {
                        reject(new Error(`删除所有数据失败：${event.target.error.message}`));
                    };
                });
            }
        });
    }

    /**
     * 根据索引查询数据
     * @param {string} storeName 仓库名称
     * @param {string} indexName 索引名称
     * @param {*} value 索引值
     * @returns {Promise} 数据结果
     */
    async getDataByIndex(storeName, indexName, value) {
        return this.processTransaction({
            storeName,
            mode: "readonly",
            operation: (objectStore) => {
                return new Promise((resolve, reject) => {
                    const index = objectStore.index(indexName);
                    const request = index.get(value);

                    request.onsuccess = () => {
                        resolve(request.result);
                    };

                    request.onerror = (event) => {
                        reject(new Error(`索引查询失败：${event.target.error.message}`));
                    };
                });
            }
        });
    }

    /**
     * 根据条件过滤数据（简单过滤，复杂条件可扩展）
     * @param {string} storeName 仓库名称
     * @param {function} filter 过滤函数
     * @returns {Promise} 过滤后的数据数组
     */
    async filterData(storeName, filter) {
        return this.processTransaction({
            storeName,
            mode: "readonly",
            operation: (objectStore) => {
                return new Promise((resolve, reject) => {
                    const results = [];
                    const cursorRequest = objectStore.openCursor();

                    cursorRequest.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            if (filter(cursor.value)) {
                                results.push(cursor.value);
                            }
                            cursor.continue();
                        } else {
                            resolve(results);
                        }
                    };

                    cursorRequest.onerror = (event) => {
                        reject(new Error(`过滤数据失败：${event.target.error.message}`));
                    };
                });
            }
        });
    }

    /**
     * 事务处理核心（处理并发，队列化执行）
     * @param {object} task 事务任务
     * @returns {Promise} 事务执行结果
     */
    async processTransaction(task) {
        return new Promise((resolve, reject) => {
            // 将任务加入队列
            this.transactionQueue.push({
                task,
                resolve,
                reject
            });

            // 处理队列
            this.processQueue();
        });
    }

    /**
     * 处理事务队列
     */
    async processQueue() {
        // 正在处理或队列为空，直接返回
        if (this.isProcessing || this.transactionQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const { task, resolve, reject } = this.transactionQueue.shift();

        try {
            // 确保数据库已打开
            const db = await this.openDB();

            // 开启事务
            const transaction = db.transaction(task.storeName, task.mode);
            const objectStore = transaction.objectStore(task.storeName);

            // 事务失败
            transaction.onerror = (event) => {
                reject(new Error(`事务执行失败：${event.target.error.message}`));
            };

            // 事务完成
            transaction.oncomplete = () => {
                this.isProcessing = false;
                // 继续处理下一个任务
                this.processQueue();
            };

            // 执行具体操作
            const result = await task.operation(objectStore);
            resolve(result);
        } catch (error) {
            reject(error);
            this.isProcessing = false;
            this.processQueue();
        }
    }
}

// 暴露全局实例
const dbManager = DBManager.getInstance();
// 确保deleteAllData方法存在
if (!dbManager.deleteAllData) {
    console.error('deleteAllData方法不存在');
}
window.dbManager = dbManager;
console.log('dbManager实例已暴露，deleteAllData方法存在:', typeof dbManager.deleteAllData);