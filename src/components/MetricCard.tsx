import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}

export function MetricCard({ label, value, hint, icon }: MetricCardProps) {
  return (
    <section className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{hint}</span>
      </div>
    </section>
  );
}
