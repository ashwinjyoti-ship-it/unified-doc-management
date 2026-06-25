import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';

interface AgentCommentPopoverProps {
  quote: string;
  onSubmit: (instruction: string) => void;
  onCancel: () => void;
}

export default function AgentCommentPopover({ quote, onSubmit, onCancel }: AgentCommentPopoverProps) {
  const [instruction, setInstruction] = useState('');

  return (
    <>
      <div className="fixed inset-0 z-[200]" onClick={onCancel} />
      <div className="fixed z-[210] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,400px)] card-surface p-4 shadow-2xl rounded-xl">
        <h3 className="font-semibold text-sm text-charcoal mb-2">Comment for AI agent</h3>
        <blockquote className="text-xs text-mid-gray border-l-2 border-sage pl-2 mb-3 line-clamp-3 italic">
          &ldquo;{quote}&rdquo;
        </blockquote>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Tell the agent what to do with this text…"
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-linen border-none outline-none text-sm text-charcoal resize-none db-cell-input"
          autoFocus
        />
        <p className="text-xs text-mid-gray mt-2">
          This is an instruction for your AI agent — not a formatting action.
        </p>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button
            type="button"
            disabled={!instruction.trim()}
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
