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

interface Props {
  session: CallSession
  onEnd: () => void
}

export function CallModal({ session, onEnd }: Props) {
  const [callState, setCallState] = useState<CallState>("connecting")

  useEffect(() => {
    // Simulate ringing after brief connect delay
    const t1 = setTimeout(() => setCallState("ringing"), 800)
    const t2 = setTimeout(() => setCallState("connected"), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onEnd() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onEnd])

  const handleDisconnected = useCallback(() => {
    setCallState("ended")
    setTimeout(onEnd, 800)
  }, [onEnd])

  return (
    <div className="t-call-screen">
      <LiveKitRoom
        serverUrl={session.lkUrl}
        token={session.token}
        connect={true}
        video={session.kind === "video"}
        audio={true}
        onDisconnected={handleDisconnected}
        onConnected={() => setCallState("connected")}
        style={{ display: "contents" }}
      >
        {session.kind === "video"
          ? <VideoCallView session={session} callState={callState} onEnd={onEnd} />
          : <AudioCallView session={session} callState={callState} onEnd={onEnd} />
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

function AudioCallView({ session, callState, onEnd }: { session: CallSession; callState: CallState; onEnd: () => void }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()
  const [speakerOn, setSpeakerOn] = useState(true)

  const toggleMic = useCallback(() => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
  }, [localParticipant, isMicrophoneEnabled])

  return (
    <div className="t-call-audio-screen">
      {/* Blurred colour backdrop */}
      <div className="t-call-backdrop" aria-hidden="true">
        <div className="t-call-blob t-call-blob--a" />
        <div className="t-call-blob t-call-blob--b" />
      </div>

      {/* Header */}
      <div className="t-call-header">
        <div className="t-call-header-name">{session.otherName ?? "Unknown"}</div>
        <div className={`t-call-header-state t-call-header-state--${callState}`}>
          {stateLabel(callState)}
        </div>
      </div>

      {/* Centre avatar */}
      <div className="t-call-centre">
        <div className={`t-call-pulse-ring${callState === "ringing" || callState === "connected" ? " active" : ""}`}>
          <div className="t-call-pulse-ring-inner" />
        </div>
        <Avatar name={session.otherName} avatar={session.otherAvatar} size={128} />
      </div>

      {/* Controls */}
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

function VideoCallView({ session, callState, onEnd }: { session: CallSession; callState: CallState; onEnd: () => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant()
  const remoteParticipants = useRemoteParticipants()

  // Remote camera track
  const remoteCameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: true })
    .filter(t => t.participant.identity !== localParticipant.identity)

  // Local camera track for self-preview
  const localCameraTracks = useTracks([Track.Source.Camera])
    .filter(t => t.participant.identity === localParticipant.identity)

  const hasRemoteVideo = remoteCameraTracks.length > 0 && callState === "connected"

  const toggleMic    = useCallback(() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled), [localParticipant, isMicrophoneEnabled])
  const toggleCamera = useCallback(() => localParticipant.setCameraEnabled(!isCameraEnabled),        [localParticipant, isCameraEnabled])

  return (
    <div className="t-call-video-screen">

      {/* Remote video — fills screen */}
      {hasRemoteVideo
        ? <VideoTrack trackRef={remoteCameraTracks[0]} className="t-call-remote-video" />
        : (
          <div className="t-call-video-waiting">
            <div className="t-call-backdrop" aria-hidden="true">
              <div className="t-call-blob t-call-blob--a" />
              <div className="t-call-blob t-call-blob--b" />
            </div>
            <Avatar name={session.otherName} avatar={session.otherAvatar} size={112} />
            <p className="t-call-video-waiting-label">{stateLabel(callState)}</p>
          </div>
        )
      }

      {/* Self preview — top right */}
      {localCameraTracks.length > 0 && isCameraEnabled && (
        <div className="t-call-self-preview">
          <VideoTrack trackRef={localCameraTracks[0]} className="t-call-self-video" />
        </div>
      )}

      {/* Overlay header */}
      <div className="t-call-video-header">
        <span className="t-call-video-name">{session.otherName ?? "Unknown"}</span>
        {callState === "connected" && remoteParticipants.length > 0 && (
          <span className="t-call-video-live">● Live</span>
        )}
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
