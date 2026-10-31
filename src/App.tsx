import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

type Kind = 'in' | 'out'
type Tx = { id: number; type: Kind; amt: number; note: string; date: string }
type St = { limit: number; cur: string; name: string; theme: '' | 'light' | 'dark'; tx: Tx[] }
type Mood = 'happy' | 'excited' | 'sleepy' | 'worried' | 'sad' | 'surprised' | 'curious'
type Pose = 'stand' | 'sit' | 'sleep'
type View = 'dashboard' | 'transactions' | 'preferences'
type ToastT = { id: number; kind: 'ok' | 'warn' | 'err'; title: string; msg?: string }
type Act = 'purr' | 'jump' | 'meow' | 'wiggle'
type Flash = { mood: Mood; msg: string; act?: Act }
type Fmt = (n: number) => string

const KEY = 'daily-money-tracker-v1' // same key as v1 so existing data carries over
const VERSION = '2.1.0'
const DEF: St = { limit: 0, cur: '₹', name: '', theme: '', tx: [] }
const VIEWS: View[] = ['dashboard', 'transactions', 'preferences']
const PAL = ['#5B8DEF', '#34C38F', '#F5B83D', '#9B8AF4', '#F2785C', '#2BB3C0', '#E86AA6']
const E = '#2B2E45', O = '#AEB4D0', P = '#FFC2CF'

const dkey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const sum = (a: Tx[], t: Kind) => a.filter(x => x.type === t).reduce((s, x) => s + x.amt, 0)
const short = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'K' : String(Math.round(n)))
const mkFmt = (cur: string): Fmt => n => cur + new Intl.NumberFormat(cur === '₹' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 }).format(n)
const fdate = (d: Date, o?: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-IN', o ?? { day: 'numeric', month: 'short', year: 'numeric' })
const poseFor = (h: number): Pose => (h >= 22 || h < 6 ? 'sleep' : h >= 18 ? 'sit' : 'stand')

function load(): St {
  try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && Array.isArray(p.tx)) return { ...DEF, ...p } } catch { /* ignore */ }
  return DEF
}
function calc(S: St, now: Date) {
  const tk = dkey(now), tin = sum(S.tx, 'in'), tout = sum(S.tx, 'out'), bal = tin - tout
  const spent = sum(S.tx.filter(x => x.date === tk), 'out'), lim = S.limit, rem = Math.max(lim - spent, 0)
  let off: number | null = null
  if (lim > 0 && bal > 0) off = bal <= rem ? 0 : Math.ceil((bal - rem) / lim)
  return { tk, tin, tout, bal, spent, lim, rem, off, last: off == null ? null : addDays(now, off) }
}
type Calc = ReturnType<typeof calc>
function series(tx: Tx[], now: Date, n: number, shift = 0) {
  const days = Array.from({ length: n }, (_, i) => addDays(now, i - n + 1 - shift))
  const on = (k: string, t: Kind) => sum(tx.filter(x => x.date === k), t)
  const ks = days.map(dkey)
  return { days, a: ks.map(k => on(k, 'in')), b: ks.map(k => on(k, 'out')), bal: ks.map(k => tx.filter(x => x.date <= k).reduce((s, x) => s + (x.type === 'in' ? x.amt : -x.amt), 0)) }
}

/* ---------- Cat ---------- */
const MOODS: Record<Mood, string> = { happy: 'Happy and purring', excited: 'So excited!', sleepy: 'Sleepy', worried: 'A little worried', sad: 'Feeling sad', surprised: 'Whoa!', curious: 'Curious' }
function catMood(S: St, c: Calc, pose: Pose, fmt: Fmt, flash: Flash | null): Flash {
  const n = S.name || 'friend'
  if (flash) return flash
  if (pose === 'sleep') return { mood: 'sleepy', msg: c.tin === 0 ? `Zzz… ${n}, add your first money in when I wake up.` : `Zzz… ${n}, you have ${fmt(c.bal)}. Sleep tight!` }
  if (c.tin === 0) return { mood: 'curious', msg: `Hi ${n}! Add your first money in and I’ll start keeping track.` }
  if (c.bal < 0) return { mood: 'sad', msg: `${n}, your balance is below zero. Let’s check your entries.` }
  if (c.bal === 0) return { mood: 'sad', msg: `${n}, no money left. Add money in when you get some.` }
  if (c.lim > 0 && c.spent > c.lim) return { mood: 'sad', msg: `${n}, you’re ${fmt(c.spent - c.lim)} over today’s limit. Tomorrow is a fresh start.` }
  if (c.lim > 0 && c.off != null && c.off <= 2) return { mood: 'worried', msg: `${n}, your money lasts only ${c.off + 1} more day${c.off ? 's' : ''} at this pace.` }
  if (c.lim > 0 && c.spent >= c.lim * 0.75) return { mood: 'worried', msg: `${n}, you’ve used most of today’s limit. Only ${fmt(c.lim - c.spent)} left.` }
  if (!S.tx.some(x => x.date === c.tk)) return { mood: 'sleepy', msg: `Quiet day so far, ${n}. Add anything you’ve spent or received.` }
  return { mood: 'happy', msg: c.lim > 0 ? `You’re doing great, ${n}! ${fmt(c.lim - c.spent)} left for today.` : `Nice tracking, ${n}! Set a daily limit and I’ll watch it for you.` }
}
const ln = { fill: 'none', stroke: E, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function Face({ m }: { m: Mood }) {
  const eye = (x: number, y: number, r: number) => <g key={x} className="eye"><circle cx={x} cy={y} r={r} fill={E} /><circle cx={x + r * 0.35} cy={y - r * 0.35} r={r * 0.35} fill="#fff" /></g>
  const bl = <><circle cx="35" cy="68" r="5" fill={P} opacity=".85" /><circle cx="85" cy="68" r="5" fill={P} opacity=".85" /></>
  const T = (x: number, y: number, s: number, f: string, t: string) => <text x={x} y={y} fontSize={s} fontWeight={800} fill={f}>{t}</text>
  const star = (x: number, y: number) => <path transform={`translate(${x} ${y})`} d="M0-6L1.8-1.8 6 0 1.8 1.8 0 6-1.8 1.8-6 0-1.8-1.8Z" fill="#F5B83D" />
  const drop = <><path d="M43 65q-4 9 0 12q4-3 0-12z" fill="#7CC4FF" /><path d="M77 65q-4 9 0 12q4-3 0-12z" fill="#7CC4FF" /></>
  switch (m) {
    case 'happy': return <><path d="M40 57q5-8 10 0M70 57q5-8 10 0" {...ln} strokeWidth={3} /><path d="M52 70q4 5 8 0q4 5 8 0" {...ln} strokeWidth={2.5} />{bl}</>
    case 'excited': return <>{eye(45, 56, 7)}{eye(75, 56, 7)}<path d="M53 69q7 11 14 0z" fill="#E85D75" stroke={E} strokeWidth="2" strokeLinejoin="round" />{bl}{star(12, 30)}{star(108, 24)}{star(112, 52)}</>
    case 'sleepy': return <><path d="M40 58q5 5 10 0M70 58q5 5 10 0" {...ln} strokeWidth={3} /><path d="M56 70q4 3 8 0" {...ln} strokeWidth={2.5} />{bl}</>
    case 'worried': return <>{eye(45, 57, 5)}{eye(75, 57, 5)}<path d="M38 48l14-3M82 48l-14-3" {...ln} strokeWidth={2.5} /><path d="M54 73q6-5 12 0" {...ln} strokeWidth={2.5} /><path d="M101 36q-5 8 0 11q5-3 0-11z" fill="#7CC4FF" /></>
    case 'sad': return <>{eye(45, 58, 5)}{eye(75, 58, 5)}<path d="M38 53l14-7M82 53l-14-7" {...ln} strokeWidth={2.5} /><path d="M53 75q7-7 14 0" {...ln} strokeWidth={2.5} />{drop}</>
    case 'surprised': return <><circle cx="45" cy="56" r="7" fill="#fff" stroke={E} strokeWidth="2.5" /><circle cx="75" cy="56" r="7" fill="#fff" stroke={E} strokeWidth="2.5" /><circle cx="46" cy="57" r="2.5" fill={E} /><circle cx="74" cy="57" r="2.5" fill={E} /><ellipse cx="60" cy="74" rx="4" ry="5" fill={E} />{T(96, 28, 22, '#F5B83D', '!')}</>
    default: return <>{eye(45, 56, 5.5)}{eye(75, 56, 5.5)}<ellipse cx="60" cy="71" rx="2.5" ry="3" fill={E} />{T(96, 28, 22, '#8B8FB0', '?')}</>
  }
}
function Cat({ m, pose, act, tick, onTap, onHover }: { m: Mood; pose: Pose; act?: Act; tick: number; onTap: () => void; onHover: () => void }) {
  const b = { fill: '#fff', stroke: O, strokeWidth: 2.5, strokeLinejoin: 'round' as const }
  const tail = (d: string) => <><path className="tail" d={d} fill="none" stroke={O} strokeWidth="12" strokeLinecap="round" /><path className="tail" d={d} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" /></>
  const zz = <><text x="92" y="34" fontSize="15" fontWeight="800" fill="#8B8FB0">z</text><text x="103" y="20" fontSize="10" fontWeight="800" fill="#8B8FB0">z</text></>
  const head = (
    <g className="head">
      <path className="ear" d="M29 48L25 14L54 33Z" {...b} /><path className="ear" d="M91 48L95 14L66 33Z" {...b} />
      <path d="M32 40L30 23L45 33Z" fill={P} /><path d="M88 40L90 23L75 33Z" fill={P} />
      <ellipse cx="60" cy="58" rx="37" ry="31" {...b} />
      <path d="M18 60h15M19 69l14-4M102 60H87M101 69l-14-4" fill="none" stroke={O} strokeWidth="1.8" strokeLinecap="round" />
      <Face m={pose === 'sleep' ? 'sleepy' : m} /><path d="M56 63h8l-4 4.5z" fill="#FF9DB0" />
    </g>
  )
  const fx = pose === 'sleep' ? null : <>
    {act === 'meow' && <><ellipse cx="60" cy="74" rx="6" ry="7" fill={E} /><ellipse cx="60" cy="78" rx="3.5" ry="2.6" fill="#FF8FA8" /><text x="86" y="22" fontSize="13" fontWeight="800" fill="#F5B83D">Meow!</text></>}
    {act === 'purr' && [0, 1, 2].map(i => <text key={i} className="heart" style={{ animationDelay: `${i * 0.6}s` }} x={26 + i * 30} y="26" fontSize="14" fill="#FF7A9C">♥</text>)}
  </>
  return (
    <button type="button" className="catbtn" onClick={onTap} onPointerEnter={onHover} onFocus={onHover} title="Pet me!" aria-label="Pet the cat">
      <svg key={tick} className={'catsvg' + (act ? ' act-' + act : '')} viewBox="0 0 120 120" role="img" aria-label={`White cat ${pose === 'sleep' ? 'sleeping' : pose === 'stand' ? 'standing' : 'sitting'}, feeling ${m}`}>
        {pose === 'sleep' && <>{tail('M104 104c12-2 10-18-4-16')}<ellipse cx="58" cy="102" rx="46" ry="17" {...b} /><g transform="translate(-4 30) scale(.8)">{head}</g>{zz}</>}
        {pose === 'sit' && <>{tail('M88 104c18 2 24-14 14-26')}<ellipse cx="60" cy="100" rx="32" ry="20" {...b} /><ellipse cx="46" cy="114" rx="10" ry="6" {...b} /><ellipse cx="74" cy="114" rx="10" ry="6" {...b} />{head}{fx}</>}
        {pose === 'stand' && <>{tail('M86 96c16 0 20-18 12-34')}<ellipse cx="60" cy="95" rx="27" ry="21" {...b} /><rect x="44" y="102" width="11" height="17" rx="5.5" {...b} /><rect x="65" y="102" width="11" height="17" rx="5.5" {...b} />{head}{fx}</>}
        {m === 'sleepy' && pose !== 'sleep' && zz}
      </svg>
    </button>
  )
}

/* ---------- Charts ---------- */
function Spark({ v, c }: { v: number[]; c: string }) {
  const mx = Math.max(...v), mn = Math.min(...v), r = mx - mn || 1, n = v.length - 1 || 1
  const p = v.map((y, i) => `${((i / n) * 100).toFixed(1)},${(30 - ((y - mn) / r) * 26).toFixed(1)}`).join(' ')
  return <svg className="sp" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polygon points={`0,32 ${p} 100,32`} style={{ fill: c, fillOpacity: 0.14 }} /><polyline points={p} fill="none" style={{ stroke: c }} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
}
function smooth(pts: [number, number][], y0: number) {
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    const y1 = Math.min(p1[1] + (p2[1] - p0[1]) / 6, y0), y2 = Math.min(p2[1] - (p3[1] - p1[1]) / 6, y0)
    d += `C${p1[0] + (p2[0] - p0[0]) / 6},${y1} ${p2[0] - (p3[0] - p1[0]) / 6},${y2} ${p2[0]},${p2[1]}`
  }
  return d
}
function Chart({ S, now, fmt }: { S: St; now: Date; fmt: Fmt }) {
  const [range, setRange] = useState<7 | 14 | 30>(7)
  const [hi, setHi] = useState<number | null>(null)
  const [showA, setShowA] = useState(true), [showB, setShowB] = useState(true)
  const ref = useRef<SVGSVGElement>(null)
  const { days, a, b } = series(S.tx, now, range)
  const n = days.length, W = 640, H = 240, L = 44, R = 12, T = 14, B = 26
  const mx = Math.max(1, ...(showA ? a : [0]), ...(showB ? b : [0]), S.limit) * 1.1
  const X = (i: number) => L + (i * (W - L - R)) / (n - 1), Y = (v: number) => T + (H - T - B) * (1 - v / mx), Y0 = Y(0)
  const lab = (d: Date) => (range === 7 ? d.toLocaleDateString('en-IN', { weekday: 'short' }) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))
  const step = range === 7 ? 1 : range === 14 ? 2 : 5
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const r = ref.current!.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W
    setHi(Math.max(0, Math.min(n - 1, Math.round((x - L) / ((W - L - R) / (n - 1))))))
  }
  const area = (v: number[], c: string, id: string) => {
    const pts = v.map((y, i) => [X(i), Y(y)] as [number, number]), top = smooth(pts, Y0)
    return <g>
      <path d={`${top}L${X(n - 1)},${Y0}L${X(0)},${Y0}Z`} fill={`url(#${id})`} />
      <path d={top} fill="none" strokeWidth="2.5" strokeLinecap="round" style={{ stroke: c }} />
      {hi !== null && <circle cx={X(hi)} cy={Y(v[hi])} r="5" strokeWidth="2" style={{ fill: c, stroke: 'var(--sf)' }} />}
    </g>
  }
  const grad = (id: string, c: string) => <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: c, stopOpacity: 0.45 }} /><stop offset="1" style={{ stopColor: c, stopOpacity: 0.02 }} /></linearGradient>
  return (
    <div className="card">
      <div className="ch">
        <h2>Last {range} days</h2>
        <div className="fl" role="group" aria-label="Chart range">{([7, 14, 30] as const).map(r => <button key={r} type="button" className={'pill ghost' + (range === r ? ' on' : '')} onClick={() => { setRange(r); setHi(null) }}>{r}d</button>)}</div>
      </div>
      <div className="lg" style={{ marginBottom: 8 }}>
        <button type="button" className={'pill ghost' + (showA ? '' : ' off')} aria-pressed={showA} onClick={() => setShowA(!showA)}><i style={{ background: 'var(--in)' }} />Money in</button>
        <button type="button" className={'pill ghost' + (showB ? '' : ' off')} aria-pressed={showB} onClick={() => setShowB(!showB)}><i style={{ background: 'var(--out)' }} />Money out</button>
      </div>
      <svg ref={ref} className="chartsvg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Area chart of money in and out for the last ${range} days`} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHi(null)}>
        <defs>{grad('gIn', 'var(--in)')}{grad('gOut', 'var(--out)')}</defs>
        {[0, 0.5, 1].map(f => <g key={f}><line x1={L} x2={W - R} y1={Y(mx * f)} y2={Y(mx * f)} style={{ stroke: 'var(--ln)' }} /><text x={L - 8} y={Y(mx * f) + 4} textAnchor="end" fontSize="11" style={{ fill: 'var(--mu)' }}>{short(mx * f)}</text></g>)}
        {days.map((d, i) => (i % step === 0 || i === n - 1) && <text key={i} x={X(i)} y={H - 6} textAnchor="middle" fontSize="11" style={{ fill: 'var(--mu)' }}>{lab(d)}</text>)}
        <g key={`${range}-${S.tx.length}-${showA}-${showB}`} className="reveal">{showB && area(b, 'var(--out)', 'gOut')}{showA && area(a, 'var(--in)', 'gIn')}</g>
        {S.limit > 0 && <line x1={L} x2={W - R} y1={Y(S.limit)} y2={Y(S.limit)} strokeDasharray="5 4" strokeWidth="1.5" style={{ stroke: 'var(--wn)' }} />}
        {hi !== null && <g>
          <line x1={X(hi)} x2={X(hi)} y1={T} y2={Y0} strokeDasharray="3 3" style={{ stroke: 'var(--mu)' }} />
          <g transform={`translate(${X(hi) > W / 2 ? X(hi) - 160 : X(hi) + 10} ${T})`}>
            <rect width="150" height="62" rx="10" style={{ fill: 'var(--sf)', stroke: 'var(--ln)' }} />
            <text x="10" y="18" fontSize="12" fontWeight="700" style={{ fill: 'var(--ink)' }}>{fdate(days[hi], { weekday: 'short', day: 'numeric', month: 'short' })}</text>
            <text x="10" y="36" fontSize="12" style={{ fill: 'var(--in)' }}>In: {fmt(a[hi])}</text>
            <text x="10" y="53" fontSize="12" style={{ fill: 'var(--out)' }}>Out: {fmt(b[hi])}</text>
          </g>
        </g>}
      </svg>
      <p className="mu" style={{ margin: '8px 0 0', fontSize: '.82rem' }}>Hover or touch the chart for details. Tap the legend to show or hide an area.</p>
    </div>
  )
}
function useInView<T extends Element>() {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, seen] as const
}
function Donut({ S, c, fmt }: { S: St; c: Calc; fmt: Fmt }) {
  const [scope, setScope] = useState<'today' | 'all'>('today')
  const [hi, setHi] = useState<number | null>(null)
  const [ref, seen] = useInView<HTMLDivElement>()
  const [grow, setGrow] = useState(false)
  useEffect(() => {
    setGrow(false)
    if (!seen) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGrow(true)))
    return () => cancelAnimationFrame(id)
  }, [seen, scope])
  const td = scope === 'today'
  const outs = S.tx.filter(x => x.type === 'out' && (!td || x.date === c.tk))
  const g: Record<string, { n: string; a: number; k: string; c: string }> = {}
  outs.forEach(x => { const k = x.note.toLowerCase(); (g[k] = g[k] || { k, n: x.note || 'No note', a: 0, c: '' }).a += x.amt })
  const items = Object.values(g).sort((x, y) => y.a - x.a)
  let ci = 0
  items.forEach(i => { i.c = i.k === '' ? '#8A9BA3' : PAL[ci++ % PAL.length] })
  const tot = items.reduce((s, i) => s + i.a, 0), hasNotes = outs.some(x => x.note)
  const toggle = <div className="fl">{(['today', 'all'] as const).map(s => <button key={s} type="button" className={'pill ghost' + (scope === s ? ' on' : '')} onClick={() => { setScope(s); setHi(null) }}>{s === 'today' ? 'Today' : 'All time'}</button>)}</div>
  let body: ReactNode, note = ''
  if (hasNotes) {
    const C = 2 * Math.PI * 60; let cum = 0
    const h = hi !== null ? items[hi] : null
    body = <div className="viz"><svg viewBox="-10 -10 180 180" role="img" aria-label="Donut chart of spending by note">
      {items.map((i, k) => {
        const len = (i.a / tot) * C, mid = -Math.PI / 2 + ((cum + len / 2) / C) * 2 * Math.PI, on = hi === k
        const el = <g key={i.k} style={{ transform: on ? `translate(${Math.cos(mid) * 7}px,${Math.sin(mid) * 7}px)` : 'none', transition: 'transform .25s' }}>
          <circle className="seg-s" cx="80" cy="80" r="60" fill="none" strokeWidth={on ? 27 : 22} stroke={i.c} opacity={hi === null || on ? 1 : 0.45}
            strokeDasharray={grow ? `${Math.max(len - (items.length > 1 ? 2 : 0), 0.1)} ${C}` : `0 ${C}`} strokeDashoffset={-cum} transform="rotate(-90 80 80)"
            style={{ cursor: 'pointer', transitionDelay: `${k * 0.1}s, 0s` }} onPointerEnter={() => setHi(k)} onPointerLeave={() => setHi(null)} onClick={() => setHi(on ? null : k)} /></g>
        cum += len; return el
      })}
      <text x="80" y="78" textAnchor="middle" fontSize="14" fontWeight="800" style={{ fill: 'var(--ink)' }}>{fmt(h ? h.a : tot)}</text>
      <text x="80" y="95" textAnchor="middle" fontSize="10" style={{ fill: 'var(--mu)' }}>{h ? `${h.n} · ${Math.round((h.a / tot) * 100)}%` : 'Total spent'}</text>
    </svg><div className="legend">{items.map((i, k) => <button key={i.k} type="button" className={hi === k ? 'on' : ''} onPointerEnter={() => setHi(k)} onPointerLeave={() => setHi(null)} onClick={() => setHi(hi === k ? null : k)}><i style={{ background: i.c }} /><span>{i.n}</span><b>{Math.round((i.a / tot) * 100)}%</b></button>)}</div></div>
    note = td && c.lim > 0 ? `Spent ${fmt(c.spent)} of your ${fmt(c.lim)} limit today.` : 'Tap a slice or a name to explore.'
  } else {
    const empty = td ? c.lim <= 0 : c.tin <= 0
    if (empty) body = <div className="empty">{td ? 'Set a daily limit in Preferences to see how much of today’s allowance is left.' : 'Add money in to see how much of it is left.'}</div>
    else {
      const left = td ? c.lim - c.spent : c.bal, total = td ? c.lim : c.tin
      const pct = Math.max(0, Math.min((left / total) * 100, 100)), C = 2 * Math.PI * 66, col = pct > 50 ? 'var(--in)' : pct > 20 ? 'var(--wn)' : 'var(--out)'
      body = <div className="viz"><svg viewBox="0 0 160 160" role="img" aria-label={`${Math.round(pct)} percent left`}><circle cx="80" cy="80" r="66" fill="none" strokeWidth="14" style={{ stroke: 'var(--ln)' }} /><circle className="seg-s" cx="80" cy="80" r="66" fill="none" strokeWidth="14" strokeLinecap={pct > 0 ? 'round' : 'butt'} style={{ stroke: col }} strokeDasharray={grow ? `${(C * pct) / 100} ${C}` : `0 ${C}`} transform="rotate(-90 80 80)" /><text x="80" y="88" textAnchor="middle" fontSize="30" fontWeight="800" style={{ fill: 'var(--ink)' }}>{Math.round(pct)}%</text><text x="80" y="106" textAnchor="middle" fontSize="11" style={{ fill: 'var(--mu)' }}>left</text></svg>
        <div className="legend"><b>{left >= 0 ? `${fmt(left)} left of ${fmt(total)}` : `Over by ${fmt(-left)}`}</b></div></div>
      note = 'Add notes to money out to see a donut by category.'
    }
  }
  return <div className="card" ref={ref}><div className="ch"><h2>{hasNotes ? (td ? 'Where today’s money went' : 'Where your money went') : td ? 'Today’s limit left' : 'Money left'}</h2>{toggle}</div>{body}<p className="mu" style={{ textAlign: 'center', margin: '12px 0 0' }}>{note}</p></div>
}

/* ---------- Pages ---------- */
function Row({ x, fmt, del }: { x: Tx; fmt: Fmt; del?: () => void }) {
  return <tr><td><span className={'dot ' + x.type}>{x.type === 'in' ? '+' : '−'}</span>{x.note || (x.type === 'in' ? 'Money in' : 'Money out')}</td><td className="mu">{fdate(parse(x.date), { day: 'numeric', month: 'short' })}</td><td className={'r ' + (x.type === 'in' ? 'inc' : 'outc')}>{x.type === 'in' ? '+' : '−'}{fmt(x.amt)}</td>{del && <td><button className="del" type="button" aria-label="Delete transaction" onClick={del}>×</button></td>}</tr>
}
function AddForm({ onAdd }: { onAdd: (t: Kind, amt: number, note: string, date: string) => boolean }) {
  const [type, setType] = useState<Kind>('in'), [amt, setAmt] = useState(''), [note, setNote] = useState(''), [date, setDate] = useState(dkey(new Date())), [err, setErr] = useState('')
  const amtRef = useRef<HTMLInputElement>(null)
  const submit = () => {
    const v = parseFloat(amt)
    if (!(v > 0)) { setErr('Enter an amount greater than 0.'); amtRef.current?.focus(); return }
    setErr('')
    if (onAdd(type, Math.round(v * 100) / 100, note.trim(), date || dkey(new Date()))) { setAmt(''); setNote('') } else { setType('in'); amtRef.current?.focus() }
  }
  const key = (e: { key: string }) => { if (e.key === 'Enter') submit() }
  return <div className="card"><h2>Add a transaction</h2>
    <div className="seg" role="group" aria-label="Transaction type"><button type="button" className="in" aria-pressed={type === 'in'} onClick={() => setType('in')}>+ Money in</button><button type="button" className="out" aria-pressed={type === 'out'} onClick={() => setType('out')}>− Money out</button></div>
    <div className="f"><input ref={amtRef} className="amt" type="number" inputMode="decimal" min="0" step="any" placeholder="Amount" aria-label="Amount" value={amt} onChange={e => setAmt(e.target.value)} onKeyDown={key} />
      <div className="two"><input type="text" maxLength={40} placeholder="Note (e.g. food, rent)" aria-label="Note" value={note} onChange={e => setNote(e.target.value)} onKeyDown={key} /><input type="date" aria-label="Date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <p className="err">{err}</p><button className="pill wide" type="button" onClick={submit}>{type === 'in' ? 'Add money in' : 'Add money out'}</button></div></div>
}
function NameAsk({ onSave }: { onSave: (n: string) => void }) {
  const [v, setV] = useState('')
  return <div className="f"><div className="inline"><input type="text" maxLength={24} placeholder="What’s your name?" aria-label="Your name" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && v.trim()) onSave(v.trim()) }} /><button className="pill" type="button" disabled={!v.trim()} onClick={() => onSave(v.trim())}>Save</button></div></div>
}
function Dashboard({ S, c, now, fmt, flash, flashIt, addTx, go, update }: { S: St; c: Calc; now: Date; fmt: Fmt; flash: Flash | null; flashIt: (m: Mood, msg: string, act?: Act) => void; addTx: (t: Kind, a: number, n: string, d: string) => boolean; go: (v: View) => void; update: (p: Partial<St>) => void }) {
  const [pets, setPets] = useState(0)
  const [hovered, setHovered] = useState(false)
  const pose = flash && poseFor(now.getHours()) === 'sleep' ? 'sit' : poseFor(now.getHours())
  const cm = catMood(S, c, pose, fmt, flash)
  const tap = () => {
    const n = S.name || 'friend', hr = now.getHours()
    setPets(x => x + 1)
    if ((hr >= 22 || hr < 6) && !flash) { flashIt('sleepy', `Zzz… ${n}, five more minutes… tap again to wake me!`, 'wiggle'); return }
    const a = (['purr', 'jump', 'meow', 'wiggle'] as const)[pets % 4]
    const msgs = {
      purr: [`Purrrr… thanks for the pets, ${n}!`, 'happy'],
      jump: [`Wheee! Watch me jump, ${n}!`, 'excited'],
      meow: [c.lim > 0 ? `Meow! You have ${fmt(c.rem)} left today, ${n}.` : `Meow! Set a daily limit, ${n}.`, 'happy'],
      wiggle: [`Hehe, that tickles, ${n}!`, 'excited'],
    } as const
    flashIt(msgs[a][1], msgs[a][0], a)
  }
  const hover = () => {
    if (hovered) return
    setHovered(true)
    const n = S.name || 'friend'
    flashIt('curious', `Psst, ${n}… I’m watching your money. Tap me for a trick!`, 'wiggle')
  }
  const w = series(S.tx, now, 7), p = series(S.tx, now, 7, 7)
  const ta = w.a.reduce((s, x) => s + x, 0), tb = w.b.reduce((s, x) => s + x, 0), pa = p.a.reduce((s, x) => s + x, 0), pb = p.b.reduce((s, x) => s + x, 0)
  const net = sum(S.tx.filter(x => x.date === c.tk), 'in') - c.spent
  const dl = (cur: number, prev: number, up: boolean) => !prev ? <span className="d mu">{cur ? 'New this week' : 'No activity yet'}</span> : <span className="d" style={{ color: `var(--${(cur >= prev) === up ? 'in' : 'out'})` }}>{cur >= prev ? '↑ ' : '↓ '}{Math.abs(((cur - prev) / prev) * 100).toFixed(0)}% <span className="mu">vs previous 7 days</span></span>
  const proj = c.lim > 0 && c.bal > 0 ? Array.from({ length: 14 }, (_, i) => Math.max(c.bal - c.rem - i * c.lim, 0)) : null
  const kpi = (label: string, icon: ReactNode, col: string, val: string, sub: ReactNode, sp: ReactNode) => <div className="card k"><div className="h">{label}<span className="ic" style={{ color: col, background: `color-mix(in srgb, ${col} 15%, transparent)` }}><svg className="i" viewBox="0 0 24 24">{icon}</svg></span></div><div className="v">{val}</div>{sub}{sp}</div>
  const recent = S.tx.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 6)
  return <>
    <div className={'card catcard' + (cm.mood === 'sad' || pose === 'sleep' ? ' still' : '')}><Cat m={cm.mood} pose={pose} act={flash?.act} tick={pets} onTap={tap} onHover={hover} />
      <div className="bubble"><b>{MOODS[cm.mood]}</b><span>{cm.msg}</span>{c.lim > 0 && <><br /><span className="cs">Today {fmt(c.spent)} of {fmt(c.lim)}</span></>}<br /><span className="cs">Friendship: {pets < 3 ? 'Just met' : pets < 10 ? 'Friends' : 'Best friends'} · Pets: {pets}</span>{!S.name && <NameAsk onSave={n => update({ name: n })} />}</div></div>
    {c.tin === 0 && <div className="bn" role="status"><div><b>Start with your money in</b><br /><span className="mu">Add the money you have (salary, cash, savings) first. Then you can record money out.</span></div></div>}
    {c.tin > 0 && !c.lim && <div className="bn" role="status"><div><b>Set a daily limit</b><br /><span className="mu">Tell me how much you plan to spend each day to see when your money runs out.</span></div><button className="pill" type="button" onClick={() => go('preferences')}>Set limit</button></div>}
    <div className="kpis">
      {kpi('Balance', <path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-3v3M16 14h2" />, 'var(--br)', fmt(c.bal), <span className="d" style={{ color: `var(--${net >= 0 ? 'in' : 'out'})` }}>{net >= 0 ? '↑ ' : '↓ '}{fmt(Math.abs(net))} <span className="mu">net today</span></span>, <Spark v={w.bal} c="var(--br)" />)}
      {kpi('Money in', <path d="M12 5v14M6 13l6 6 6-6" />, 'var(--in)', fmt(ta), dl(ta, pa, true), <Spark v={w.a} c="var(--in)" />)}
      {kpi('Money out', <path d="M12 19V5M6 11l6-6 6 6" />, 'var(--out)', fmt(tb), dl(tb, pb, false), <Spark v={w.b} c="var(--out)" />)}
      {kpi('Money lasts until', <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>, 'var(--wn)', c.lim <= 0 ? 'Set a limit' : c.bal <= 0 ? 'No money left' : fdate(c.last!), <span className="d mu">{c.lim <= 0 ? 'in Preferences' : c.bal <= 0 ? 'Add money in' : `${c.off! + 1} day${c.off ? 's' : ''} at ${fmt(c.lim)}/day`}</span>, proj ? <Spark v={proj} c="var(--wn)" /> : <div style={{ height: 50 }} />)}
    </div>
    <div className="row r1"><Chart S={S} now={now} fmt={fmt} /><AddForm onAdd={addTx} /></div>
    <div className="row r2"><Donut S={S} c={c} fmt={fmt} />
      <div className="card"><div className="ch"><h2>Recent activity</h2><button className="pill ghost" type="button" onClick={() => go('transactions')}>View all</button></div>
        <div className="tw"><table><thead><tr><th>Activity</th><th>Date</th><th className="r">Amount</th></tr></thead><tbody>{recent.length ? recent.map(x => <Row key={x.id} x={x} fmt={fmt} />) : <tr><td colSpan={3} className="empty">No activity yet. Add your first money in.</td></tr>}</tbody></table></div></div></div>
  </>
}
function Transactions({ S, c, fmt, setS, toast }: { S: St; c: Calc; fmt: Fmt; setS: (f: (s: St) => St) => void; toast: (k: ToastT['kind'], t: string, m?: string) => void }) {
  const [filt, setFilt] = useState<'all' | Kind>('all'), [ask, setAsk] = useState(false)
  const all = S.tx.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).filter(x => filt === 'all' || x.type === filt)
  const rows: ReactNode[] = []; let pd = ''
  all.forEach(x => {
    if (x.date !== pd) {
      pd = x.date
      const i = sum(S.tx.filter(y => y.date === pd), 'in'), o = sum(S.tx.filter(y => y.date === pd), 'out')
      rows.push(<tr className="gh" key={'g' + pd}><td colSpan={4}>{pd === c.tk ? 'Today' : fdate(parse(pd), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · In {fmt(i)} · Out {fmt(o)}{c.lim > 0 && o > 0 && (o > c.lim ? <span className="tag bad">Over by {fmt(o - c.lim)}</span> : <span className="tag ok">Under by {fmt(c.lim - o)}</span>)}</td></tr>)
    }
    rows.push(<Row key={x.id} x={x} fmt={fmt} del={() => setS(s => ({ ...s, tx: s.tx.filter(y => y.id !== x.id) }))} />)
  })
  return <div className="card"><div className="ch"><div className="fl">{(['all', 'in', 'out'] as const).map(f => <button key={f} type="button" className={'pill ghost' + (filt === f ? ' on' : '')} onClick={() => setFilt(f)}>{f === 'all' ? 'All' : f === 'in' ? 'Money in' : 'Money out'}</button>)}</div>
    <div className="fl"><button className="pill ghost" type="button" disabled={!S.tx.length} onClick={() => { const m = Math.max(...S.tx.map(x => x.id)); setS(s => ({ ...s, tx: s.tx.filter(x => x.id !== m) })); toast('ok', 'Last entry removed') }}>Undo last</button><button className="pill danger" type="button" disabled={!S.tx.length} onClick={() => setAsk(true)}>Reset</button></div></div>
    {ask && <div className="confirm" role="alert"><span>Delete all {S.tx.length} transactions? This can’t be undone.</span><button className="pill danger" type="button" onClick={() => { setS(s => ({ ...s, tx: [] })); setAsk(false); toast('ok', 'All transactions cleared') }}>Yes, reset</button><button className="pill ghost" type="button" onClick={() => setAsk(false)}>Cancel</button></div>}
    <div className="tw"><table><thead><tr><th>Activity</th><th>Date</th><th className="r">Amount</th><th /></tr></thead><tbody>{rows.length ? rows : <tr><td colSpan={4} className="empty">No transactions to show.</td></tr>}</tbody></table></div></div>
}
function Prefs({ S, update, toast }: { S: St; update: (p: Partial<St>) => void; toast: (k: ToastT['kind'], t: string, m?: string) => void }) {
  const [name, setName] = useState(S.name), [cur, setCur] = useState(S.cur), [lim, setLim] = useState(S.limit ? String(S.limit) : '')
  return <div style={{ display: 'grid', gap: 14, maxWidth: 480 }}>
    <div className="card f"><h2>Your daily limit</h2>
      <label htmlFor="lim">How much do you plan to spend each day?</label>
      <div className="inline"><input id="lim" type="number" inputMode="decimal" min="0" placeholder="e.g. 500" value={lim} onChange={e => setLim(e.target.value)} />
        <button className="pill" type="button" onClick={() => { const v = Math.max(parseFloat(lim) || 0, 0); update({ limit: v }); toast('ok', v > 0 ? 'Daily limit changed' : 'Daily limit cleared', v > 0 ? `Your limit is now ${mkFmt(S.cur)(v)} a day.` : undefined) }}>Change limit</button></div></div>
    <div className="card f"><h2>Profile</h2>
      <label htmlFor="nm">Your name (the cat will use it)</label><input id="nm" type="text" maxLength={24} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
      <label htmlFor="cu">Currency</label><select id="cu" value={cur} onChange={e => setCur(e.target.value)}>{['₹', '$', '€', '£'].map(x => <option key={x}>{x}</option>)}</select>
      <button className="pill wide" type="button" onClick={() => { update({ name: name.trim(), cur }); toast('ok', 'Saved', 'Your preferences were updated.') }}>Save</button></div>
    <p className="mu" style={{ margin: 0 }}>Version {VERSION}. When a new version is ready, an Update button appears at the top of the app. Your data stays on this device.</p>
  </div>
}
function UpdatePrompt() {
  const { needRefresh: [need], updateServiceWorker } = useRegisterSW({ onRegisteredSW(_u, r) { if (r) setInterval(() => { r.update() }, 60 * 60 * 1000) } })
  return need ? <div className="upd" role="status">New version available<button type="button" onClick={() => updateServiceWorker(true)}>Update</button></div> : null
}

/* ---------- App shell ---------- */
const NAV: { v: View; label: string; icon: ReactNode }[] = [
  { v: 'dashboard', label: 'Dashboard', icon: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></> },
  { v: 'transactions', label: 'Transactions', icon: <path d="M7 4v16M7 4L3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4" /> },
  { v: 'preferences', label: 'Preferences', icon: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></> },
]
export default function App() {
  const wide = () => matchMedia('(min-width:900px)').matches
  const [S, setS] = useState<St>(load)
  const [view, setView] = useState<View>(() => { const h = location.hash.slice(1) as View; return VIEWS.includes(h) ? h : 'dashboard' })
  const [open, setOpen] = useState(wide)
  const [now, setNow] = useState(new Date())
  const [flash, setFlash] = useState<Flash | null>(null)
  const [toasts, setToasts] = useState<ToastT[]>([])
  const ft = useRef<number>()
  const fmt = mkFmt(S.cur), c = calc(S, now)
  const update = (p: Partial<St>) => setS(s => ({ ...s, ...p }))
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch { /* ignore */ } }, [S])
  useEffect(() => { if (S.theme) document.documentElement.dataset.theme = S.theme; else delete document.documentElement.dataset.theme }, [S.theme])
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])
  useEffect(() => { const f = () => { const h = location.hash.slice(1) as View; if (VIEWS.includes(h)) setView(h) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  const go = (v: View) => { setView(v); location.hash = v; if (!wide()) setOpen(false) }
  const toast = (kind: ToastT['kind'], title: string, msg?: string) => { const id = Date.now() + Math.random(); setToasts(t => [...t, { id, kind, title, msg }]); setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 7000) }
  const flashIt = (mood: Mood, msg: string, act?: Act) => { setFlash({ mood, msg, act }); window.clearTimeout(ft.current); ft.current = window.setTimeout(() => setFlash(null), 6000) }
  const addTx = (type: Kind, amt: number, note: string, date: string) => {
    if (type === 'out' && c.tin === 0) {
      toast('warn', 'Add your money in first', 'You can’t record money out until you’ve added some money in. Add what you have now, such as salary, cash or savings, then record what you spend.')
      flashIt('surprised', `${S.name || 'Friend'}, you haven’t added any money in yet. Add some first, then I can track what you spend.`)
      return false
    }
    const next = { ...S, tx: [...S.tx, { id: Date.now(), type, amt, note, date }] }
    setS(next)
    const n = calc(next, now)
    if (type === 'in') { flashIt('excited', `Yay, money in, ${S.name || 'friend'}! ${fmt(amt)} added. Your balance is ${fmt(n.bal)}.`); toast('ok', 'Money in added', `${fmt(amt)} added. Your balance is ${fmt(n.bal)}.`) }
    else if (n.bal < 0) toast('err', 'Balance is below zero', `You’ve spent ${fmt(-n.bal)} more than you have. Check your entries or add money in.`)
    else if (n.lim > 0 && n.spent > n.lim) toast('warn', 'Over today’s limit', `You’re ${fmt(n.spent - n.lim)} over your daily limit.`)
    else if (n.off != null && n.off <= 2) toast('warn', 'Money is running low', `At your daily limit, your money lasts ${n.off + 1} more day${n.off ? 's' : ''}.`)
    else toast('ok', 'Money out added', `${fmt(amt)} recorded.`)
    return true
  }
  const h = now.getHours(), T: Record<View, [string, string]> = {
    dashboard: [`Good ${h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'}${S.name ? ', ' + S.name : ''}`, 'Here’s where your money stands today.'],
    transactions: ['Transactions', 'Everything you’ve added, day by day.'],
    preferences: ['Preferences', 'Your daily limit, name and currency.'],
  }
  const dark = S.theme ? S.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches
  return (
    <div className="shell">
      <div className={'railwrap' + (open ? ' open' : '')}>
        <nav className="rail" aria-label="Main">
          <div className="logo"><img src="/icons/icon-192.png" alt="" /><span className="lbl">Money Cat</span></div>
          <button className="burger" type="button" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)}><svg className="i" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg><span className="lbl">Menu</span></button>
          {NAV.map(n => <button key={n.v} type="button" className="n" aria-current={view === n.v ? 'page' : undefined} onClick={() => go(n.v)}><svg className="i" viewBox="0 0 24 24">{n.icon}</svg><span className="lbl">{n.label}</span></button>)}
        </nav>
        <div className="scrim" onClick={() => setOpen(false)} />
      </div>
      <main className="main">
        <div className="top"><div><h1>{T[view][0]}</h1><p className="sub">{T[view][1]}</p></div>
          <button className="chip" type="button" onClick={() => update({ theme: dark ? 'light' : 'dark' })}>{dark ? 'Light mode' : 'Dark mode'}</button></div>
        {view === 'dashboard' && <Dashboard S={S} c={c} now={now} fmt={fmt} flash={flash} flashIt={flashIt} addTx={addTx} go={go} update={update} />}
        {view === 'transactions' && <Transactions S={S} c={c} fmt={fmt} setS={setS} toast={toast} />}
        {view === 'preferences' && <Prefs S={S} update={update} toast={toast} />}
      </main>
      <div className="toasts" aria-live="polite">{toasts.map(t => <div key={t.id} className={'toast ' + t.kind} role={t.kind === 'ok' ? 'status' : 'alert'} onClick={() => setToasts(a => a.filter(x => x.id !== t.id))}><b>{t.title}</b>{t.msg && <span>{t.msg}</span>}</div>)}</div>
      <UpdatePrompt />
    </div>
  )
}
