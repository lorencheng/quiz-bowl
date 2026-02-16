import { CATEGORIES, DIFFICULTIES } from '../api/qbreader'

export default function Settings({ settings, onChange, voices }) {
  const update = (key, value) => {
    onChange({ ...settings, key: undefined, [key]: value })
  }

  const toggleCategory = (cat) => {
    const cats = settings.categories || []
    const next = cats.includes(cat)
      ? cats.filter(c => c !== cat)
      : [...cats, cat]
    update('categories', next)
  }

  const toggleDifficulty = (diff) => {
    const diffs = settings.difficulties || []
    const next = diffs.includes(diff)
      ? diffs.filter(d => d !== diff)
      : [...diffs, diff]
    update('difficulties', next)
  }

  return (
    <div className="settings">
      <details className="settings-group">
        <summary>Settings</summary>
        <div className="settings-content">
          {/* Voice */}
          <label className="setting-row">
            <span>Voice</span>
            <select
              value={settings.voiceURI || ''}
              onChange={e => update('voiceURI', e.target.value || undefined)}
            >
              <option value="">Default</option>
              {voices
                .filter(v => v.lang.startsWith('en'))
                .map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
            </select>
          </label>

          {/* Speed */}
          <label className="setting-row">
            <span>Speed: {settings.rate?.toFixed(1) || '1.0'}x</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.rate || 1}
              onChange={e => update('rate', parseFloat(e.target.value))}
            />
          </label>

          {/* Categories */}
          <div className="setting-section">
            <span>Categories {settings.categories?.length ? `(${settings.categories.length})` : '(all)'}</span>
            <div className="chip-list">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`chip ${(settings.categories || []).includes(cat) ? 'active' : ''}`}
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulties */}
          <div className="setting-section">
            <span>Difficulties {settings.difficulties?.length ? `(${settings.difficulties.length})` : '(all)'}</span>
            <div className="chip-list">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.value}
                  className={`chip ${(settings.difficulties || []).includes(d.value) ? 'active' : ''}`}
                  onClick={() => toggleDifficulty(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  )
}
