import { useEffect, useState, useRef, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

interface User {
  id: string
  email: string
  name: string
  role: string
  position: string | null
  area: string | null
  created_at: string
}

interface BulkRow {
  name: string
  email: string
  password: string
  role: string
  position: string
  area: string
  _error?: string
}

const ROLE_LABELS: Record<string, string> = { admin: 'Administrador', viewer: 'Visor' }
const ROLE_COLORS: Record<string, string> = { admin: 'bg-indigo-100 text-indigo-700', viewer: 'bg-gray-100 text-gray-600' }

const CSV_TEMPLATE = `nombre,email,contraseña,puesto,area,rol
Juan Pérez,juan@empresa.com,Pass1234,Gerente,Comercial,admin
Ana López,ana@empresa.com,Pass1234,Analista,Operaciones,viewer`

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'plantilla_usuarios.csv'
  a.click()
}

function parseCSV(text: string): BulkRow[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // Detect separator
  const header = lines[0].toLowerCase()
  const sep = header.includes(';') ? ';' : ','

  const rows: BulkRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
    const [name = '', email = '', password = '', position = '', area = '', role = ''] = cols
    const r: BulkRow = {
      name,
      email,
      password,
      position,
      area,
      role: ['admin', 'viewer'].includes(role.toLowerCase()) ? role.toLowerCase() : 'viewer',
    }
    if (!name) r._error = 'Falta nombre'
    else if (!email || !email.includes('@')) r._error = 'Email inválido'
    else if (!password || password.length < 6) r._error = 'Contraseña muy corta (mín. 6)'
    rows.push(r)
  }
  return rows
}

function BulkModal({ onSave, onClose, existingPositions }: {
  onSave: () => void
  onClose: () => void
  existingPositions: string[]
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<BulkRow[]>([])
  const [results, setResults] = useState<any[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResults(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setRows(parseCSV(text))
    }
    reader.readAsText(file, 'UTF-8')
  }

  const validRows = rows.filter(r => !r._error)
  const invalidRows = rows.filter(r => r._error)

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)
    try {
      const { data } = await api.post('/auth/users/bulk', { users: validRows })
      setResults(data.results)
      if (data.created > 0) onSave()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  const created = results?.filter(r => r.ok).length ?? 0
  const failed  = results?.filter(r => !r.ok).length ?? 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">Carga masiva de usuarios</h3>
            <p className="text-xs text-gray-400 mt-0.5">Sube un archivo CSV con los datos de los usuarios</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Step 1 — Download template */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">1. Descarga la plantilla</p>
              <p className="text-xs text-gray-400 mt-0.5">Columnas: nombre, email, contraseña, puesto, area, rol</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Descargar plantilla
            </button>
          </div>

          {/* Step 2 — Upload */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">2. Sube el archivo completado</p>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer transition"
            >
              <svg className="mx-auto mb-2 text-gray-300" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p className="text-sm text-gray-500">
                {fileName ? <span className="font-medium text-indigo-600">{fileName}</span> : 'Haz clic para seleccionar un archivo CSV'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Formato: .csv con separador coma o punto y coma</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </div>
          </div>

          {/* Preview */}
          {rows.length > 0 && !results && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  3. Previsualización — <span className="text-green-600">{validRows.length} válidos</span>
                  {invalidRows.length > 0 && <span className="text-red-500 ml-2">{invalidRows.length} con error</span>}
                </p>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Nombre</th>
                      <th className="text-left px-3 py-2 font-medium">Email</th>
                      <th className="text-left px-3 py-2 font-medium">Puesto</th>
                      <th className="text-left px-3 py-2 font-medium">Área</th>
                      <th className="text-left px-3 py-2 font-medium">Rol</th>
                      <th className="text-left px-3 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r, i) => (
                      <tr key={i} className={r._error ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 text-gray-800">{r.name || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-gray-600 font-mono">{r.email || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-gray-600">{r.position || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-gray-600">{r.area || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${ROLE_COLORS[r.role] || 'bg-gray-100 text-gray-500'}`}>
                            {ROLE_LABELS[r.role] || r.role}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {r._error
                            ? <span className="text-red-500">{r._error}</span>
                            : <span className="text-green-600">✓</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Results after import */}
          {results && (
            <div className="space-y-3">
              <div className={`rounded-xl p-4 ${created > 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                <p className="font-semibold text-gray-800">Importación completada</p>
                <p className="text-sm mt-1">
                  <span className="text-green-600 font-medium">{created} creado{created !== 1 ? 's' : ''}</span>
                  {failed > 0 && <span className="text-red-500 font-medium ml-3">{failed} fallido{failed !== 1 ? 's' : ''}</span>}
                </p>
              </div>
              {results.filter(r => !r.ok).length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-500 font-medium">Email</th>
                        <th className="text-left px-3 py-2 text-gray-500 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {results.filter(r => !r.ok).map((r, i) => (
                        <tr key={i} className="bg-red-50">
                          <td className="px-3 py-2 font-mono text-gray-700">{r.email}</td>
                          <td className="px-3 py-2 text-red-500">{r.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            El rol puede ser <code className="bg-gray-100 px-1 rounded">admin</code> o <code className="bg-gray-100 px-1 rounded">viewer</code>. Si se omite se asigna <em>viewer</em>.
          </p>
          <div className="flex gap-2 shrink-0">
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
              {results ? 'Cerrar' : 'Cancelar'}
            </button>
            {!results && validRows.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
              >
                {importing ? 'Importando...' : `Importar ${validRows.length} usuario${validRows.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function UserModal({
  user,
  existingPositions,
  existingAreas,
  onSave,
  onClose,
}: {
  user: User | null
  existingPositions: string[]
  existingAreas: string[]
  onSave: () => void
  onClose: () => void
}) {
  const isEdit = Boolean(user)
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(user?.role || 'admin')
  const [position, setPosition] = useState(user?.position || '')
  const [area, setArea] = useState(user?.area || '')
  const [customPosition, setCustomPosition] = useState(!existingPositions.includes(user?.position || '') && Boolean(user?.position))
  const [customArea, setCustomArea] = useState(!existingAreas.includes(user?.area || '') && Boolean(user?.area))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const posOptions = [...new Set([...existingPositions, position].filter(Boolean))]
  const areaOptions = [...new Set([...existingAreas, area].filter(Boolean))]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/auth/users/${user!.id}`, { name, role, position: position || null, area: area || null })
        if (password) await api.put(`/auth/users/${user!.id}/password`, { password })
      } else {
        await api.post('/auth/users', { email, password, name, role, position: position || null, area: area || null })
      }
      onSave()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              required={!isEdit} minLength={6} placeholder={isEdit ? 'Mínimo 6 caracteres' : ''}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Rol */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol del sistema</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="admin">Administrador</option>
              <option value="viewer">Visor</option>
            </select>
          </div>

          {/* Puesto + Área en grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Puesto</label>
              {!customPosition && posOptions.length > 0 ? (
                <div className="flex gap-1">
                  <select value={position} onChange={e => setPosition(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Sin puesto</option>
                    {posOptions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button type="button" onClick={() => setCustomPosition(true)}
                    className="text-xs text-indigo-500 hover:text-indigo-700 px-1" title="Nuevo puesto">+</button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <input type="text" value={position} onChange={e => setPosition(e.target.value)}
                    placeholder="Ej: Gerente..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  {posOptions.length > 0 && (
                    <button type="button" onClick={() => setCustomPosition(false)}
                      className="text-xs text-gray-400 hover:text-gray-600 px-1">↩</button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
              {!customArea && areaOptions.length > 0 ? (
                <div className="flex gap-1">
                  <select value={area} onChange={e => setArea(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Sin área</option>
                    {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <button type="button" onClick={() => setCustomArea(true)}
                    className="text-xs text-indigo-500 hover:text-indigo-700 px-1" title="Nueva área">+</button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <input type="text" value={area} onChange={e => setArea(e.target.value)}
                    placeholder="Ej: Comercial..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  {areaOptions.length > 0 && (
                    <button type="button" onClick={() => setCustomArea(false)}
                      className="text-xs text-gray-400 hover:text-gray-600 px-1">↩</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition">
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </button>
            <button type="button" onClick={onClose} className="px-4 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [positions, setPositions] = useState<string[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [modalUser, setModalUser] = useState<User | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showBulk, setShowBulk] = useState(false)

  const meId = (() => {
    try { return JSON.parse(atob(localStorage.getItem('token')!.split('.')[1])).id } catch { return '' }
  })()

  function load() {
    Promise.all([
      api.get('/auth/users'),
      api.get('/auth/positions'),
      api.get('/auth/areas'),
    ]).then(([u, p, a]) => {
      setUsers(u.data)
      setPositions(p.data)
      setAreas(a.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function deleteUser(id: string, name: string) {
    if (!confirm(`¿Eliminar al usuario "${name}"?`)) return
    try {
      await api.delete(`/auth/users/${id}`)
      load()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar')
    }
  }

  // Group users by position
  const byPosition = users.reduce((acc, u) => {
    const key = u.position || '— Sin puesto asignado'
    if (!acc[key]) acc[key] = []
    acc[key].push(u)
    return acc
  }, {} as Record<string, User[]>)

  const positionGroups = Object.entries(byPosition).sort(([a], [b]) => {
    if (a.startsWith('—')) return 1
    if (b.startsWith('—')) return -1
    return a.localeCompare(b)
  })

  return (
    <div className="max-w-4xl mx-auto">
      {showModal && (
        <UserModal
          user={modalUser}
          existingPositions={positions}
          existingAreas={areas}
          onSave={load}
          onClose={() => setShowModal(false)}
        />
      )}
      {showBulk && (
        <BulkModal
          existingPositions={positions}
          onSave={load}
          onClose={() => setShowBulk(false)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block">← Inicio</Link>
          <h2 className="text-2xl font-bold text-gray-900">Usuarios</h2>
          <p className="text-sm text-gray-500 mt-0.5">Los puestos asignados se usan como filtros en resultados de encuestas.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-2 border border-gray-200 hover:border-indigo-300 text-gray-600 hover:text-indigo-600 text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Carga masiva
          </button>
          <button
            onClick={() => { setModalUser(null); setShowModal(true) }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-lg shadow-indigo-600/20"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nuevo usuario
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Cargando...</div>
      ) : (
        <div className="space-y-6">
          {positionGroups.map(([pos, group]) => (
            <div key={pos}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{pos}</span>
                <span className="text-xs text-gray-300">{group.length}</span>
              </div>
              <div className="space-y-2">
                {group.map(u => (
                  <div key={u.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm flex items-center justify-center shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{u.name}</span>
                        {u.id === meId && <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">Tú</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                        {u.area && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            {u.area}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => { setModalUser(u); setShowModal(true) }}
                        className="text-xs border border-gray-200 hover:border-indigo-300 text-gray-500 hover:text-indigo-600 px-2.5 py-1 rounded-lg transition">
                        Editar
                      </button>
                      {u.id !== meId && (
                        <button onClick={() => deleteUser(u.id, u.name)}
                          className="text-gray-300 hover:text-red-500 transition">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-center py-16 text-gray-400">No hay usuarios. Crea el primero o sube un CSV.</p>
          )}
        </div>
      )}
    </div>
  )
}
