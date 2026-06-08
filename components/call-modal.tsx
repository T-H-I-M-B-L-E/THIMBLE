"use client"

import { useEffect, useCallback } from "react"
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useLocalParticipant,
} from "@livekit/components-react"
import { Mic, MicOff, PhoneOff, Video, Phone } from "lucide-react"

export interface CallSession {
  room: string
  token: string
  lkUrl: string
  kind: "video" | "audio"
  otherName?: string
  otherAvatar?: string
}

interface Props {
  session: CallSession
  onEnd: () => void
}

export function CallModal({ session, onEnd }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onEnd() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onEnd])

  return (
    <div className="t-call-overlay" role="dialog" aria-modal="true" aria-label="Call">
      <LiveKitRoom
        serverUrl={session.lkUrl}
        token={session.token}
        connect={true}
        video={session.kind === "video"}
        audio={true}
        onDisconnected={onEnd}
        className="t-call-lk-room"
      >
        {session.kind === "video" ? (
          <div className="t-call-video-wrap">
            <VideoConference />
          </div>
        ) : (
          <AudioCallView
            onEnd={onEnd}
            otherName={session.otherName}
            otherAvatar={session.otherAvatar}
          />
        )}
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  )
}

function AudioCallView({ onEnd, otherName, otherAvatar }: {
  onEnd: () => void
  otherName?: string
  otherAvatar?: string
}) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()

  const toggleMic = useCallback(() => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
  }, [localParticipant, isMicrophoneEnabled])

  const initials = (otherName ?? "?")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="t-call-audio">
      {/* Background blur blobs */}
      <div className="t-call-bg" aria-hidden="true">
        <div className="t-call-blob t-call-blob--1" />
        <div className="t-call-blob t-call-blob--2" />
      </div>

      <div className="t-call-audio-body">
        {/* Avatar with pulse ring */}
        <div className="t-call-avatar-wrap">
          <div className="t-call-pulse" />
          <div className="t-call-avatar">
            {otherAvatar
              ? <img src={otherAvatar} alt={otherName ?? ""} />
              : <span>{initials}</span>
            }
          </div>
        </div>

        <div className="t-call-audio-meta">
          <p className="t-call-name">{otherName ?? "Unknown"}</p>
          <p className="t-call-status">Call in progress</p>
        </div>

        {/* Controls */}
        <div className="t-call-controls">
          <div className="t-call-ctrl-group">
            <button
              type="button"
              className={`t-call-ctrl${isMicrophoneEnabled ? "" : " t-call-ctrl--muted"}`}
              onClick={toggleMic}
              aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"}
            >
              {isMicrophoneEnabled ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
            <span className="t-call-ctrl-label">{isMicrophoneEnabled ? "Mute" : "Unmuted"}</span>
          </div>

          <div className="t-call-ctrl-group">
            <button
              type="button"
              className="t-call-ctrl t-call-ctrl--end"
              onClick={onEnd}
              aria-label="End call"
            >
              <PhoneOff size={24} />
            </button>
            <span className="t-call-ctrl-label">End</span>
          </div>
        </div>
      </div>
    </div>
  )
}

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
      <div className="t-call-incoming-pulse" aria-hidden="true" />

      <div className="t-call-incoming-left">
        <div className="t-call-incoming-avatar">{initials}</div>
        <div className="t-call-incoming-text">
          <p className="t-call-incoming-name">{callerName}</p>
          <p className="t-call-incoming-sub">
            {kind === "video" ? "📹 Incoming video call" : "📞 Incoming audio call"}
          </p>
        </div>
      </div>

      <div className="t-call-incoming-actions">
        <button
          type="button"
          className="t-call-incoming-btn t-call-incoming-btn--decline"
          onClick={onDecline}
          aria-label="Decline"
        >
          <PhoneOff size={18} />
        </button>
        <button
          type="button"
          className="t-call-incoming-btn t-call-incoming-btn--accept"
          onClick={onAccept}
          aria-label="Accept"
        >
          {kind === "video" ? <Video size={18} /> : <Phone size={18} />}
        </button>
      </div>
    </div>
  )
}
