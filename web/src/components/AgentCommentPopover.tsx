import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { buildAgentPrompt } from '../lib/agentComments';

interface AgentCommentPopoverProps {
  quote: string;
  onSubmit: (instruction: string) => void;
  onCancel: () => void;
}

export default function AgentCommentPopover({ quote, onSubmit, onCancel }: AgentCommentPopoverProps) {
  const [instruction, setInstruction] = useState('');
  const preview = instruction.trim()
    ? buildAgentPrompt(quote, instruction)
    : null;

  return (
    <>
      <div className="fixed inset-0 z-[200]" onClick={onCancel} />
      <div
        className="fixed z-[210] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,440px)] card-surface p-4 shadow-2xl rounded-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-sm text-charcoal mb-2">Comment for AI agent</h3>

        <div className="mb-3 rounded-lg bg-amber-50/80 border border-amber-200/70 px-3 py-2">
          <p className="text-xs font-medium text-amber-900 mb-1">Selected text (sent to agent)</p>
          <p className="text-sm text-charcoal whitespace-pre-wrap break-words">
            &ldquo;{quote}&rdquo;
          </p>
        </div>

        <label className="block text-xs font-medium text-mid-gray mb-1">Your instruction</label>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder='e.g. "Add a hyphen between these two words"'
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-linen border-none outline-none text-sm text-charcoal resize-none db-cell-input"
          autoFocus
        />

        {preview && (
          <div className="mt-3 rounded-lg bg-linen/80 border border-green-mist px-3 py-2">
            <p className="text-xs font-medium text-mid-gray mb-1">What the agent will receive</p>
            <pre className="text-xs text-charcoal whitespace-pre-wrap font-sans">{preview}</pre>
          </div>
        )}

        <p className="text-xs text-mid-gray mt-2">
          This is an instruction for your AI agent — not a formatting action.
        </p>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button
            type="button"
            disabled={!instruction.trim() || !quote.trim()}
            onClick={() => onSubmit(instruction.trim())}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-1"
          >
            <MessageSquarePlus className="w-4 h-4" /> Save instruction
          </button>
        </div>
      </div>
    </>
  );
}
