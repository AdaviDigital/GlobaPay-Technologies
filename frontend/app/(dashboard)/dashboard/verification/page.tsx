'use client';

import { useState } from 'react';
import { CheckCircle2, Upload, Trash2, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/dashboard/status-badge';
import {
  useKycStatus,
  useSubmitTier1,
  useSubmitTier2,
  useSubmitTier3,
  useUploadKycDocument,
  useFinalizeSubmission,
  useRemoveKycDocument,
  type KycSubmission,
} from '@/hooks/use-kyc';
import { ApiError } from '@/lib/api';

const TIER_LABELS: Record<number, string> = {
  0: 'Email only',
  1: 'Phone, BVN, NIN & selfie',
  2: 'Government ID & proof of address',
  3: 'Business verification',
};

function DocumentUploader({
  submission,
  types,
}: {
  submission: KycSubmission;
  types: { value: string; label: string }[];
}) {
  const [selectedType, setSelectedType] = useState(types[0]?.value ?? '');
  const upload = useUploadKycDocument();
  const remove = useRemoveKycDocument();
  const [error, setError] = useState<string | null>(null);

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync({ submissionId: submission.id, type: selectedType, file });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-ink focus:border-teal/60 focus:outline-none"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm text-ink hover:border-teal/60">
          <Upload className="h-4 w-4" />
          {upload.isPending ? 'Uploading…' : 'Choose file'}
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={onFileChange} />
        </label>
      </div>

      {submission.documents.length > 0 && (
        <div className="flex flex-col divide-y divide-border">
          {submission.documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink">
                {doc.type.replace(/_/g, ' ').toLowerCase()} — {doc.fileName}
              </span>
              <button onClick={() => remove.mutate(doc.id)} className="text-muted hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinalizeBar({ submission }: { submission: KycSubmission }) {
  const finalize = useFinalizeSubmission();
  const [error, setError] = useState<string | null>(null);

  const onFinalize = async () => {
    setError(null);
    try {
      await finalize.mutateAsync(submission.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit for review.');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {error && <Alert>{error}</Alert>}
      <Button onClick={onFinalize} isLoading={finalize.isPending} className="w-fit">
        Submit for verification
      </Button>
    </div>
  );
}

function Tier1Form() {
  const submit = useSubmitTier1();
  const [bvn, setBvn] = useState('');
  const [nin, setNin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await submit.mutateAsync({ bvn, nin });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submission failed.');
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Input label="BVN" value={bvn} onChange={(e) => setBvn(e.target.value.replace(/\D/g, ''))} maxLength={11} required />
        <Input label="NIN" value={nin} onChange={(e) => setNin(e.target.value.replace(/\D/g, ''))} maxLength={11} required />
      </div>
      <Button type="submit" isLoading={submit.isPending} className="w-fit">
        Start Tier 1 verification
      </Button>
    </form>
  );
}

function Tier2Form() {
  const submit = useSubmitTier2();
  const [form, setForm] = useState({ addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: '' });
  const [error, setError] = useState<string | null>(null);
  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await submit.mutateAsync(form);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submission failed.');
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <Alert>{error}</Alert>}
      <Input label="Address line 1" value={form.addressLine1} onChange={update('addressLine1')} required />
      <Input label="Address line 2 (optional)" value={form.addressLine2} onChange={update('addressLine2')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="City" value={form.city} onChange={update('city')} required />
        <Input label="State/Province" value={form.state} onChange={update('state')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Postal code" value={form.postalCode} onChange={update('postalCode')} />
        <Input label="Country" value={form.country} onChange={update('country')} required />
      </div>
      <Button type="submit" isLoading={submit.isPending} className="w-fit">
        Start Tier 2 verification
      </Button>
    </form>
  );
}

function Tier3Form() {
  const submit = useSubmitTier3();
  const [form, setForm] = useState({ businessName: '', registrationNumber: '', taxId: '' });
  const [error, setError] = useState<string | null>(null);
  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await submit.mutateAsync(form);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submission failed.');
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <Alert>{error}</Alert>}
      <Input label="Business name" value={form.businessName} onChange={update('businessName')} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="CAC registration number" value={form.registrationNumber} onChange={update('registrationNumber')} required />
        <Input label="Tax ID" value={form.taxId} onChange={update('taxId')} required />
      </div>
      <Button type="submit" isLoading={submit.isPending} className="w-fit">
        Start Tier 3 verification
      </Button>
    </form>
  );
}

export default function VerificationPage() {
  const { data: status, isLoading } = useKycStatus();

  const openSubmissionForTier = (tier: number) =>
    status?.submissions.find((s) => s.targetTier === tier && ['PENDING', 'NEEDS_MORE_INFO'].includes(s.status));

  const inReviewForTier = (tier: number) =>
    status?.submissions.find((s) => s.targetTier === tier && s.status === 'IN_REVIEW');

  const nextTier = status ? status.currentTier + 1 : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Verification</h1>
        <p className="mt-1 text-sm text-muted">Higher tiers unlock higher limits.</p>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal/10 text-teal">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-ink">
              {isLoading ? 'Loading…' : `Tier ${status?.currentTier}`}
            </p>
            <p className="text-xs text-muted">{status ? TIER_LABELS[status.currentTier] : ''}</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {[0, 1, 2, 3].map((tier) => (
            <div
              key={tier}
              className={`h-1.5 flex-1 rounded-full ${status && status.currentTier >= tier ? 'bg-teal' : 'bg-surface-2'}`}
            />
          ))}
        </div>
      </Card>

      {nextTier === 1 && !openSubmissionForTier(1) && !inReviewForTier(1) && (
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">Tier 1 — Identity verification</h2>
          <Tier1Form />
        </Card>
      )}

      {nextTier === 2 && !openSubmissionForTier(2) && !inReviewForTier(2) && (
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">Tier 2 — Government ID & address</h2>
          <Tier2Form />
        </Card>
      )}

      {nextTier === 3 && !openSubmissionForTier(3) && !inReviewForTier(3) && (
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">Tier 3 — Business verification</h2>
          <Tier3Form />
        </Card>
      )}

      {status?.submissions
        .filter((s) => ['PENDING', 'NEEDS_MORE_INFO'].includes(s.status))
        .map((submission) => (
          <Card key={submission.id}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-ink">Tier {submission.targetTier} documents</h2>
              <StatusBadge status={submission.status} />
            </div>
            {submission.reviewNote && <p className="mt-2 text-sm text-muted">{submission.reviewNote}</p>}
            <div className="mt-4">
              <DocumentUploader
                submission={submission}
                types={
                  submission.targetTier === 1
                    ? [{ value: 'SELFIE', label: 'Selfie' }]
                    : submission.targetTier === 2
                      ? [
                          { value: 'PASSPORT', label: 'Passport' },
                          { value: 'DRIVERS_LICENSE', label: "Driver's license" },
                          { value: 'NATIONAL_ID', label: 'National ID' },
                          { value: 'PROOF_OF_ADDRESS', label: 'Proof of address' },
                        ]
                      : [
                          { value: 'CAC_CERTIFICATE', label: 'CAC certificate' },
                          { value: 'TAX_ID_DOCUMENT', label: 'Tax ID document' },
                          { value: 'COMPANY_DOCUMENT', label: 'Other company document' },
                        ]
                }
              />
            </div>
            <div className="mt-4">
              <FinalizeBar submission={submission} />
            </div>
          </Card>
        ))}

      {status && status.submissions.length > 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink">Submission history</h2>
          <div className="mt-4 flex flex-col divide-y divide-border">
            {status.submissions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="text-ink">Tier {s.targetTier}</p>
                  <p className="text-xs text-muted">{new Date(s.submittedAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.status === 'APPROVED' && <CheckCircle2 className="h-4 w-4 text-teal" />}
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
