const STOP_WORDS = new Set([
  'de','la','el','en','y','a','los','del','las','un','una','por','con','no','que','se',
  'su','es','son','para','como','más','este','esta','al','lo','si','pero','o','le','les',
  'me','mi','tu','te','nos','fue','ha','he','han','hay','ser','estar','hace','hacer',
  'todo','todos','toda','todas','muy','ya','también','sobre','entre','cuando','donde',
  'the','and','for','are','but','not','you','all','can','had','her','his','was','one',
  'our','out','day','get','has','him','how','its','may','new','now','old','see','two',
  'who','did','use','she','they','what','this','with','have','from','been','that','were',
  'into','each','more','also','some','than','then','them','well','will','your','said',
])

function tokenize(texts: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const text of texts) {
    const words = text
      .toLowerCase()
      .replace(/[^\w\sáéíóúüñ]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1)
    }
  }
  return freq
}

interface WordCloudProps {
  responses: string[]
}

export default function WordCloud({ responses }: WordCloudProps) {
  if (!responses || responses.length === 0) {
    return <p className="text-xs text-gray-400">Sin respuestas</p>
  }

  const freq = tokenize(responses)
  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)

  if (sorted.length === 0) {
    return (
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {responses.slice(0, 20).map((r, i) => (
          <p key={i} className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">"{r}"</p>
        ))}
      </div>
    )
  }

  const maxCount = sorted[0][1]
  const minCount = sorted[sorted.length - 1][1]
  const range = Math.max(maxCount - minCount, 1)

  const COLORS = [
    'text-indigo-600','text-purple-600','text-blue-600','text-teal-600',
    'text-emerald-600','text-violet-600','text-sky-600','text-cyan-600',
  ]

  function fontSize(count: number) {
    const norm = (count - minCount) / range
    // Scale between 0.75rem and 2.2rem
    return 0.75 + norm * 1.45
  }

  return (
    <div>
      {/* Word cloud */}
      <div className="flex flex-wrap gap-2 items-baseline p-3 bg-gray-50 rounded-xl mb-4 min-h-[80px]">
        {sorted.map(([word, count], i) => (
          <span
            key={word}
            title={`${count} vez${count !== 1 ? 'es' : ''}`}
            className={`${COLORS[i % COLORS.length]} font-medium leading-none cursor-default transition-opacity hover:opacity-70`}
            style={{ fontSize: `${fontSize(count)}rem` }}
          >
            {word}
          </span>
        ))}
      </div>

      {/* Top words bar chart */}
      {sorted.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-400 mb-2">Palabras más frecuentes</p>
          {sorted.slice(0, 10).map(([word, count]) => (
            <div key={word} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-28 truncate">{word}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Raw responses toggle */}
      <details className="mt-3">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
          Ver respuestas completas ({responses.length})
        </summary>
        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
          {responses.map((r, i) => (
            <p key={i} className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">"{r}"</p>
          ))}
        </div>
      </details>
    </div>
  )
}
