import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api/client'

interface Wave {
  id: string
  name: string
  slug: string
  status: 'draft' | 'open' | 'closed'
  opens_at: string | null
  closes_at: string | null
  response_count: number
  created_at: string
}

interface Participant {
  id: string
  email: string
  name: string | null
  position: string | null
  token: string
  invited_at: string
  responded_at: string | null
}

interface Survey {
  id: string
  title: string
  description: string
  anonymous: number
  measurement_type: 'individual' | 'waves' | 'continuous'
  questions: any[]
}

const MTYPE_LABELS = { individual: 'Individual', waves: 'Por oleadas', continuous: 'Continua' }
const MTYPE_COLORS = { individual: 'bg-sky-100 text-sky-700', waves: 'bg-violet-100 text-violet-700', continuous: 'bg-emerald-100 text-emerald-700' }

const STATUS_LABELS: Record<string, string> = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' }
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  open: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-600',
}

interface Role { position: string; user_count: number }

function SharePanel({ wave, survey, onClose }: { wave: Wave; survey: Survey; onClose: () => void }) {
  const publicBase = `${window.location.origin}/s/`
  const publicLink = `${publicBase}${wave.slug}`
  const [tab, setTab] = useState<'link' | 'emails'>('link')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [knownPositions, setKnownPositions] = useState<string[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [positionInput, setPositionInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addingRole, setAddingRole] = useState(false)
  const [selectedRole, setSelectedRole] = useState('')
  const [roleMsg, setRoleMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (tab === 'emails') loadParticipants()
    api.get('/auth/positions').then(r => setKnownPositions(r.data)).catch(() => {})
    api.get('/participants/roles').then(r => setRoles(r.data)).catch(() => {})
  }, [tab])

  function loadParticipants() {
    api.get(`/participants/${wave.id}`).then(r => setParticipants(r.data))
  }

  async function addByRole() {
    if (!selectedRole) return
    setAddingRole(true)
    setRoleMsg(null)
    try {
      const { data } = await api.post(`/participants/${wave.id}/from-role`, { position: selectedRole })
      setRoleMsg(data.added > 0
        ? `✓ ${data.added} de ${data.total} usuario${data.total !== 1 ? 's' : ''} agregado${data.added !== 1 ? 's' : ''}`
        : `Todos los usuarios de "${selectedRole}" ya estaban en la lista`)
      setSelectedRole('')
      loadParticipants()
    } catch (err: any) {
      setRoleMsg(err.response?.data?.error || 'Error al agregar por puesto')
    } finally {
      setAddingRole(false)
    }
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isSingleEmail = emailInput.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@')).length <= 1

  async function addParticipants() {
    const emails = emailInput.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'))
    if (emails.length === 0) return
    setAdding(true)
    try {
      const payload = emails.map(email => ({
        email,
        name: isSingleEmail ? nameInput || undefined : undefined,
        position: positionInput || undefined
      }))
      await api.post(`/participants/${wave.id}`, { participants: payload })
      setEmailInput(''); setNameInput(''); setPositionInput('')
      loadParticipants()
    } finally {
      setAdding(false)
    }
  }

  async function removeParticipant(pid: string) {
    await api.delete(`/participants/${wave.id}/${pid}`)
    loadParticipants()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">Compartir oleada</h3>
            <p className="text-xs text-gray-400 mt-0.5">{wave.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('link')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${tab === 'link' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Compartir link
          </button>
          <button
            onClick={() => setTab('emails')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${tab === 'emails' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Lista de participantes
          </button>
        </div>

        <div className="p-5">
          {tab === 'link' && (
            <div className="space-y-4">
              {survey.anonymous ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-green-800 mb-1">Encuesta anónima</p>
                  <p className="text-xs text-green-600 mb-3">Cualquiera con el enlace puede responder directamente.</p>
                  <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-600 flex-1 truncate font-mono">{publicLink}</span>
                    <button
                      onClick={() => copyLink(publicLink)}
                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md transition shrink-0"
                    >
                      {copied ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-amber-800 mb-1">Encuesta identificada</p>
                  <p className="text-xs text-amber-600 mb-3">Al acceder al enlace se pedirá nombre y email antes de ver la encuesta.</p>
                  <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-600 flex-1 truncate font-mono">{publicLink}</span>
                    <button
                      onClick={() => copyLink(publicLink)}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-md transition shrink-0"
                    >
                      {copied ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}
              <a
                href={publicLink}
                target="_blank"
                rel="noreferrer"
                className="block text-center text-xs text-indigo-500 hover:underline"
              >
                Abrir encuesta →
              </a>
            </div>
          )}

          {tab === 'emails' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Cada participante recibirá un link personalizado que los identifica automáticamente.</p>

              {/* ── Agregar por puesto ── */}
              {roles.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-indigo-700 mb-2 uppercase tracking-wide">Agregar por puesto</p>
                  <div className="flex gap-2">
                    <select
                      value={selectedRole}
                      onChange={e => { setSelectedRole(e.target.value); setRoleMsg(null) }}
                      className="flex-1 text-sm border border-indigo-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">Seleccionar puesto...</option>
                      {roles.map(r => (
                        <option key={r.position} value={r.position}>
                          {r.position} ({r.user_count} usuario{r.user_count !== 1 ? 's' : ''})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={addByRole}
                      disabled={addingRole || !selectedRole}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition shrink-0 font-medium"
                    >
                      {addingRole ? 'Agregando...' : 'Agregar todos'}
                    </button>
                  </div>
                  {roleMsg && (
                    <p className={`text-xs mt-2 ${roleMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                      {roleMsg}
                    </p>
                  )}
                </div>
              )}

              {/* Add emails manually */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agregar manualmente</p>
                <textarea
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="Emails (separados por coma, punto y coma o línea nueva)"
                  rows={3}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  {isSingleEmail && (
                    <input
                      type="text"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      placeholder="Nombre (opcional)"
                      className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                  <div className={isSingleEmail ? '' : 'col-span-2'}>
                    {knownPositions.length > 0 ? (
                      <select
                        value={positionInput}
                        onChange={e => setPositionInput(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Puesto (opcional)</option>
                        {knownPositions.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="__custom__">Otro...</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={positionInput}
                        onChange={e => setPositionInput(e.target.value)}
                        placeholder="Puesto / posición (opcional)"
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    )}
                    {positionInput === '__custom__' && (
                      <input
                        type="text"
                        autoFocus
                        value=""
                        onChange={e => setPositionInput(e.target.value)}
                        placeholder="Escribe el puesto"
                        className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    )}
                  </div>
                </div>
                <button
                  onClick={addParticipants}
                  disabled={adding || !emailInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm px-4 py-1.5 rounded-lg transition"
                >
                  {adding ? 'Añadiendo...' : 'Añadir'}
                </button>
              </div>

              {/* Participants list */}
              {participants.length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  <p className="text-xs font-medium text-gray-500">{participants.length} participante{participants.length !== 1 ? 's' : ''}</p>
                  {participants.map(p => {
                    const link = `${window.location.origin}/s/${wave.slug}?token=${p.token}`
                    return (
                      <div key={p.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{p.name ? `${p.name} (${p.email})` : p.email}</p>
                          {p.position && <p className="text-xs text-indigo-500">{p.position}</p>}
                        </div>
                        {p.responded_at
                          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">Respondió</span>
                          : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">Pendiente</span>
                        }
                        <button
                          onClick={() => navigator.clipboard.writeText(link)}
                          className="text-gray-300 hover:text-indigo-500 transition shrink-0"
                          title="Copiar link personal"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                        </button>
                        {!p.responded_at && (
                          <button onClick={() => removeParticipant(p.id)} className="text-gray-300 hover:text-red-400 transition shrink-0" title="Eliminar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6 6 18M6 6l12 12"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {participants.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-4">No hay participantes todavía</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SurveyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [waves, setWaves] = useState<Wave[]>([])
  const [showWaveForm, setShowWaveForm] = useState(false)
  const [waveName, setWaveName] = useState('')
  const [waveOpens, setWaveOpens] = useState('')
  const [waveCloses, setWaveCloses] = useState('')
  const [saving, setSaving] = useState(false)
  const [shareWave, setShareWave] = useState<Wave | null>(null)

  useEffect(() => {
    api.get(`/surveys/${id}`).then(r => setSurvey(r.data))
    loadWaves()
  }, [id])

  function loadWaves() {
    api.get(`/waves/survey/${id}`).then(r => setWaves(r.data))
  }

  async function createWave() {
    if (!waveName.trim()) return
    setSaving(true)
    try {
      await api.post('/waves', { survey_id: id, name: waveName, opens_at: waveOpens || null, closes_at: waveCloses || null })
      setWaveName(''); setWaveOpens(''); setWaveCloses(''); setShowWaveForm(false)
      loadWaves()
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(wave: Wave, status: string) {
    await api.put(`/waves/${wave.id}`, { status })
    loadWaves()
  }

  async function deleteWave(waveId: string) {
    if (!confirm('¿Eliminar esta oleada y todas sus respuestas?')) return
    await api.delete(`/waves/${waveId}`)
    loadWaves()
  }

  async function deleteSurvey() {
    if (!confirm('¿Eliminar esta encuesta y todo su contenido?')) return
    await api.delete(`/surveys/${id}`)
    navigate('/')
  }

  if (!survey) return <div className="text-center py-20 text-gray-400">Cargando...</div>

  return (
    <div className="max-w-3xl mx-auto">
      {shareWave && <SharePanel wave={shareWave} survey={survey} onClose={() => setShareWave(null)} />}

      <div className="flex items-start justify-between mb-6">
        <div>
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block">← Volver</Link>
          <h2 className="text-2xl font-bold text-gray-900">{survey.title}</h2>
          {survey.description && <p className="text-gray-500 text-sm mt-1">{survey.description}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${MTYPE_COLORS[survey.measurement_type] || 'bg-gray-100 text-gray-500'}`}>
              {MTYPE_LABELS[survey.measurement_type] || survey.measurement_type}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${survey.anonymous ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
              {survey.anonymous ? 'Anónima' : 'Identificada'}
            </span>
            <span className="text-xs text-gray-400">{survey.questions?.length || 0} preguntas</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/surveys/${id}/edit`} className="text-sm border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 transition">Editar</Link>
          <button onClick={deleteSurvey} className="text-sm border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 text-red-500 transition">Eliminar</button>
        </div>
      </div>

      {/* Oleadas / header dinámico según tipo */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">
          {survey.measurement_type === 'continuous' ? 'Enlace de medición continua' : 'Oleadas'}
        </h3>
        <div className="flex gap-2">
          {survey.measurement_type === 'continuous' ? (
            <Link to={`/surveys/${id}/continuous`} className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition">
              Ver evolución
            </Link>
          ) : (
            <>
              {survey.measurement_type === 'waves' && waves.length >= 2 && (
                <Link to={`/surveys/${id}/compare`} className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition">
                  Comparar
                </Link>
              )}
              <Link to={`/surveys/${id}/analytics`} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition">
                Analítica
              </Link>
              {survey.measurement_type !== 'individual' || waves.length === 0 ? (
                <button
                  onClick={() => setShowWaveForm(true)}
                  className="text-sm border border-gray-200 hover:border-indigo-300 rounded-lg px-3 py-1.5 text-gray-600 hover:text-indigo-600 transition"
                >
                  + Nueva oleada
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {showWaveForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 space-y-3">
          <h4 className="font-medium text-indigo-800 text-sm">Nueva oleada</h4>
          <input
            type="text"
            value={waveName}
            onChange={e => setWaveName(e.target.value)}
            placeholder="Nombre (ej: Oleada Q1 2026)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Apertura (opcional)</label>
              <input type="datetime-local" value={waveOpens} onChange={e => setWaveOpens(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cierre (opcional)</label>
              <input type="datetime-local" value={waveCloses} onChange={e => setWaveCloses(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createWave} disabled={saving || !waveName.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm px-4 py-1.5 rounded-lg transition">
              Crear
            </button>
            <button onClick={() => setShowWaveForm(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </div>
      )}

      {waves.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
          No hay oleadas. Crea la primera para empezar a recoger respuestas.
        </div>
      ) : (
        <div className="space-y-3">
          {waves.map(w => (
            <div key={w.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{w.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[w.status]}`}>{STATUS_LABELS[w.status]}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{w.response_count} respuestas</span>
                    {w.opens_at && <span>Abre: {new Date(w.opens_at).toLocaleString('es-ES')}</span>}
                    {w.closes_at && <span>Cierra: {new Date(w.closes_at).toLocaleString('es-ES')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {w.status === 'draft' && (
                    <button onClick={() => changeStatus(w, 'open')} className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded-lg transition">Abrir</button>
                  )}
                  {w.status === 'open' && (
                    <>
                      <button onClick={() => setShareWave(w)} className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded-lg transition">Compartir</button>
                      <button onClick={() => changeStatus(w, 'closed')} className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded-lg transition">Cerrar</button>
                    </>
                  )}
                  {w.status === 'closed' && (
                    <button onClick={() => changeStatus(w, 'open')} className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-1 rounded-lg transition">Reabrir</button>
                  )}
                  <Link to={`/surveys/${id}/analytics`} state={{ waveId: w.id }} className="text-xs border border-gray-200 hover:border-indigo-300 text-gray-500 hover:text-indigo-600 px-2 py-1 rounded-lg transition">
                    Resultados
                  </Link>
                  <button onClick={() => deleteWave(w.id)} className="text-xs text-gray-300 hover:text-red-500 transition">×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
