/**
 * 通用工具函数
 * Common Utility Functions
 *
 * 功能说明:
 * - 提供JSON解析安全包装
 * - 实现函数节流功能
 * - 其他通用辅助函数
 *
 * Features:
 * - Provide safe JSON parsing wrapper
 * - Implement function throttling
 * - Other common utility functions
 */

/**
 * 安全的JSON解析函数
 * Safe JSON parsing function
 *
 * 在JSON解析失败时返回默认值而不是抛出异常
 * Returns default value instead of throwing exception when JSON parsing fails
 *
 * @template T 返回值类型 / Return value type
 * @param json 要解析的JSON字符串 / JSON string to parse
 * @param defaultValue 解析失败时的默认值 / Default value when parsing fails
 * @returns 解析成功时返回解析结果，失败时返回默认值 / Returns parsed result on success, default value on failure
 */
export function safeParseJSON<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    // 解析失败时记录错误并返回默认值
    // Log error and return default value when parsing fails
    return defaultValue;
  }
}

/**
 * 函数节流装饰器
 * Function throttling decorator
 *
 * 限制函数在指定时间间隔内只能执行一次，用于防止频繁调用
 * Limits function execution to once within specified time interval to prevent frequent calls
 *
 * @template T 函数类型，必须返回Promise / Function type that must return Promise
 * @param fn 要进行节流的异步函数 / Async function to throttle
 * @param wait 节流间隔时间（毫秒）/ Throttle interval time (milliseconds)
 * @returns 节流后的函数 / Throttled function
 */
export function pThrottle<T extends (...args: any[]) => Promise<any>>(fn: T, wait: number): T {
  // 记录上次执行时间
  // Record last execution time
  let lastTime = 0;

  return (async (...args: any[]) => {
    const now = Date.now();

    // 检查是否已超过等待时间
    // Check if wait time has elapsed
    if (now - lastTime >= wait) {
      // 更新最后执行时间并执行函数
      // Update last execution time and execute function
      lastTime = now;
      return await fn(...args);
    } else {
      // 在等待期间内的调用被丢弃，返回空的Promise
      // Calls within wait period are discarded, return empty Promise
      return Promise.resolve();
    }
  }) as T;
}
