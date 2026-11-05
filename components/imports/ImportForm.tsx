"use client";

// CSV upload + validate + commit. Errors are listed; nothing is committed
// unless every row passes.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runImportAction, type ImportActionState } from "@/app/actions/imports";

export default function ImportForm({
  importType,
  label,
}: {
  importType: string;
  label: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<ImportActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState("");

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await runImportAction(state, formData);
      setState(result);
      if ("ok" in result && result.ok) {
        setFileName("");
        router.refresh();
      }
    });
  };

  return (
    <div>
      <form action={submit} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="import_type" value={importType} />
        <label className="btn-secondary cursor-pointer">
          📄 Choose CSV file
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          />
        </label>
        <span className="text-sm text-slate-500">{fileName || "No file chosen"}</span>
        <button type="submit" className="btn-primary" disabled={!fileName || pending}>
          {pending ? "Validating & importing…" : `Import ${label.toLowerCase()}`}
        </button>
      </form>

      {state ? (
        "error" in state ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {state.error}
          </div>
        ) : (
          <div className="mt-3">
            <div
              className={`rounded-lg border px-4 py-2.5 text-sm ${
                state.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {state.message}
            </div>
            {state.errors.length > 0 ? (
              <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-rose-200 bg-white p-3 text-xs text-rose-700">
                {state.errors.map((e, i) => (
                  <li key={i} className="border-b border-rose-50 py-1 last:border-0">
                    {e}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}
