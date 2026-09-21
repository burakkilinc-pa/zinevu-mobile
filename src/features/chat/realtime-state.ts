import { create } from 'zustand';

/**
 * What the chat socket currently knows, for the screens that have to react to
 * it: whether it is carrying this session, and who is typing.
 *
 * It lives apart from the hook that fills it (use-chat-realtime.ts) so the
 * polling hooks can read the connection without importing the subscription
 * that imports them back.
 */

/** How long a "typing" lasts without being renewed. Matches the portal desk. */
const TYPING_TTL = 6_000;

type ChatRealtimeState = {
  /** True while messages are arriving over the socket rather than the poll. */
  connected: boolean;
  /** Conversation uuid → the visitor is writing right now. */
  typing: Record<string, boolean>;
};

export const useChatRealtimeStore = create<ChatRealtimeState>(() => ({
  connected: false,
  typing: {},
}));

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function setRealtimeConnected(connected: boolean): void {
  useChatRealtimeStore.setState({ connected });
}

export function setVisitorTyping(uuid: string, typing: boolean): void {
  const timer = typingTimers.get(uuid);
  if (timer) clearTimeout(timer);

  useChatRealtimeStore.setState((state) => ({
    typing: { ...state.typing, [uuid]: typing },
  }));

  if (!typing) {
    typingTimers.delete(uuid);
    return;
  }

  // The other side only ever says "I am typing"; nothing guarantees a
  // "stopped". Let it lapse on its own rather than leaving a bubble bouncing
  // under a visitor who closed the tab ten minutes ago.
  typingTimers.set(
    uuid,
    setTimeout(() => {
      typingTimers.delete(uuid);
      useChatRealtimeStore.setState((state) => ({
        typing: { ...state.typing, [uuid]: false },
      }));
    }, TYPING_TTL)
  );
}

/** Is the live socket carrying this session's chat right now? */
export function useChatRealtimeConnected(): boolean {
  return useChatRealtimeStore((s) => s.connected);
}

/** Is the visitor in this conversation typing? */
export function useVisitorTyping(uuid: string): boolean {
  return useChatRealtimeStore((s) => !!s.typing[uuid]);
}
