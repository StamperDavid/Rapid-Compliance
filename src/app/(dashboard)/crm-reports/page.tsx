import { CrmReports } from '@/components/crm/CrmReports';

export const metadata = {
  title: 'CRM Reports',
  description: 'Pipeline, forecast, and win/loss reporting computed from live CRM deals.',
};

export default function CrmReportsPage() {
  return <CrmReports />;
}
