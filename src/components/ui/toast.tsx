import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { create } from 'zustand';

import { haptic } from '@/lib/haptics';

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastState = {
  current: ToastItem | null;
  show: (kind: ToastKind, message: string) => void;
  dismiss: () => void;
};

let nextId = 1;

const useToastStore = create<ToastState>((set) => ({
  current: null,
  show: (kind, message) => set({ current: { id: nextId++, kind, message } }),
  dismiss: () => set({ current: null }),
}));

/**
 * Fire-and-forget feedback, callable from anywhere (including outside React):
 * `toast.error('Kaydedilemedi')`. One toast at a time — a newer one replaces
 * the visible one, which is what a small app actually needs.
 */
export const toast = {
  success: (message: string) => useToastStore.getState().show('success', message),
  error: (message: string) => useToastStore.getState().show('error', message),
  info: (message: string) => useToastStore.getState().show('info', message),
};

const STYLE: Record<
  ToastKind,
  { icon: keyof typeof Ionicons.glyphMap; className: string }
> = {
  success: { icon: 'checkmark-circle', className: 'bg-secondary' },
  error: { icon: 'alert-circle', className: 'bg-destructive' },
  info: { icon: 'information-circle', className: 'bg-secondary' },
};

/** Renders the active toast. Mounted once, in Providers. */
export function ToastHost() {
  const current = useToastStore((s) => s.current);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!current) return;
    haptic(current.kind === 'error' ? 'error' : 'success');
    const t = setTimeout(dismiss, 3000);
    return () => clearTimeout(t);
  }, [current, dismiss]);

  if (!current) return null;

  const style = STYLE[current.kind];

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12 }}
    >
      <Pressable
        onPress={dismiss}
        className={`flex-row items-center gap-2 rounded-2xl px-4 py-3 ${style.className}`}
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Ionicons name={style.icon} size={20} color="#FFFFFF" />
        <Text className="flex-1 text-base font-medium text-white">
          {current.message}
        </Text>
      </Pressable>
    </View>
  );
}
