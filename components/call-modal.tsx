"use client"

import { useEffect, useCallback, useState, useRef } from "react"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  VideoTrack,
} from "@livekit/components-react"
import { Track } from "livekit-client"
import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react"

export interface CallSession {
  room: string
  token: string
  lkUrl: string
  kind: "video" | "audio"
  otherName?: string
  otherAvatar?: string
}

type CallState = "connecting" | "ringing" | "connected" | "ended"

const RING_TIMEOUT_MS = 30_000

interface Props {
  session: CallSession
  onEnd: (durationSecs: number, missed: boolean) => void
}

/* Generates a phone-style ring tone using Web Audio API */
function useRinger(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!active) {
      stopRef.current?.()
      stopRef.current = null
      return
    }

    let cancelled = false

    const ring = () => {
      if (cancelled) return
      const ctx = ctxRef.current ?? (ctxRef.current = new AudioContext())

      const beep = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = "sine"
        gain.gain.setValueAtTime(0, ctx.currentTime + start)
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.01)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur - 0.01)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + dur)
      }

      beep(480, 0,    0.4)
      beep(480, 0.45, 0.4)

      const t = setTimeout(ring, 2200)
      stopRef.current = () => { clearTimeout(t); cancelled = true }
    }

    ring()
    return () => { stopRef.current?.(); cancelled = true }
  }, [active])
}

export function CallModal({ session, onEnd }: Props) {
  const [callState, setCallState] = useState<CallState>("connecting")
  const connectedAtRef = useRef<number | null>(null)
  const endedRef = useRef(false)

  const doEnd = useCallback((missed: boolean) => {
    if (endedRef.current) return
    endedRef.current = true
    const duration = connectedAtRef.current ? Math.floor((Date.now() - connectedAtRef.current) / 1000) : 0
    setCallState("ended")
    setTimeout(() => onEnd(duration, missed), 800)
  }, [onEnd])

  // Start ringing shortly after mount
  useEffect(() => {
    const t = setTimeout(() => setCallState("ringing"), 600)
    return () => clearTimeout(t)
  }, [])

  useRinger(callState === "ringing")

  // Track when call becomes connected
  useEffect(() => {
    if (callState === "connected" && !connectedAtRef.current) {
      connectedAtRef.current = Date.now()
    }
  }, [callState])

  // Auto-cancel after 30s if nobody picks up (missed call)
  useEffect(() => {
    if (callState !== "ringing") return
    const t = setTimeout(() => doEnd(true), RING_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [callState, doEnd])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") doEnd(false) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [doEnd])

  const handleDisconnected = useCallback(() => {
    doEnd(false)
  }, [doEnd])

  return (
    <div className="t-call-screen">
      <LiveKitRoom
        serverUrl={session.lkUrl}
        token={session.token}
        connect={true}
        video={session.kind === "video"}
        audio={true}
        onDisconnected={handleDisconnected}
        style={{ display: "contents" }}
      >
        {session.kind === "video"
          ? <VideoCallView session={session} callState={callState} setCallState={setCallState} onEnd={() => doEnd(false)} />
          : <AudioCallView session={session} callState={callState} setCallState={setCallState} onEnd={() => doEnd(false)} />
        }
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  )
}

/* ── Shared helpers ─────────────────────────────────────────── */

function stateLabel(s: CallState) {
  if (s === "connecting") return "Connecting…"
  if (s === "ringing")    return "Ringing…"
  if (s === "connected")  return "Connected"
  return "Call ended"
}

function Avatar({ name, avatar, size = 96 }: { name?: string; avatar?: string; size?: number }) {
  const initials = (name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  return (
    <div className="t-call-av" style={{ width: size, height: size, fontSize: size * 0.3 }}>
      {avatar
        ? <img src={avatar} alt={name} />
        : <span>{initials}</span>
      }
    </div>
  )
}

/* ── Audio call ─────────────────────────────────────────────── */

function AudioCallView({ session, callState, setCallState, onEnd }: {
  session: CallSession; callState: CallState
  setCallState: (s: CallState) => void; onEnd: () => void
}) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()
  const remoteParticipants = useRemoteParticipants()
  const [speakerOn, setSpeakerOn] = useState(true)
  const [elapsed, setElapsed] = useState(0)

  const remoteMicTracks = useTracks([Track.Source.Microphone], { onlySubscribed: true })
    .filter(t => t.participant.identity !== localParticipant.identity)
  const isRemoteMuted = remoteParticipants.length > 0 && remoteMicTracks.length === 0

  useEffect(() => {
    if (remoteParticipants.length > 0 && callState !== "connected") {
      setCallState("connected")
    }
  }, [remoteParticipants.length, callState, setCallState])

  // Live call duration timer
  useEffect(() => {
    if (callState !== "connected") return
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [callState])

  const toggleMic = useCallback(() => {
    void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
  }, [localParticipant, isMicrophoneEnabled])

  const durationLabel = callState === "connected"
    ? `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
    : stateLabel(callState)

  return (
    <div className="t-call-audio-screen">
      <div className="t-call-backdrop" aria-hidden="true">
        <div className="t-call-blob t-call-blob--a" />
        <div className="t-call-blob t-call-blob--b" />
      </div>

      <div className="t-call-header">
        <div className="t-call-header-name">{session.otherName ?? "Unknown"}</div>
        <div className={`t-call-header-state t-call-header-state--${callState}`}>
          {durationLabel}
        </div>
      </div>

      <div className="t-call-centre">
        <div className={`t-call-pulse-ring${callState === "ringing" || callState === "connected" ? " active" : ""}`}>
          <div className="t-call-pulse-ring-inner" />
        </div>
        <Avatar name={session.otherName} avatar={session.otherAvatar} size={128} />
        {isRemoteMuted && callState === "connected" && (
          <div className="t-call-remote-muted">
            <MicOff size={14} />
            <span>{session.otherName?.split(" ")[0] ?? "They"} is muted</span>
          </div>
        )}
      </div>

      <div className="t-call-bar">
        <CallBtn
          icon={isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          label={isMicrophoneEnabled ? "Mute" : "Unmuted"}
          onClick={toggleMic}
          muted={!isMicrophoneEnabled}
        />
        <CallBtn
          icon={<PhoneOff size={22} />}
          label="End"
          onClick={onEnd}
          end
        />
        <CallBtn
          icon={speakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          label="Speaker"
          onClick={() => setSpeakerOn(s => !s)}
          muted={!speakerOn}
        />
      </div>
    </div>
  )
}

/* ── Video call ─────────────────────────────────────────────── */

function VideoCallView({ session, callState, setCallState, onEnd }: {
  session: CallSession; callState: CallState
  setCallState: (s: CallState) => void; onEnd: () => void
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant()
  const remoteParticipants = useRemoteParticipants()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (remoteParticipants.length > 0 && callState !== "connected") {
      setCallState("connected")
    }
  }, [remoteParticipants.length, callState, setCallState])

  // Live call duration timer
  useEffect(() => {
    if (callState !== "connected") return
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [callState])

  // Remote camera track
  const remoteCameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: true })
    .filter(t => t.participant.identity !== localParticipant.identity)

  // Remote mic track — used to detect muted state
  const remoteMicTracks = useTracks([Track.Source.Microphone], { onlySubscribed: true })
    .filter(t => t.participant.identity !== localParticipant.identity)

  // Local camera track
  const localCameraTracks = useTracks([Track.Source.Camera])
    .filter(t => t.participant.identity === localParticipant.identity)

  const hasRemoteVideo   = remoteCameraTracks.length > 0 && callState === "connected"
  const hasLocalVideo    = localCameraTracks.length > 0 && isCameraEnabled
  const isRemoteMuted    = remoteParticipants.length > 0 && remoteMicTracks.length === 0
  const isRemoteCamOff   = callState === "connected" && remoteParticipants.length > 0 && !hasRemoteVideo

  const toggleMic    = useCallback(() => { void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled) }, [localParticipant, isMicrophoneEnabled])
  const toggleCamera = useCallback(() => { void localParticipant.setCameraEnabled(!isCameraEnabled) },        [localParticipant, isCameraEnabled])

  const durationLabel = callState === "connected"
    ? `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
    : stateLabel(callState)

  return (
    <div className="t-call-video-screen">

      {/* Main video area:
          - Before remote joins: show your own camera full-screen (Snapchat style)
          - Remote camera off: show their avatar
          - Remote connected with video: show remote full-screen */}
      {hasRemoteVideo ? (
        <VideoTrack trackRef={remoteCameraTracks[0]} className="t-call-remote-video" />
      ) : isRemoteCamOff ? (
        <div className="t-call-video-waiting">
          <div className="t-call-backdrop" aria-hidden="true">
            <div className="t-call-blob t-call-blob--a" />
            <div className="t-call-blob t-call-blob--b" />
          </div>
          <Avatar name={session.otherName} avatar={session.otherAvatar} size={112} />
          <p className="t-call-video-waiting-label">Camera off</p>
        </div>
      ) : hasLocalVideo ? (
        <VideoTrack trackRef={localCameraTracks[0]} className="t-call-remote-video" />
      ) : (
        <div className="t-call-video-waiting">
          <div className="t-call-backdrop" aria-hidden="true">
            <div className="t-call-blob t-call-blob--a" />
            <div className="t-call-blob t-call-blob--b" />
          </div>
          <Avatar name={session.otherName} avatar={session.otherAvatar} size={112} />
          <p className="t-call-video-waiting-label">{stateLabel(callState)}</p>
        </div>
      )}

      {/* Self PiP — only shown once remote video is present */}
      {hasRemoteVideo && hasLocalVideo && (
        <div className="t-call-self-preview">
          <VideoTrack trackRef={localCameraTracks[0]} className="t-call-self-video" />
        </div>
      )}

      {/* Remote muted indicator */}
      {isRemoteMuted && callState === "connected" && (
        <div className="t-call-remote-muted">
          <MicOff size={14} />
          <span>{session.otherName?.split(" ")[0] ?? "They"} is muted</span>
        </div>
      )}

      {/* Overlay header */}
      <div className="t-call-video-header">
        <span className="t-call-video-name">{session.otherName ?? "Unknown"}</span>
        <span className="t-call-video-duration">{durationLabel}</span>
      </div>

      {/* Controls */}
      <div className="t-call-bar t-call-bar--video">
        <CallBtn
          icon={isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          label={isMicrophoneEnabled ? "Mute" : "Unmuted"}
          onClick={toggleMic}
          muted={!isMicrophoneEnabled}
          glass
        />
        <CallBtn
          icon={<PhoneOff size={22} />}
          label="End"
          onClick={onEnd}
          end
        />
        <CallBtn
          icon={isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          label={isCameraEnabled ? "Camera" : "No cam"}
          onClick={toggleCamera}
          muted={!isCameraEnabled}
          glass
        />
      </div>
    </div>
  )
}

/* ── Shared control button ──────────────────────────────────── */

function CallBtn({ icon, label, onClick, end, muted, glass }: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  end?: boolean
  muted?: boolean
  glass?: boolean
}) {
  return (
    <div className="t-call-ctrl-wrap">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={[
          "t-call-ctrl",
          end   ? "t-call-ctrl--end"   : "",
          muted ? "t-call-ctrl--muted" : "",
          glass ? "t-call-ctrl--glass" : "",
        ].filter(Boolean).join(" ")}
      >
        {icon}
      </button>
      <span className="t-call-ctrl-lbl">{label}</span>
    </div>
  )
}

/* ── Incoming call banner ────────────────────────────────────── */

interface IncomingCallBannerProps {
  callerName: string
  kind: "video" | "audio"
  onAccept: () => void
  onDecline: () => void
}

export function IncomingCallBanner({ callerName, kind, onAccept, onDecline }: IncomingCallBannerProps) {
  const initials = callerName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()

  useRinger(true)

  return (
    <div className="t-call-incoming" role="alertdialog" aria-label="Incoming call">
      <div className="t-call-incoming-glow" aria-hidden="true" />

      <div className="t-call-incoming-left">
        <div className="t-call-incoming-av">{initials}</div>
        <div>
          <p className="t-call-incoming-name">{callerName}</p>
          <p className="t-call-incoming-sub">
            {kind === "video" ? "Incoming video call" : "Incoming audio call"}
          </p>
        </div>
      </div>

      <div className="t-call-incoming-btns">
        <button type="button" className="t-call-incoming-btn decline" onClick={onDecline} aria-label="Decline">
          <PhoneOff size={18} />
        </button>
        <button type="button" className="t-call-incoming-btn accept" onClick={onAccept} aria-label="Accept">
          {kind === "video" ? <Video size={18} /> : <Mic size={18} />}
        </button>
      </div>
    </div>
  )
}
