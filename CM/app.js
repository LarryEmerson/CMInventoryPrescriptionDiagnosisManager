/**
 * 前端交互入口模块
 * 负责DOM绑定、页面刷新、交互逻辑处理
 */
class App {
    constructor() {
        // DOM元素
        this.tipBox = document.getElementById("tipBox");
        this.prescriptionDrugList = document.getElementById("prescriptionDrugList");
        this.drugSelectPopup = document.getElementById("drugSelectPopup");
        this.selectableDrugList = document.getElementById("selectableDrugList");
        // 批量操作弹窗DOM元素
        this.batchSourcePopup = document.getElementById("batchSourcePopup");
        this.batchDrugPopup = document.getElementById("batchDrugPopup");
        this.batchStockInPopup = document.getElementById("batchStockInPopup");
        // 导入相关DOM元素
        this.importPopup = document.getElementById("importPopup");
        this.importPopupTitle = document.getElementById("importPopupTitle");
        this.importFormatExample = document.getElementById("importFormatExample");
        this.importTextArea = document.getElementById("importTextArea");
        // 备份恢复相关DOM元素
        this.backupBtn = document.getElementById("backupBtn");
        this.restoreBtn = document.getElementById("restoreBtn");
        this.restoreFileInput = null;
        // Tab相关DOM元素
        this.tabBtns = document.querySelectorAll(".tab-btn");
        this.tabPanels = document.querySelectorAll(".tab-panel");
        // 当前导入类型
        this.currentImportType = null;

        // 开方药物列表（内存中维护）
        this.currentPrescriptionDrugs = [];

        // 初始化
        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        // 绑定所有事件
        this.bindEvents();
        this.bindImportEvents();

        // 刷新页面数据
        await this.refreshPage();

        // 加载上次开方记录
        await this.loadLastPrescription();

        // 加载最后一条诊疗日志（默认值）
        await this.loadLastDiagnosisLog();
        
        // 默认选择统计标签
        this.switchTab("statistics");
    }

    /**
     * 绑定DOM事件
     */
    bindEvents() {
        // 备份按钮事件
        this.backupBtn.addEventListener("click", async () => {
            await this.handleBackup();
        });

        // 恢复按钮事件
        this.restoreBtn.addEventListener("click", () => {
            this.handleRestore();
        });

        // Tab按钮事件
        this.tabBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const tabId = e.target.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // 新增来源
        document.getElementById("addSourceBtn").addEventListener("click", async () => {
            const name = document.getElementById("sourceName").value;
            const remark = document.getElementById("sourceRemark").value;
            const result = await sourceManager.addSource(name, remark);
            this.showTip(result.success, result.message);

            if (result.success) {
                document.getElementById("sourceName").value = "";
                document.getElementById("sourceRemark").value = "";
                // 刷新来源下拉框和来源列表
                this.loadSourceSelect();
                this.loadSourceList();
            }
        });

        // 新增药物
        document.getElementById("addDrugBtn").addEventListener("click", async () => {
            const drugInfo = {
                name: document.getElementById("drugName").value,
                storageType: document.getElementById("storageType").value,
                minStock: document.getElementById("minStock").value,
                defaultEstimate: document.getElementById("defaultEstimate").value
            };
            const result = await drugManager.addDrug(drugInfo);
            this.showTip(result.success, result.message);

            if (result.success) {
                document.getElementById("drugName").value = "";
                document.getElementById("minStock").value = "100";
                document.getElementById("defaultEstimate").value = "10";
                // 刷新药物下拉框和药物列表
                this.loadDrugSelect();
                this.loadDrugList();
            }
        });

        // 确认入库
        document.getElementById("addStockInBtn").addEventListener("click", async () => {
            const drugSelect = document.getElementById("stockInDrug");
            const sourceSelect = document.getElementById("stockInSource");
            const stockInInfo = {
                drugId: drugSelect.value,
                drugName: drugSelect.options[drugSelect.selectedIndex].text,
                sourceId: sourceSelect.value,
                sourceName: sourceSelect.options[sourceSelect.selectedIndex].text,
                grams: document.getElementById("stockInGrams").value,
                totalAmount: document.getElementById("stockInAmount").value,
                remark: document.getElementById("stockInRemark").value
            };
            const result = await stockInManager.addStockIn(stockInInfo);
            this.showTip(result.success, result.message);

            if (result.success) {
                document.getElementById("stockInGrams").value = "500";
                document.getElementById("stockInAmount").value = "100.00";
                document.getElementById("stockInRemark").value = "";
                // 刷新入库记录
                this.loadStockInList();
            }
        });

        // 新增药物到开方
        document.getElementById("addDrugToPresBtn").addEventListener("click", async () => {
            // 过滤已选药物，排序
            const selectedDrugNames = this.currentPrescriptionDrugs.map(d => d.name);
            const sortedDrugs = await drugManager.sortDrugs(selectedDrugNames);

            // 渲染可选药物列表
            this.renderSelectableDrugs(sortedDrugs);

            // 显示弹窗
            this.drugSelectPopup.style.display = "flex";
        });

        // 关闭药物选择弹窗
        document.getElementById("closePopupBtn").addEventListener("click", () => {
            this.drugSelectPopup.style.display = "none";
        });

        // 批量新增来源按钮
        document.getElementById("batchAddSourceBtn").addEventListener("click", () => {
            this.batchSourcePopup.style.display = "flex";
        });

        // 关闭批量新增来源弹窗
        document.getElementById("closeBatchSourceBtn").addEventListener("click", () => {
            this.batchSourcePopup.style.display = "none";
            document.getElementById("batchSourceText").value = "";
        });

        // 批量新增来源删除全部按钮 - 修改为删除所有来源数据
        document.getElementById("clearAllSourceBtn").addEventListener("click", async () => {
            if (confirm("确定要删除所有药物来源数据吗？此操作不可恢复！")) {
                try {
                    await window.dbManager.deleteAllData("sources");
                    this.showTip(true, "所有药物来源数据已删除");
                    // 刷新相关UI
                    this.loadSourceSelect();
                    this.loadSourceList();
                } catch (error) {
                    this.showTip(false, `删除失败：${error.message}`);
                }
            }
        });

        // 确认批量新增来源
        document.getElementById("confirmBatchSourceBtn").addEventListener("click", async () => {
            await this.handleBatchAddSource();
        });

        // 批量新增药物按钮
        document.getElementById("batchAddDrugBtn").addEventListener("click", () => {
            this.batchDrugPopup.style.display = "flex";
        });

        // 关闭批量新增药物弹窗
        document.getElementById("closeBatchDrugBtn").addEventListener("click", () => {
            this.batchDrugPopup.style.display = "none";
            document.getElementById("batchDrugText").value = "";
        });

        // 批量新增药物删除全部按钮 - 修改为删除所有药物数据
        document.getElementById("clearAllDrugBtn").addEventListener("click", async () => {
            // if (confirm("确定要删除所有药物数据吗？此操作不可恢复！")) {
                try {
                    await window.dbManager.deleteAllData("drugs");
                    this.showTip(true, "所有药物数据已删除");
                    // 刷新相关UI
                    this.loadDrugSelect();
                    this.loadDrugList();
                } catch (error) {
                    this.showTip(false, `删除失败：${error.message}`);
                }
            // }
        });

        // 确认批量新增药物
        document.getElementById("confirmBatchDrugBtn").addEventListener("click", async () => {
            await this.handleBatchAddDrug();
        });

        // 批量入库按钮
        document.getElementById("batchStockInBtn").addEventListener("click", () => {
            this.batchStockInPopup.style.display = "flex";
        });

        // 关闭批量入库弹窗
        document.getElementById("closeBatchStockInBtn").addEventListener("click", () => {
            this.batchStockInPopup.style.display = "none";
            document.getElementById("batchStockInText").value = "";
        });

        // 批量入库删除全部按钮 - 修改为删除所有入库数据
        document.getElementById("clearAllStockInBtn").addEventListener("click", async () => {
            // if (confirm("确定要删除所有入库数据吗？此操作不可恢复！")) {
                try {
                    // 确保使用全局的dbManager实例
                    console.log('>>1', window.dbManager, window.dbManager.deleteAllData);
                    await window.dbManager.deleteAllData("stockIns");
                    this.showTip(true, "所有入库数据已删除");
                    // 刷新相关UI
                    this.loadStockInList();
                } catch (error) {
                    this.showTip(false, `删除失败：${error.message}`);
                }
            // }
        });

        // 确认批量入库
        document.getElementById("confirmBatchStockInBtn").addEventListener("click", async () => {
            await this.handleBatchStockIn();
        });

        // 提交开方
            document.getElementById("submitPrescriptionBtn").addEventListener("click", async () => {
            if (this.currentPrescriptionDrugs.length === 0) {
                this.showTip(false, "开方药物列表不能为空");
                return;
            }

            // 收集诊疗日志信息
            const diagnosisLogInfo = this.collectDiagnosisLogInfo();

            // 提交开方
            const result = await prescriptionManager.addPrescription(
                this.currentPrescriptionDrugs,
                diagnosisLogInfo
            );

            this.showTip(result.success, result.message);

            if (result.success) {
                // 刷新页面
                setTimeout(async () => {
                    await this.refreshPage();
                    this.currentPrescriptionDrugs = [];
                    this.renderPrescriptionDrugs();
                }, 1000);
            }
        });
    }

    /**
     * 切换Tab面板
     * @param {string} tabId 要切换的Tab ID
     */
    switchTab(tabId) {
        // 移除所有Tab按钮的active类
        this.tabBtns.forEach(btn => {
            btn.classList.remove("active");
        });

        // 移除所有Tab面板的active类
        this.tabPanels.forEach(panel => {
            panel.classList.remove("active");
        });

        // 添加当前Tab按钮的active类
        const currentBtn = document.querySelector(`[data-tab="${tabId}"]`);
        if (currentBtn) {
            currentBtn.classList.add("active");
        }

        // 添加当前Tab面板的active类
        const currentPanel = document.getElementById(tabId);
        if (currentPanel) {
            currentPanel.classList.add("active");
        }
    }

    /**
     * 刷新页面所有数据
     */
    async refreshPage() {
        // 加载来源和药物下拉框
        await this.loadSourceSelect();
        await this.loadDrugSelect();

        // 加载昨日统计
        const yesterdayStats = await statsManager.getDailyPrescriptionStats("yesterday");
        this.renderDailyStats("yesterday", yesterdayStats);

        // 加载今日统计
        const todayStats = await statsManager.getDailyPrescriptionStats("today");
        this.renderDailyStats("today", todayStats);

        // 加载预警统计
        const warningStats = await statsManager.getWarningStats();
        this.renderWarningStats(warningStats);
        
        // 加载药物列表
        await this.loadDrugList();
        
        // 加载来源列表
        await this.loadSourceList();
        
        // 加载出库记录
        await this.loadStockOutList();
        
        // 加载入库记录
        await this.loadStockInList();
    }

    /**
     * 加载入库记录
     */
    async loadStockInList() {
        try {
            const stockIns = await stockInManager.getAllStockIns();
            this.renderStockInList(stockIns);
        } catch (error) {
            console.error("加载入库记录失败：", error);
        }
    }

    /**
     * 渲染入库记录（按日期分段）
     * @param {Array} stockIns 入库记录数组
     */
    renderStockInList(stockIns) {
        const stockInList = document.getElementById('stockInList');
        if (!stockInList) return;

        // 按日期分组
        const groupedByDate = stockIns.reduce((groups, stockIn) => {
            const date = new Date(stockIn.inTime).toLocaleDateString();
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(stockIn);
            return groups;
        }, {});

        // 渲染分组后的记录
        let html = '';
        
        // 按日期降序排序
        const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));
        
        sortedDates.forEach(date => {
            const dateStockIns = groupedByDate[date];
            
            html += `
                <div class="date-group">
                    <div class="date-header">${date}</div>
                    <div class="stock-in-records">
            `;
            
            dateStockIns.forEach(stockIn => {
                html += `
                    <div class="stock-in-item">
                        <div class="stock-in-info">
                            <div class="drug-info">
                                <span class="drug-name">${stockIn.drugName}</span>
                                <span class="drug-amount">${stockIn.grams}g / ¥${stockIn.totalAmount.toFixed(2)}</span>
                                <span class="drug-unit-price">单价：¥${(stockIn.totalAmount / stockIn.grams).toFixed(4)}/g</span>
                            </div>
                            <div class="source-info">来源：${stockIn.sourceName}</div>
                        </div>
                        <div class="stock-in-details">
                            <button class="detail-btn" onclick="app.showStockInDetails('${stockIn.id}')">查看详情</button>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        // 如果没有入库记录
        if (sortedDates.length === 0) {
            html = '<div class="no-records">暂无入库记录</div>';
        }
        
        stockInList.innerHTML = html;
    }

    /**
     * 显示入库详情
     * @param {string} stockInId 入库记录ID
     */
    async showStockInDetails(stockInId) {
        try {
            const stockIns = await stockInManager.getAllStockIns();
            const stockIn = stockIns.find(si => si.id === stockInId);
            
            if (stockIn) {
                // 这里可以添加弹窗显示详情的逻辑
                alert(
                    `入库详情：\n` +
                    `ID: ${stockIn.id}\n` +
                    `药物: ${stockIn.drugName}\n` +
                    `来源: ${stockIn.sourceName}\n` +
                    `克数: ${stockIn.grams}g\n` +
                    `总金额: ¥${stockIn.totalAmount.toFixed(2)}\n` +
                    `单价: ¥${stockIn.unitPrice.toFixed(2)}/g\n` +
                    `时间: ${new Date(stockIn.inTime).toLocaleString()}\n` +
                    `备注: ${stockIn.remark || '无'}`
                );
            }
        } catch (error) {
            console.error("获取入库详情失败：", error);
        }
    }
    
    /**
     * 显示出库详情
     * @param {string} stockOutId 出库记录ID
     */
    async showStockOutDetails(stockOutId) {
        try {
            const stockOuts = await stockOutManager.getAllStockOuts();
            const stockOut = stockOuts.find(so => so.id === stockOutId);
            
            if (stockOut) {
                // 显示出库详情
                alert(
                    `出库详情：\n` +
                    `ID: ${stockOut.id}\n` +
                    `药物: ${stockOut.drugName}\n` +
                    `克数: ${stockOut.grams}g\n` +
                    `总价值: ¥${stockOut.totalAmount.toFixed(2)}\n` +
                    `出库类型: ${stockOut.outType}\n` +
                    `时间: ${new Date(stockOut.outTime).toLocaleString()}\n` +
                    `备注: ${stockOut.remark || '无'}`
                );
            }
        } catch (error) {
            console.error("获取出库详情失败：", error);
        }
    }

    /**
     * 加载来源下拉框
     */
    async loadSourceSelect() {
        const sourceSelect = document.getElementById("stockInSource");
        const sources = await sourceManager.getSourceList();

        // 清空下拉框
        sourceSelect.innerHTML = "";

        // 添加选项
        sources.forEach(source => {
            const option = document.createElement("option");
            option.value = source.id;
            option.textContent = source.name;
            sourceSelect.appendChild(option);
        });
    }

    /**
     * 加载药物下拉框
     */
    async loadDrugSelect() {
        const drugSelect = document.getElementById("stockInDrug");
        const drugs = await drugManager.getDrugList();

        // 清空下拉框
        drugSelect.innerHTML = "";

        // 添加选项
        drugs.forEach(drug => {
            const option = document.createElement("option");
            option.value = drug.id;
            option.textContent = drug.name;
            drugSelect.appendChild(option);
        });
    }

    /**
     * 渲染每日统计数据
     * @param {string} type 日期类型（yesterday/today）
     * @param {object} stats 统计数据
     */
    renderDailyStats(type, stats) {
        const prefix = type === "yesterday" ? "yesterday" : "today";

        document.getElementById(`${prefix}TotalGrams`).textContent = stats.totalGrams;
        document.getElementById(`${prefix}TotalTypes`).textContent = stats.totalTypes;
        document.getElementById(`${prefix}TotalAmount`).textContent = stats.totalAmount;

        const drugListEl = document.getElementById(`${prefix}DrugList`);
        drugListEl.innerHTML = "";

        stats.drugList.forEach(drug => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${drug.name}</td>
                <td>${drug.grams}</td>
                <td>${drug.amount}</td>
            `;
            drugListEl.appendChild(row);
        });
    }

    /**
     * 渲染预警统计数据
     * @param {object} stats 预警统计数据
     */
    renderWarningStats(stats) {
        document.getElementById("warningCount").textContent = stats.count;

        const warningListEl = document.getElementById("warningDrugList");
        warningListEl.innerHTML = "";

        stats.list.forEach(drug => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${drug.name}</td>
                <td>${drug.currentStock}</td>
                <td>${drug.minStock}</td>
            `;
            warningListEl.appendChild(row);
        });
    }
    
    /**
     * 加载药物列表
     */
    async loadDrugList() {
        const drugs = await drugManager.getDrugList();
        this.renderDrugList(drugs);
    }
    
    /**
     * 渲染药物列表
     */
    renderDrugList(drugs) {
        const tbody = document.getElementById('drugTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        drugs.forEach(drug => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${drug.name}</td>
                <td>${drug.storageType}</td>
                <td>${drug.minStock}</td>
                <td>${drug.currentEstimate}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    /**
     * 加载来源列表
     */
    async loadSourceList() {
        const sources = await sourceManager.getSourceList();
        this.renderSourceList(sources);
    }
    
    /**
     * 渲染来源列表
     */
    renderSourceList(sources) {
        const tbody = document.getElementById('sourceTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        sources.forEach(source => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${source.name}</td>
                <td>${source.remark || ''}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    /**
     * 加载出库记录
     */
    async loadStockOutList() {
        const stockOuts = await stockOutManager.getAllStockOuts();
        this.renderStockOutList(stockOuts);
    }
    
    /**
     * 将日期时间格式化为YYYY/MM/DD/HH/mm格式
     * @param {Date} date 要格式化的日期时间对象
     * @returns {string} 格式化后的日期时间字符串
     */
    formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}/${month}/${day}/${hours}/${minutes}`;
    }

    /**
     * 渲染出库记录（按YYYY/MM/DD/HH/mm格式分组）
     */
    renderStockOutList(stockOuts) {
        const container = document.getElementById('stockOutList');
        if (!container) return;
        
        if (stockOuts.length === 0) {
            container.innerHTML = '<p>暂无出库记录</p>';
            return;
        }
        
        // 按YYYY/MM/DD/HH/mm格式分组
        const groupedByDateTime = stockOuts.reduce((groups, stockOut) => {
            const date = new Date(stockOut.outTime);
            const formattedDateTime = this.formatDateTime(date);
            if (!groups[formattedDateTime]) {
                groups[formattedDateTime] = [];
            }
            groups[formattedDateTime].push(stockOut);
            return groups;
        }, {});
        
        // 渲染分组后的记录
        let html = '';
        
        // 按日期时间降序排序
        const sortedDateTimes = Object.keys(groupedByDateTime).sort((a, b) => {
            // 将YYYY/MM/DD/HH/mm格式转换为日期对象进行比较
            const dateA = new Date(a.replace(/\//g, '-').replace(/(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})/, '$1T$2:$3:00'));
            const dateB = new Date(b.replace(/\//g, '-').replace(/(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})/, '$1T$2:$3:00'));
            return dateB - dateA;
        });
        
        sortedDateTimes.forEach(formattedDateTime => {
            const timeStockOuts = groupedByDateTime[formattedDateTime];
            
            // 创建分组标题
            html += `
                <div class="date-group">
                    <div class="date-header">${formattedDateTime}</div>
                    <div class="stock-out-records">
            `;
            
            // 渲染当前分组下的出库记录
            timeStockOuts.forEach(stockOut => {
                html += `
                    <div class="stock-out-record">
                        <div class="record-header">
                            <!-- 移除时间显示，因为分组标题已经显示 -->
                        </div>
                        <div class="record-content">
                            <div>药物：${stockOut.drugName}</div>
                            <div>数量：${stockOut.grams}g</div>
                            <div>总价值：${stockOut.totalAmount}元</div>
                            <div>类型：${stockOut.outType}</div>
                            ${stockOut.remark ? `<div>备注：${stockOut.remark}</div>` : ''}
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    /**
     * 加载上次开方记录
     */
    async loadLastPrescription() {
        const lastPrescription = await prescriptionManager.getLastPrescription();
        if (lastPrescription) {
            this.currentPrescriptionDrugs = lastPrescription.drugList.map(d => ({
                name: d.name,
                grams: d.grams
            }));
            this.renderPrescriptionDrugs();
        }
    }

    /**
     * 渲染开方药物列表
     */
    renderPrescriptionDrugs() {
        this.prescriptionDrugList.innerHTML = "";

        this.currentPrescriptionDrugs.forEach((drug, index) => {
            const drugItem = document.createElement("div");
            drugItem.className = "prescription-drug-item";

            drugItem.innerHTML = `
                <span>${drug.name}</span> 
                <input type="number" class="drug-grams-input" data-index="${index}" value="${drug.grams}" min="1" step="1">
                <button class="delete-drug-btn" data-index="${index}">删除</button>
            `;

            // 绑定克数修改事件
            drugItem.querySelector(".drug-grams-input").addEventListener("change", (e) => {
                const index = Number(e.target.dataset.index);
                const grams = Number(e.target.value);
                if (grams > 0) {
                    this.currentPrescriptionDrugs[index].grams = grams;
                }
            });

            // 绑定删除事件
            drugItem.querySelector(".delete-drug-btn").addEventListener("click", (e) => {
                const index = Number(e.target.dataset.index);
                this.currentPrescriptionDrugs.splice(index, 1);
                this.renderPrescriptionDrugs();
            });

            this.prescriptionDrugList.appendChild(drugItem);
        });
    }

    /**
     * 渲染可选药物列表（表格样式，核心修改）
     * @param {array} drugs 排序后的药物数组
     */
    renderSelectableDrugs(drugs) {
        this.selectableDrugList.innerHTML = "";
        // 无药物时提示
        if (drugs.length === 0) {
            this.selectableDrugList.innerHTML = "<p style='text-align: center; padding: 20px;'>暂无可选药物</p>";
            return;
        }
        // 创建表格
        const table = document.createElement("table");
        table.className = "drug-table";
        // 创建表头
        const thead = document.createElement("thead");
        thead.innerHTML = `
        <tr>
            <th>名称</th>
            <th>频率</th>
            <th>剩余（克）</th>
            <th>剩余预估次数</th>
        </tr>
    `;
        // 创建表体
        const tbody = document.createElement("tbody");
        // 循环渲染药物行
        drugs.forEach(drug => {
            const tr = document.createElement("tr");
            // 格式化数值，保留2位小数
            const currentStock = Math.round(drug.currentStock * 100) / 100;
            const remainingUses = Math.round(drug.remainingUses * 100) / 100;
            tr.innerHTML = `
            <td>${drug.name}</td>
            <td>${drug.useCount}次</td>
            <td>${currentStock}g</td>
            <td>${remainingUses}次</td>
        `;
            // 绑定行点击选择事件
            tr.addEventListener("click", () => {
                // 添加到开方列表（默认克数为动态预估量）
                this.currentPrescriptionDrugs.push({
                    name: drug.name,
                    grams: drug.currentEstimate
                });
                // 刷新开方列表，关闭弹窗
                this.renderPrescriptionDrugs();
                this.drugSelectPopup.style.display = "none";
            });
            tbody.appendChild(tr);
        });
        // 拼接表格并添加到容器
        table.appendChild(thead);
        table.appendChild(tbody);
        this.selectableDrugList.appendChild(table);
    }

    /**
     * 加载最后一条诊疗日志（默认值）
     */
    async loadLastDiagnosisLog() {
        const lastLog = await diagnosisLogManager.getLastDiagnosisLog();
        if (lastLog) {
            // 填充尿液情况
            if (lastLog.urine) {
                document.getElementById("nightUrineVolume").value = lastLog.urine.nightUrineVolume || "5";
                document.getElementById("nightUrineFoam").value = lastLog.urine.nightUrineFoam || "无";
                document.getElementById("nightUrineColor").value = lastLog.urine.nightUrineColor || "黄";
                document.getElementById("nightUrineDeposit").value = lastLog.urine.nightUrineDeposit || "5";
                // 沉淀颜色：下拉框回显（核心修改）
                document.getElementById("nightUrineDepositColor").value = lastLog.urine.nightUrineDepositColor || "白";
                document.getElementById("shortUrineVolume").value = lastLog.urine.shortUrineVolume || "5";
                document.getElementById("shortUrineColor").value = lastLog.urine.shortUrineColor || "黄";
                document.getElementById("shortUrineRemark").value = lastLog.urine.shortUrineRemark || "";
            }
            // 填充大便情况
            if (lastLog.stool) {
                document.getElementById("stoolColor").value = lastLog.stool.color || "黄色";
                document.getElementById("stoolShape").value = lastLog.stool.shape || "成型";
            }

            // 填充睡眠情况（简化，可扩展所有时间段）
            if (lastLog.sleep) {
                document.getElementById("sleepNoon").value = lastLog.sleep.noon || "浅睡";
                document.getElementById("sleep9").value = lastLog.sleep["9"] || "浅睡";
                document.getElementById("sleep10").value = lastLog.sleep["10"] || "多梦";
            }

            // 填充运动情况
            if (lastLog.exercise) {
                document.getElementById("exerciseMorning").value = lastLog.exercise.morning || "无";
                document.getElementById("exerciseNoon").value = lastLog.exercise.noon || "无";
                document.getElementById("exerciseEvening").value = lastLog.exercise.evening || "无";
            }

            // 填充其他情况
            if (lastLog.other) {
                document.getElementById("morningWeak").value = lastLog.other.morningWeak || "否";
                document.getElementById("dietBloating").value = lastLog.other.dietBloating || "否";
                document.getElementById("dietAbdominalPain").value = lastLog.other.dietAbdominalPain || "否";
                document.getElementById("dietAppetite").value = lastLog.other.dietAppetite || "否";
                document.getElementById("hasDiarrhea").value = lastLog.other.hasDiarrhea || "否";
                document.getElementById("otherRemark").value = lastLog.other.remark || "";
            }
        }
    }

    /**
     * 收集诊疗日志信息
     * @returns {object} 诊疗日志信息
     */
    collectDiagnosisLogInfo() {
        // 收集尿液情况
        const urine = {
            nightUrineVolume: document.getElementById("nightUrineVolume").value,
            nightUrineFoam: document.getElementById("nightUrineFoam").value,
            nightUrineColor: document.getElementById("nightUrineColor").value,
            nightUrineDeposit: document.getElementById("nightUrineDeposit").value,
            nightUrineDepositColor: document.getElementById("nightUrineDepositColor").value,
            shortUrineVolume: document.getElementById("shortUrineVolume").value,
            shortUrineColor: document.getElementById("shortUrineColor").value,
            shortUrineRemark: document.getElementById("shortUrineRemark").value
        };

        // 收集大便情况
        const stool = {
            color: document.getElementById("stoolColor").value,
            shape: document.getElementById("stoolShape").value
        };

        // 收集睡眠情况
        const sleep = {
            noon: document.getElementById("sleepNoon").value,
            "9": document.getElementById("sleep9").value,
            "10": document.getElementById("sleep10").value,
            "11": document.getElementById("sleep11").value,
            "12": document.getElementById("sleep12").value,
            "1": document.getElementById("sleep1").value,
            "2": document.getElementById("sleep2").value,
            "3": document.getElementById("sleep3").value,
            "4": document.getElementById("sleep4").value,
            "5": document.getElementById("sleep5").value,
            "6": document.getElementById("sleep6").value,
            "7": document.getElementById("sleep7").value,
            assist: document.getElementById("sleepAssist").value
        };

        // 收集运动情况
        const exercise = {
            morning: document.getElementById("exerciseMorning").value,
            noon: document.getElementById("exerciseNoon").value,
            evening: document.getElementById("exerciseEvening").value
        };

        // 收集其他情况
        const other = {
            morningWeak: document.getElementById("morningWeak").value,
            dietBloating: document.getElementById("dietBloating").value,
            dietAbdominalPain: document.getElementById("dietAbdominalPain").value,
            dietAppetite: document.getElementById("dietAppetite").value,
            hasDiarrhea: document.getElementById("hasDiarrhea").value,
            remark: document.getElementById("otherRemark").value
        };

        return { urine, stool, sleep, exercise, other };
    }

    /**
     * 显示操作提示
     * @param {boolean} isSuccess 是否成功
     * @param {string} message 提示信息
     */
    showTip(isSuccess, message) {
        this.tipBox.textContent = message;
        this.tipBox.className = `tip-box ${isSuccess ? "tip-success" : "tip-error"}`;
        this.tipBox.style.display = "block";

        // 3秒后隐藏
        setTimeout(() => {
            this.tipBox.style.display = "none";
        }, 3000);
    }

    /**
     * 绑定导入相关事件
     */
    bindImportEvents() {
        // 来源导入按钮
        const importSourcesBtn = document.getElementById("importSourcesBtn");
        if (importSourcesBtn) {
            importSourcesBtn.addEventListener("click", () => {
                this.showImportPopup("source");
            });
        }

        // 药物导入按钮
        const importDrugsBtn = document.getElementById("importDrugsBtn");
        if (importDrugsBtn) {
            importDrugsBtn.addEventListener("click", () => {
                this.showImportPopup("drug");
            });
        }

        // 入库导入按钮
        const importStockInBtn = document.getElementById("importStockInBtn");
        if (importStockInBtn) {
            importStockInBtn.addEventListener("click", () => {
                this.showImportPopup("stockIn");
            });
        }

        // 取消导入
        const cancelImportBtn = document.getElementById("cancelImportBtn");
        if (cancelImportBtn) {
            cancelImportBtn.addEventListener("click", () => {
                this.hideImportPopup();
            });
        }

        // 确认导入
        const confirmImportBtn = document.getElementById("confirmImportBtn");
        if (confirmImportBtn) {
            confirmImportBtn.addEventListener("click", async () => {
                await this.handleImport();
            });
        }
    }

    /**
     * 显示导入弹窗
     * @param {string} type 导入类型：source/drug/stockIn
     */
    showImportPopup(type) {
        this.currentImportType = type;
        
        // 设置弹窗标题和格式说明
        switch (type) {
            case "source":
                this.importPopupTitle.textContent = "批量导入药物来源";
                this.importFormatExample.textContent = "京东 京东来源备注\n抖音 抖音来源备注";
                break;
            case "drug":
                this.importPopupTitle.textContent = "批量导入中药药物";
                this.importFormatExample.textContent = "甘草 密封 100 10\n黄芪 密封 200 12";
                break;
            case "stockIn":
                this.importPopupTitle.textContent = "批量导入药物入库";
                this.importFormatExample.textContent = "甘草 京东 400 100 入库备注\n黄芪 抖音 200 50 入库备注";
                break;
        }

        // 清空输入框
        this.importTextArea.value = "";
        
        // 显示弹窗
        this.importPopup.style.display = "flex";
    }

    /**
     * 隐藏导入弹窗
     */
    hideImportPopup() {
        this.importPopup.style.display = "none";
        this.currentImportType = null;
    }

    /**
     * 处理导入逻辑
     */
    async handleImport() {
        const importText = this.importTextArea.value.trim();
        if (!importText) {
            this.showTip(false, "请输入要导入的数据");
            return;
        }

        try {
            let successCount = 0;
            let errorCount = 0;
            
            // 根据导入类型处理
            switch (this.currentImportType) {
                case "source":
                    ({ successCount, errorCount } = await this.importSources(importText));
                    break;
                case "drug":
                    ({ successCount, errorCount } = await this.importDrugs(importText));
                    break;
                case "stockIn":
                    ({ successCount, errorCount } = await this.importStockIns(importText));
                    break;
            }

            // 显示导入结果
            this.showTip(true, `导入完成：成功${successCount}条，失败${errorCount}条`);
            
            // 隐藏弹窗
            this.hideImportPopup();
            
            // 刷新页面数据
            await this.refreshPage();
        } catch (error) {
            this.showTip(false, error.message);
        }
    }

    /**
     * 批量导入药物来源
     */
    async importSources(importText) {
        const lines = importText.split("\n").filter(line => line.trim());
        let successCount = 0;
        let errorCount = 0;
        let errorMessages = [];
        let failedData = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const parts = line.split(/\s+/);
            
            try {
                if (parts.length < 1) {
                    throw new Error(`第${i + 1}行格式错误：数据不完整`);
                }

                const name = parts[0];
                const remark = parts.slice(1).join(" ");

                // 校验重复
                const existingSource = await dbManager.getDataByIndex("sources", "name", name);
                if (existingSource) {
                    throw new Error(`第${i + 1}行：来源"${name}"已存在`);
                }

                // 新增来源
                const result = await sourceManager.addSource(name, remark);
                if (result.success) {
                    successCount++;
                } else {
                    throw new Error(`第${i + 1}行：${result.message}`);
                }
            } catch (error) {
                errorCount++;
                errorMessages.push(error.message);
                failedData.push(line);
            }
        }

        // 显示所有错误信息和失败数据
        if (errorMessages.length > 0) {
            let errorText = errorMessages.join("\n") + "\n\n失败的数据：\n" + failedData.join("\n") + "\n\n请复制失败的数据进行修正后重新导入。";
            this.showTip(false, errorText);
        }

        return { successCount, errorCount };
    }

    /**
     * 批量导入中药药物
     */
    async importDrugs(importText) {
        const lines = importText.split("\n").filter(line => line.trim());
        let successCount = 0;
        let errorCount = 0;
        let errorMessages = [];
        let failedData = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const parts = line.split(/\s+/);
            
            try {
                if (parts.length < 4) {
                    throw new Error(`第${i + 1}行格式错误：数据不完整`);
                }

                const name = parts[0];
                const storageType = parts[1];
                const minStock = parts[2];
                const defaultEstimate = parts[3];

                // 校验存储方式
                if (storageType !== "密封" && storageType !== "冷藏") {
                    throw new Error(`第${i + 1}行：存储方式必须为"密封"或"冷藏"`);
                }

                // 校验数值
                if (isNaN(minStock) || isNaN(defaultEstimate) || Number(minStock) < 0 || Number(defaultEstimate) < 1) {
                    throw new Error(`第${i + 1}行：数值格式错误`);
                }

                // 校验重复
                const existingDrug = await dbManager.getDataByIndex("drugs", "name", name);
                if (existingDrug) {
                    throw new Error(`第${i + 1}行：药物"${name}"已存在`);
                }

                // 新增药物
                const drugInfo = {
                    name,
                    storageType,
                    minStock,
                    defaultEstimate
                };
                const result = await drugManager.addDrug(drugInfo);
                if (result.success) {
                    successCount++;
                } else {
                    throw new Error(`第${i + 1}行：${result.message}`);
                }
            } catch (error) {
                errorCount++;
                errorMessages.push(error.message);
                failedData.push(line);
            }
        }

        // 显示所有错误信息和失败数据
        if (errorMessages.length > 0) {
            let errorText = errorMessages.join("\n") + "\n\n失败的数据：\n" + failedData.join("\n") + "\n\n请复制失败的数据进行修正后重新导入。";
            this.showTip(false, errorText);
        }

        return { successCount, errorCount };
    }

    /**
     * 批量导入药物入库
     */
    async importStockIns(importText) {
        const lines = importText.split("\n").filter(line => line.trim());
        let successCount = 0;
        let errorCount = 0;
        let errorMessages = [];
        let failedData = [];
        let successIds = []; // 记录成功入库的ID，用于回滚

        // 先获取所有药物和来源数据，用于校验
        const drugs = await drugManager.getDrugList();
        const sources = await sourceManager.getSourceList();
        const drugMap = new Map(drugs.map(d => [d.name, d]));
        const sourceMap = new Map(sources.map(s => [s.name, s]));

        try {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const parts = line.split(/\s+/);
                
                try {
                    // 校验数据完整性
                    if (parts.length < 4) {
                        throw new Error(`第${i + 1}行格式错误：数据不完整`);
                    }

                    const drugName = parts[0];
                    const sourceName = parts[1];
                    const grams = parts[2];
                    const totalAmount = parts[3];
                    const remark = parts.slice(4).join(" ");

                    // 校验药物是否存在
                    const drug = drugMap.get(drugName);
                    if (!drug) {
                        throw new Error(`第${i + 1}行：药物"${drugName}"不存在`);
                    }

                    // 校验来源是否存在
                    const source = sourceMap.get(sourceName);
                    if (!source) {
                        throw new Error(`第${i + 1}行：来源"${sourceName}"不存在`);
                    }

                    // 校验数值
                    if (isNaN(grams) || isNaN(totalAmount) || Number(grams) <= 0 || Number(totalAmount) <= 0) {
                        throw new Error(`第${i + 1}行：数值格式错误`);
                    }

                    // 新增入库
                    const stockInInfo = {
                        drugId: drug.id,
                        drugName: drug.name,
                        sourceId: source.id,
                        sourceName: source.name,
                        grams,
                        totalAmount,
                        remark
                    };
                    const result = await stockInManager.addStockIn(stockInInfo);
                    if (result.success) {
                        successCount++;
                        successIds.push(result.data.id); // 记录成功入库的ID
                    } else {
                        throw new Error(`第${i + 1}行：${result.message}`);
                    }
                } catch (error) {
                    errorCount++;
                    errorMessages.push(error.message);
                    failedData.push(line);
                    // 出现错误，抛出异常，触发回滚
                    throw new Error(`批量入库失败，已回滚操作：${error.message}`);
                }
            }

            // 没有错误，显示成功信息
            if (errorMessages.length === 0) {
                this.showTip(true, `批量入库成功：共${successCount}条记录`);
            }

            return { successCount, errorCount };
        } catch (error) {
            // 出现错误，回滚已经成功入库的数据
            if (successIds.length > 0) {
                for (const id of successIds) {
                    await window.dbManager.deleteData("stockIns", id);
                }
            }

            // 显示所有错误信息和失败数据
            if (errorMessages.length > 0) {
                // 显示失败记录弹窗
                this.showFailedImportPopup(errorMessages, failedData);
            }

            return { successCount: 0, errorCount: errorCount + successIds.length };
        }
    }

    /**
     * 显示导入失败的弹窗
     */
    showFailedImportPopup(errorMessages, failedData) {
        // 创建弹窗元素
        const popup = document.createElement("div");
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            max-height: 80vh;
            background-color: #444;
            border: 1px solid #ccc;
            border-radius: 5px;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            overflow-y: auto;
            color: white;
        `;

        // 创建标题
        const title = document.createElement("h2");
        title.textContent = "批量入库失败记录";
        title.style.marginBottom = "20px";
        popup.appendChild(title);

        // 创建错误信息区域
        const errorSection = document.createElement("div");
        errorSection.style.marginBottom = "20px";
        const errorTitle = document.createElement("h3");
        errorTitle.textContent = "错误信息：";
        errorTitle.style.marginBottom = "10px";
        errorSection.appendChild(errorTitle);
        const errorList = document.createElement("ul");
        errorList.style.marginLeft = "20px";
        for (const message of errorMessages) {
            const li = document.createElement("li");
            li.textContent = message;
            li.style.color = "red";
            errorList.appendChild(li);
        }
        errorSection.appendChild(errorList);
        popup.appendChild(errorSection);

        // 创建失败数据区域
        const failedSection = document.createElement("div");
        failedSection.style.marginBottom = "20px";
        const failedTitle = document.createElement("h3");
        failedTitle.textContent = "失败的数据：";
        failedTitle.style.marginBottom = "10px";
        failedSection.appendChild(failedTitle);
        const failedText = document.createElement("pre");
        failedText.textContent = failedData.join("\n");
        failedText.style.padding = "10px";
        failedText.style.backgroundColor = "#666";
        failedText.style.borderRadius = "3px";
        failedText.style.fontSize = "14px";
        failedText.style.color = "white";
        failedSection.appendChild(failedText);
        popup.appendChild(failedSection);

        // 创建关闭按钮
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "关闭";
        closeBtn.style.cssText = `
            display: block;
            margin: 0 auto;
            padding: 8px 20px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        `;
        closeBtn.addEventListener("click", () => {
            document.body.removeChild(popup);
        });
        popup.appendChild(closeBtn);

        // 添加到页面
        document.body.appendChild(popup);
    }

    /**
     * 处理批量新增来源
     */
    async handleBatchAddSource() {
        const text = document.getElementById("batchSourceText").value.trim();
        if (!text) {
            this.showTip(false, "请输入要添加的来源数据");
            return;
        }

        try {
            const { successCount, errorCount } = await this.importSources(text);
            this.showTip(true, `批量添加完成：成功${successCount}条，失败${errorCount}条`);
            
            // 关闭弹窗并清空输入
            this.batchSourcePopup.style.display = "none";
            document.getElementById("batchSourceText").value = "";
            
            // 刷新相关数据
            this.loadSourceSelect();
            this.loadSourceList();
        } catch (error) {
            this.showTip(false, `批量添加失败：${error.message}`);
        }
    }

    /**
     * 处理批量新增药物
     */
    async handleBatchAddDrug() {
        const text = document.getElementById("batchDrugText").value.trim();
        if (!text) {
            this.showTip(false, "请输入要添加的药物数据");
            return;
        }

        try {
            const { successCount, errorCount } = await this.importDrugs(text);
            this.showTip(true, `批量添加完成：成功${successCount}条，失败${errorCount}条`);
            
            // 关闭弹窗并清空输入
            this.batchDrugPopup.style.display = "none";
            document.getElementById("batchDrugText").value = "";
            
            // 刷新相关数据
            this.loadDrugSelect();
            this.loadDrugList();
        } catch (error) {
            this.showTip(false, `批量添加失败：${error.message}`);
        }
    }

    /**
     * 处理批量入库
     */
    async handleBatchStockIn() {
        const text = document.getElementById("batchStockInText").value.trim();
        if (!text) {
            this.showTip(false, "请输入要入库的药物数据");
            return;
        }

        try {
            const { successCount, errorCount } = await this.importStockIns(text);
            this.showTip(true, `批量入库完成：成功${successCount}条，失败${errorCount}条`);
            
            // 关闭弹窗并清空输入
            this.batchStockInPopup.style.display = "none";
            document.getElementById("batchStockInText").value = "";
            
            // 刷新相关数据
            this.loadStockInList();
        } catch (error) {
            this.showTip(false, `批量入库失败：${error.message}`);
        }
    }

    /**
     * 处理备份功能
     */
    async handleBackup() {
        try {
            // 获取所有表的数据
            const backupData = {
                sources: await dbManager.getAllData('sources'),
                drugs: await dbManager.getAllData('drugs'),
                stockIns: await dbManager.getAllData('stockIns'),
                stockOuts: await dbManager.getAllData('stockOuts'),
                prescriptions: await dbManager.getAllData('prescriptions'),
                diagnosisLogs: await dbManager.getAllData('diagnosisLogs')
            };

            // 生成文件名：中药诊疗管理数据_YYYY-MM-DD-HH-mm-ss.json
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const fileName = `中药诊疗管理数据_${year}-${month}-${day}-${hours}-${minutes}-${seconds}.json`;

            // 创建JSON文件并下载
            const jsonString = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showTip(true, '备份成功！');
        } catch (error) {
            console.error('备份失败:', error);
            this.showTip(false, '备份失败：' + error.message);
        }
    }

    /**
     * 处理恢复功能
     */
    handleRestore() {
        // 创建文件输入元素
        if (!this.restoreFileInput) {
            this.restoreFileInput = document.createElement('input');
            this.restoreFileInput.type = 'file';
            this.restoreFileInput.accept = '.json';
            this.restoreFileInput.style.display = 'none';
            
            // 监听文件选择事件
            this.restoreFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.processRestoreFile(file);
                }
                // 清空文件选择
                this.restoreFileInput.value = '';
            });
            
            document.body.appendChild(this.restoreFileInput);
        }
        
        // 触发文件选择
        this.restoreFileInput.click();
    }

    /**
     * 处理恢复文件
     */
    async processRestoreFile(file) {
        try {
            // 读取文件内容
            const content = await this.readFile(file);
            const restoreData = JSON.parse(content);

            // 导入数据到数据库
            for (const storeName in restoreData) {
                if (restoreData.hasOwnProperty(storeName)) {
                    const dataList = restoreData[storeName];
                    for (const data of dataList) {
                        // 先删除可能存在的旧数据（根据id）
                        try {
                            await dbManager.deleteData(storeName, data.id);
                        } catch (error) {
                            // 如果数据不存在，忽略错误
                        }
                        // 导入新数据
                        await dbManager.addData(storeName, data);
                    }
                }
            }

            this.showTip(true, '恢复成功！');
            
            // 刷新页面
            setTimeout(async () => {
                await this.refreshPage();
                this.currentPrescriptionDrugs = [];
                this.renderPrescriptionDrugs();
            }, 1000);
        } catch (error) {
            console.error('恢复失败:', error);
            this.showTip(false, '恢复失败：' + error.message);
        }
    }

    /**
     * 读取文件内容
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }
}

// 页面加载完成后初始化应用
window.onload = () => {
    window.app = new App();
};