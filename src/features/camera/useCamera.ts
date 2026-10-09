import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraState = 'idle' | 'starting' | 'running' | 'error'

// Opens the back camera into a <video>. Stops it when the page is hidden so Android releases the camera.
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<CameraState>('idle')
  const [error, setError] = useState<string | null>(null)
  const wasRunningRef = useRef(false)

  const stop = useCallback(() => {
    wasRunningRef.current = false
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setState('idle')
  }, [])

  // Resolves true once the camera is running, false if it could not start (the reason is in `error`).
  const start = useCallback(async (): Promise<boolean> => {
    setState('starting')
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('video element missing')
      video.srcObject = stream
      await video.play()
      wasRunningRef.current = true
      setState('running')
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('error')
      return false
    }
  }, [])

  // Power button or app switch: release the camera; on return, restart it without a tap.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        const resume = wasRunningRef.current
        stop()
        wasRunningRef.current = resume
      } else if (wasRunningRef.current) {
        void start()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [stop, start])

  return { videoRef, state, error, start, stop }
}
