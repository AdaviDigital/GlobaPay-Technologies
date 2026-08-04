import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success'; children: React.ReactNode }) {
  const Icon = tone === 'error' ? AlertTriangle : CheckCircle2;
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border px-4 py-3 text-sm',
        tone === 'error' && 'border-danger/30 bg-danger/10 text-danger',
        tone === 'success' && 'border-teal/30 bg-teal/10 text-teal',
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
