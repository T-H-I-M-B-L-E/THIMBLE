"use client"

import { useEffect, useCallback } from "react"
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useLocalParticipant,
  ControlBar,
} from "@livekit/components-react"
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react"

export interface CallSession {
  room: string
  token: string
  lkUrl: string
  kind: "video" | "audio"
}

interface Props {
  session: CallSession
  onEnd: () => void
}

export function CallModal({ session, onEnd }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onEnd() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onEnd])

  return (
    <div className="t-call-overlay" role="dialog" aria-modal="true" aria-label="Call">
      <div className="t-call-modal">
        <LiveKitRoom
          serverUrl={session.lkUrl}
          token={session.token}
          connect={true}
          video={session.kind === "video"}
          audio={true}
          onDisconnected={onEnd}
          className="t-call-room"
        >
          {session.kind === "video" ? (
            <VideoConference />
          ) : (
            <AudioCallView onEnd={onEnd} />
          )}
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  )
}

function AudioCallView({ onEnd }: { onEnd: () => void }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()

  const toggleMic = useCallback(() => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
  }, [localParticipant, isMicrophoneEnabled])

  return (
    <div className="t-call-audio-view">
      <div className="t-call-audio-icon">
        <Mic size={40} />
      </div>
      <p className="t-call-audio-label">Audio call in progress</p>
      <div className="t-call-audio-controls">
        <button
          type="button"
          className={`t-call-ctrl-btn ${isMicrophoneEnabled ? "" : "muted"}`}
          onClick={toggleMic}
          aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"}
        >
          {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        <button
          type="button"
          className="t-call-ctrl-btn hang-up"
          onClick={onEnd}
          aria-label="End call"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  )
}

// Thin wrapper shown to the callee before they accept.
interface IncomingCallBannerProps {
  callerName: string
  kind: "video" | "audio"
  onAccept: () => void
  onDecline: () => void
}

export function IncomingCallBanner({ callerName, kind, onAccept, onDecline }: IncomingCallBannerProps) {
  return (
    <div className="t-call-incoming" role="alertdialog" aria-label="Incoming call">
      <div className="t-call-incoming-info">
        {kind === "video" ? <Video size={18} /> : <Mic size={18} />}
        <span>
          <strong>{callerName}</strong> is calling you ({kind})
        </span>
      </div>
      <div className="t-call-incoming-actions">
        <button type="button" className="t-call-accept" onClick={onAccept} aria-label="Accept">
          <Mic size={16} /> Accept
        </button>
        <button type="button" className="t-call-decline" onClick={onDecline} aria-label="Decline">
          <PhoneOff size={16} /> Decline
        </button>
      </div>
    </div>
  )
}
