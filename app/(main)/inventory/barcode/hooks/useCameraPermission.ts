"use client";

import { useState, useEffect } from "react";

export function useCameraPermission() {
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    // Check if camera permission is already granted
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const hasCamera = devices.some((device) => device.kind === "videoinput");
          if (!hasCamera) {
            setPermissionDenied(true);
          }
        })
        .catch((err) => {
          console.error("[Camera Permission Check Error]", err);
        });
    } else {
      setPermissionDenied(true);
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      });

      // Stop the stream immediately, we just needed permission
      stream.getTracks().forEach((track) => track.stop());

      setHasPermission(true);
      setPermissionDenied(false);
      return true;
    } catch (err) {
      console.error("[Camera Permission Request Error]", err);
      setHasPermission(false);
      setPermissionDenied(true);
      return false;
    }
  };

  return {
    hasPermission,
    permissionDenied,
    requestPermission,
  };
}
