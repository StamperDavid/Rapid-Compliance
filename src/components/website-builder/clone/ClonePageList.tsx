/**
 * ClonePageList
 *
 * Renders the pages discovered by `POST /api/website/clone/discover` as a
 * checkbox list (title + path per row), with Select all / Clear controls and a
 * live "N of M selected" count. Selection state is owned by the parent so the
 * "Clone selected" button can read it.
 */

'use client';

import { Button } from '@/components/ui/button';
import { CardTitle, Caption } from '@/components/ui/typography';

/** A page discovered on the source site. Matches the `/discover` contract. */
export interface DiscoveredPage {
  path: string;
  url: string;
  title: string;
}

interface ClonePageListProps {
  pages: DiscoveredPage[];
  /** Selected page paths (paths are the stable identity used by `/run`). */
  selected: Set<string>;
  onToggle: (path: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

export function ClonePageList({
  pages,
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: ClonePageListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <CardTitle>
          Discovered pages
          <span className="ml-2 font-normal text-muted-foreground">
            {selected.size} of {pages.length} selected
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onSelectAll}>
            Select all
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border-light rounded-lg border border-border-strong bg-card">
        {pages.map((page) => {
          const isSelected = selected.has(page.path);
          return (
            <label
              key={page.path}
              className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-surface-elevated"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(page.path)}
                className="mt-1 h-4 w-4 cursor-pointer accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {page.title || 'Untitled page'}
                </span>
                <Caption className="block truncate">{page.path}</Caption>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default ClonePageList;
