export function Field({ label, hint, error, value, onChange, ...rest }) {
  const id = `field-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[12.5px] font-medium text-ink-800">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={[
          "h-11 rounded-xl border bg-white px-3.5 text-[13.5px] text-ink-900 tnum",
          "placeholder:text-ink-400 transition-colors duration-200",
          "focus:outline-none focus:ring-2 focus:ring-leaf-500/30",
          error ? "border-rust-600/50" : "border-ink-200 focus:border-ink-400",
          rest.disabled ? "cursor-not-allowed bg-ink-100 text-ink-400" : "",
        ].join(" ")}
        {...rest}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[11.5px] text-ink-400">
          {hint}
        </p>
      )}
      {error && <p className="text-[11.5px] text-rust-600">{error}</p>}
    </div>
  );
}
