'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { useAuth } from '@/lib/auth-context';
import { useComplianceQueue, useReviewSubmission, type QueuedSubmission } from '@/hooks/use-compliance';
import { ApiError } from '@/lib/api';

function SubmissionCard({ submission }: { submission: QueuedSubmission }) {
  const review = useReviewSubmission();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: 'APPROVE' | 'REJECT' | 'NEEDS_MORE_INFO') => {
    setError(null);
    try {
      await review.mutateAsync({ id: submission.id, decision, note: note || undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save decision.');
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-ink">
            {submission.user.firstName} {submission.user.lastName} — Tier {submission.targetTier}
          </p>
          <p className="text-xs text-muted">{submission.user.email}</p>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {submission.sanctionsFlag && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-danger">Sanctions match</span>}
        {submission.pepFlag && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-danger">PEP match</span>}
        {submission.amlFlag && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-danger">AML flag</span>}
        {submission.riskScore !== null && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">Risk score: {submission.riskScore}</span>
        )}
      </div>

      {submission.documents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {submission.documents.map((doc) => (
            <a
              key={doc.id}
              href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/kyc/documents/${doc.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted hover:text-ink"
            >
              <FileText className="h-3 w-3" />
              {doc.type.replace(/_/g, ' ').toLowerCase()}
            </a>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}

      <textarea
        className="mt-3 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-teal/60 focus:outline-none"
        placeholder="Review note (optional)"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={() => decide('APPROVE')} isLoading={review.isPending}>
          Approve
        </Button>
        <Button variant="secondary" onClick={() => decide('NEEDS_MORE_INFO')} isLoading={review.isPending}>
          Needs more info
        </Button>
        <Button variant="danger" onClick={() => decide('REJECT')} isLoading={review.isPending}>
          Reject
        </Button>
      </div>
    </Card>
  );
}

export default function CompliancePage() {
  const { user } = useAuth();
  const { data: queue, isLoading } = useComplianceQueue();

  const canReview = user?.roles.some((r) => ['COMPLIANCE_OFFICER', 'ADMIN', 'SUPER_ADMIN'].includes(r));

  if (!canReview) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="h-8 w-8 text-muted" />
        <p className="text-sm text-muted">This page is only available to compliance and admin roles.</p>
        <Link href="/dashboard" className="text-sm text-teal hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Compliance review</h1>
        <p className="mt-1 text-sm text-muted">Pending and flagged KYC submissions.</p>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading queue…</p>}
      {!isLoading && queue?.length === 0 && <p className="text-sm text-muted">Nothing waiting for review.</p>}

      <div className="flex flex-col gap-4">
        {queue?.map((submission) => (
          <SubmissionCard key={submission.id} submission={submission} />
        ))}
      </div>
    </div>
  );
}
