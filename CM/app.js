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
        // 导入相关DOM元素
        this.importPopup = document.getElementById("importPopup");
        this.importPopupTitle = document.getElementById("importPopupTitle");
        this.importFormatExample = document.getElementById("importFormatExample");
        this.importTextArea = document.getElementById("importTextArea");
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
    }

    /**
     * 绑定DOM事件
     */
    bindEvents() {
        // 新增来源
        document.getElementById("addSourceBtn").addEventListener("click", async () => {
            const name = document.getElementById("sourceName").value;
            const remark = document.getElementById("sourceRemark").value;
            const result = await sourceManager.addSource(name, remark);
            this.showTip(result.success, result.message);

            if (result.success) {
                document.getElementById("sourceName").value = "";
                document.getElementById("sourceRemark").value = "";
                // 刷新来源下拉框
                this.loadSourceSelect();
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
                // 刷新药物下拉框
                this.loadDrugSelect();
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
            const li = document.createElement("li");
            li.textContent = `${drug.name}：${drug.grams}g，${drug.amount}元`;
            drugListEl.appendChild(li);
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
            const li = document.createElement("li");
            li.textContent = `${drug.name}（当前库存：${drug.currentStock}g，预警阈值：${drug.minStock}g）`;
            warningListEl.appendChild(li);
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
     * 渲染出库记录
     */
    renderStockOutList(stockOuts) {
        const container = document.getElementById('stockOutList');
        if (!container) return;
        
        if (stockOuts.length === 0) {
            container.innerHTML = '<p>暂无出库记录</p>';
            return;
        }
        
        container.innerHTML = '';
        
        stockOuts.forEach(stockOut => {
            const recordEl = document.createElement('div');
            recordEl.className = 'stock-out-record';
            recordEl.innerHTML = `
                <div class="record-header">
                    <span class="record-time">${new Date(stockOut.outTime).toLocaleString()}</span>
                    <button class="detail-btn" data-id="${stockOut.id}">详情</button>
                </div>
                <div class="record-content">
                    <div>药物：${stockOut.drugName}</div>
                    <div>数量：${stockOut.grams}g</div>
                    <div>总价值：${stockOut.totalAmount}元</div>
                    <div>类型：${stockOut.outType}</div>
                    ${stockOut.remark ? `<div>备注：${stockOut.remark}</div>` : ''}
                </div>
                <div class="record-details" id="detail-${stockOut.id}" style="display: none;"></div>
            `;
            container.appendChild(recordEl);
        });
        
        // 绑定详情按钮事件
        document.querySelectorAll('.detail-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const detailEl = document.getElementById(`detail-${id}`);
                if (detailEl.style.display === 'none') {
                    detailEl.style.display = 'block';
                    // 这里可以加载更详细的信息
                    detailEl.innerHTML = '<p>详细信息加载中...</p>';
                } else {
                    detailEl.style.display = 'none';
                }
            });
        });
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
                <span>药物：${drug.name}</span>
                <span>克数：</span>
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

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const parts = line.split(/\s+/);
            
            if (parts.length < 1) {
                this.showTip(false, `第${i + 1}行格式错误：数据不完整`);
                return { successCount, errorCount };
            }

            const name = parts[0];
            const remark = parts.slice(1).join(" ");

            // 校验重复
            const existingSource = await dbManager.getDataByIndex("sources", "name", name);
            if (existingSource) {
                this.showTip(false, `第${i + 1}行：来源"${name}"已存在`);
                return { successCount, errorCount };
            }

            // 新增来源
            const result = await sourceManager.addSource(name, remark);
            if (result.success) {
                successCount++;
            } else {
                this.showTip(false, `第${i + 1}行：${result.message}`);
                return { successCount, errorCount };
            }
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

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const parts = line.split(/\s+/);
            
            if (parts.length < 4) {
                this.showTip(false, `第${i + 1}行格式错误：数据不完整`);
                return { successCount, errorCount };
            }

            const name = parts[0];
            const storageType = parts[1];
            const minStock = parts[2];
            const defaultEstimate = parts[3];

            // 校验存储方式
            if (storageType !== "密封" && storageType !== "冷藏") {
                this.showTip(false, `第${i + 1}行：存储方式必须为"密封"或"冷藏"`);
                return { successCount, errorCount };
            }

            // 校验数值
            if (isNaN(minStock) || isNaN(defaultEstimate) || Number(minStock) < 0 || Number(defaultEstimate) < 1) {
                this.showTip(false, `第${i + 1}行：数值格式错误`);
                return { successCount, errorCount };
            }

            // 校验重复
            const existingDrug = await dbManager.getDataByIndex("drugs", "name", name);
            if (existingDrug) {
                this.showTip(false, `第${i + 1}行：药物"${name}"已存在`);
                return { successCount, errorCount };
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
                this.showTip(false, `第${i + 1}行：${result.message}`);
                return { successCount, errorCount };
            }
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

        // 先获取所有药物和来源数据，用于校验
        const drugs = await drugManager.getDrugList();
        const sources = await sourceManager.getSourceList();
        const drugMap = new Map(drugs.map(d => [d.name, d]));
        const sourceMap = new Map(sources.map(s => [s.name, s]));

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const parts = line.split(/\s+/);
            
            if (parts.length < 4) {
                this.showTip(false, `第${i + 1}行格式错误：数据不完整`);
                return { successCount, errorCount };
            }

            const drugName = parts[0];
            const sourceName = parts[1];
            const grams = parts[2];
            const totalAmount = parts[3];
            const remark = parts.slice(4).join(" ");

            // 校验药物是否存在
            const drug = drugMap.get(drugName);
            if (!drug) {
                this.showTip(false, `第${i + 1}行：药物"${drugName}"不存在`);
                return { successCount, errorCount };
            }

            // 校验来源是否存在
            const source = sourceMap.get(sourceName);
            if (!source) {
                this.showTip(false, `第${i + 1}行：来源"${sourceName}"不存在`);
                return { successCount, errorCount };
            }

            // 校验数值
            if (isNaN(grams) || isNaN(totalAmount) || Number(grams) <= 0 || Number(totalAmount) <= 0) {
                this.showTip(false, `第${i + 1}行：数值格式错误`);
                return { successCount, errorCount };
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
            } else {
                this.showTip(false, `第${i + 1}行：${result.message}`);
                return { successCount, errorCount };
            }
        }

        return { successCount, errorCount };
    }
}

// 页面加载完成后初始化应用
window.onload = () => {
    new App();
};