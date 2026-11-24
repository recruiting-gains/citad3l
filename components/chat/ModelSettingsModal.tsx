"use client";

import { useEffect, useState } from "react";
import type { ModelSettings } from "@/lib/types";

export function ModelSettingsModal({ modelId, modelName, onClose }: { modelId: string; modelName: string; onClose: () => void }) {
  const [settings, setSettings] = useState<ModelSettings>({ modelId, systemPrompt: "", temperature: null, maxTokens: null });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/account/model-settings?model=${encodeURIComponent(modelId)}`)
      .then(async (r) => {
        if (r.status === 403) { setMsg("Tune each model on Max."); return; }
        if (!r.ok) throw new Error();
        const j = await r.json();
        if (j.settings) setSettings(j.settings);
      })
      .catch(() => setMsg("Couldn't load settings."));
  }, [modelId]);

  const save = async (reset = false) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/account/model-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reset ? { modelId, reset: true } : settings),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error?.message || "Save failed.");
      setSettings(j.settings);
      setMsg(reset ? "Reset." : `Saved for ${modelName}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed.");
    }
    setBusy(false);
  };

  return (
    <div className="cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form
        className="model-settings"
        data-testid="model-settings"
        onSubmit={(e) => { e.preventDefault(); void save(false); }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="model-settings-head">
          <h2>Model settings: {modelName}</h2>
          <button type="button" className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Close">×</button>
        </div>
        <label className="label" htmlFor="ms-sys">Standing instructions</label>
        <textarea
          id="ms-sys"
          className="input"
          rows={6}
          placeholder="Tell this model how to work with you…"
          value={settings.systemPrompt}
          onChange={(e) => setSettings((s: ModelSettings) => ({ ...s, systemPrompt: e.target.value }))}
        />
        <div className="model-settings-row">
          <div>
            <label className="label" htmlFor="ms-temp">Temperature</label>
            <input
              id="ms-temp"
              className="input"
              type="number"
              min={0}
              max={2}
              step={0.1}
              placeholder="Auto"
              value={settings.temperature ?? ""}
              onChange={(e) => setSettings((s: ModelSettings) => ({ ...s, temperature: e.target.value === "" ? null : Number(e.target.value) }))}
            />
            <p className="model-settings-help">Lower is more focused. Higher is more inventive.</p>
          </div>
          <div>
            <label className="label" htmlFor="ms-max">Max reply length</label>
            <input
              id="ms-max"
              className="input"
              type="number"
              min={16}
              max={4096}
              placeholder="Auto"
              value={settings.maxTokens ?? ""}
              onChange={(e) => setSettings((s: ModelSettings) => ({ ...s, maxTokens: e.target.value === "" ? null : Number(e.target.value) }))}
            />
            <p className="model-settings-help">In tokens. Leave blank for the default.</p>
          </div>
        </div>
        {msg && <p className="tiny" role="status">{msg}</p>}
        <div className="model-settings-actions">
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void save(true)}>Reset</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy && <span className="spinner" />} Save</button>
        </div>
      </form>
    </div>
  );
}

export default ModelSettingsModal;
