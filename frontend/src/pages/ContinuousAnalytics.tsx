import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell
} from 'recharts'
import api from '../api/client'
import WordCloud from '../components/WordCloud'

const PALETTE = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']

type GroupBy = 'day' | 'week' | 'month'

const GROUP_LABELS: Record<GroupBy, string> = { day: 'Día', week: 'Semana', month: 'Mes' }

interface QuestionTrend {
  question: { id: string; type: string; text: string; options?: string[] }
  periodStats: {
    period: string
    label: string
    responses: number
    stats: any
  }[]
}

interface ContinuousData {
  survey: { id: string; title: string; anonymous: number }
  wave: { id: string; slug: string; status: string }
  groupBy: GroupBy
  periods: { period: string; label: string; count: number }[]
  questionTrends: QuestionTrend[]
  availablePositions: string[]
  dateRange: { minDate: string | null; maxDate: string | null }
}

function NumericTrend({ trend, groupBy }: { trend: QuestionTrend; groupBy: GroupBy }) {
  const data = trend.periodStats.map(p => ({
    name: p.label,
    promedio: p.stats?.avg ?? null,
    nps: p.stats?.nps ?? null,
    respuestas: p.responses,
  }))

  const isNPS = trend.question.type === 'nps'

  return (
    <div>
      {isNPS && (
        <div className="flex gap-6 mb-4 flex-wrap">
          {trend.periodStats.slice(-1).map(p => (
            <div key={p.period}>
              <span className="text-2xl font-bold" style={{ color: (p.stats?.nps ?? 0) >= 50 ? '#10b981' : (p.stats?.nps ?? 0) >= 0 ? '#f59e0b' : '#ef4444' }}>
                {p.stats?.nps ?? '—'}
              </span>
              <span className="text-xs text-gray-400 ml-1">NPS último período</span>
            </div>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="promedio"
            name="Promedio"
            stroke={PALETTE[0]}
            strokeWidth={2.5}
            dot={{ fill: PALETTE[0], r: 3 }}
            connectNulls
          />
          {isNPS && (
            <Line type="monotone" dataKey="nps" name="NPS" stroke={PALETTE[2]} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function DistributionTrend({ trend }: { trend: QuestionTrend }) {
  // One line per option, x = period
  const allOptions = [...new Set(
    trend.periodStats.flatMap(p => Object.keys(p.stats?.counts || {}))
  )]

  const data = trend.periodStats.map(p => {
    const total = p.stats?.total || 1
    const point: any = { name: p.label }
    allOptions.forEach(opt => {
      point[opt] = p.stats?.counts?.[opt]
        ? Math.round((p.stats.counts[opt] / total) * 100)
        : 0
    })
    return point
  })

  if (data.length === 0 || allOptions.length === 0) return <p className="text-xs text-gray-400">Sin datos</p>

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
        <Tooltip formatter={(v: any) => [`${v}%`, '']} />
        <Legend />
        {allOptions.map((opt, i) => (
          <Line
            key={opt}
            type="monotone"
            dataKey={opt}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function RankingTrend({ trend }: { trend: QuestionTrend }) {
  const allItems = [...new Set(
    trend.periodStats.flatMap(p => (p.stats?.ranked || []).map((r: any) => r.item))
  )]
  const data = trend.periodStats.map(p => {
    const point: any = { name: p.label }
    allItems.forEach(item => {
      const r = p.stats?.ranked?.find((x: any) => x.item === item)
      point[item] = r?.avgScore ?? null
    })
    return point
  })
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        {allItems.map((item, i) => (
          <Line key={item} type="monotone" dataKey={item} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function ResponsesTrend({ periods }: { periods: { label: string; count: number }[] }) {
  const data = periods.map(p => ({ name: p.label, respuestas: p.count }))
  return (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={data}>
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="respuestas" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[0]} fillOpacity={0.4 + (i / data.length) * 0.6} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function ContinuousAnalytics() {
  const { surveyId } = useParams()
  const [data, setData] = useState<ContinuousData | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>('week')
  const [positionFilter, setPositionFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ groupBy })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (positionFilter) params.set('position', positionFilter)
    api.get(`/analytics/continuous/${surveyId}?${params}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [surveyId, groupBy, from, to, positionFilter])

  const publicLink = data ? `${window.location.origin}/s/${data.wave.slug}` : ''

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link to={`/surveys/${surveyId}`} className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block">← Volver</Link>
          <h2 className="text-2xl font-bold text-gray-900">Evolución continua</h2>
          {data && <p className="text-sm text-gray-500 mt-0.5">{data.survey.title}</p>}
        </div>
        {data && (
          <button
            onClick={() => setShareOpen(v => !v)}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
          >
            Compartir enlace
          </button>
        )}
      </div>

      {/* Share popover */}
      {shareOpen && data && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <span className="text-xs font-mono text-indigo-700 flex-1 truncate">{publicLink}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(publicLink); setShareOpen(false) }}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
          >
            Copiar
          </button>
          <a href={publicLink} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">Abrir →</a>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* GroupBy */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Agrupar por</p>
            <div className="flex gap-1">
              {(['day', 'week', 'month'] as GroupBy[]).map(g => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    groupBy === g
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {GROUP_LABELS[g]}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Desde</p>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Hasta</p>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo('') }} className="text-xs text-gray-400 hover:text-gray-600 self-end pb-2">
              ✕ Limpiar fechas
            </button>
          )}

          {/* Position filter */}
          {data && data.availablePositions.length > 0 && (
            <div className="ml-auto">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Filtrar por puesto</p>
              <select
                value={positionFilter}
                onChange={e => setPositionFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Todos</option>
                {data.availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Active filters */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {positionFilter && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              Puesto: {positionFilter}
              <button onClick={() => setPositionFilter('')} className="font-bold leading-none hover:text-indigo-900">×</button>
            </span>
          )}
          {data?.dateRange?.minDate && !from && !to && (
            <span className="text-xs text-gray-400">
              Datos disponibles: {data.dateRange.minDate} — {data.dateRange.maxDate}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Calculando...</div>
      ) : !data || data.periods.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="mb-2">Sin respuestas todavía</p>
          {data && (
            <p className="text-sm">
              Comparte el enlace:{' '}
              <a href={publicLink} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-mono text-xs">{publicLink}</a>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Participation over time */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">Respuestas por {GROUP_LABELS[groupBy].toLowerCase()}</h3>
              <span className="text-sm text-gray-500">
                Total: <span className="font-bold text-gray-900">{data.periods.reduce((s, p) => s + Number(p.count), 0)}</span>
              </span>
            </div>
            <ResponsesTrend periods={data.periods} />
          </div>

          {/* Per question */}
          {data.questionTrends.map(trend => (
            <div key={trend.question.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="font-medium text-gray-900 mb-4">{trend.question.text}</p>

              {['likert', 'nps', 'rating'].includes(trend.question.type) && (
                <NumericTrend trend={trend} groupBy={groupBy} />
              )}

              {['multiple_choice', 'yes_no', 'multiple_select'].includes(trend.question.type) && (
                <DistributionTrend trend={trend} />
              )}

              {trend.question.type === 'ranking' && (
                <RankingTrend trend={trend} />
              )}

              {trend.question.type === 'text' && (
                <WordCloud responses={trend.periodStats.flatMap(p => p.stats?.responses || [])} />
              )}

              {/* Mini participation per period */}
              <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                {trend.periodStats.map(p => (
                  <span key={p.period} className="text-xs text-gray-400">
                    {p.label}: <span className="text-gray-600 font-medium">{p.responses}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
