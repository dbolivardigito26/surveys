import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '../api/client'

type QuestionType = 'multiple_choice' | 'multiple_select' | 'likert' | 'nps' | 'rating' | 'yes_no' | 'text' | 'ranking'

interface Question {
  id: string
  type: QuestionType
  text: string
  options?: string[]
  required: boolean
  order_index?: number
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'multiple_choice', label: 'Opción múltiple' },
  { value: 'multiple_select', label: 'Selección múltiple' },
  { value: 'likert', label: 'Escala Likert (1-5)' },
  { value: 'rating', label: 'Valoración (1-5)' },
  { value: 'nps', label: 'NPS (0-10)' },
  { value: 'yes_no', label: 'Sí / No' },
  { value: 'text', label: 'Texto libre' },
  { value: 'ranking', label: 'Ranking' },
]

function newQuestion(): Question {
  return { id: crypto.randomUUID(), type: 'multiple_choice', text: '', options: ['', ''], required: true }
}

function QuestionCard({ q, onChange, onDelete }: { q: Question; onChange: (q: Question) => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const needsOptions = ['multiple_choice', 'multiple_select', 'ranking'].includes(q.type)

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        {/* Drag handle */}
        <button {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500 transition" title="Reordenar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/>
            <circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/>
          </svg>
        </button>
        <select
          value={q.type}
          onChange={e => onChange({ ...q, type: e.target.value as QuestionType, options: ['multiple_choice','multiple_select','ranking'].includes(e.target.value) ? ['',''] : undefined })}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={q.required} onChange={e => onChange({ ...q, required: e.target.checked })} className="rounded" />
          Obligatoria
        </label>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-400 transition" title="Eliminar pregunta">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <input
        type="text"
        value={q.text}
        onChange={e => onChange({ ...q, text: e.target.value })}
        placeholder="Escribe la pregunta..."
        className="w-full text-sm border-0 border-b border-gray-200 pb-1 focus:outline-none focus:border-indigo-400 bg-transparent mb-3"
      />

      {q.type === 'likert' && <p className="text-xs text-gray-400">Escala del 1 (muy en desacuerdo) al 5 (muy de acuerdo)</p>}
      {q.type === 'rating' && <p className="text-xs text-gray-400">Valoración de 1 a 5 estrellas</p>}
      {q.type === 'nps' && <p className="text-xs text-gray-400">¿Con qué probabilidad recomendarías? (0-10)</p>}
      {q.type === 'yes_no' && <p className="text-xs text-gray-400">Respuesta: Sí / No</p>}
      {q.type === 'text' && <p className="text-xs text-gray-400">Respuesta de texto libre</p>}

      {needsOptions && (
        <div className="space-y-1 mt-1">
          {(q.options || []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-gray-300 text-sm">•</span>
              <input
                type="text"
                value={opt}
                onChange={e => { const o = [...(q.options||[])]; o[i] = e.target.value; onChange({ ...q, options: o }) }}
                placeholder={`Opción ${i + 1}`}
                className="flex-1 text-sm border-0 border-b border-gray-100 focus:outline-none focus:border-indigo-300 bg-transparent py-0.5"
              />
              {(q.options||[]).length > 2 && (
                <button onClick={() => { const o = (q.options||[]).filter((_, j) => j !== i); onChange({ ...q, options: o }) }} className="text-gray-300 hover:text-red-400 transition" title="Eliminar opción">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
          ))}
          <button onClick={() => onChange({ ...q, options: [...(q.options||[]), ''] })} className="text-xs text-indigo-500 hover:underline mt-1">+ Añadir opción</button>
        </div>
      )}
    </div>
  )
}

export default function SurveyBuilder() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [measurementType, setMeasurementType] = useState<'individual' | 'waves' | 'continuous'>('waves')
  const [questions, setQuestions] = useState<Question[]>([newQuestion()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEdit) {
      api.get(`/surveys/${id}`).then(r => {
        setTitle(r.data.title)
        setDescription(r.data.description || '')
        setAnonymous(Boolean(r.data.anonymous))
        setMeasurementType(r.data.measurement_type || 'waves')
        setQuestions(r.data.questions.length ? r.data.questions.map((q: any) => ({ ...q, required: Boolean(q.required) })) : [newQuestion()])
      })
    }
  }, [id])

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (over && active.id !== over.id) {
      setQuestions(qs => {
        const from = qs.findIndex(q => q.id === active.id)
        const to = qs.findIndex(q => q.id === over.id)
        return arrayMove(qs, from, to)
      })
    }
  }

  async function handleSave() {
    if (!title.trim()) return setError('El título es obligatorio')
    const validQuestions = questions.filter(q => q.text.trim())
    if (validQuestions.length === 0) return setError('Añade al menos una pregunta')
    setError('')
    setSaving(true)
    try {
      const payload = { title, description, anonymous, measurement_type: measurementType, questions: validQuestions }
      if (isEdit) {
        await api.put(`/surveys/${id}`, payload)
      } else {
        const { data } = await api.post('/surveys', payload)
        navigate(`/surveys/${data.id}`)
        return
      }
      navigate(`/surveys/${id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{isEdit ? 'Editar encuesta' : 'Nueva encuesta'}</h2>
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ej: Satisfacción del equipo Q1 2026"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Descripción opcional..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
        {/* Measurement type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de medición *</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              {
                value: 'individual',
                label: 'Individual',
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4"/>
                  </svg>
                ),
                desc: 'Una sola aplicación. Se recogen respuestas durante un período y se cierra.',
              },
              {
                value: 'waves',
                label: 'Por oleadas',
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-4 6-4 6 8 10 8 6-4 6-4"/>
                  </svg>
                ),
                desc: 'Se repite en el tiempo (ej. cada 6 meses). Permite comparar resultados entre oleadas.',
              },
              {
                value: 'continuous',
                label: 'Continua',
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
                  </svg>
                ),
                desc: 'Siempre abierta. Los resultados se analizan agrupando por día, semana o mes.',
              },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMeasurementType(opt.value)}
                className={`text-left p-3 rounded-xl border-2 transition ${
                  measurementType === opt.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className={`mb-2 ${measurementType === opt.value ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {opt.icon}
                </div>
                <div className={`text-sm font-semibold mb-1 ${measurementType === opt.value ? 'text-indigo-700' : 'text-gray-800'}`}>
                  {opt.label}
                </div>
                <div className="text-xs text-gray-500 leading-snug">{opt.desc}</div>
              </button>
            ))}
          </div>
          {measurementType === 'continuous' && (
            <p className="text-xs text-indigo-600 mt-2 bg-indigo-50 rounded-lg px-3 py-2">
              Se creará automáticamente un enlace permanente al guardar. En el panel de resultados podrás elegir agrupar por día, semana o mes.
            </p>
          )}
        </div>

        {/* Response type */}
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-gray-700">Tipo de respuesta</span>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={anonymous} onChange={() => setAnonymous(true)} />
            Anónima
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={!anonymous} onChange={() => setAnonymous(false)} />
            Identificada (requiere email)
          </label>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
            {questions.map(q => (
              <QuestionCard
                key={q.id}
                q={q}
                onChange={updated => setQuestions(qs => qs.map(x => x.id === updated.id ? updated : x))}
                onDelete={() => setQuestions(qs => qs.filter(x => x.id !== q.id))}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <button
        onClick={() => setQuestions(qs => [...qs, newQuestion()])}
        className="w-full border-2 border-dashed border-gray-200 hover:border-indigo-300 text-gray-400 hover:text-indigo-500 rounded-xl py-3 text-sm transition mb-6"
      >
        + Añadir pregunta
      </button>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition"
      >
        {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear encuesta'}
      </button>
    </div>
  )
}
