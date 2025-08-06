/**
 * 交互反馈管理器 - 提供统一的用户反馈机制
 */
class FeedbackManager {
    constructor() {
        this.loadingStates = new Map();
        this.progressCallbacks = new Map();
        this.messageQueue = [];
        this.isShowingMessage = false;
    }

    // 显示加载状态
    showLoading(elementId, message = '处理中...') {
        const element = document.getElementById(elementId);
        if (!element) return;

        // 保存原始内容
        if (!this.loadingStates.has(elementId)) {
            this.loadingStates.set(elementId, {
                originalContent: element.innerHTML,
                originalDisabled: element.disabled
            });
        }

        // 禁用元素并显示加载状态
        element.disabled = true;
        element.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <span>${message}</span>
            </div>
        `;
    }

    // 隐藏加载状态
    hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const state = this.loadingStates.get(elementId);
        if (state) {
            // 恢复原始内容
            element.innerHTML = state.originalContent;
            element.disabled = state.originalDisabled;
            this.loadingStates.delete(elementId);
        }
    }

    // 显示进度条
    showProgress(elementId, progress, message = '') {
        const element = document.getElementById(elementId);
        if (!element) return;

        let progressBar = element.querySelector('.progress-bar');
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            element.innerHTML = '';
            element.appendChild(progressBar);
        }

        progressBar.innerHTML = `
            <div class="progress-fill" style="width: ${progress}%"></div>
            <div class="progress-text">${message || `${progress}%`}</div>
        `;
    }

    // 显示提示消息
    showMessage(message, type = 'info', duration = 3000) {
        const messageData = {
            id: Date.now(),
            message,
            type,
            duration
        };

        this.messageQueue.push(messageData);
        this.processMessageQueue();
    }

    // 处理消息队列
    async processMessageQueue() {
        if (this.isShowingMessage || this.messageQueue.length === 0) return;

        this.isShowingMessage = true;
        const messageData = this.messageQueue.shift();

        try {
            await this.displayMessage(messageData);
        } catch (error) {
            console.error('显示消息失败:', error);
        } finally {
            this.isShowingMessage = false;
            // 处理下一条消息
            setTimeout(() => this.processMessageQueue(), 100);
        }
    }

    // 显示单个消息
    displayMessage(messageData) {
        return new Promise((resolve) => {
            const { id, message, type, duration } = messageData;
            
            // 创建消息元素
            const messageEl = document.createElement('div');
            messageEl.className = `feedback-message feedback-${type}`;
            messageEl.innerHTML = `
                <div class="message-content">
                    <div class="message-icon">${this.getMessageIcon(type)}</div>
                    <div class="message-text">${message}</div>
                    <div class="message-close">×</div>
                </div>
            `;

            // 添加到页面
            const container = document.getElementById('feedback-container') || document.body;
            container.appendChild(messageEl);

            // 添加关闭事件
            const closeBtn = messageEl.querySelector('.message-close');
            closeBtn.addEventListener('click', () => {
                this.removeMessage(messageEl);
                resolve();
            });

            // 自动消失
            if (duration > 0) {
                setTimeout(() => {
                    this.removeMessage(messageEl);
                    resolve();
                }, duration);
            }
        });
    }

    // 移除消息
    removeMessage(messageEl) {
        if (messageEl && messageEl.parentNode) {
            messageEl.classList.add('fade-out');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }
    }

    // 获取消息图标
    getMessageIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    // 显示错误提示
    showError(message, duration = 5000) {
        this.showMessage(message, 'error', duration);
    }

    // 显示成功提示
    showSuccess(message, duration = 3000) {
        this.showMessage(message, 'success', duration);
    }

    // 显示警告提示
    showWarning(message, duration = 4000) {
        this.showMessage(message, 'warning', duration);
    }

    // 显示信息提示
    showInfo(message, duration = 3000) {
        this.showMessage(message, 'info', duration);
    }

    // 显示确认对话框
    showConfirm(message, onConfirm, onCancel) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            
            const dialog = document.createElement('div');
            dialog.className = 'confirm-dialog';
            dialog.innerHTML = `
                <div class="confirm-content">
                    <div class="confirm-message">${message}</div>
                    <div class="confirm-buttons">
                        <button class="confirm-btn confirm-cancel">取消</button>
                        <button class="confirm-btn confirm-ok">确定</button>
                    </div>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 绑定事件
            const cancelBtn = dialog.querySelector('.confirm-cancel');
            const okBtn = dialog.querySelector('.confirm-ok');

            const closeDialog = (result) => {
                document.body.removeChild(overlay);
                resolve(result);
                if (result && onConfirm) onConfirm();
                if (!result && onCancel) onCancel();
            };

            cancelBtn.addEventListener('click', () => closeDialog(false));
            okBtn.addEventListener('click', () => closeDialog(true));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeDialog(false);
            });
        });
    }

    // 显示操作提示
    showTooltip(element, message, position = 'top') {
        const tooltip = document.createElement('div');
        tooltip.className = `tooltip tooltip-${position}`;
        tooltip.textContent = message;
        
        document.body.appendChild(tooltip);
        
        // 定位
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let left, top;
        switch (position) {
            case 'top':
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                top = rect.top - tooltipRect.height - 5;
                break;
            case 'bottom':
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                top = rect.bottom + 5;
                break;
            case 'left':
                left = rect.left - tooltipRect.width - 5;
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                break;
            case 'right':
                left = rect.right + 5;
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                break;
        }
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        
        // 自动隐藏
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        }, 2000);
    }

    // 键盘快捷键支持
    setupKeyboardShortcuts(shortcuts) {
        const handleKeyPress = (e) => {
            for (const [key, callback] of Object.entries(shortcuts)) {
                if (this.matchesShortcut(e, key)) {
                    e.preventDefault();
                    callback();
                    break;
                }
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        
        // 返回清理函数
        return () => {
            document.removeEventListener('keydown', handleKeyPress);
        };
    }

    // 检查快捷键匹配
    matchesShortcut(event, shortcut) {
        const parts = shortcut.split('+');
        const key = parts.pop().toLowerCase();
        const modifiers = parts.map(p => p.toLowerCase());
        
        // 检查主键
        if (event.key.toLowerCase() !== key) return false;
        
        // 检查修饰键
        const hasCtrl = modifiers.includes('ctrl');
        const hasAlt = modifiers.includes('alt');
        const hasShift = modifiers.includes('shift');
        
        return event.ctrlKey === hasCtrl && 
               event.altKey === hasAlt && 
               event.shiftKey === hasShift;
    }

    // 清理资源
    destroy() {
        this.loadingStates.clear();
        this.progressCallbacks.clear();
        this.messageQueue = [];
        
        // 清除所有消息元素
        const messages = document.querySelectorAll('.feedback-message');
        messages.forEach(msg => msg.remove());
    }
}

// 创建全局反馈管理器实例
const feedbackManager = new FeedbackManager();

// 导出反馈管理器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FeedbackManager;
} else if (typeof window !== 'undefined') {
    window.FeedbackManager = FeedbackManager;
    window.feedbackManager = feedbackManager;
}