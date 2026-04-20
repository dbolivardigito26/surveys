import { useEffect, useState, FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import api from '../api/client'

interface Question {
  id: string
  type: string
  text: string
  options?: string[]
  required: boolean
}

interface WaveData {
  wave: { id: string; name: string }
  survey: { title: string; description: string; anonymous: number }
  questions: Question[]
  participant?: { email: string; name: string | null; token: string } | null
}

function StarRating({ value, onChange, max = 5 }: { value: number; onChange: (v: number) => void; max?: number }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map(i => (
        <button key={i} type="button"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className={`text-2xl transition ${i <= (hover || value) ? 'text-yellow-400' : 'text-gray-200'}`}
        >★</button>
      ))}
    </div>
  )
}

function NPSScale({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: 11 }, (_, i) => i).map(i => (
          <button key={i} type="button"
            onClick={() => onChange(i)}
            className={`w-10 h-10 rounded-lg text-sm font-medium transition ${value === i ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-indigo-100 text-gray-700'}`}
          >{i}</button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>Muy improbable</span>
        <span>Muy probable</span>
      </div>
    </div>
  )
}

function LikertScale({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const labels = ['', 'Muy en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Muy de acuerdo']
  return (
    <div className="flex gap-2 flex-wrap">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button"
          onClick={() => onChange(i)}
          className={`flex-1 min-w-[80px] py-2 px-1 rounded-lg text-xs text-center transition ${value === i ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-indigo-100 text-gray-700'}`}
        >
          <div className="font-bold text-lg leading-none mb-1">{i}</div>
          <div>{labels[i]}</div>
        </button>
      ))}
    </div>
  )
}

export default function PublicSurvey() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [data, setData] = useState<WaveData | null>(null)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // Gateway state for identified surveys (no token)
  const [identified, setIdentified] = useState(false)
  const [gatewayEmail, setGatewayEmail] = useState('')
  const [gatewayName, setGatewayName] = useState('')

  useEffect(() => {
    const url = token ? `/waves/public/${slug}?token=${token}` : `/waves/public/${slug}`
    api.get(url).then(r => {
      setData(r.data)
      // If participant resolved via token, pre-fill
      if (r.data.participant) {
        setEmail(r.data.participant.email)
        setName(r.data.participant.name || '')
        setIdentified(true)
      }
    }).catch(err => {
      setError(err.response?.data?.error || 'Encuesta no disponible')
    })
  }, [slug, token])

  function setAnswer(qId: string, value: any) {
    setAnswers(prev => ({ ...prev, [qId]: value }))
  }

  function toggleMultiSelect(qId: string, option: string) {
    setAnswers(prev => {
      const current: string[] = prev[qId] || []
      return { ...prev, [qId]: current.includes(option) ? current.filter(x => x !== option) : [...current, option] }
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError('')

    // Validate required
    const missing = data!.questions.filter(q => q.required && (answers[q.id] === undefined || answers[q.id] === '' || (Array.isArray(answers[q.id]) && answers[q.id].length === 0)))
    if (missing.length > 0) {
      setSubmitError(`Por favor responde todas las preguntas obligatorias (${missing.length} pendiente${missing.length > 1 ? 's' : ''})`)
      return
    }

    setSubmitting(true)
    try {
      await api.post('/responses/public', {
        wave_id: data!.wave.id,
        respondent_email: email || undefined,
        respondent_name: name || undefined,
        participant_token: data!.participant?.token || undefined,
        answers
      })
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Error al enviar')
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
        <p className="text-gray-500">{error}</p>
      </div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Cargando...</p>
    </div>
  )

  // Gateway for identified surveys without a personal token
  if (!data.survey.anonymous && !identified && !data.participant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
          <h1 className="text-xl font-bold text-gray-900 mb-1">{data.survey.title}</h1>
          <p className="text-xs text-indigo-600 mb-6">{data.wave.name}</p>
          <p className="text-sm text-gray-600 mb-4">Esta encuesta requiere identificación antes de continuar.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={gatewayEmail}
                onChange={e => setGatewayEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={gatewayName}
                onChange={e => setGatewayName(e.target.value)}
                placeholder="Tu nombre (opcional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              disabled={!gatewayEmail.includes('@')}
              onClick={() => { setEmail(gatewayEmail); setName(gatewayName); setIdentified(true) }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">¡Gracias!</h2>
        <p className="text-gray-500 text-sm">Tu respuesta ha sido registrada correctamente.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{data.survey.title}</h1>
          {data.survey.description && <p className="text-gray-500 text-sm">{data.survey.description}</p>}
          <p className="text-xs text-indigo-600 mt-2">{data.wave.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!data.survey.anonymous && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <div>
                <p className="text-sm font-medium text-amber-800">Respondiendo como</p>
                <p className="text-sm text-amber-700">{name ? `${name} (${email})` : email}</p>
              </div>
            </div>
          )}

          {data.questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-2xl shadow-sm p-6">
              <p className="font-medium text-gray-900 mb-1">
                {idx + 1}. {q.text}
                {q.required && <span className="text-red-400 ml-1">*</span>}
              </p>

              {q.type === 'multiple_choice' && q.options && (
                <div className="space-y-2 mt-3">
                  {q.options.filter(Boolean).map(opt => (
                    <label key={opt} className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={() => setAnswer(q.id, opt)} className="text-indigo-600" />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'multiple_select' && q.options && (
                <div className="space-y-2 mt-3">
                  {q.options.filter(Boolean).map(opt => (
                    <label key={opt} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={(answers[q.id] || []).includes(opt)} onChange={() => toggleMultiSelect(q.id, opt)} className="text-indigo-600 rounded" />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === 'yes_no' && (
                <div className="flex gap-3 mt-3">
                  {['Sí', 'No'].map(opt => (
                    <button key={opt} type="button" onClick={() => setAnswer(q.id, opt)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${answers[q.id] === opt ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-indigo-100 text-gray-700'}`}
                    >{opt}</button>
                  ))}
                </div>
              )}

              {q.type === 'likert' && (
                <div className="mt-3">
                  <LikertScale value={answers[q.id] ?? null} onChange={v => setAnswer(q.id, v)} />
                </div>
              )}

              {q.type === 'rating' && (
                <div className="mt-3">
                  <StarRating value={answers[q.id] ?? 0} onChange={v => setAnswer(q.id, v)} />
                </div>
              )}

              {q.type === 'nps' && (
                <div className="mt-3">
                  <NPSScale value={answers[q.id] ?? null} onChange={v => setAnswer(q.id, v)} />
                </div>
              )}

              {q.type === 'text' && (
                <textarea
                  value={answers[q.id] || ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  rows={3}
                  placeholder="Escribe tu respuesta..."
                  className="w-full mt-3 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              )}

              {q.type === 'ranking' && q.options && (
                <div className="mt-3 space-y-1 text-sm text-gray-500">
                  <p className="text-xs text-gray-400 mb-2">Ordena las opciones de mayor a menor preferencia</p>
                  {(answers[q.id] || q.options.filter(Boolean)).map((opt: string, i: number) => (
                    <div key={opt} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-400 w-5">{i+1}.</span>
                      <span className="flex-1">{opt}</span>
                      <div className="flex flex-col gap-0.5">
                        <button type="button" disabled={i === 0} onClick={() => {
                          const arr = [...(answers[q.id] || (q.options ?? []).filter(Boolean))];
                          [arr[i-1], arr[i]] = [arr[i], arr[i-1]];
                          setAnswer(q.id, arr)
                        }} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none">▲</button>
                        <button type="button" disabled={i === (answers[q.id] || (q.options ?? []).filter(Boolean)).length - 1} onClick={() => {
                          const arr = [...(answers[q.id] || (q.options ?? []).filter(Boolean))];
                          [arr[i], arr[i+1]] = [arr[i+1], arr[i]];
                          setAnswer(q.id, arr)
                        }} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none">▼</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {submitError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl text-sm transition"
          >
            {submitting ? 'Enviando...' : 'Enviar respuestas'}
          </button>
        </form>
      </div>
    </div>
  )
}
