'use client'

import { useState, useEffect, useRef } from 'react'
import { adminFetch } from '@/lib/adminFetch'
import { ShieldAlert, Lock, Unlock, AlertTriangle, CheckCircle2, Loader2, RotateCcw, KeyRound } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'loading' | 'idle' | 'actions' | 'confirm' | 'pin_setup' | 'pin' | 'otp' | 'verified' | 'executing' | 'done' | 'pending_approval'
type Mode = 'real' | 'simulate'

interface Action {
  id: string
  label: string
  desc: string
  risk: 'high' | 'medium' | 'low'
}

const ACTIONS: Action[] = [
  { id: 'notify_users', label: 'Notify all users', desc: 'Send a platform shutdown email to every user on TVIMBLE.', risk: 'medium' },
  { id: 'disable_api',  label: 'Disable API',      desc: 'Stop the backend from accepting new requests.',           risk: 'high' },
  { id: 'lock_panel',   label: 'Lock admin panel',  desc: 'Revoke admin access and lock the dashboard.',            risk: 'high' },
]

const RISK_COLOR: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#3fcf8e' }

function Spinner() {
  return <Loader2 size={16} style={{ animation: 'sd-spin .7s linear infinite' }} />
}

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, flexShrink: 0,
      background: done ? '#ef4444' : active ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.05)',
      border: `1px solid ${done ? '#ef4444' : active ? '#ef4444' : '#333'}`,
      color: done ? '#fff' : active ? '#ef4444' : '#555',
      transition: 'all .3s',
    }}>
      {done ? '✓' : n}
    </div>
  )
}

function PinDots({ value, max }: { value: string; max: number }) {
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '8px 0' }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: 14, height: 14, borderRadius: '50%',
          background: i < value.length ? '#ef4444' : 'transparent',
          border: `2px solid ${i < value.length ? '#ef4444' : '#333'}`,
          transition: 'all .15s',
        }} />
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ShutdownPage() {
  const [step, setStep]                = useState<Step>('loading')
  const [mode, setMode]                = useState<Mode>('real')
  const [selectedActions, setSelected] = useState<Set<string>>(new Set())
  const [hasPin, setHasPin]            = useState(false)

  // PIN setup state
  const [newPin, setNewPin]            = useState('')
  const [confirmPin, setConfirmPin]    = useState('')
  const [pinSetupStage, setPinStage]   = useState<'enter' | 'confirm'>('enter')
  const [pinSetupError, setPinSetupError] = useState('')

  // PIN entry state
  const [pin, setPin]                  = useState('')
  const [pinError, setPinError]        = useState('')
  const [pinToken, setPinToken]        = useState('')

  // OTP state
  const [otp, setOtp]                  = useState('')
  const [otpError, setOtpError]        = useState('')
  const [shutdownToken, setToken]      = useState('')
  const [maskedEmail, setMaskedEmail]  = useState('')
  const [isSuperAdmin, setSuperAdmin]  = useState(false)
  const [otpCountdown, setCountdown]   = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [loading, setLoading]          = useState(false)
  const [result, setResult]            = useState<{ notified?: number; simulate?: boolean; actions?: string[]; executedAt?: string } | null>(null)

  // On mount: check if admin already has a PIN set
  useEffect(() => {
    const adminEmail = sessionStorage.getItem('admin_email') || ''
    setSuperAdmin(adminEmail.toLowerCase() === 'anjeesax@gmail.com')

    adminFetch('/api/admin/shutdown')
      .then(r => r.json())
      .then((d: { hasPin?: boolean }) => {
        setHasPin(d.hasPin ?? false)
        setStep('idle')
      })
      .catch(() => setStep('idle'))
  }, [])

  const startCountdown = () => {
    setCountdown(600)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(countdownRef.current!); return 0 } return c - 1 })
    }, 1000)
  }

  const reset = () => {
    setStep('idle'); setMode('real'); setSelected(new Set())
    setNewPin(''); setConfirmPin(''); setPinStage('enter'); setPinSetupError('')
    setPin(''); setPinError(''); setPinToken('')
    setOtp(''); setOtpError(''); setToken(''); setLoading(false); setResult(null)
    if (countdownRef.current) clearInterval(countdownRef.current)
    setCountdown(0)
  }

  const toggleAction = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  // ── PIN setup handlers ──────────────────────────────────────────────────

  const handlePinSetupNext = () => {
    if (newPin.length < 4) { setPinSetupError('PIN must be at least 4 digits'); return }
    setPinSetupError(''); setPinStage('confirm')
  }

  const handlePinSetupSave = async () => {
    if (confirmPin !== newPin) { setPinSetupError('PINs do not match'); return }
    setLoading(true); setPinSetupError('')
    try {
      const res = await adminFetch('/api/admin/shutdown?action=set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin }),
      })
      const d = await res.json() as { set?: boolean; error?: string }
      if (!res.ok || !d.set) throw new Error(d.error || 'Failed')
      setHasPin(true)
      setNewPin(''); setConfirmPin(''); setPinStage('enter')
      setStep('pin') // proceed straight to PIN entry
    } catch (e: unknown) {
      setPinSetupError(e instanceof Error ? e.message : 'Failed to save PIN')
    } finally {
      setLoading(false)
    }
  }

  // ── PIN entry ───────────────────────────────────────────────────────────

  const handleVerifyPin = async () => {
    if (pin.length < 4) { setPinError('Enter your PIN'); return }
    setLoading(true); setPinError('')
    try {
      const res = await adminFetch('/api/admin/shutdown?action=verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const d = await res.json() as { pinVerified?: boolean; pinToken?: string; error?: string }
      if (!res.ok || !d.pinVerified) throw new Error(d.error || 'Incorrect PIN')
      setPinToken(d.pinToken || '')
      setPin('')
      setStep('otp')
      // Immediately request the OTP after PIN passes
      await handleRequestOTP()
    } catch (e: unknown) {
      setPinError(e instanceof Error ? e.message : 'Incorrect PIN')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  // ── OTP ────────────────────────────────────────────────────────────────

  const handleRequestOTP = async () => {
    try {
      const res = await adminFetch('/api/admin/shutdown?action=request-otp', { method: 'POST' })
      const data = await res.json() as { sent?: boolean; email?: string; isSuperAdmin?: boolean; error?: string }
      if (!res.ok || !data.sent) throw new Error(data.error || 'Failed')
      setMaskedEmail(data.email || '')
      setSuperAdmin(data.isSuperAdmin ?? false)
      startCountdown()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to send code')
      setStep('pin')
    }
  }

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { setOtpError('Enter the 6-digit code'); return }
    setLoading(true); setOtpError('')
    try {
      const res = await adminFetch('/api/admin/shutdown?action=verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otp, pinToken }),
      })
      const data = await res.json() as { verified?: boolean; shutdownToken?: string; error?: string }
      if (!res.ok || !data.verified) throw new Error(data.error || 'Incorrect code')
      setToken(data.shutdownToken || '')
      setStep('verified')
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Execute ─────────────────────────────────────────────────────────────

  const handleExecute = async () => {
    setStep('executing'); setLoading(true)
    try {
      const res = await adminFetch('/api/admin/shutdown?action=execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shutdownToken, simulate: mode === 'simulate', actions: Array.from(selectedActions) }),
      })
      const data = await res.json() as { executed?: boolean; pending?: boolean; notified?: number; simulate?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error || 'Execution failed')
      if (data.pending) { setStep('pending_approval'); return }
      setResult({ ...data, executedAt: new Date().toUTCString() }); setStep('done')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Execution failed')
      setStep('verified')
    } finally {
      setLoading(false)
    }
  }

  const stepNum = { loading: 0, idle: 0, actions: 1, confirm: 2, pin_setup: 3, pin: 3, otp: 4, verified: 5, executing: 6, done: 6, pending_approval: 6 }[step] ?? 0

  const STEPS = [
    { n: 1, label: 'Select' },
    { n: 2, label: 'Confirm' },
    { n: 3, label: 'PIN' },
    { n: 4, label: 'Code' },
    { n: 5, label: 'Verify' },
    { n: 6, label: 'Execute' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#060608', color: '#e5e5e5', fontFamily: 'monospace', padding: '24px 16px', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes sd-spin    { to { transform: rotate(360deg) } }
        @keyframes sd-pulse   { 0%,100%{opacity:1}50%{opacity:.4} }
        @keyframes sd-shake   { 0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)} }
        @keyframes sd-fade-in { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        .sd-animate { animation: sd-fade-in .3s ease forwards; }
        .sd-otp-input::-webkit-outer-spin-button,.sd-otp-input::-webkit-inner-spin-button{-webkit-appearance:none}
        .sd-otp-input { -moz-appearance:textfield; }
        .sd-action-card:hover { border-color:#3a1a1a!important;background:#0f0a0a!important; }
        .sd-action-card.checked { border-color:#ef4444!important;background:rgba(239,68,68,.05)!important; }
        .sd-btn-red:hover    { background:#dc2626!important; }
        .sd-btn-yellow:hover { background:#d97706!important; }
        .sd-btn-ghost:hover  { background:rgba(255,255,255,.05)!important; }
      `}</style>

      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, padding: '20px 24px', background: '#0c0a0a', border: '1px solid #2a1010', borderRadius: 10 }}>
          <ShieldAlert size={28} color='#ef4444' />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.1em', color: '#fff' }}>TVIMBLE CRITICAL CONTROL</div>
            <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.2em', marginTop: 2 }}>RESTRICTED ACCESS · MULTI-LAYER AUTHENTICATION</div>
          </div>
        </div>

        {/* Progress stepper */}
        {step !== 'idle' && step !== 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, padding: '0 4px', overflowX: 'auto' }}>
            {STEPS.map((s, i, arr) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < arr.length - 1 ? 1 : undefined, gap: 6, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <StepDot n={s.n} active={stepNum === s.n} done={stepNum > s.n} />
                  <span style={{ fontSize: 9, color: stepNum >= s.n ? '#ef4444' : '#444', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: stepNum > s.n ? '#ef4444' : '#222', marginBottom: 14, transition: 'background .4s', minWidth: 8 }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── LOADING ── */}
        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#444' }}>
            <Loader2 size={24} style={{ animation: 'sd-spin .7s linear infinite' }} />
          </div>
        )}

        {/* ── IDLE: choose mode ── */}
        {step === 'idle' && (
          <div className="sd-animate">
            <div style={{ padding: '20px 24px', background: '#0c0a0a', border: '1px solid #1a1010', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <AlertTriangle size={16} color='#ef4444' />
                <span style={{ fontSize: 12, color: '#ef4444', letterSpacing: '0.15em', fontWeight: 700 }}>WARNING</span>
              </div>
              <p style={{ fontSize: 13, color: '#999', lineHeight: 1.7, margin: '0 0 12px' }}>
                This control panel executes <strong style={{ color: '#fff' }}>critical platform actions</strong>. All operations require multi-layer authentication including your personal shutdown PIN and a one-time email code. Every action is permanently logged.
              </p>
              {!hasPin && (
                <div style={{ fontSize: 12, color: '#f59e0b', padding: '8px 12px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 6 }}>
                  ⚠ You have not set a shutdown PIN yet. You will be prompted to create one before proceeding.
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <button className="sd-btn-red" onClick={() => { setMode('real'); setStep('actions') }}
                style={{ padding: '20px 16px', background: '#1a0505', border: '2px solid #7f1d1d', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'background .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Lock size={18} color='#ef4444' />
                  <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, letterSpacing: '0.12em' }}>INITIATE SYSTEM SHUTDOWN</span>
                </div>
                <p style={{ fontSize: 12, color: '#777', margin: 0, lineHeight: 1.6 }}>Execute real platform actions. All changes are permanent and cannot be undone.</p>
              </button>

              <button className="sd-btn-yellow" onClick={() => { setMode('simulate'); setStep('actions') }}
                style={{ padding: '20px 16px', background: '#1a1205', border: '2px solid #78350f', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'background .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <AlertTriangle size={18} color='#f59e0b' />
                  <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.12em' }}>SIMULATE SHUTDOWN (TEST)</span>
                </div>
                <p style={{ fontSize: 12, color: '#777', margin: 0, lineHeight: 1.6 }}>Full auth flow, no real actions. Sends a clearly marked TEST notification only.</p>
              </button>
            </div>
          </div>
        )}

        {/* ── ACTIONS ── */}
        {step === 'actions' && (
          <div className="sd-animate">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: mode === 'real' ? '#ef4444' : '#f59e0b', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 4 }}>
                {mode === 'real' ? '🔴 REAL SHUTDOWN' : '🟡 SIMULATION MODE'}
              </div>
              <div style={{ fontSize: 12, color: '#555' }}>Select the actions to execute. At least one is required.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {ACTIONS.map(a => (
                <button key={a.id} className={`sd-action-card${selectedActions.has(a.id) ? ' checked' : ''}`}
                  onClick={() => toggleAction(a.id)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', background: '#09090b', border: '1px solid #1c1c1c', borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1, border: `2px solid ${selectedActions.has(a.id) ? '#ef4444' : '#333'}`, background: selectedActions.has(a.id) ? '#ef4444' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                    {selectedActions.has(a.id) && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e5e5' }}>{a.label}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${RISK_COLOR[a.risk]}22`, color: RISK_COLOR[a.risk], letterSpacing: '0.1em' }}>{a.risk.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="sd-btn-ghost" onClick={reset} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #222', borderRadius: 8, color: '#666', cursor: 'pointer', fontSize: 12, transition: 'background .15s' }}>← Back</button>
              <button className="sd-btn-red" onClick={() => setStep('confirm')} disabled={selectedActions.size === 0}
                style={{ flex: 2, padding: '12px', background: selectedActions.size > 0 ? '#7f1d1d' : '#1a0a0a', border: `1px solid ${selectedActions.size > 0 ? '#ef4444' : '#222'}`, borderRadius: 8, color: selectedActions.size > 0 ? '#fff' : '#333', cursor: selectedActions.size > 0 ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', transition: 'all .15s' }}>
                CONTINUE →
              </button>
            </div>
          </div>
        )}

        {/* ── CONFIRM ── */}
        {step === 'confirm' && (
          <div className="sd-animate">
            <div style={{ padding: '20px 24px', background: '#0c0505', border: '2px solid #7f1d1d', borderRadius: 10, marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 16 }}>⚠ THIS ACTION IS IRREVERSIBLE</div>
              <div style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>
                You are about to execute the following on <strong style={{ color: '#fff' }}>TVIMBLE{mode === 'simulate' ? ' (SIMULATION)' : ''}</strong>:
              </div>
              <ul style={{ margin: '0 0 16px', padding: '0 0 0 16px', listStyle: 'none' }}>
                {Array.from(selectedActions).map(id => {
                  const a = ACTIONS.find(x => x.id === id)!
                  return <li key={id} style={{ fontSize: 13, color: '#fff', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#ef4444' }}>▸</span> {a.label}</li>
                })}
              </ul>
              <div style={{ fontSize: 11, color: '#555', borderTop: '1px solid #2a1010', paddingTop: 12 }}>
                Requires your shutdown PIN + email authorization code. This will be permanently logged.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="sd-btn-ghost" onClick={() => setStep('actions')} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #222', borderRadius: 8, color: '#666', cursor: 'pointer', fontSize: 12, transition: 'background .15s' }}>← Back</button>
              <button className="sd-btn-red" onClick={() => setStep(hasPin ? 'pin' : 'pin_setup')}
                style={{ flex: 2, padding: '12px', background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background .15s' }}>
                <Lock size={13} /> PROCEED TO AUTHENTICATION →
              </button>
            </div>
          </div>
        )}

        {/* ── PIN SETUP (first time) ── */}
        {step === 'pin_setup' && (
          <div className="sd-animate">
            <div style={{ padding: '24px', background: '#09090b', border: '1px solid #2a1a0a', borderRadius: 10, marginBottom: 16, textAlign: 'center' }}>
              <KeyRound size={32} color='#f59e0b' style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                {pinSetupStage === 'enter' ? 'Create Your Shutdown PIN' : 'Confirm Your PIN'}
              </div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 24 }}>
                {pinSetupStage === 'enter'
                  ? 'This PIN is required every time you access the shutdown panel. Choose 4 digits.'
                  : 'Enter the same PIN again to confirm.'}
              </div>

              <PinDots value={pinSetupStage === 'enter' ? newPin : confirmPin} max={4} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, maxWidth: 240, margin: '20px auto 0' }}>
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
                  <button key={i} onClick={() => {
                    if (k === '') return
                    const setter = pinSetupStage === 'enter' ? setNewPin : setConfirmPin
                    const cur = pinSetupStage === 'enter' ? newPin : confirmPin
                    if (k === '⌫') { setter(cur.slice(0,-1)); setPinSetupError('') }
                    else if (cur.length < 4) setter(cur + k)
                  }}
                  style={{ padding: '14px', background: k === '' ? 'transparent' : '#111', border: k === '' ? 'none' : '1px solid #222', borderRadius: 8, color: '#e5e5e5', fontSize: 18, fontWeight: 600, cursor: k === '' ? 'default' : 'pointer', transition: 'background .1s' }}>
                    {k}
                  </button>
                ))}
              </div>

              {pinSetupError && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12, animation: 'sd-shake .3s ease' }}>{pinSetupError}</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="sd-btn-ghost" onClick={() => { if (pinSetupStage === 'confirm') { setPinStage('enter'); setConfirmPin(''); setPinSetupError('') } else setStep('confirm') }}
                style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #222', borderRadius: 8, color: '#666', cursor: 'pointer', fontSize: 12, transition: 'background .15s' }}>
                ← Back
              </button>
              {pinSetupStage === 'enter' ? (
                <button className="sd-btn-red" onClick={handlePinSetupNext} disabled={newPin.length < 4}
                  style={{ flex: 2, padding: '12px', background: newPin.length >= 4 ? '#7f1d1d' : '#1a0a0a', border: `1px solid ${newPin.length >= 4 ? '#ef4444' : '#222'}`, borderRadius: 8, color: newPin.length >= 4 ? '#fff' : '#333', cursor: newPin.length === 4 ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', transition: 'all .15s' }}>
                  NEXT →
                </button>
              ) : (
                <button className="sd-btn-red" onClick={() => void handlePinSetupSave()} disabled={loading || confirmPin.length < 4}
                  style={{ flex: 2, padding: '12px', background: confirmPin.length >= 4 ? '#7f1d1d' : '#1a0a0a', border: `1px solid ${confirmPin.length >= 4 ? '#ef4444' : '#222'}`, borderRadius: 8, color: confirmPin.length >= 4 ? '#fff' : '#333', cursor: confirmPin.length === 4 && !loading ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .15s' }}>
                  {loading ? <Spinner /> : null} {loading ? 'SAVING…' : 'SET PIN & CONTINUE'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── PIN ENTRY ── */}
        {step === 'pin' && (
          <div className="sd-animate">
            <div style={{ padding: '24px', background: '#09090b', border: '1px solid #1c1c1c', borderRadius: 10, marginBottom: 16, textAlign: 'center' }}>
              <KeyRound size={32} color='#ef4444' style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Enter Your Shutdown PIN</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 24 }}>Layer 1 of 2 — your personal shutdown PIN</div>

              <PinDots value={pin} max={4} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, maxWidth: 240, margin: '20px auto 0' }}>
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
                  <button key={i} onClick={() => {
                    if (k === '') return
                    if (k === '⌫') { setPin(p => p.slice(0,-1)); setPinError('') }
                    else if (pin.length < 4) { const next = pin + k; setPin(next); if (next.length === 4) setTimeout(() => void handleVerifyPin(), 100) }
                  }}
                  style={{ padding: '14px', background: k === '' ? 'transparent' : '#111', border: k === '' ? 'none' : '1px solid #222', borderRadius: 8, color: '#e5e5e5', fontSize: 18, fontWeight: 600, cursor: k === '' ? 'default' : 'pointer', transition: 'background .1s' }}>
                    {k}
                  </button>
                ))}
              </div>

              {pinError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12, animation: 'sd-shake .3s ease' }}>{pinError}</div>}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="sd-btn-ghost" onClick={() => setStep('confirm')} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #222', borderRadius: 8, color: '#666', cursor: 'pointer', fontSize: 12, transition: 'background .15s' }}>← Back</button>
              <button className="sd-btn-red" onClick={() => void handleVerifyPin()} disabled={loading || pin.length < 4}
                style={{ flex: 2, padding: '12px', background: pin.length >= 4 ? '#7f1d1d' : '#1a0a0a', border: `1px solid ${pin.length >= 4 ? '#ef4444' : '#222'}`, borderRadius: 8, color: pin.length >= 4 ? '#fff' : '#333', cursor: pin.length >= 4 && !loading ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .15s' }}>
                {loading ? <Spinner /> : <Unlock size={13} />} {loading ? 'VERIFYING…' : 'UNLOCK'}
              </button>
            </div>
          </div>
        )}

        {/* ── OTP ── */}
        {step === 'otp' && (
          <div className="sd-animate">
            <div style={{ padding: '24px', background: '#09090b', border: '1px solid #1c1c1c', borderRadius: 10, marginBottom: 16, textAlign: 'center' }}>
              <Lock size={32} color='#ef4444' style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Authorization Code Sent</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 20 }}>Layer 2 of 2 — a 6-digit code was sent to <strong style={{ color: '#999' }}>{maskedEmail}</strong></div>
              <input type="number" maxLength={6} value={otp}
                onChange={e => { setOtp(e.target.value.slice(0,6)); setOtpError('') }}
                onKeyDown={e => e.key === 'Enter' && void handleVerifyOTP()}
                placeholder="000000" className="sd-otp-input"
                style={{ width: '100%', padding: '16px', textAlign: 'center', fontSize: 28, fontWeight: 700, letterSpacing: '0.4em', background: '#060608', border: `2px solid ${otpError ? '#ef4444' : '#333'}`, borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box', animation: otpError ? 'sd-shake .3s ease' : 'none' }} />
              {otpError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{otpError}</div>}
              {otpCountdown > 0 && <div style={{ fontSize: 11, color: '#444', marginTop: 10 }}>Expires in {Math.floor(otpCountdown/60)}:{String(otpCountdown%60).padStart(2,'0')}</div>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="sd-btn-ghost" onClick={() => { setStep('pin'); setOtp(''); setOtpError('') }} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #222', borderRadius: 8, color: '#666', cursor: 'pointer', fontSize: 12, transition: 'background .15s' }}>← Back</button>
              <button className="sd-btn-red" onClick={() => void handleVerifyOTP()} disabled={loading || otp.length !== 6}
                style={{ flex: 2, padding: '12px', background: otp.length === 6 ? '#7f1d1d' : '#1a0a0a', border: `1px solid ${otp.length === 6 ? '#ef4444' : '#222'}`, borderRadius: 8, color: otp.length === 6 ? '#fff' : '#333', cursor: otp.length === 6 && !loading ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .15s' }}>
                {loading ? <Spinner /> : <Unlock size={13} />} {loading ? 'VERIFYING…' : 'VERIFY CODE'}
              </button>
            </div>
          </div>
        )}

        {/* ── VERIFIED: final fire ── */}
        {step === 'verified' && (
          <div className="sd-animate">
            <div style={{ padding: '24px', background: '#09090b', border: '2px solid #ef4444', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <CheckCircle2 size={20} color='#ef4444' />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', letterSpacing: '0.1em' }}>IDENTITY VERIFIED — ALL LAYERS PASSED</span>
              </div>
              {!isSuperAdmin && (
                <div style={{ padding: '12px 16px', background: '#1a1205', border: '1px solid #78350f', borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>⚠ APPROVAL REQUIRED</div>
                  <div style={{ fontSize: 12, color: '#777' }}>You are not the Super Admin. This will send an approval request to <strong style={{ color: '#f59e0b' }}>anjeesax@gmail.com</strong>.</div>
                </div>
              )}
              <div style={{ fontSize: 13, color: '#999', marginBottom: 6 }}>Mode: <strong style={{ color: mode === 'real' ? '#ef4444' : '#f59e0b' }}>{mode === 'real' ? '🔴 REAL SHUTDOWN' : '🟡 SIMULATION'}</strong></div>
              <div style={{ fontSize: 13, color: '#999' }}>Actions: <strong style={{ color: '#fff' }}>{Array.from(selectedActions).map(id => ACTIONS.find(a => a.id === id)?.label).join(', ')}</strong></div>
            </div>
            <div style={{ padding: '16px 20px', background: '#0c0505', border: '1px solid #3a0a0a', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#666', lineHeight: 1.7 }}>By clicking below you confirm you are authorized to execute this action. This event will be recorded in the permanent audit log with your identity and timestamp. There is no undo.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="sd-btn-ghost" onClick={reset} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid #222', borderRadius: 8, color: '#666', cursor: 'pointer', fontSize: 12, transition: 'background .15s' }}>ABORT</button>
              <button className="sd-btn-red" onClick={() => void handleExecute()}
                style={{ flex: 2, padding: '14px', background: '#991b1b', border: '2px solid #ef4444', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background .15s' }}>
                <ShieldAlert size={15} /> {isSuperAdmin ? 'EXECUTE NOW' : 'SUBMIT FOR APPROVAL'}
              </button>
            </div>
          </div>
        )}

        {/* ── EXECUTING ── */}
        {step === 'executing' && (
          <div className="sd-animate" style={{ textAlign: 'center', padding: '60px 24px' }}>
            <Loader2 size={40} color='#ef4444' style={{ animation: 'sd-spin .7s linear infinite', marginBottom: 20 }} />
            <div style={{ fontSize: 14, color: '#ef4444', fontWeight: 700, letterSpacing: '0.2em', marginBottom: 8, animation: 'sd-pulse 1.4s ease infinite' }}>EXECUTING…</div>
            <div style={{ fontSize: 12, color: '#555' }}>Do not close this window.</div>
          </div>
        )}

        {/* ── PENDING APPROVAL ── */}
        {step === 'pending_approval' && (
          <div className="sd-animate" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 14, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>PENDING SUPER ADMIN APPROVAL</div>
            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.7, marginBottom: 24 }}>Your request has been sent to <strong style={{ color: '#f59e0b' }}>anjeesax@gmail.com</strong>. The action will execute once approved.</div>
            <button className="sd-btn-ghost" onClick={reset} style={{ padding: '10px 24px', background: 'transparent', border: '1px solid #333', borderRadius: 8, color: '#666', cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'background .15s' }}>
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div className="sd-animate">
            <div style={{ padding: '28px 24px', background: '#09090b', border: `2px solid ${result?.simulate ? '#f59e0b' : '#ef4444'}`, borderRadius: 10, marginBottom: 16, textAlign: 'center' }}>
              <CheckCircle2 size={40} color={result?.simulate ? '#f59e0b' : '#ef4444'} style={{ marginBottom: 14 }} />
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.12em', color: result?.simulate ? '#f59e0b' : '#ef4444', marginBottom: 4 }}>
                {result?.simulate ? '⚠ SIMULATION COMPLETE' : '🔴 SHUTDOWN EXECUTED'}
              </div>
              <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.1em', marginBottom: 24 }}>
                {result?.simulate ? 'NO REAL ACTIONS WERE TAKEN' : 'PLATFORM ACTIONS HAVE BEEN EXECUTED'}
              </div>

              <div style={{ textAlign: 'left', background: '#060608', border: '1px solid #1c1c1c', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.1em', marginBottom: 12 }}>ACTIONS {result?.simulate ? 'SIMULATED' : 'EXECUTED'}</div>
                {(result?.actions ?? Array.from(selectedActions)).map(id => {
                  const a = ACTIONS.find(x => x.id === id)
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #111' }}>
                      <span style={{ color: result?.simulate ? '#f59e0b' : '#ef4444', fontSize: 13 }}>✓</span>
                      <span style={{ fontSize: 13, color: '#ccc' }}>{a?.label ?? id}</span>
                      {result?.simulate && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#555', letterSpacing: '0.1em' }}>SIMULATED</span>}
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
                <div style={{ background: '#060608', border: '1px solid #1c1c1c', borderRadius: 8, padding: '12px 16px', textAlign: 'left' }}>
                  <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.1em', marginBottom: 4 }}>ADMINS NOTIFIED</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: result?.simulate ? '#f59e0b' : '#fff' }}>{result?.notified ?? 0}</div>
                </div>
                <div style={{ background: '#060608', border: '1px solid #1c1c1c', borderRadius: 8, padding: '12px 16px', textAlign: 'left' }}>
                  <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.1em', marginBottom: 4 }}>MODE</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: result?.simulate ? '#f59e0b' : '#ef4444' }}>{result?.simulate ? 'SIMULATION' : 'REAL'}</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 16px', background: '#0c0a06', border: '1px solid #2a2010', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#555' }}>Logged at: <span style={{ color: '#666' }}>{result?.executedAt ?? new Date().toUTCString()}</span></div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>All actions recorded in the permanent audit trail.</div>
            </div>

            <button className="sd-btn-ghost" onClick={reset} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #333', borderRadius: 8, color: '#666', cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background .15s' }}>
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
