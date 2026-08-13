import { Placeholder } from '@/components/ui/placeholder';
import { useT } from '@/lib/i18n';

export default function LeadsScreen() {
  const t = useT();
  return <Placeholder icon="albums-outline" title={t('tabs.leads')} subtitle={t('phase.leads')} />;
}
