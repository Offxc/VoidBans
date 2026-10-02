"use client";

import { useEffect, useState } from "react";

const UNITS = [
  { key: "minutes", label: "Minutes", seconds: 60 },
  { key: "hours", label: "Hours", seconds: 3600 },
  { key: "days", label: "Days", seconds: 86400 },
  { key: "weeks", label: "Weeks", seconds: 604800 },
] as const;

type UnitKey = (typeof UNITS)[number]["key"];

function pickUnit(totalSeconds: number): { unit: UnitKey; amount: string } {
  for (const u of [...UNITS].reverse()) {
    if (totalSeconds % u.seconds === 0) {
      return { unit: u.key, amount: String(totalSeconds / u.seconds) };
    }
  }
  return { unit: "hours", amount: String(totalSeconds / 3600) };
}

/**
 * Amount + unit duration picker. Reports the result as whole seconds via
 * onChange(null when empty), plain "hours" forced 5-minute durations to be
 * entered as 0.0833, so this lets staff pick the unit that actually fits.
 */
export function DurationInput({
  label,
  seconds,
  onChange,
  required,
}: {
  label: string;
  seconds: number | null;
  onChange: (seconds: number | null) => void;
  required?: boolean;
}) {
  const initial = seconds ? pickUnit(seconds) : { unit: "hours" as UnitKey, amount: "" };
  const [amount, setAmount] = useState(initial.amount);
  const [unit, setUnit] = useState<UnitKey>(initial.unit);

  // Keep in sync if the parent resets/prefills seconds externally (e.g. picking a template).
  useEffect(() => {
    if (seconds === null) {
      setAmount("");
      return;
    }
    const picked = pickUnit(seconds);
    setAmount(picked.amount);
    setUnit(picked.unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  function update(nextAmount: string, nextUnit: UnitKey) {
    setAmount(nextAmount);
    setUnit(nextUnit);
    const n = Number(nextAmount);
    if (!nextAmount || Number.isNaN(n) || n <= 0) {
      onChange(null);
      return;
    }
    const unitDef = UNITS.find((u) => u.key === nextUnit)!;
    onChange(Math.round(n * unitDef.seconds));
  }

  return (
    <label className="vb-field">
      {label}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="vb-input"
          type="number"
          min={1}
          step="any"
          required={required}
          value={amount}
          onChange={(e) => update(e.target.value, unit)}
          style={{ flex: 1 }}
        />
        <select
          className="vb-select"
          value={unit}
          onChange={(e) => update(amount, e.target.value as UnitKey)}
          style={{ width: 120 }}
        >
          {UNITS.map((u) => (
            <option key={u.key} value={u.key}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

export function formatDuration(totalSeconds: number): string {
  const picked = pickUnit(totalSeconds);
  const n = Number(picked.amount);
  const unitDef = UNITS.find((u) => u.key === picked.unit)!;
  const label = n === 1 ? unitDef.label.slice(0, -1) : unitDef.label;
  return `${picked.amount} ${label.toLowerCase()}`;
}
