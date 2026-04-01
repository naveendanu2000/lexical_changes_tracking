import { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

type TooltipState = {
  createdBy: string;
  deletedBy: string | null;
  text: string;
  type: string;
};

export function HoverMetadataPlugin() {
  const [editor] = useLexicalComposerContext();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    return editor.registerRootListener((rootElement, previousRootElement) => {
      const detach = (element: HTMLElement | null) => {
        if (!element) {
          return;
        }

        element.onmousemove = null;
        element.onmouseleave = null;
      };

      detach(previousRootElement);

      if (!rootElement) {
        return;
      }

      rootElement.onmousemove = (event: MouseEvent) => {
        const target = (event.target as HTMLElement | null)?.closest('[data-created-by]') as HTMLElement | null;

        if (!target || target.dataset.trackAnchor === 'true' || !target.dataset.createdBy) {
          setTooltip(null);
          return;
        }

        setTooltip({
          createdBy: target.dataset.createdBy,
          deletedBy: target.dataset.deletedBy || null,
          text: target.textContent ?? '',
          type: target.dataset.trackStatus ?? 'retained',
        });
      };

      rootElement.onmouseleave = () => {
        setTooltip(null);
      };
    });
  }, [editor]);

  if (!tooltip) {
    return (
      <aside className="metadata-sidebar">
        <p className="metadata-label">Word details</p>
        <p className="metadata-empty">Hover a word to see who created or deleted it.</p>
      </aside>
    );
  }

  return (
    <aside aria-live="polite" className="metadata-sidebar">
      <p className="metadata-label">Word details</p>
      <p className="metadata-word">{tooltip.text || '(space)'}</p>
      <p className="metadata-row">
        <span>Type</span>
        <strong>{tooltip.type}</strong>
      </p>
      <p className="metadata-row">
        <span>Created by</span>
        <strong>{tooltip.createdBy}</strong>
      </p>
      {tooltip.type === 'deleted' && tooltip.deletedBy ? (
        <p className="metadata-row">
          <span>Deleted by</span>
          <strong>{tooltip.deletedBy}</strong>
        </p>
      ) : null}
    </aside>
  );
}
