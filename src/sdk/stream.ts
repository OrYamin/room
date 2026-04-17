export function extractAssistantText(message: any): string {
  const content = message?.message?.content ?? message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block) continue;
    if (typeof block === "string") {
      parts.push(block);
    } else if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("");
}

export function extractResultText(message: any): string {
  if (typeof message?.result === "string") return message.result;
  if (typeof message?.content === "string") return message.content;
  return "";
}
