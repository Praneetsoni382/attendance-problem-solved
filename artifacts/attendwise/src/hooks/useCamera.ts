import { useState, useEffect, useRef, useCallback } from "react";

export type FacingMode = "environment" | "user";

export interface UseCameraOptions {
  idealFacingMode?: FacingMode;
  idealWidth?: number;
  idealHeight?: number;
}

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  hasPermission: boolean | null;
  isLoading: boolean;
  facingMode: FacingMode;
  torchOn: boolean;
  supportsTorch: boolean;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  cameraError: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  toggleTorch: () => Promise<void>;
  switchCamera: () => Promise<void>;
  selectDevice: (deviceId: string) => Promise<void>;
}

export function useCamera({
  idealFacingMode = "environment",
  idealWidth = 1920,
  idealHeight = 1080
}: UseCameraOptions = {}): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<FacingMode>(idealFacingMode);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [supportsTorch, setSupportsTorch] = useState<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Stop camera stream & release tracks
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
  }, []);

  // Sync stream to video element whenever stream state or videoRef mounts
  useEffect(() => {
    if (stream && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch((e) => console.warn("[useCamera] video.play error:", e));
      }
    }
  }, [stream, hasPermission]);

  // Start Real Hardware Camera Feed
  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setCameraError(null);

    // Stop previous stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }

    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported on this browser or environment.");
      }

      // Enumerate available camera devices
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoInputs);
      } catch {}

      // Construct video constraints
      const videoConstraints: MediaTrackConstraints = selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId } }
        : {
            facingMode: { ideal: facingMode },
            width: { ideal: idealWidth },
            height: { ideal: idealHeight }
          };

      let activeStream: MediaStream | null = null;

      // Tier 1: Ideal resolution + facing mode
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });
      } catch (tier1Err) {
        // Tier 2: Basic facing mode
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingMode } },
            audio: false
          });
        } catch (tier2Err) {
          // Tier 3: Unconstrained video
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      if (!activeStream) {
        throw new Error("Unable to acquire live stream from device camera.");
      }

      streamRef.current = activeStream;
      setStream(activeStream);

      if (videoRef.current) {
        videoRef.current.srcObject = activeStream;
        await videoRef.current.play().catch(() => {});
      }

      // Check torch capability
      const videoTrack = activeStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
        setSupportsTorch(Boolean(capabilities.torch));
      }

      setHasPermission(true);
      setCameraError(null);
    } catch (err: any) {
      console.warn("[useCamera] Camera stream request failed:", err?.name || err?.message || err);
      setHasPermission(false);

      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied or blocked by browser iframe policy. Please allow camera permissions or open this URL in a new tab.");
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setCameraError("No video camera hardware detected on this device. You can select a document photo file below.");
      } else {
        setCameraError(err?.message || "Failed to start camera feed. Please check camera connection or select a document photo file.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [facingMode, selectedDeviceId, idealWidth, idealHeight]);

  // Toggle Torch Light
  const toggleTorch = useCallback(async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && supportsTorch) {
        try {
          const nextState = !torchOn;
          await track.applyConstraints({
            advanced: [{ torch: nextState } as any]
          });
          setTorchOn(nextState);
          return;
        } catch (e) {
          console.warn("[useCamera] Torch constraint error:", e);
        }
      }
    }
    setTorchOn((prev) => !prev);
  }, [torchOn, supportsTorch]);

  // Switch Front / Rear Camera
  const switchCamera = useCallback(async () => {
    setSelectedDeviceId("");
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  // Select Specific Device
  const selectDevice = useCallback(async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    stream,
    hasPermission,
    isLoading,
    facingMode,
    torchOn,
    supportsTorch,
    devices,
    selectedDeviceId,
    cameraError,
    startCamera,
    stopCamera,
    toggleTorch,
    switchCamera,
    selectDevice
  };
}
