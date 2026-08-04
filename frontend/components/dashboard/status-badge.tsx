import { cn } from '@/lib/utils';

const STYLES: Record<string, string> = {
  COMPLETED: 'bg-teal/10 text-teal',
  APPROVED: 'bg-teal/10 text-teal',
  PASSED: 'bg-teal/10 text-teal',
  PROCESSING: 'bg-gold/10 text-gold',
  PENDING: 'bg-gold/10 text-gold',
  IN_REVIEW: 'bg-gold/10 text-gold',
  NEEDS_MORE_INFO: 'bg-gold/10 text-gold',
  FLAGGED: 'bg-gold/10 text-gold',
  SCHEDULED: 'bg-surface-2 text-muted',
  FAILED: 'bg-danger/10 text-danger',
  REJECTED: 'bg-danger/10 text-danger',
  CANCELLED: 'bg-surface-2 text-muted',
};

export function StatusBadge({ status }: { status: string }) {
  const label = status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STYLES[status] ?? 'bg-surface-2 text-muted')}>
      {label}
    </span>
  );
}
