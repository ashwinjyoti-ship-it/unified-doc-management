import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Zap, X, CheckSquare, FileText, Camera } from 'lucide-react';
import Tooltip from './Tooltip';

export default function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [type, setType] = useState<'note' | 'task'>('note');
  const { createPage } = useStore();
  const navigate = useNavigate();

  const handleCapture = async () => {
    if (!text.trim()) return;
    const page = await createPage({
      type: 'page',
      title: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
      icon: type === 'task' ? '✅' : '📝',
    });

    if (type === 'task') {
      await api.saveBlocks(page.id, [{
        type: 'todo',
        content: { text, checked: false },
        orderIndex: 0,
      }]);
    } else {
      await api.saveBlocks(page.id, [{
        type: 'paragraph',
        content: { text },
        orderIndex: 0,
      }]);
    }

    setText('');
    setOpen(false);
    navigate(`/page/${page.id}`);
  };

  return (
    <>
      <Tooltip text="Quickly capture a note or task to Inbox">
        <button
          onClick={() => setOpen(true)}
          className="fixed fixed-bottom-safe right-6 w-14 h-14 bg-forest text-white rounded-full shadow-lg flex items-center justify-center z-40 md:hidden hover:bg-dark-teal transition-colors"
          aria-label="Quick capture"
        >
          <Zap className="w-6 h-6" />
        </button>
      </Tooltip>

      {open && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setOpen(false)}>
          <div className="card-surface w-full max-w-md p-6 rounded-t-2xl md:rounded-[14px] safe-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-charcoal">Quick Capture</h3>
              <button onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setType('note')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm ${type === 'note' ? 'bg-sage/30 text-forest font-medium' : 'bg-linen'}`}
              >
                <FileText className="w-4 h-4" /> Note
              </button>
              <button
                onClick={() => setType('task')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm ${type === 'task' ? 'bg-sage/30 text-forest font-medium' : 'bg-linen'}`}
              >
                <CheckSquare className="w-4 h-4" /> Task
              </button>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={type === 'task' ? 'What needs to be done?' : 'Jot something down...'}
              className="w-full h-32 px-4 py-3 rounded-xl bg-linen border-none outline-none resize-none text-sm"
              autoFocus
            />

            <button onClick={handleCapture} className="btn-primary w-full mt-4" disabled={!text.trim()}>
              Save {type === 'task' ? 'Task' : 'Note'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
