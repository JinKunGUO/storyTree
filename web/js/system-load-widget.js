/**
 * 系统负载显示组件
 * 在AI任务提交页面显示当前系统负载和推荐时间
 */

class SystemLoadWidget {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.loadData = null;
        this.updateInterval = null;
    }

    /**
     * 初始化组件
     */
    async init() {
        await this.fetchLoadData();
        this.render();
        
        // 每30秒更新一次
        this.updateInterval = setInterval(() => {
            this.fetchLoadData();
        }, 30000);
    }

    /**
     * 获取系统负载数据
     */
    async fetchLoadData() {
        try {
            const response = await fetch('/api/system/load');
            if (response.ok) {
                this.loadData = await response.json();
                this.render();
            }
        } catch (error) {
            console.error('获取系统负载失败:', error);
        }
    }

    /**
     * 渲染组件
     */
    render() {
        if (!this.container || !this.loadData) return;

        const { loadLevel, totalLoad, estimatedWaitMinutes, recommendation } = this.loadData;

        // 负载等级对应的颜色和图标
        const levelConfig = {
            low: {
                color: '#4caf50',
                bgColor: '#e8f5e9',
                icon: '🟢',
                text: '低负载'
            },
            medium: {
                color: '#ff9800',
                bgColor: '#fff3e0',
                icon: '🟡',
                text: '中等负载'
            },
            high: {
                color: '#f44336',
                bgColor: '#ffebee',
                icon: '🔴',
                text: '高负载'
            },
            critical: {
                color: '#9c27b0',
                bgColor: '#f3e5f5',
                icon: '🚨',
                text: '严重负载'
            }
        };

        const config = levelConfig[loadLevel];

        this.container.innerHTML = `
            <div style="
                background: linear-gradient(135deg, ${config.bgColor} 0%, white 100%);
                border: 2px solid ${config.color};
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <span style="font-size: 24px;">${config.icon}</span>
                    <div style="flex: 1;">
                        <div style="font-size: 16px; font-weight: 600; color: ${config.color};">
                            ${config.text}
                        </div>
                        <div style="font-size: 12px; color: #666; margin-top: 2px;">
                            当前队列: ${totalLoad} 个任务
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 14px; color: #666;">预计等待</div>
                        <div style="font-size: 20px; font-weight: 700; color: ${config.color};">
                            ~${estimatedWaitMinutes}分钟
                        </div>
                    </div>
                </div>
                <div style="
                    background: white;
                    padding: 12px;
                    border-radius: 8px;
                    border-left: 3px solid ${config.color};
                    font-size: 13px;
                    line-height: 1.6;
                    color: #333;
                ">
                    <i class="fas fa-info-circle" style="color: ${config.color};"></i>
                    ${recommendation}
                </div>
            </div>
        `;
    }

    /**
     * 销毁组件
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// 导出到全局
window.SystemLoadWidget = SystemLoadWidget;

