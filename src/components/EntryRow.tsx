import type { ReactNode } from "react";
import type { Entry } from "../types";
import { round1 } from "../utils";

interface Props {
  entry: Entry;
  time: string;
  children?: ReactNode;
}

/** Shared presentation for one entry, used by both Today and DayDetail. */
export default function EntryRow({ entry, time, children }: Props) {
  return (
    <div className="entry-row">
      <div className="entry-info">
        <span className="entry-time">
          {time}
          {entry.source === "chatgpt" && (
            <span className="entry-badge" title="Estimated by ChatGPT">
              GPT
            </span>
          )}
        </span>
        <span className="entry-macros">
          {entry.proteinGrams}g protein &middot; {entry.calories} cal &middot;{" "}
          {round1(entry.saturatedFatGrams ?? 0)}g sat. fat &middot;{" "}
          {round1(entry.fiberGrams ?? 0)}g fiber
        </span>
        {entry.note && <span className="entry-note">{entry.note}</span>}
      </div>
      {children && <div className="entry-actions">{children}</div>}
    </div>
  );
}
