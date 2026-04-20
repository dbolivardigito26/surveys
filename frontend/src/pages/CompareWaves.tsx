import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line, CartesianGrid
} from 'recharts'
import api from '../api/client'
import WordCloud from '../components/WordCloud'

const PALETTE = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6']

interface Wave { id: string; name: string; status: string }

type ChartPref = 'bar' | 'line'

export default function CompareWaves() {
  const { surveyId } = useParams()
  const [waves, setWaves] = useState<Wave[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [comparison, setComparison] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [chartPrefs, setChartPrefs] = useState<Record<string, ChartPref>>({})
  const [positionFilter, setPositionFilter] = useState<string>('')

  useEffect(() => {
    // waves come DESC from API (newest first)
    api.get(`/waves/survey/${surveyId}`).then(r => {
      setWaves(r.data)
      setSelected(r.data.slice(0, 5).map((x: Wave) => x.id))
    })
  }, [surveyId])

  useEffect(() => {
    if (selected.length < 2) { setComparison(null); return }
    setLoading(true)
    api.post('/analytics/compare', {
      wave_ids: selected,
      position: positionFilter || undefined
    })
      .then(r => setComparison(r.data))
      .finally(() => setLoading(false))
  }, [selected, positionFilter])

  function toggleWave(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function setChartPref(qId: string, pref: ChartPref) {
    setChartPrefs(p => ({ ...p, [qId]: pref }))
  }

  function renderNumericComparison(item: any, pref: ChartPref) {
    const waveData: any[] = item.waveData // already reversed by renderComparison
    const q = item.question

    const chartData = waveData.map((wd: any) => ({
      name: wd.wave.name,
      promedio: wd.stats?.avg ?? 0,
      ...(q.type === 'nps' ? { nps: wd.stats?.nps ?? 0 } : {})
    }))

    const delta = chartData.length >= 2
      ? (chartData[chartData.length - 1].promedio - chartData[0].promedio).toFixed(2)
      : null

    const deltaNum = delta !== null ? Number(delta) : 0

    return (
      <div>
        {/* KPI row */}
        <div className="flex items-start gap-6 mb-4 flex-wrap">
          {chartData.map((d: any, i: number) => (
            <div key={d.name} className="text-center">
              <p className="text-2xl font-bold" style={{ color: PALETTE[i] }}>{d.promedio}</p>
              {q.type === 'nps' && <p className="text-xs font-medium" style={{ color: PALETTE[i] }}>NPS: {d.nps}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{d.name}</p>
            </div>
          ))}
          {delta !== null && (
            <div className={`ml-auto self-center inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full ${
              deltaNum > 0 ? 'bg-green-100 text-green-700' :
              deltaNum < 0 ? 'bg-red-100 text-red-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              {deltaNum > 0 ? '▲' : deltaNum < 0 ? '▼' : '='}{' '}
              {deltaNum > 0 ? '+' : ''}{delta} vs primera
            </div>
          )}
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={140}>
          {pref === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="promedio" stroke={PALETTE[0]} strokeWidth={2.5} dot={{ fill: PALETTE[0], r: 5 }} />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="promedio" radius={[4,4,0,0]}>
                {chartData.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i]} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  function renderDistributionComparison(item: any, pref: ChartPref) {
    const waveData: any[] = item.waveData // already reversed by renderComparison
    const allOptions = Array.from(new Set(waveData.flatMap((wd: any) => Object.keys(wd.stats?.counts || {}))))

    if (pref === 'line') {
      // For line: one line per option, x axis = waves
      const lineData = waveData.map((wd: any) => {
        const total = wd.stats?.total || 1
        const point: any = { name: wd.wave.name }
        allOptions.forEach(opt => {
          point[opt] = wd.stats?.counts?.[opt] ? Math.round((wd.stats.counts[opt] / total) * 100) : 0
        })
        return point
      })
      return (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => [`${v}%`, '']} />
            <Legend />
            {allOptions.map((opt, i) => (
              <Line key={opt} type="monotone" dataKey={opt} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 4 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )
    }

    // Bar vertical (default) — options on X axis, one bar per wave
    const barData = allOptions.map(opt => {
      const point: any = { name: opt }
      waveData.forEach((wd: any) => {
        const total = wd.stats?.total || 1
        point[wd.wave.name] = wd.stats?.counts?.[opt] ? Math.round((wd.stats.counts[opt] / total) * 100) : 0
      })
      return point
    })
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: any) => [`${v}%`, '']} />
          <Legend />
          {waveData.map((wd: any, i: number) => (
            <Bar key={wd.wave.id} dataKey={wd.wave.name} fill={PALETTE[i]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  function renderComparison(item: any) {
    const q = item.question
    const waveData: any[] = [...item.waveData].reverse() // oldest left → newest right
    const pref: ChartPref = chartPrefs[q.id] || 'bar'

    // Chart type selector — shown for numeric & distribution questions
    const canToggle = ['multiple_choice','multiple_select','yes_no','likert','nps','rating'].includes(q.type)

    const ChartToggle = canToggle ? (
      <div className="flex items-center gap-1 ml-auto">
        <span className="text-xs text-gray-400 mr-1">Tipo:</span>
        <button
          onClick={() => setChartPref(q.id, 'bar')}
          title="Barras"
          className={`px-2 py-0.5 text-xs rounded transition ${pref === 'bar' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          Barras
        </button>
        <button
          onClick={() => setChartPref(q.id, 'line')}
          title="Línea"
          className={`px-2 py-0.5 text-xs rounded transition ${pref === 'line' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          Línea
        </button>
      </div>
    ) : null

    if (q.type === 'text') {
      const allResponses = waveData.flatMap((wd: any) => wd.stats?.responses || [])
      return (
        <div>
          <div className="flex items-center gap-2 mb-3">
            {waveData.map((wd: any, i: number) => (
              <span key={wd.wave.id} className="text-xs text-gray-400">
                <span style={{ color: PALETTE[i] }}>●</span> {wd.wave.name}: {wd.answered} resp.
              </span>
            ))}
          </div>
          <WordCloud responses={allResponses} />
        </div>
      )
    }

    if (['multiple_choice','multiple_select','yes_no'].includes(q.type)) {
      return (
        <div>
          <div className="flex items-center mb-3">{ChartToggle}</div>
          {renderDistributionComparison({ ...item, waveData }, pref)}
        </div>
      )
    }

    if (['likert','nps','rating'].includes(q.type)) {
      return (
        <div>
          <div className="flex items-center mb-2">{ChartToggle}</div>
          {renderNumericComparison({ ...item, waveData }, pref)}
        </div>
      )
    }

    if (q.type === 'ranking') {
      const allItems = Array.from(new Set(waveData.flatMap((wd: any) => (wd.stats?.ranked || []).map((r: any) => r.item))))
      const radarData = allItems.map(item => {
        const point: any = { item }
        waveData.forEach((wd: any) => {
          const r = wd.stats?.ranked?.find((x: any) => x.item === item)
          point[wd.wave.name] = r?.avgScore ?? 0
        })
        return point
      })
      return (
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="item" tick={{ fontSize: 10 }} />
            {waveData.map((wd: any, i: number) => (
              <Radar key={wd.wave.id} name={wd.wave.name} dataKey={wd.wave.name}
                stroke={PALETTE[i]} fill={PALETTE[i]} fillOpacity={0.2} />
            ))}
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      )
    }

    return <p className="text-xs text-gray-400">Tipo no soportado</p>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to={`/surveys/${surveyId}`} className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block">← Volver</Link>
          <h2 className="text-2xl font-bold text-gray-900">Comparar oleadas</h2>
        </div>
        <Link to={`/surveys/${surveyId}/analytics`}
          className="text-sm border border-gray-200 hover:border-indigo-300 rounded-lg px-3 py-1.5 text-gray-600 hover:text-indigo-600 transition">
          Ver oleada individual
        </Link>
      </div>

      {/* Wave selector + position filter */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-medium text-gray-700">Oleadas a comparar:</p>
          {/* Position filter — shown when positions available */}
          {comparison?.availablePositions?.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Filtrar por puesto:</span>
              <select
                value={positionFilter}
                onChange={e => setPositionFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Todos</option>
                {comparison.availablePositions.map((p: string) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {positionFilter && (
                <button onClick={() => setPositionFilter('')}
                  className="text-xs text-gray-400 hover:text-gray-600">✕ Limpiar</button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {waves.map((w, i) => (
            <button key={w.id} onClick={() => toggleWave(w.id)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition ${
                selected.includes(w.id)
                  ? 'border-transparent text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              style={selected.includes(w.id) ? { background: PALETTE[waves.findIndex(x => x.id === w.id) % PALETTE.length] } : {}}
            >
              {w.name}
            </button>
          ))}
        </div>
        {selected.length < 2 && (
          <p className="text-xs text-amber-600">Selecciona al menos 2 oleadas</p>
        )}

        {positionFilter && (
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              Puesto: {positionFilter}
              <button onClick={() => setPositionFilter('')} className="hover:text-indigo-900 font-bold leading-none">×</button>
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Calculando...</div>
      ) : comparison ? (
        <div className="space-y-4">

          {/* Participation trend — shown here in compare view */}
          {(() => {
            const wavesAsc = [...comparison.waves].reverse() // oldest left → newest right
            return (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Evolución de participación</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Absolute responses */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Respuestas totales por oleada</p>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={wavesAsc.map((w: any) => ({ name: w.wave.name, respuestas: w.totalResponses }))}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="respuestas" radius={[4,4,0,0]}>
                          {wavesAsc.map((_: any, i: number) => <Cell key={i} fill={PALETTE[wavesAsc.length - 1 - i]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Participation rate if available */}
                  {wavesAsc.some((w: any) => w.participationRate !== null) && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2">% participación (vs invitados)</p>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={wavesAsc.filter((w: any) => w.participationRate !== null).map((w: any) => ({ name: w.wave.name, participacion: w.participationRate }))}>
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                          <Tooltip formatter={(v: any) => [`${v}%`, '']} />
                          <Bar dataKey="participacion" radius={[4,4,0,0]}>
                            {wavesAsc.map((_: any, i: number) => <Cell key={i} fill={PALETTE[wavesAsc.length - 1 - i]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Question comparisons */}
          {comparison.comparison.map((item: any) => {
            const waveDataAsc = [...item.waveData].reverse() // oldest → newest for footer labels
            return (
              <div key={item.question.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="font-medium text-gray-900 mb-4">{item.question.text}</p>
                {renderComparison(item)}
                <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                  {waveDataAsc.map((wd: any, i: number) => (
                    <span key={wd.wave.id} className="text-xs text-gray-400">
                      <span style={{ color: PALETTE[i] }}>●</span> {wd.wave.name}: {wd.answered} resp.
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
