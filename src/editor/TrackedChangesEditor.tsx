import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { useState } from 'react';
import type { InitialConfigType } from '@lexical/react/LexicalComposer';
import { HoverMetadataPlugin } from './HoverMetadataPlugin';
import { TrackTextNode } from './TrackTextNode';
import {
  getAcceptedTextFromBackendWords,
  initializeDocumentFromBackendWords,
  initializeDocumentFromText,
  type BackendTrackedWord,
} from './tracking';
import { ToolbarPlugin } from './ToolbarPlugin';
import { TrackedChangesPlugin } from './TrackedChangesPlugin';

type TrackedChangesEditorProps = {
  currentUserName?: string;
  initialText?: string;
  initialWords?: BackendTrackedWord[];
  onSaveAccepted?: (payload: { acceptedText: string; lexicalState: unknown }) => void;
  onSaveChanges?: (payload: BackendTrackedWord[]) => void;
};

function Placeholder() {
  return <div className="editor-placeholder">Start editing to see tracked changes...</div>;
}

export function TrackedChangesEditor({
  currentUserName = 'Current user',
  initialText = '',
  initialWords,
  onSaveAccepted,
  onSaveChanges,
}: TrackedChangesEditorProps) {
  const [acceptedText, setAcceptedText] = useState(
    initialWords ? getAcceptedTextFromBackendWords(initialWords) : initialText,
  );

  const initialConfig: InitialConfigType = {
    editorState: () => {
      if (initialWords && initialWords.length > 0) {
        initializeDocumentFromBackendWords(initialWords);
        return;
      }

      initializeDocumentFromText(initialText);
    },
    namespace: 'tracked-changes-editor',
    nodes: [TrackTextNode],
    onError(error) {
      throw error;
    },
    theme: {
      paragraph: 'editor-paragraph',
      text: {
        bold: 'editor-text-bold',
        italic: 'editor-text-italic',
        strikethrough: 'editor-text-strikethrough',
        underline: 'editor-text-underline',
      },
    },
  };

  return (
    <div className="editor-shell">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="editor-layout">
          <div className="editor-main">
            <ToolbarPlugin onSaveAccepted={onSaveAccepted} onSaveChanges={onSaveChanges} />
            <div className="editor-inner">
              <RichTextPlugin
                contentEditable={<ContentEditable className="editor-input" />}
                ErrorBoundary={LexicalErrorBoundary}
                placeholder={<Placeholder />}
              />
              <HistoryPlugin />
              <TrackedChangesPlugin currentUserName={currentUserName} onAcceptedTextChange={setAcceptedText} />
            </div>
          </div>
          <HoverMetadataPlugin />
        </div>
      </LexicalComposer>
      <div className="legend">
        <span className="legend-chip">
          <span className="legend-swatch inserted" />
          Inserted text
        </span>
        <span className="legend-chip">
          <span className="legend-swatch deleted" />
          Deleted text
        </span>
        <span className="legend-chip">
          <span className="legend-swatch format" />
          Formatting changed on retained text
        </span>
      </div>
      <div className="status-panel">
        Accepted output length: <code>{acceptedText.length}</code>
      </div>
    </div>
  );
}
