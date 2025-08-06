/**
 * 性能优化工具库 - 防抖、节流和其他性能优化功能
 */

class PerformanceUtils {
    constructor() {
        this.debounceTimers = new Map();
        this.throttleTimers = new Map();
        this.rafCallbacks = new Map();
        this.intersectionObservers = new Map();
        this.resizeObservers = new Map();
        this.mutationObservers = new Map();
    }

    // 防抖函数 - 在指定时间内多次调用只执行最后一次
    debounce(func, delay = 300, options = {}) {
        const { leading = false, trailing = true } = options;
        const key = `${func.name}_${delay}`;
        
        return function (...args) {
            const context = this;
            
            // 清除之前的定时器
            if (this.debounceTimers.has(key)) {
                clearTimeout(this.debounceTimers.get(key));
            }
            
            // 立即执行（leading edge）
            if (leading && !this.debounceTimers.has(key)) {
                func.apply(context, args);
            }
            
            // 设置新的定时器
            const timer = setTimeout(() => {
                if (trailing && !leading) {
                    func.apply(context, args);
                }
                this.debounceTimers.delete(key);
            }, delay);
            
            this.debounceTimers.set(key, timer);
        };
    }

    // 节流函数 - 在指定时间内只执行一次
    throttle(func, delay = 300, options = {}) {
        const { leading = true, trailing = false } = options;
        const key = `${func.name}_${delay}`;
        
        return function (...args) {
            const context = this;
            const now = Date.now();
            
            if (!this.throttleTimers.has(key)) {
                this.throttleTimers.set(key, {
                    lastExecTime: 0,
                    timer: null
                });
            }
            
            const throttleData = this.throttleTimers.get(key);
            
            if (leading && now - throttleData.lastExecTime >= delay) {
                func.apply(context, args);
                throttleData.lastExecTime = now;
                return;
            }
            
            if (trailing && !throttleData.timer) {
                throttleData.timer = setTimeout(() => {
                    func.apply(context, args);
                    throttleData.lastExecTime = Date.now();
                    throttleData.timer = null;
                }, delay - (now - throttleData.lastExecTime));
            }
        };
    }

    // RAF节流 - 使用requestAnimationFrame进行节流
    rafThrottle(func) {
        let ticking = false;
        
        return function (...args) {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(() => {
                    func.apply(this, args);
                    ticking = false;
                });
            }
        };
    }

    // 懒加载图片
    lazyLoadImages(selector = 'img[data-src]', options = {}) {
        const {
            root = null,
            rootMargin = '0px',
            threshold = 0.1,
            onLoad = null,
            onError = null
        } = options;
        
        const images = document.querySelectorAll(selector);
        
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const src = img.dataset.src;
                        
                        if (src) {
                            img.src = src;
                            img.removeAttribute('data-src');
                            
                            if (onLoad) {
                                img.onload = () => onLoad(img);
                            }
                            
                            if (onError) {
                                img.onerror = () => onError(img);
                            }
                        }
                        
                        observer.unobserve(img);
                    }
                });
            }, { root, rootMargin, threshold });
            
            images.forEach(img => observer.observe(img));
            this.intersectionObservers.set(selector, observer);
        } else {
            // 降级处理：直接加载所有图片
            images.forEach(img => {
                const src = img.dataset.src;
                if (src) {
                    img.src = src;
                    img.removeAttribute('data-src');
                }
            });
        }
    }

    // 批量DOM操作 - 减少重排和重绘
    batchDOMOperations(callback) {
        // 创建文档片段
        const fragment = document.createDocumentFragment();
        
        // 执行回调函数
        callback(fragment);
        
        // 一次性添加到DOM
        if (fragment.childNodes.length > 0) {
            document.body.appendChild(fragment);
        }
    }

    // 虚拟滚动 - 处理大量列表数据
    createVirtualScroll(container, options = {}) {
        const {
            itemHeight = 50,
            bufferSize = 5,
            renderItem = null,
            totalItems = 0
        } = options;
        
        if (!renderItem) {
            throw new Error('renderItem function is required');
        }
        
        const visibleItems = Math.ceil(container.clientHeight / itemHeight);
        const totalHeight = totalItems * itemHeight;
        
        // 设置容器高度
        container.style.height = `${totalHeight}px`;
        container.style.position = 'relative';
        
        // 创建可见项容器
        const visibleContainer = document.createElement('div');
        visibleContainer.style.position = 'absolute';
        visibleContainer.style.top = '0';
        visibleContainer.style.left = '0';
        visibleContainer.style.right = '0';
        container.appendChild(visibleContainer);
        
        // 渲染可见项
        const renderVisibleItems = (scrollTop) => {
            const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
            const endIndex = Math.min(totalItems, startIndex + visibleItems + bufferSize * 2);
            
            visibleContainer.innerHTML = '';
            visibleContainer.style.transform = `translateY(${startIndex * itemHeight}px)`;
            
            for (let i = startIndex; i < endIndex; i++) {
                const itemElement = renderItem(i);
                itemElement.style.position = 'absolute';
                itemElement.style.top = '0';
                itemElement.style.left = '0';
                itemElement.style.right = '0';
                itemElement.style.height = `${itemHeight}px`;
                visibleContainer.appendChild(itemElement);
            }
        };
        
        // 监听滚动事件
        const handleScroll = this.throttle((e) => {
            renderVisibleItems(e.target.scrollTop);
        }, 16); // 60fps
        
        container.addEventListener('scroll', handleScroll);
        
        // 初始渲染
        renderVisibleItems(0);
        
        // 返回清理函数
        return () => {
            container.removeEventListener('scroll', handleScroll);
            container.innerHTML = '';
        };
    }

    // 事件委托 - 减少事件监听器数量
    delegateEvent(container, eventType, selector, handler) {
        const handleEvent = (e) => {
            const target = e.target.closest(selector);
            if (target && container.contains(target)) {
                handler.call(target, e);
            }
        };
        
        container.addEventListener(eventType, handleEvent);
        
        // 返回清理函数
        return () => {
            container.removeEventListener(eventType, handleEvent);
        };
    }

    // 内存优化 - 清理未使用的对象
    garbageCollect() {
        // 清理定时器
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        this.throttleTimers.forEach(data => {
            if (data.timer) clearTimeout(data.timer);
        });
        this.throttleTimers.clear();
        
        // 清理观察者
        this.intersectionObservers.forEach(observer => observer.disconnect());
        this.intersectionObservers.clear();
        
        this.resizeObservers.forEach(observer => observer.disconnect());
        this.resizeObservers.clear();
        
        this.mutationObservers.forEach(observer => observer.disconnect());
        this.mutationObservers.clear();
        
        // 清理RAF回调
        this.rafCallbacks.forEach(callback => cancelAnimationFrame(callback));
        this.rafCallbacks.clear();
    }

    // 性能监控
    monitorPerformance(name, callback) {
        return function (...args) {
            const startTime = performance.now();
            
            try {
                const result = callback.apply(this, args);
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                console.log(`${name} 执行时间: ${duration.toFixed(2)}ms`);
                
                if (duration > 100) { // 超过100ms警告
                    console.warn(`${name} 执行时间过长: ${duration.toFixed(2)}ms`);
                }
                
                return result;
            } catch (error) {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                console.error(`${name} 执行失败，耗时: ${duration.toFixed(2)}ms`, error);
                throw error;
            }
        };
    }

    // 缓存DOM查询结果
    createDOMCache() {
        const cache = new Map();
        
        return {
            get: (selector) => {
                if (!cache.has(selector)) {
                    const element = document.querySelector(selector);
                    cache.set(selector, element);
                }
                return cache.get(selector);
            },
            getAll: (selector) => {
                if (!cache.has(selector)) {
                    const elements = document.querySelectorAll(selector);
                    cache.set(selector, elements);
                }
                return cache.get(selector);
            },
            clear: () => cache.clear(),
            invalidate: (selector) => cache.delete(selector)
        };
    }

    // 优化的事件监听器
    addOptimizedEventListener(element, event, handler, options = {}) {
        const { passive = true, capture = false, once = false } = options;
        
        // 如果是滚动或触摸事件，使用passive: true提高性能
        const optimizedOptions = {
            passive: ['scroll', 'touchstart', 'touchmove'].includes(event),
            capture,
            once
        };
        
        element.addEventListener(event, handler, optimizedOptions);
        
        // 返回清理函数
        return () => {
            element.removeEventListener(event, handler, optimizedOptions);
        };
    }

    // 批量处理异步操作
    async batchAsyncOperations(operations, batchSize = 5, delay = 100) {
        const results = [];
        
        for (let i = 0; i < operations.length; i += batchSize) {
            const batch = operations.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(batch);
            
            results.push(...batchResults);
            
            // 如果不是最后一批，等待延迟
            if (i + batchSize < operations.length) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        return results;
    }

    // 清理资源
    destroy() {
        this.garbageCollect();
    }
}

// 创建全局性能工具实例
const performanceUtils = new PerformanceUtils();

// 导出工具类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceUtils;
} else if (typeof window !== 'undefined') {
    window.PerformanceUtils = PerformanceUtils;
    window.performanceUtils = performanceUtils;
    
    // 提供便捷的全局函数
    window.debounce = performanceUtils.debounce.bind(performanceUtils);
    window.throttle = performanceUtils.throttle.bind(performanceUtils);
    window.rafThrottle = performanceUtils.rafThrottle.bind(performanceUtils);
}