import { Input } from '@/components/ui/input';

export function PinField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Input
      label="Transaction PIN"
      inputMode="numeric"
      maxLength={4}
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      hint="Confirms this transfer — set one under Security if you haven't yet"
    />
  );
}
