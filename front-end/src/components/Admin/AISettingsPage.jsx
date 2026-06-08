import { useState } from 'react'

const AI_MODELS = ['Claude Sonnet 4.6', 'Claude Haiku 4.5', 'Claude Opus 4.6']

const DEFAULT = {
    model: 'Claude Sonnet 4.6',
    temperature: 0.7,
    maxTokens: 2048,
    prompt: 'You are a helpful AI learning assistant. Guide users through their course materials with clear, concise explanations.',
}

export default function AISettingsPage() {
    const [model, setModel] = useState(DEFAULT.model)
    const [temperature, setTemperature] = useState(DEFAULT.temperature)
    const [maxTokens, setMaxTokens] = useState(DEFAULT.maxTokens)
    const [prompt, setPrompt] = useState(DEFAULT.prompt)
    const [saved, setSaved] = useState(false)

    const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    const handleReset = () => {
        setModel(DEFAULT.model); setTemperature(DEFAULT.temperature)
        setMaxTokens(DEFAULT.maxTokens); setPrompt(DEFAULT.prompt)
    }

    return (
        <>
            <div className="admin-topbar">
                <h1>AI Settings</h1>
                <p>Configure AI model parameters</p>
            </div>

            <div className="admin-body">
                <div className="a-card mb-3">
                    <div className="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom">
                        <div className="setting-icon"><i className="bi bi-robot" /></div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>AI Model Configuration</div>
                            <div style={{ fontSize: 13, color: '#94a3b8' }}>Configure the AI model used across the platform</div>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="setting-label d-block mb-2">AI Model</label>
                        <select className="form-select" style={{ borderRadius: 8, fontSize: 14 }}
                            value={model} onChange={e => setModel(e.target.value)}>
                            {AI_MODELS.map(m => <option key={m}>{m}</option>)}
                        </select>
                    </div>

                    <div className="mb-4">
                        <div className="d-flex justify-content-between mb-2">
                            <span className="setting-label">Temperature</span>
                            <span className="range-val">{temperature.toFixed(1)}</span>
                        </div>
                        <input type="range" className="form-range" min="0" max="1" step="0.1"
                            value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} />
                        <div className="d-flex justify-content-between" style={{ fontSize: 12, color: '#94a3b8' }}>
                            <span>Precise (0.0)</span><span>Creative (1.0)</span>
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="d-flex justify-content-between mb-2">
                            <span className="setting-label">Max Tokens</span>
                            <span className="range-val">{maxTokens.toLocaleString()}</span>
                        </div>
                        <input type="range" className="form-range" min="256" max="8192" step="256"
                            value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value))} />
                        <div className="d-flex justify-content-between" style={{ fontSize: 12, color: '#94a3b8' }}>
                            <span>256</span><span>8,192</span>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="setting-label d-block mb-2">System Prompt</label>
                        <textarea className="form-control" rows={4}
                            style={{ borderRadius: 8, fontSize: 14, resize: 'vertical' }}
                            value={prompt} onChange={e => setPrompt(e.target.value)} />
                    </div>

                    <div className="d-flex justify-content-end align-items-center gap-2">
                        {saved && (
                            <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                                <i className="bi bi-check-circle-fill me-1" />Settings saved!
                            </span>
                        )}
                        <button className="btn btn-light border" onClick={handleReset}>Reset</button>
                        <button className="btn-purple" onClick={handleSave}>
                            <i className="bi bi-floppy" /> Save Settings
                        </button>
                    </div>
                </div>

                <div className="info-box d-flex gap-3">
                    <div style={{ fontSize: 22, color: '#7c3aed' }}><i className="bi bi-info-circle-fill" /></div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#6d28d9', marginBottom: 4 }}>About these settings</div>
                        <p style={{ fontSize: 13, color: '#7c3aed', margin: 0 }}>
                            These parameters control how the AI responds to users across the entire platform.
                            Lower temperature produces more consistent answers; higher values allow more creativity.
                            Max tokens limits the length of each AI response.
                        </p>
                    </div>
                </div>
            </div>
        </>
    )
}