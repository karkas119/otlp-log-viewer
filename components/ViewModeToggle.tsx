"use client";

export type ViewMode = "flat" | "grouped";

interface Props {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
}

/**
 * Segmented control for switching between flat and grouped layouts. Kept
 * as a small controlled component so parent owns view-mode state (and can
 * later persist it to URL/search params without touching this file).
 */
export function ViewModeToggle({ value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      className="inline-flex rounded border border-slate-300 bg-white p-0.5 text-xs"
    >
      <Option
        active={value === "flat"}
        label="Flat"
        description="All logs in one timeline"
        onClick={() => onChange("flat")}
      />
      <Option
        active={value === "grouped"}
        label="Group by service"
        description="Collapse by parent resource"
        onClick={() => onChange("grouped")}
      />
    </div>
  );
}

function Option({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      title={description}
      onClick={onClick}
      className={`rounded px-3 py-1 font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}
