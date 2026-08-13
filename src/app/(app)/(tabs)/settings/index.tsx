import { Placeholder } from '@/components/ui/placeholder';
import { useT } from '@/lib/i18n';

export default function SettingsScreen() {
  const t = useT();
  return <Placeholder icon="settings-outline" title={t('tabs.settings')} subtitle={t('phase.settings')} />;
}
