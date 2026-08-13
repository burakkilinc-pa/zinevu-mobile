import { Placeholder } from '@/components/ui/placeholder';
import { useT } from '@/lib/i18n';

export default function JobsScreen() {
  const t = useT();
  return <Placeholder icon="construct-outline" title={t('tabs.jobs')} subtitle={t('phase.jobs')} />;
}
