import { useEffect, useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import api from '../api/client'
import WordCloud from '../components/WordCloud'

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']

interface Wave {
  id: string
  name: string
  status: string
  response_count: number
}

interface QuestionStats {
  question: { id: string; type: string; text: string }
  stats: any
  answered: number
  skipped: number
}

interface WaveStats {
  wave: Wave
  survey: { title: string; anonymous: number }
  totalResponses: number
  totalParticipants: number
  participationRate: number | null
  availablePositions: string[]
  questionStats: QuestionStats[]
}

function DistributionChart({ stats }: { stats: any }) {
  const data = Object.entries(stats.counts as Record<string, number>).map(([name, value]) => ({ name, value }))
  if (data.length === 0) return <p className="text-xs text-gray-400">Sin datos</p>
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any) => [`${v} resp.`, '']} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function NumericChart({ stats, qType }: { stats: any; qType: string }) {
  const data = Object.entries(stats.counts as Record<string, number>)
    .map(([name, value]) => ({ name: String(name), value }))
    .sort((a, b) => Number(a.name) - Number(b.name))

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-3 flex-wrap">
        {qType === 'nps' && stats.nps !== null ? (
          <>
            <div>
              <span className="text-3xl font-bold" style={{ color: stats.nps >= 50 ? '#10b981' : stats.nps >= 0 ? '#f59e0b' : '#ef4444' }}>
                {stats.nps}
              </span>
              <span className="text-sm text-gray-400 ml-1">NPS</span>
            </div>
            <div>
              <span className="text-2xl font-semibold text-gray-700">{stats.avg}</span>
              <span className="text-sm text-gray-400 ml-1">promedio</span>
            </div>
          </>
        ) : (
          <div>
            <span className="text-3xl font-bold text-indigo-600">{stats.avg}</span>
            <span className="text-sm text-gray-400 ml-1">promedio de {stats.total} respuestas</span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: any) => [`${v} resp.`, '']} />
          <Bar dataKey="value" fill="#6366f1" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function QuestionCard({ qs }: { qs: QuestionStats }) {
  const { question: q, stats, answered, skipped } = qs
  const pct = answered + skipped > 0 ? Math.round((answered / (answered + skipped)) * 100) : 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="font-medium text-gray-900 mb-1">{q.text}</p>
      <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
        <span>{answered} respuestas ({pct}%)</span>
        {skipped > 0 && <span className="text-amber-500">{skipped} omitidas</span>}
      </div>

      {stats.type === 'distribution' && <DistributionChart stats={stats} />}
      {stats.type === 'numeric' && <NumericChart stats={stats} qType={q.type} />}

      {stats.type === 'ranking' && (
        <div className="space-y-1.5">
          {stats.ranked.map((r: any, i: number) => (
            <div key={r.item} className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 w-5">{i+1}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${Math.min((r.avgScore / (stats.ranked[0]?.avgScore || 1)) * 100, 100)}%` }} />
              </div>
              <span className="text-sm text-gray-700 w-36 truncate">{r.item}</span>
              <span className="text-xs text-gray-400">{r.avgScore.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {stats.type === 'text' && <WordCloud responses={stats.responses} />}
    </div>
  )
}

export default function WaveAnalytics() {
  const { surveyId } = useParams()
  const location = useLocation()
  const [waves, setWaves] = useState<Wave[]>([])
  const [selectedWaveId, setSelectedWaveId] = useState<string>(location.state?.waveId || '')
  const [stats, setStats] = useState<WaveStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [positionFilter, setPositionFilter] = useState<string>('')

  useEffect(() => {
    api.get(`/waves/survey/${surveyId}`).then(r => {
      setWaves(r.data)
      if (!selectedWaveId && r.data.length > 0) setSelectedWaveId(r.data[0].id)
    })
  }, [surveyId])

  useEffect(() => {
    if (!selectedWaveId) return
    setLoading(true)
    const url = positionFilter
      ? `/analytics/wave/${selectedWaveId}?position=${encodeURIComponent(positionFilter)}`
      : `/analytics/wave/${selectedWaveId}`
    api.get(url).then(r => setStats(r.data)).finally(() => setLoading(false))
  }, [selectedWaveId, positionFilter])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to={`/surveys/${surveyId}`} className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block">← Volver</Link>
          <h2 className="text-2xl font-bold text-gray-900">Analítica</h2>
        </div>
        {waves.length >= 2 && (
          <Link to={`/surveys/${surveyId}/compare`} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
            Comparar oleadas
          </Link>
        )}
      </div>

      {/* Wave selector + position filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex gap-2 flex-wrap flex-1">
          {waves.map(w => (
            <button
              key={w.id}
              onClick={() => { setSelectedWaveId(w.id); setPositionFilter('') }}
              className={`text-sm px-3 py-1.5 rounded-lg transition ${
                selectedWaveId === w.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {w.name}
              <span className="ml-1.5 text-xs opacity-70">{w.response_count}</span>
            </button>
          ))}
        </div>
        {/* Position filter — only shown when positions exist */}
        {stats && stats.availablePositions?.length > 0 && (
          <select
            value={positionFilter}
            onChange={e => setPositionFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">Todos los puestos</option>
            {stats.availablePositions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
      </div>

      {/* Active filter badge */}
      {positionFilter && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            Puesto: {positionFilter}
            <button onClick={() => setPositionFilter('')} className="hover:text-indigo-900 font-bold leading-none">×</button>
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">Cargando...</div>
      ) : stats ? (
        <>
          {/* Summary header */}
          <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3">
            {/* Total responses */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-3xl font-bold text-indigo-700">{stats.totalResponses}</p>
              <p className="text-xs text-indigo-400 mt-0.5">respuestas</p>
            </div>

            {/* Participation rate — only if there's an email list */}
            {stats.participationRate !== null && (
              <div className={`rounded-xl p-4 border ${
                stats.participationRate >= 75 ? 'bg-green-50 border-green-100' :
                stats.participationRate >= 40 ? 'bg-amber-50 border-amber-100' :
                'bg-red-50 border-red-100'
              }`}>
                <div className="flex items-baseline gap-1">
                  <p className={`text-3xl font-bold ${
                    stats.participationRate >= 75 ? 'text-green-700' :
                    stats.participationRate >= 40 ? 'text-amber-700' : 'text-red-600'
                  }`}>{stats.participationRate}%</p>
                </div>
                <p className={`text-xs mt-0.5 ${
                  stats.participationRate >= 75 ? 'text-green-500' :
                  stats.participationRate >= 40 ? 'text-amber-500' : 'text-red-400'
                }`}>
                  participación ({stats.totalResponses}/{stats.totalParticipants})
                </p>
                {/* Progress bar */}
                <div className="mt-2 bg-white/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${
                      stats.participationRate >= 75 ? 'bg-green-500' :
                      stats.participationRate >= 40 ? 'bg-amber-500' : 'bg-red-400'
                    }`}
                    style={{ width: `${stats.participationRate}%` }}
                  />
                </div>
              </div>
            )}

            {/* Pending — only if email list */}
            {stats.participationRate !== null && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <p className="text-3xl font-bold text-gray-500">
                  {stats.totalParticipants - stats.totalResponses}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">pendientes de responder</p>
              </div>
            )}
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {stats.questionStats.map(qs => <QuestionCard key={qs.question.id} qs={qs} />)}
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-gray-400">Selecciona una oleada</div>
      )}
    </div>
  )
}
