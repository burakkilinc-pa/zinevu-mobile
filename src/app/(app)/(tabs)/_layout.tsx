import { Tabs, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/features/auth/store';
import { resolveAppSpace } from '@/lib/auth/roles';
import { BrandTabBar } from '@/components/brand-tab-bar';
import { useT } from '@/lib/i18n';

/**
 * Tab navigator. Adapts to the user's space (src/lib/auth/roles.ts):
 *
 *  - dealer / admin  Leads · Planning · [Dashboard] · Live Chat · Settings —
 *                    Dashboard sits in the raised centre of the dock, and an
 *                    admin additionally gets the platform back-office tab.
 *  - installer       a stripped dock: Planning · [Jobs] · Settings. A fitter
 *                    only ever needs the visits assigned to them.
 *
 * Support is reached from Settings rather than the dock: it is a rare,
 * deliberate action, and five icons is already the most a dock reads cleanly at.
 *
 * Irrelevant tabs are hidden with href={null}; BrandTabBar filters those out
 * itself, since it renders its own buttons rather than the default bar's.
 *
 * Full-screen detail routes (lead detail, chat thread, the 3D configurator) are
 * NOT tabs — they are pushed over this navigator by the parent Stack, so they
 * cover the dock and return cleanly to their origin. See (app)/_layout.
 */
export default function TabsLayout() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  // Cast: the tuple type expo-router infers comes from generated route types,
  // which don't exist on a clean checkout — indexing it would fail to compile
  // there while passing locally.
  const segments = useSegments() as string[];

  const space = resolveAppSpace(user);
  const isInstaller = space === 'installer';
  const isOffice = space === 'dealer' || space === 'admin';
  const isAdmin = space === 'admin';

  // WhatsApp hides the tab bar inside a thread so the composer sits on the
  // safe-area edge. The (tabs) group segment sits between '(app)' and the tab
  // name, so locate 'chat' rather than assuming a fixed index.
  const chatIndex = segments.indexOf('chat');
  const inThread = chatIndex !== -1 && segments.length > chatIndex + 1;

  // Each space's landing screen sits in the raised centre of the dock.
  const centerRoute = isInstaller ? 'jobs' : 'index';

  return (
    <Tabs
      tabBar={(props) =>
        inThread ? null : <BrandTabBar {...props} centerRoute={centerRoute} />
      }
      screenOptions={{ headerShown: false }}
    >
      {/* Dashboard — the office landing screen, in the dock's notch. */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.dashboard'),
          href: isOffice ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: t('tabs.leads'),
          href: isOffice ? undefined : null,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'albums' : 'albums-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="planning"
        options={{
          title: t('tabs.planning'),
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          href: isOffice ? undefined : null,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      {/* Installer landing screen — the visits assigned to this crew. */}
      <Tabs.Screen
        name="jobs"
        options={{
          title: t('tabs.jobs'),
          href: isInstaller ? undefined : null,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'construct' : 'construct-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      {/* Zinevu platform back-office — staff only. */}
      <Tabs.Screen
        name="platform"
        options={{
          title: t('tabs.admin'),
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
