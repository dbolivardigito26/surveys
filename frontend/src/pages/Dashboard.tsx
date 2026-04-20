import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

interface Survey {
  id: string
  title: string
  description: string
  anonymous: number
  measurement_type: string
  wave_count: number
  creator_name: string
  created_at: string
}

const MTYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  waves: 'Por oleadas',
  continuous: 'Continua',
}

const MTYPE_COLORS: Record<string, string> = {
  individual: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  waves: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  continuous: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

function WavesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-4 6-4 6 8 10 8 6-4 6-4"/>
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}

export default function Dashboard() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/surveys').then(r => setSurveys(r.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mis encuestas</h2>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">{surveys.length} encuesta{surveys.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          to="/surveys/new"
          className="flex items-center gap-2 bg-[#4D0FC1] hover:bg-[#3d0b99] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-[#4D0FC1]/25"
        >
          <PlusIcon />
          Nueva encuesta
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-400 dark:text-white/30">Cargando...</div>
      ) : surveys.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4D0FC1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>
            </svg>
          </div>
          <p className="text-gray-500 dark:text-white/40 mb-3">No hay encuestas todavía</p>
          <Link to="/surveys/new" className="text-[#4D0FC1] dark:text-indigo-400 hover:underline text-sm font-medium">
            Crea la primera →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {surveys.map(s => (
            <Link
              key={s.id}
              to={`/surveys/${s.id}`}
              className="bg-white dark:bg-[#1E1B26] rounded-2xl border border-gray-200 dark:border-white/8 hover:border-[#4D0FC1]/40 dark:hover:border-[#4D0FC1]/40 hover:shadow-xl hover:shadow-[#4D0FC1]/10 p-5 transition group block"
            >
              {/* Type badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${MTYPE_COLORS[s.measurement_type] || 'bg-gray-100 text-gray-500'}`}>
                  {MTYPE_LABELS[s.measurement_type] || s.measurement_type}
                </span>
                {s.anonymous ? (
                  <span className="text-xs text-gray-400 dark:text-white/30 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">Anónima</span>
                ) : null}
              </div>

              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-[#4D0FC1] dark:group-hover:text-indigo-400 transition leading-snug mb-1.5">
                {s.title}
              </h3>
              {s.description && (
                <p className="text-sm text-gray-500 dark:text-white/40 line-clamp-2 mb-4">{s.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-white/30 pt-3 border-t border-gray-100 dark:border-white/5">
                <span className="flex items-center gap-1.5">
                  <WavesIcon />
                  {s.wave_count} {s.wave_count === 1 ? 'oleada' : 'oleadas'}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarIcon />
                  {new Date(s.created_at).toLocaleDateString('es-ES')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
