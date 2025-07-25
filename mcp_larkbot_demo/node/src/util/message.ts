/**
 * 消息处理工具函数
 * Message Processing Utility Functions
 *
 * 功能说明:
 * - 格式化工具调用和结果显示
 * - 解析AI消息为Markdown格式
 * - 处理流式消息数据块
 *
 * Features:
 * - Format tool calls and results display
 * - Parse AI messages to Markdown format
 * - Process streaming message chunks
 */

import { CoreAssistantMessage, CoreToolMessage, TextPart, ToolCallPart } from 'ai';

/**
 * 格式化工具调用信息
 * Format tool call information
 *
 * 将工具调用转换为可读的Markdown格式
 * Convert tool call to readable Markdown format
 *
 * @param toolName 工具名称 / Tool name
 * @param args 工具参数对象 / Tool arguments object
 * @returns 格式化的工具调用字符串 / Formatted tool call string
 */
export function formatToolCall(toolName: string, args: any) {
  return `调用 \`\`\`${toolName}\`\`\` 工具，参数为:\n \`\`\`\n${JSON.stringify(args, null, 2)}\n\`\`\``;
}

/**
 * 格式化工具执行结果
 * Format tool execution result
 *
 * 将工具执行结果转换为可读的Markdown格式
 * Convert tool execution result to readable Markdown format
 *
 * @param result 工具执行结果 / Tool execution result
 * @returns 格式化的结果字符串 / Formatted result string
 */
export function formatToolResult(result: any) {
  return `执行结果：\n \`\`\`\n${JSON.stringify(result, null, 2)}\n\`\`\``;
}

/**
 * 将AI消息数组转换为Markdown字符串
 * Convert AI message array to Markdown string
 *
 * 遍历消息数组，根据内容类型进行相应的格式化处理
 * Iterate through message array and format according to content type
 *
 * @param messages AI核心消息数组 / AI core message array
 * @returns 合并后的Markdown字符串 / Combined Markdown string
 */
export function parseMessages2Markdown(messages: (CoreAssistantMessage | CoreToolMessage)[]) {
  const result = [];

  for (const message of messages) {
    // 处理字符串类型的消息内容
    // Handle string type message content
    if (typeof message.content === 'string') {
      result.push(message.content);
      continue;
    }

    // 处理复合内容类型的消息
    // Handle composite content type messages
    for (const content of message.content) {
      if (content.type === 'text') {
        result.push(content.text);
      }
      if (content.type === 'tool-call') {
        result.push(formatToolCall(content.toolName, content.args));
      }
      if (content.type === 'tool-result') {
        result.push(formatToolResult(content.result));
      }
    }
  }

  return result.join('\n\n');
}

/**
 * 代理核心消息类型定义
 * Agent Core Message Type Definition
 * 用于流式处理过程中的临时消息存储
 * Used for temporary message storage during streaming process
 */
export type AgentCoreMessage = CoreToolMessage | { role: 'assistant'; content: (TextPart | ToolCallPart)[] };

/**
 * 解析流式数据块为消息格式
 * Parse streaming chunk to message format
 *
 * 处理AI模型的流式响应，将数据块转换为标准消息格式
 * Process AI model streaming response and convert chunks to standard message format
 *
 * @param tempMessages 临时消息数组 / Temporary message array
 * @param chunk 流式数据块 / Streaming data chunk
 * @returns 更新后的消息数组 / Updated message array
 */
export function parseChunk2Message(tempMessages: AgentCoreMessage[], chunk: any) {
  // 处理文本增量数据块
  // Handle text delta chunks
  if (chunk.chunk.type === 'text-delta' || chunk.chunk.type === 'reasoning') {
    const lastMessage = tempMessages.at(-1);
    const lastContent = lastMessage?.content.at(-1);

    if (lastMessage?.role === 'assistant') {
      if (lastContent?.type === 'text') {
        lastContent.text += chunk.chunk.textDelta;
      } else {
        lastMessage.content.push({ type: 'text', text: chunk.chunk.textDelta });
      }
    } else {
      tempMessages.push({ role: 'assistant', content: [{ type: 'text', text: chunk.chunk.textDelta }] });
    }
  }

  // 处理工具调用数据块
  // Handle tool call chunks
  if (chunk.chunk.type === 'tool-call') {
    const content = { ...chunk.chunk, type: 'tool-call' as const };
    const lastMessage = tempMessages.at(-1);

    if (lastMessage?.role === 'assistant') {
      lastMessage.content.push(content);
    } else {
      tempMessages.push({ role: 'assistant', content: [content] });
    }
  }

  // 处理工具结果数据块
  // Handle tool result chunks
  if (chunk.chunk.type === 'tool-result') {
    tempMessages.push({ role: 'tool', content: [{ ...chunk.chunk, type: 'tool-result' as const }] });
  }

  return tempMessages;
}
