/**
 * 状态管理器 - 统一管理应用状态
 */
class StateManager {
    constructor() {
        this.state = {
            currentExtraction: null,
            settings: null,
            keywords: '',
            toolType: 'collect_search_keywords',
            targetTabId: null,
            ui: {
                currentPage: 'input',
                isLoading: false,
                error: null,
                progress: 0
            }
        };
        this.subscribers = new Map();
        this.persistenceThrottle = this.throttle(this.persistState, 1000);
    }

    // 订阅状态变化
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        this.subscribers.get(key).add(callback);
        
        // 返回取消订阅函数
        return () => {
            const callbacks = this.subscribers.get(key);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }

    // 更新状态
    updateState(updates) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };
        
        // 通知订阅者
        this.notifySubscribers(oldState);
        
        // 持久化状态
        this.persistenceThrottle();
    }

    // 通知订阅者
    notifySubscribers(oldState) {
        for (const [key, callbacks] of this.subscribers) {
            const oldValue = oldState[key];
            const newValue = this.state[key];
            
            if (oldValue !== newValue) {
                callbacks.forEach(callback => {
                    try {
                        callback(newValue, oldValue);
                    } catch (error) {
                        console.error('状态订阅回调错误:', error);
                    }
                });
            }
        }
    }

    // 持久化状态到存储
    async persistState() {
        try {
            const persistData = {
                current_extraction: this.state.currentExtraction,
                settings: this.state.settings,
                keywords: this.state.keywords
            };
            
            await this.storageSet(persistData);
        } catch (error) {
            console.error('状态持久化失败:', error);
        }
    }

    // 加载持久化状态
    async loadPersistedState() {
        try {
            const data = await this.storageGet(['current_extraction', 'settings', 'keywords']);
            
            this.updateState({
                currentExtraction: data.current_extraction || null,
                settings: data.settings || null,
                keywords: data.keywords || ''
            });
            
            return data;
        } catch (error) {
            console.error('加载持久化状态失败:', error);
            return null;
        }
    }

    // Chrome Storage API 封装
    storageSet(data) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(data, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    storageGet(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });
    }

    // 工具函数：节流
    throttle(func, delay) {
        return window.performanceUtils ? 
            window.performanceUtils.throttle(func, delay) : 
            this.throttleFallback(func, delay);
    }

    // 工具函数：防抖
    debounce(func, delay) {
        return window.performanceUtils ? 
            window.performanceUtils.debounce(func, delay) : 
            this.debounceFallback(func, delay);
    }

    // 降级节流实现
    throttleFallback(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        
        return function (...args) {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }

    // 降级防抖实现
    debounceFallback(func, delay) {
        let timeoutId;
        
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // 获取当前状态
    getState() {
        return { ...this.state };
    }

    // 重置状态
    reset() {
        this.updateState({
            currentExtraction: null,
            ui: {
                currentPage: 'input',
                isLoading: false,
                error: null,
                progress: 0
            }
        });
    }
}

// 创建全局状态管理器实例
const stateManager = new StateManager();

// 导出状态管理器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
} else if (typeof window !== 'undefined') {
    window.StateManager = StateManager;
    window.stateManager = stateManager;
}