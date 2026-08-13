import { Placeholder } from '@/components/ui/placeholder';
import { useT } from '@/lib/i18n';

export default function PlatformScreen() {
  const t = useT();
  return <Placeholder icon="shield-checkmark-outline" title={t('tabs.admin')} subtitle={t('phase.platform')} />;
}
