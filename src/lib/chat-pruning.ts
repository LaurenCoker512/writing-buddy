import { AI_CONFIG } from "@/config/ai";

export function shouldPruneChatMessages(count: number): boolean {
  return count >= AI_CONFIG.CHAT_RETENTION_LIMIT;
}
