import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraState = 'idle' | 'starting' | 'running' | 'error'

// Opens the back camera into a <video>. Stops it when the page is hidden so Android releases the camera.
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<CameraState>('idle')
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setState('idle')
  }, [])

  const start = useCallback(async () => {
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
      setState('running')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [stop])

  return { videoRef, state, error, start, stop }
}
