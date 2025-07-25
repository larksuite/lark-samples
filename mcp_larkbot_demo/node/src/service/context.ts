/**
 * 用户上下文服务
 * User Context Service
 *
 * 功能说明:
 * - 管理用户的对话历史
 * - 维护用户的认证状态
 * - 管理MCP客户端连接
 * - 提供登录状态检查和等待功能
 *
 * Features:
 * - Manage user conversation history
 * - Maintain user authentication state
 * - Manage MCP client connections
 * - Provide login status check and waiting functionality
 */

import { CoreMessage } from 'ai';
import { MCPClientService } from './mcp';

/**
 * 认证令牌接口
 * Authentication Token Interface
 * 存储用户的访问令牌信息
 * Stores user's access token information
 */
export interface AuthToken {
  /** 访问令牌 / Access token */
  accessToken: string;

  /** 刷新令牌（可选）/ Refresh token (optional) */
  refreshToken?: string;

  /** 令牌过期时间戳 / Token expiration timestamp */
  expiresAt: number;
}

/**
 * 用户上下文接口
 * User Context Interface
 * 包含用户会话的所有相关信息
 * Contains all relevant information for user session
 */
export interface UserContext {
  /** 核心消息历史数组 / Core message history array */
  coreMessages: CoreMessage[];

  /** MCP客户端连接数组 / MCP client connections array */
  mcpClients: Awaited<ReturnType<typeof MCPClientService.createLarkMCPClient>>[];

  /** 用户认证令牌（可选）/ User authentication token (optional) */
  authToken?: AuthToken;
}

/**
 * 上下文服务类
 * Context Service Class
 * 为每个用户提供独立的上下文管理
 * Provides independent context management for each user
 */
export class ContextService {
  /** 用户上下文数据 / User context data */
  private userContext: UserContext;

  /** 上下文服务实例缓存（静态成员）/ Context service instance cache (static member) */
  private static contextServices = new Map<string, ContextService>();

  /**
   * 构造函数
   * Constructor
   * 初始化空的用户上下文
   * Initialize empty user context
   */
  constructor() {
    this.userContext = { coreMessages: [], mcpClients: [] };
  }

  /**
   * 获取用户专属的上下文服务实例（单例模式）
   * Get user-specific context service instance (singleton pattern)
   * @param userId 用户ID / User ID
   * @returns 上下文服务实例 / Context service instance
   */
  static getUserContextService(userId: string) {
    // 检查缓存中是否已存在该用户的上下文服务
    // Check if context service already exists in cache for this user
    if (this.contextServices.has(userId)) {
      return this.contextServices.get(userId)!;
    }

    // 创建新的上下文服务实例并缓存
    // Create new context service instance and cache it
    const contextService = new ContextService();
    this.contextServices.set(userId, contextService);
    return contextService;
  }

  /**
   * 检查用户是否已登录
   * Check if user is logged in
   * @returns 布尔值表示登录状态 / Boolean indicating login status
   */
  get isLogin() {
    return Boolean(this.getContext().authToken);
  }

  /**
   * 等待用户完成登录
   * Wait for user to complete login
   * @param timeout 超时时间（毫秒），默认5分钟 / Timeout in milliseconds, default 5 minutes
   * @returns Promise<boolean> 登录是否成功 / Promise<boolean> whether login succeeded
   */
  waitLogin(timeout: number = 5 * 60 * 1000) {
    let time = 0;
    return new Promise(resolve => {
      /**
       * 定时检查器函数
       * Timer checker function
       * 每秒检查一次登录状态，直到登录成功或超时
       * Check login status every second until login succeeds or timeout
       */
      const checker = () => {
        // 检查是否已登录
        // Check if already logged in
        if (this.isLogin) {
          resolve(true);
          return;
        }

        // 检查是否超时
        // Check if timeout
        if (time > timeout) {
          resolve(false);
          return;
        }

        // 增加等待时间并继续检查
        // Increment wait time and continue checking
        time += 1000;
        setTimeout(checker, 1000);
      };
      checker();
    });
  }

  /**
   * 添加消息到对话历史
   * Add messages to conversation history
   * @param coreMessages 要添加的核心消息数组 / Array of core messages to add
   */
  addMessage(coreMessages: CoreMessage[]) {
    this.userContext.coreMessages.push(...coreMessages);
  }

  /**
   * 清除所有对话消息
   * Clear all conversation messages
   * 用于重置用户的对话历史
   * Used to reset user's conversation history
   */
  cleanMessage() {
    this.userContext.coreMessages = [];
  }

  /**
   * 获取用户上下文数据
   * Get user context data
   * @returns 用户上下文对象 / User context object
   */
  getContext() {
    return this.userContext;
  }

  /**
   * 添加认证令牌并创建MCP客户端
   * Add authentication token and create MCP client
   * @param authToken 认证令牌信息 / Authentication token information
   */
  async addAuthToken(authToken: AuthToken) {
    // 保存认证令牌到用户上下文
    // Save authentication token to user context
    this.userContext.authToken = authToken;

    // 创建对应的MCP客户端连接
    // Create corresponding MCP client connection
    await this.createMcpClient();
  }

  /**
   * 创建MCP客户端连接
   * Create MCP client connection
   * 关闭现有连接并创建新的飞书/LarkMCP客户端
   * Close existing connections and create new Lark MCP client
   */
  async createMcpClient() {
    const context = this.userContext;
    if (!context) {
      throw new Error('用户上下文不存在 / User context does not exist');
    }

    // 关闭所有现有的MCP客户端连接
    // Close all existing MCP client connections
    for (const mcpClient of context.mcpClients) {
      mcpClient.close();
    }

    // 创建新的飞书/LarkMCP客户端
    // Create new Lark MCP client
    const mcpClient = await MCPClientService.createLarkMCPClient(context.authToken?.accessToken);
    this.userContext.mcpClients.push(mcpClient);
  }

  /**
   * 确保获取有效的用户上下文
   * Ensure getting valid user context
   * 如果MCP客户端不存在，会自动创建
   * Automatically create MCP client if it doesn't exist
   * @returns 用户上下文对象 / User context object
   */
  async mustGetContext() {
    const context = this.getContext();

    // 如果已有MCP客户端，直接返回上下文
    // If MCP clients already exist, return context directly
    if (context.mcpClients.length > 0) {
      return context;
    }

    // 创建MCP客户端并返回更新后的上下文
    // Create MCP client and return updated context
    await this.createMcpClient();
    return this.getContext();
  }
}
