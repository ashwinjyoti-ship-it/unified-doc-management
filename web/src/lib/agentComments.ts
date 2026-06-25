/** Build a single prompt string agents can consume directly. */
export function buildAgentPrompt(selectionQuote: string, instruction: string): string {
  const quote = selectionQuote.trim();
  const text = instruction.trim();
  if (!quote) return text;
  if (!text) return `Selected text: "${quote}"`;
  return `Selected text: "${quote}"\n\nInstruction: ${text}`;
}

export interface AgentSelectionMeta {
  from: number;
  to: number;
  blockType?: string;
}

export function parseSelectionMeta(raw: string | null | undefined): AgentSelectionMeta | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AgentSelectionMeta;
  } catch {
    return null;
  }
}
