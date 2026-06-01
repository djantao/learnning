"use client"

import { useEffect } from "react"
import { registerServiceWorker, requestNotificationPermission } from "@/lib/notify"

export function NotificationInit() {
  useEffect(() => {
    registerServiceWorker().then(() => {
      setTimeout(() => requestNotificationPermission(), 1000)
    })
  }, [])
  return null
}
