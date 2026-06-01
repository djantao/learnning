"use client"

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false
  return (await Notification.requestPermission()) === "granted"
}

export function sendBrowserNotification(title: string, body: string, url?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, { body, icon: "/favicon.ico", data: { url: url || "/" }, tag: "learnning", requireInteraction: true })
    })
  } else {
    new Notification(title, { body, icon: "/favicon.ico" })
  }
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
  try { await navigator.serviceWorker.register("/sw.js") } catch { /* not HTTPS or unsupported */ }
}
