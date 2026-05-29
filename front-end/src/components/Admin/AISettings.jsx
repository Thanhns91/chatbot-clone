function Toggle({ checked, onChange }) {
  return (
    <label className="ad-toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="ad-toggle-slider" />
    </label>
  );
}

export default function AISettings({ settings, onToggle }) {
  return (
    <>
      <div className="ad-panel-header">
        <div className="ad-panel-title">AI Settings</div>
        <div className="ad-panel-count">Configure AI capabilities</div>
      </div>

      <div className="ad-ai-settings">
        {settings.map((s) => (
          <div key={s.id} className="ad-setting-row">
            <div>
              <div className="ad-setting-label">{s.label}</div>
              <div className="ad-setting-desc">{s.desc}</div>
            </div>

            <Toggle checked={s.on} onChange={() => onToggle(s.id)} />
          </div>
        ))}
      </div>
    </>
  );
}