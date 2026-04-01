import { useEffect, useMemo, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { AcceptedSelectionOffsets, BaseChar } from './tracking';
import {
  applyTrackedDocument,
  buildTrackedChars,
  collectAcceptedChars,
  collectOriginalChars,
  getAcceptedSelectionOffsets,
  getCurrentSelection,
  restoreSelectionFromOffsets,
} from './tracking';

type TrackedChangesPluginProps = {
  currentUserName?: string;
  onAcceptedTextChange?: (value: string) => void;
};

export function TrackedChangesPlugin({
  currentUserName = 'Current user',
  onAcceptedTextChange,
}: TrackedChangesPluginProps) {
  const [editor] = useLexicalComposerContext();
  const baselineRef = useRef<BaseChar[] | null>(null);
  const currentAcceptedRef = useRef<BaseChar[]>([]);
  const applyingRef = useRef(false);
  const [summary, setSummary] = useState({
    deleted: 0,
    inserted: 0,
    retained: 0,
  });
  const [acceptedText, setAcceptedText] = useState('');

  useEffect(() => {
    editor.update(
      () => {
        const originalChars = collectOriginalChars();
        const acceptedChars = collectAcceptedChars();
        baselineRef.current = originalChars;
        currentAcceptedRef.current = acceptedChars;
        const tracked = buildTrackedChars(originalChars, acceptedChars, {
          deletedBy: currentUserName,
          insertedCreatedBy: currentUserName,
        });
        applyTrackedDocument(tracked);
        setSummary({
          deleted: tracked.filter((item) => item.status === 'deleted').length,
          inserted: tracked.filter((item) => item.status === 'inserted').length,
          retained: tracked.filter((item) => item.status === 'retained').length,
        });
        setAcceptedText(
          acceptedChars
            .map((item) => item.char)
            .join(''),
        );
      },
      {
        tag: 'track-changes:init',
      },
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, tags }) => {
      if (applyingRef.current || tags.has('track-changes:apply') || tags.has('track-changes:init')) {
        return;
      }

      const baseline = baselineRef.current;
      if (!baseline) {
        return;
      }

      let nextChars: BaseChar[] = [];
      let nextSelection: AcceptedSelectionOffsets | null = null;

      editorState.read(() => {
        nextChars = collectAcceptedChars();
        nextSelection = getAcceptedSelectionOffsets(getCurrentSelection());
      });

      if (areCharListsEqual(currentAcceptedRef.current, nextChars)) {
        return;
      }

      const tracked = buildTrackedChars(baseline, nextChars, {
        deletedBy: currentUserName,
        insertedCreatedBy: currentUserName,
      });
      const counts = tracked.reduce(
        (accumulator, item) => {
          accumulator[item.status] += 1;
          return accumulator;
        },
        { deleted: 0, inserted: 0, retained: 0 },
      );

      applyingRef.current = true;
      editor.update(
        () => {
          applyTrackedDocument(tracked);
          restoreSelectionFromOffsets(nextSelection);
        },
        {
          tag: 'track-changes:apply',
        },
      );
      applyingRef.current = false;
      currentAcceptedRef.current = nextChars;

      const nextAcceptedText = nextChars
        .map((item) => item.char)
        .join('');

      setSummary(counts);
      setAcceptedText(nextAcceptedText);
      onAcceptedTextChange?.(nextAcceptedText);
    });
  }, [currentUserName, editor, onAcceptedTextChange]);

  const summaryText = useMemo(
    () => `retained: ${summary.retained} | inserted: ${summary.inserted} | deleted: ${summary.deleted}`,
    [summary],
  );

  return (
    <div className="status-panel">
      Current accepted text: <code>{acceptedText || '(empty)'}</code>
      <br />
      Character summary: <code>{summaryText}</code>
    </div>
  );
}

function areCharListsEqual(left: BaseChar[], right: BaseChar[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (
      left[index].char !== right[index].char ||
      left[index].format !== right[index].format ||
      left[index].style !== right[index].style
    ) {
      return false;
    }
  }

  return true;
}
