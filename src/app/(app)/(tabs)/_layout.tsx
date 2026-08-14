import { useState } from 'react';
import { Tabs, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/features/auth/store';
import { useSupportUnread } from '@/features/support/hooks/use-support';
import { resolveAppSpace } from '@/lib/auth/roles';
import { BrandTabBar } from '@/components/brand-tab-bar';
import { MoreSheet } from '@/components/more-sheet';
import { Avatar } from '@/components/ui/avatar';
import { useT } from '@/lib/i18n';

/**
 * Tab navigator. Adapts to the user's space (src/lib/auth/roles.ts):
 *
 *  - dealer / admin  Leads · Planning · [Dashboard] · Live Chat · More —
 *                    Dashboard sits in the raised centre of the dock.
 *  - installer       a stripped dock: Planning · [Jobs] · More. A fitter
 *                    only ever needs the visits assigned to them.
 *
 * The side tabs are kept to an even number on purpose: the brand Z only reads
 * as the hero when it is dead centre, and an odd split pushes it off-axis.
 * So the last slot is not the Settings screen but an overflow sheet (MoreSheet)
 * carrying support, the platform back-office and settings — and it wears the
 * signed-in user's photo when they have one, the way every app of this shape
 * does. Support's unread count rides up onto that slot so an answer is never
 * buried a sheet deep.
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
  const supportUnread = useSupportUnread();
  const [moreOpen, setMoreOpen] = useState(false);

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  // WhatsApp hides the tab bar inside a thread so the composer sits on the
  // safe-area edge. The (tabs) group segment sits between '(app)' and the tab
  // name, so locate 'chat' rather than assuming a fixed index.
  const chatIndex = segments.indexOf('chat');
  const inThread = chatIndex !== -1 && segments.length > chatIndex + 1;

  // Each space's landing screen sits in the raised centre of the dock.
  const centerRoute = isInstaller ? 'jobs' : 'index';

  return (
    <>
    <MoreSheet visible={moreOpen} onClose={() => setMoreOpen(false)} />
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
      {/* Zinevu platform back-office — staff only, and reached from the More
          sheet rather than the dock: a fifth side icon would knock the brand Z
          off centre, and this is a back-office errand, not daily work. */}
      <Tabs.Screen
        name="platform"
        options={{
          title: t('tabs.admin'),
          href: null,
        }}
      />
      {/* The overflow slot. It never navigates — pressing it opens MoreSheet
          (see the tabPress listener), which is where Settings now lives. */}
      <Tabs.Screen
        name="settings"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            setMoreOpen(true);
          },
        }}
        options={{
          title: t('tabs.settings'),
          tabBarBadge: supportUnread.data || undefined,
          tabBarIcon: ({ focused, color, size }) =>
            user?.avatarUrl ? (
              <Avatar
                url={user.avatarUrl}
                initials={initials || '?'}
                size={size + 2}
                className={focused ? 'opacity-100' : 'opacity-90'}
              />
            ) : (
              <Ionicons
                name={focused ? 'settings' : 'settings-outline'}
                color={color}
                size={size}
              />
            ),
        }}
      />
    </Tabs>
    </>
  );
}
