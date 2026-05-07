export interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

const channel = "pos:notification";

export function pushAppNotification(title: string, message: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(channel, { detail: { title, message } }));
}

export function subscribeAppNotifications(handler: (title: string, message: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ title: string; message: string }>;
    handler(custom.detail?.title || "Notification", custom.detail?.message || "");
  };
  window.addEventListener(channel, listener as EventListener);
  return () => window.removeEventListener(channel, listener as EventListener);
}

