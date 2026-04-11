"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/notifications";

export function ServiceWorkerRegister() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
