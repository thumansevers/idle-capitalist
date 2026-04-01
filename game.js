// 资本家模拟器 - 核心游戏逻辑

class IdleGame {
    constructor() {
        // 游戏配置
        this.config = {
            fps: 60,
            autoSaveInterval: 30000, // 30 秒自动保存
            offlineEarningsRate: 0.5 // 离线收益 50%
        };

        // 初始游戏状态
        this.defaultState = {
            money: 0,
            totalEarned: 0,
            prestigeMultiplier: 1,
            prestigeCount: 0,
            startTime: Date.now(),
            lastSaveTime: Date.now(),
            businesses: {},
            upgrades: [],
            unlockedPlanets: ['earth'],
            settings: {
                sound: true,
                offlineEarnings: true
            }
        };

        // 商业建筑配置
        this.businessConfig = {
            earth: [
                { id: 'lemonade', name: '柠檬水摊', icon: '🍋', baseCost: 10, baseEarn: 1, baseTime: 1000 },
                { id: 'newspaper', name: '报纸配送', icon: '📰', baseCost: 100, baseEarn: 10, baseTime: 3000 },
                { id: 'carwash', name: '洗车行', icon: '🚗', baseCost: 1000, baseEarn: 50, baseTime: 5000 },
                { id: 'restaurant', name: '餐厅', icon: '🍔', baseCost: 10000, baseEarn: 200, baseTime: 8000 },
                { id: 'bank', name: '银行', icon: '🏦', baseCost: 100000, baseEarn: 1000, baseTime: 15000 },
                { id: 'oil', name: '石油公司', icon: '🛢️', baseCost: 1000000, baseEarn: 5000, baseTime: 30000 }
            ],
            moon: [
                { id: 'oxygen', name: '氧气吧', icon: '💨', baseCost: 5000000, baseEarn: 25000, baseTime: 20000 },
                { id: 'hotel', name: '太空酒店', icon: '🏨', baseCost: 50000000, baseEarn: 150000, baseTime: 45000 },
                { id: 'mine', name: '氦 3 矿', icon: '⛏️', baseCost: 500000000, baseEarn: 1000000, baseTime: 90000 }
            ],
            mars: [
                { id: 'dome', name: '生态穹顶', icon: ' dome', baseCost: 1000000000, baseEarn: 5000000, baseTime: 60000 },
                { id: 'factory', name: '火星工厂', icon: '🏭', baseCost: 10000000000, baseEarn: 25000000, baseTime: 120000 },
                { id: 'port', name: '星际港口', icon: '🚀', baseCost: 100000000000, baseEarn: 100000000, baseTime: 300000 }
            ]
        };

        // 升级配置
        this.upgradeConfig = [
            { id: 'click1', name: '点击强化 I', desc: '点击获得 +1$', cost: 500, type: 'click', value: 1 },
            { id: 'click2', name: '点击强化 II', desc: '点击获得 +5$', cost: 2500, type: 'click', value: 5 },
            { id: 'auto1', name: '自动化 I', desc: '所有收益 +10%', cost: 5000, type: 'global', value: 0.1 },
            { id: 'auto2', name: '自动化 II', desc: '所有收益 +25%', cost: 25000, type: 'global', value: 0.25 },
            { id: 'earth2x', name: '地球 x2', desc: '地球收益 x2', cost: 100000, type: 'planet', planet: 'earth', value: 2 },
            { id: 'moon2x', name: '月球 x2', desc: '月球收益 x2', cost: 50000000, type: 'planet', planet: 'moon', value: 2 },
            { id: 'prestige1', name: '永恒之力 I', desc: '重置倍率 +10%', cost: 1000000, type: 'prestige', value: 0.1 }
        ];

        // 加载游戏状态
        this.state = this.loadState();
        this.currentPlanet = 'earth';
        this.businessProgress = {}; // 每个建筑的进度
        this.clickPower = 1;
        this.globalMultiplier = 1;
        this.planetMultipliers = { earth: 1, moon: 1, mars: 1 };

        this.init();
    }

    // 初始化
    init() {
        this.calculateOfflineEarnings();
        this.applyUpgrades();
        this.bindEvents();
        this.renderBusinesses();
        this.updateDisplay();
        this.startGameLoop();
        this.startAutoSave();
    }

    // 加载存档
    loadState() {
        try {
            const saved = localStorage.getItem('idleCapitalist');
            if (saved) {
                const loaded = JSON.parse(saved);
                return { ...this.defaultState, ...loaded };
            }
        } catch (e) {
            console.error('加载存档失败:', e);
        }
        return { ...this.defaultState };
    }

    // 保存存档
    saveState() {
        try {
            this.state.lastSaveTime = Date.now();
            localStorage.setItem('idleCapitalist', JSON.stringify(this.state));
        } catch (e) {
            console.error('保存存档失败:', e);
        }
    }

    // 计算离线收益
    calculateOfflineEarnings() {
        if (!this.state.settings.offlineEarnings) return;

        const now = Date.now();
        const elapsed = now - this.state.lastSaveTime;
        const hours = elapsed / (1000 * 60 * 60);

        if (hours > 0.05) { // 至少 3 分钟
            let offlineEarn = 0;
            const allBusinesses = [...this.businessConfig.earth, ...this.businessConfig.moon, ...this.businessConfig.mars];

            for (const biz of allBusinesses) {
                const bizState = this.state.businesses[biz.id];
                if (bizState && bizState.level > 0) {
                    const earnPerSec = this.calculateEarnPerSec(biz);
                    offlineEarn += earnPerSec * hours * 3600 * this.config.offlineEarningsRate;
                }
            }

            if (offlineEarn > 0) {
                this.addMoney(offlineEarn);
                this.showToast(`离线 ${hours.toFixed(1)} 小时，赚取 ${this.formatNumber(offlineEarn)}$`);
            }
        }
    }

    // 应用升级效果
    applyUpgrades() {
        this.clickPower = 1;
        this.globalMultiplier = 1;
        this.planetMultipliers = { earth: 1, moon: 1, mars: 1 };

        for (const upgradeId of this.state.upgrades) {
            const upgrade = this.upgradeConfig.find(u => u.id === upgradeId);
            if (!upgrade) continue;

            switch (upgrade.type) {
                case 'click':
                    this.clickPower += upgrade.value;
                    break;
                case 'global':
                    this.globalMultiplier += upgrade.value;
                    break;
                case 'planet':
                    this.planetMultipliers[upgrade.planet] *= upgrade.value;
                    break;
                case 'prestige':
                    this.state.prestigeMultiplier += upgrade.value;
                    break;
            }
        }
    }

    // 绑定事件
    bindEvents() {
        // 星球切换
        document.querySelectorAll('.planet-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchPlanet(btn.dataset.planet));
        });

        // 面板开关
        document.getElementById('btnUpgrades').addEventListener('click', () => this.openPanel('upgradePanel'));
        document.getElementById('btnSettings').addEventListener('click', () => this.openPanel('settingsPanel'));
        document.getElementById('btnPrestige').addEventListener('click', () => this.openPanel('prestigePanel'));

        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closePanel(btn.dataset.panel));
        });

        // 设置
        document.getElementById('toggleSound').addEventListener('change', (e) => {
            this.state.settings.sound = e.target.checked;
        });
        document.getElementById('toggleOffline').addEventListener('change', (e) => {
            this.state.settings.offlineEarnings = e.target.checked;
        });

        // 硬重置
        document.getElementById('btnHardReset').addEventListener('click', () => {
            if (confirm('确定要清除所有存档吗？此操作不可恢复！')) {
                localStorage.removeItem('idleCapitalist');
                location.reload();
            }
        });

        // 确认重置
        document.getElementById('btnConfirmPrestige').addEventListener('click', () => {
            this.doPrestige();
            this.closePanel('prestigePanel');
        });

        // 点击金钱显示
        document.querySelector('.money-display').addEventListener('click', (e) => {
            this.handleClick(e);
        });
    }

    // 切换星球
    switchPlanet(planet) {
        if (!this.state.unlockedPlanets.includes(planet)) return;
        this.currentPlanet = planet;
        
        document.querySelectorAll('.planet-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.planet === planet);
        });

        this.renderBusinesses();
    }

    // 渲染商业建筑
    renderBusinesses() {
        const container = document.getElementById('businessList');
        const businesses = this.businessConfig[this.currentPlanet] || [];

        container.innerHTML = businesses.map(biz => {
            const bizState = this.state.businesses[biz.id] || { level: 0, totalEarned: 0 };
            const cost = this.calculateCost(biz);
            const earnPerCycle = this.calculateEarnPerCycle(biz);
            const progress = this.businessProgress[biz.id] || 0;

            return `
                <div class="business-card" data-business="${biz.id}">
                    <div class="business-header">
                        <div class="business-name">
                            <span class="biz-icon">${biz.icon}</span>
                            <span>${biz.name}</span>
                        </div>
                        <span class="business-level">Lv.${bizState.level}</span>
                    </div>
                    <div class="business-stats">
                        <span>每次：${this.formatNumber(earnPerCycle)}$</span>
                        <span class="earn-rate">${this.formatNumber(this.calculateEarnPerSec(biz))}$/秒</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                            <span class="progress-text">${(progress).toFixed(0)}%</span>
                        </div>
                    </div>
                    <button class="buy-btn" onclick="game.buyBusiness('${biz.id}')" ${this.state.money < cost ? 'disabled' : ''}>
                        <span>购买 #${bizState.level + 1}</span>
                        <span class="buy-cost">${this.formatNumber(cost)}$</span>
                    </button>
                </div>
            `;
        }).join('');

        this.renderUpgrades();
        this.updatePrestigeDisplay();
    }

    // 渲染升级
    renderUpgrades() {
        const container = document.getElementById('upgradeList');
        
        container.innerHTML = this.upgradeConfig.map(upgrade => {
            const owned = this.state.upgrades.includes(upgrade.id);
            return `
                <div class="upgrade-item">
                    <div class="upgrade-info">
                        <div class="upgrade-name">${upgrade.name}</div>
                        <div class="upgrade-desc">${upgrade.desc}</div>
                    </div>
                    <button class="upgrade-cost ${owned ? 'owned' : ''}" 
                            onclick="game.buyUpgrade('${upgrade.id}')"
                            ${this.state.money < upgrade.cost || owned ? 'disabled' : ''}>
                        ${owned ? '已拥有' : this.formatNumber(upgrade.cost) + '$'}
                    </button>
                </div>
            `;
        }).join('');
    }

    // 计算建筑成本 (指数增长)
    calculateCost(biz) {
        const bizState = this.state.businesses[biz.id] || { level: 0 };
        return Math.floor(biz.baseCost * Math.pow(1.15, bizState.level));
    }

    // 计算每次收益
    calculateEarnPerCycle(biz) {
        const bizState = this.state.businesses[biz.id] || { level: 0 };
        const planetMultiplier = this.planetMultipliers[this.currentPlanet] || 1;
        
        return biz.baseEarn * bizState.level * planetMultiplier * this.globalMultiplier * this.state.prestigeMultiplier;
    }

    // 计算每秒收益
    calculateEarnPerSec(biz) {
        return this.calculateEarnPerCycle(biz) / (biz.baseTime / 1000);
    }

    // 购买建筑
    buyBusiness(bizId) {
        const biz = this.businessConfig[this.currentPlanet].find(b => b.id === bizId);
        const cost = this.calculateCost(biz);

        if (this.state.money >= cost) {
            this.state.money -= cost;
            
            if (!this.state.businesses[bizId]) {
                this.state.businesses[bizId] = { level: 0, totalEarned: 0 };
            }
            this.state.businesses[bizId].level++;

            // 检查解锁新星球
            this.checkPlanetUnlock();

            this.applyUpgrades();
            this.renderBusinesses();
            this.updateDisplay();
            this.saveState();
        }
    }

    // 购买升级
    buyUpgrade(upgradeId) {
        const upgrade = this.upgradeConfig.find(u => u.id === upgradeId);
        
        if (this.state.money >= upgrade.cost && !this.state.upgrades.includes(upgradeId)) {
            this.state.money -= upgrade.cost;
            this.state.upgrades.push(upgradeId);
            
            this.applyUpgrades();
            this.renderUpgrades();
            this.updateDisplay();
            this.saveState();
            
            this.showToast(`已购买：${upgrade.name}`);
        }
    }

    // 检查星球解锁
    checkPlanetUnlock() {
        const earthOil = this.state.businesses['oil']?.level || 0;
        const moonMine = this.state.businesses['mine']?.level || 0;

        if (earthOil >= 10 && !this.state.unlockedPlanets.includes('moon')) {
            this.state.unlockedPlanets.push('moon');
            this.showToast('🌙 月球已解锁！');
            this.renderBusinesses();
            this.updatePlanetNav();
        }

        if (moonMine >= 10 && !this.state.unlockedPlanets.includes('mars')) {
            this.state.unlockedPlanets.push('mars');
            this.showToast('🔴 火星已解锁！');
            this.renderBusinesses();
            this.updatePlanetNav();
        }
    }

    // 更新星球导航
    updatePlanetNav() {
        document.querySelectorAll('.planet-btn').forEach(btn => {
            const planet = btn.dataset.planet;
            const unlocked = this.state.unlockedPlanets.includes(planet);
            btn.classList.toggle('locked', !unlocked);
        });
    }

    // 点击处理
    handleClick(e) {
        this.addMoney(this.clickPower * this.globalMultiplier * this.state.prestigeMultiplier);
        
        // 特效
        const rect = e.target.getBoundingClientRect();
        const popup = document.createElement('div');
        popup.className = 'multiplier-popup';
        popup.textContent = `+${this.formatNumber(this.clickPower * this.globalMultiplier * this.state.prestigeMultiplier)}$`;
        popup.style.left = `${e.clientX}px`;
        popup.style.top = `${e.clientY}px`;
        document.body.appendChild(popup);
        
        setTimeout(() => popup.remove(), 1000);
        
        this.updateDisplay();
    }

    // 添加金钱
    addMoney(amount) {
        this.state.money += amount;
        this.state.totalEarned += amount;
        this.updateDisplay();
    }

    // 重置 (Prestige)
    doPrestige() {
        const bonus = this.calculatePrestigeBonus();
        
        this.state.prestigeCount++;
        this.state.prestigeMultiplier += bonus;
        this.state.money = 0;
        this.state.businesses = {};
        this.state.upgrades = [];
        this.state.unlockedPlanets = ['earth'];
        
        this.businessProgress = {};
        this.currentPlanet = 'earth';
        
        this.applyUpgrades();
        this.renderBusinesses();
        this.updateDisplay();
        this.updatePlanetNav();
        this.saveState();
        
        this.showToast(`🔄 重置完成！倍率 +${(bonus * 100).toFixed(0)}%`);
    }

    // 计算重置倍率
    calculatePrestigeBonus() {
        // 基于总赚取金钱计算
        const totalEarned = this.state.totalEarned || 0;
        if (totalEarned < 1000000) return 0;
        
        // 每 100 万获得 10% 倍率
        return Math.floor(totalEarned / 1000000) * 0.1;
    }

    // 游戏主循环
    startGameLoop() {
        setInterval(() => {
            this.gameTick();
        }, 1000 / this.config.fps);
    }

    // 游戏 tick
    gameTick() {
        const delta = 1000 / this.config.fps;
        const allBusinesses = [...this.businessConfig.earth, ...this.businessConfig.moon, ...this.businessConfig.mars];

        for (const biz of allBusinesses) {
            const bizState = this.state.businesses[biz.id];
            if (!bizState || bizState.level <= 0) continue;

            // 更新进度
            if (!this.businessProgress[biz.id]) {
                this.businessProgress[biz.id] = 0;
            }

            const progressPerTick = (delta / biz.baseTime) * 100;
            this.businessProgress[biz.id] += progressPerTick;

            // 完成一个周期
            if (this.businessProgress[biz.id] >= 100) {
                const cycles = Math.floor(this.businessProgress[biz.id] / 100);
                this.businessProgress[biz.id] = this.businessProgress[biz.id] % 100;
                
                const earnPerCycle = this.calculateEarnPerCycle(biz);
                this.addMoney(earnPerCycle * cycles);
                this.state.businesses[biz.id].totalEarned += earnPerCycle * cycles;
            }
        }

        this.updateProgressBars();
    }

    // 更新进度条
    updateProgressBars() {
        document.querySelectorAll('.business-card').forEach(card => {
            const bizId = card.dataset.business;
            const progress = this.businessProgress[bizId] || 0;
            const fill = card.querySelector('.progress-fill');
            const text = card.querySelector('.progress-text');
            
            if (fill && text) {
                fill.style.width = `${progress}%`;
                text.textContent = `${progress.toFixed(0)}%`;
            }
        });

        // 更新购买按钮状态
        document.querySelectorAll('.buy-btn').forEach(btn => {
            const card = btn.closest('.business-card');
            const bizId = card.dataset.business;
            const cost = this.calculateCost(this.businessConfig[this.currentPlanet].find(b => b.id === bizId));
            btn.disabled = this.state.money < cost;
        });
    }

    // 更新显示
    updateDisplay() {
        document.getElementById('moneyValue').textContent = this.formatNumber(this.state.money);
        document.getElementById('multiplierValue').textContent = `x${this.state.prestigeMultiplier.toFixed(1)}`;
        
        // 更新统计
        const playTime = (Date.now() - this.state.startTime) / (1000 * 60 * 60);
        document.getElementById('statPlayTime').textContent = `${playTime.toFixed(1)}小时`;
        document.getElementById('statPrestigeCount').textContent = this.state.prestigeCount;
        document.getElementById('statTotalEarned').textContent = `💰${this.formatNumber(this.state.totalEarned)}`;
    }

    // 更新重置面板显示
    updatePrestigeDisplay() {
        const bonus = this.calculatePrestigeBonus();
        document.getElementById('prestigeGain').textContent = `x${bonus.toFixed(1)}`;
        document.getElementById('prestigeCurrent').textContent = `x${this.state.prestigeMultiplier.toFixed(1)}`;
        document.getElementById('prestigeBonus').textContent = `+${(bonus * 100).toFixed(0)}%`;
    }

    // 打开面板
    openPanel(panelId) {
        document.getElementById(panelId).classList.remove('hidden');
        if (panelId === 'prestigePanel') {
            this.updatePrestigeDisplay();
        }
    }

    // 关闭面板
    closePanel(panelId) {
        document.getElementById(panelId).classList.add('hidden');
    }

    // 显示提示
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    // 格式化数字
    formatNumber(num) {
        if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Q';
        if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'k';
        return Math.floor(num).toString();
    }

    // 自动保存
    startAutoSave() {
        setInterval(() => {
            this.saveState();
        }, this.config.autoSaveInterval);
    }
}

// 启动游戏
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new IdleGame();
});
