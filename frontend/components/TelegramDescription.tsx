"use client";

import { useMemo, useState } from "react";

type TelegramDescriptionProps = {
  text: string | null;
  postedLabel: string;
};

function renderWithLinks(value: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = value.split(urlRegex);
  return parts.map((part, idx) => {
    if (/^https?:\/\/[^\s]+$/i.test(part)) {
      return (
        <a
          key={`link-${idx}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
        >
          {part}
        </a>
      );
    }
    return <span key={`txt-${idx}`}>{part}</span>;
  });
}

export default function TelegramDescription({
  text,
  postedLabel
}: TelegramDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const safeText = (text || "").trim();
  const hashtags = useMemo(() => {
    if (!safeText) return [];
    const tags = safeText.match(/#[^\s#]+/g) || [];
    return Array.from(new Set(tags)).slice(0, 16);
  }, [safeText]);
  const canExpand = safeText.length > 320 || safeText.split("\n").length > 8;

  return (
    <div className="ui-card-strong p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900">
          Описание (оригинал из Telegram)
        </span>
        <span className="text-xs text-slate-500">{postedLabel}</span>
      </div>

      {safeText ? (
        <>
          <div className="relative">
            <div
              className={`rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap ${
                !expanded ? "max-h-[240px] overflow-hidden" : ""
              }`}
            >
              {renderWithLinks(safeText)}
            </div>
            {!expanded && canExpand && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-b-xl bg-gradient-to-t from-slate-50 to-transparent" />
            )}
          </div>

          {canExpand && (
            <button
              type="button"
              className="mt-2 text-sm font-medium text-blue-700 hover:underline"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? "Свернуть" : "Показать полностью"}
            </button>
          )}

          {hashtags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Описание отсутствует.
        </div>
      )}
    </div>
  );
}
