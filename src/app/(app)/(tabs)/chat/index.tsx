import { Placeholder } from '@/components/ui/placeholder';
import { useT } from '@/lib/i18n';

export default function ChatScreen() {
  const t = useT();
  return <Placeholder icon="chatbubbles-outline" title={t('tabs.chat')} subtitle={t('phase.chat')} />;
}
