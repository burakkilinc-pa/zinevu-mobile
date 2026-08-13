import { Placeholder } from '@/components/ui/placeholder';
import { useT } from '@/lib/i18n';

export default function DashboardScreen() {
  const t = useT();
  return <Placeholder icon="grid-outline" title={t('tabs.dashboard')} subtitle={t('phase.dashboard')} />;
}
