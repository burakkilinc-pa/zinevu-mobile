import { Placeholder } from '@/components/ui/placeholder';
import { useT } from '@/lib/i18n';

export default function PlanningScreen() {
  const t = useT();
  return <Placeholder icon="calendar-outline" title={t('tabs.planning')} subtitle={t('phase.planning')} />;
}
