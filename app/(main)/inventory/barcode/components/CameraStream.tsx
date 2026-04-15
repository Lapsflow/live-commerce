"use client";

import { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";
import { Flashlight, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraStreamProps {
  onDetected: (barcode: string) => void;
  isActive: boolean;
}

export function CameraStream({ onDetected, isActive }: CameraStreamProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const lastDetected = useRef<string>("");
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const trackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    if (!isActive || !videoRef.current) return;

    const initQuagga = async () => {
      try {
        await Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target: videoRef.current!,
              constraints: {
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                facingMode,
                aspectRatio: { min: 1, max: 2 },
              },
            },
            locator: {
              patchSize: "medium" as const,
              halfSample: true,
            },
            numOfWorkers: navigator.hardwareConcurrency || 4,
            decoder: {
              readers: [
                "ean_reader",
                "ean_8_reader",
                "code_128_reader",
                "code_39_reader",
                "code_39_vin_reader",
                "codabar_reader",
                "upc_reader",
                "upc_e_reader",
                "i2of5_reader",
              ],
            },
            locate: true,
          },
          (err) => {
            if (err) {
              console.error("[Quagga Init Error]", err);
              return;
            }
            Quagga.start();

            // Get media stream track for torch control
            if (videoRef.current) {
              const videoElement = videoRef.current.querySelector("video");
              if (videoElement && videoElement.srcObject) {
                const stream = videoElement.srcObject as MediaStream;
                const track = stream.getVideoTracks()[0];
                trackRef.current = track;
              }
            }
          }
        );

        // Barcode detection handler with debouncing
        Quagga.onDetected((result) => {
          const code = result.codeResult.code;
          if (!code) return;

          // Ignore duplicate scans within 2 seconds
          if (code === lastDetected.current) return;

          // Clear previous timeout
          if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
          }

          // Debounce detection
          debounceTimeout.current = setTimeout(() => {
            lastDetected.current = code;
            onDetected(code);

            // Reset after 2 seconds
            setTimeout(() => {
              lastDetected.current = "";
            }, 2000);
          }, 300);
        });
      } catch (error) {
        console.error("[Camera Stream Error]", error);
      }
    };

    initQuagga();

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      Quagga.stop();
      Quagga.offDetected();
      trackRef.current = null;
    };
  }, [isActive, onDetected, facingMode]);

  const toggleTorch = async () => {
    if (!trackRef.current) return;

    try {
      const capabilities = trackRef.current.getCapabilities() as any;
      if (capabilities.torch) {
        await trackRef.current.applyConstraints({
          // @ts-ignore
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
      }
    } catch (error) {
      console.error("[Torch Toggle Error]", error);
    }
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  return (
    <div
      ref={videoRef}
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden"
    >
      {/* Quagga will render camera stream here */}

      {/* Camera Controls */}
      {isActive && (
        <div className="absolute bottom-4 right-4 flex gap-2">
          <Button
            size="icon"
            variant="secondary"
            onClick={toggleTorch}
            className="bg-white/90 hover:bg-white"
          >
            <Flashlight className={torchOn ? "text-yellow-500" : ""} />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            onClick={flipCamera}
            className="bg-white/90 hover:bg-white"
          >
            <SwitchCamera />
          </Button>
        </div>
      )}
    </div>
  );
}
