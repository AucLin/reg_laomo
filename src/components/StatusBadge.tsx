import { STATUS_LABELS, type RegistrationStatus } from '../lib/types';

const STATUS_STYLES: Record<RegistrationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  contacted: 'bg-blue-100 text-blue-800',
  enrolled: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-600',
};

export default function StatusBadge({ status }: { status: RegistrationStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
