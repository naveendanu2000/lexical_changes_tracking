import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, SELECTION_CHANGE_COMMAND } from 'lexical';
import { $patchStyleText } from '@lexical/selection';
import { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { getAcceptedText, serializeTrackedWordsForBackend, type BackendTrackedWord } from './tracking';

type FormatState = {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
};

const DEFAULT_FORMAT_STATE: FormatState = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
};

function FormatButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`toolbar-button${active ? ' is-active' : ''}`} type="button" onClick={onClick}>
      {label}
    </button>
  );
}

type ToolbarPluginProps = {
  onSaveAccepted?: (payload: { acceptedText: string; lexicalState: unknown }) => void;
  onSaveChanges?: (payload: BackendTrackedWord[]) => void;
};

export function ToolbarPlugin({ onSaveAccepted, onSaveChanges }: ToolbarPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [formatState, setFormatState] = useState<FormatState>(DEFAULT_FORMAT_STATE);
  const [fontColor, setFontColor] = useState('#0f172a');
  const [highlightColor, setHighlightColor] = useState('#fef08a');

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            setFormatState(DEFAULT_FORMAT_STATE);
            return;
          }

          setFormatState({
            bold: selection.hasFormat('bold'),
            italic: selection.hasFormat('italic'),
            strikethrough: selection.hasFormat('strikethrough'),
            underline: selection.hasFormat('underline'),
          });
        });
        return false;
      },
      1,
    );
  }, [editor]);

  const applyTextStyle = (styles: Record<string, string>) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, styles);
      }
    });
  };

  const handleSaveAccepted = () => {
    editor.getEditorState().read(() => {
      const payload = {
        acceptedText: getAcceptedText(),
        lexicalState: editor.getEditorState().toJSON(),
      };

      onSaveAccepted?.(payload);
      if (!onSaveAccepted) {
        console.log('save', payload);
      }
    });
  };

  const handleSaveChanges = () => {
    editor.getEditorState().read(() => {
      const payload = serializeTrackedWordsForBackend();
      onSaveChanges?.(payload);
      if (!onSaveChanges) {
        console.log('save_changes', payload);
      }
    });
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <FormatButton active={formatState.bold} label="Bold" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')} />
        <FormatButton
          active={formatState.italic}
          label="Italic"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        />
        <FormatButton
          active={formatState.underline}
          label="Underline"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        />
        <FormatButton
          active={formatState.strikethrough}
          label="Strike"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
        />
      </div>
      <div className="toolbar-group">
        <label className="toolbar-color">
          <input
            aria-label="Font color"
            type="color"
            value={fontColor}
            onChange={(event) => {
              const nextColor = event.target.value;
              setFontColor(nextColor);
              applyTextStyle({ color: nextColor });
            }}
          />
          Font color
        </label>
        <label className="toolbar-color">
          <input
            aria-label="Highlight color"
            type="color"
            value={highlightColor}
            onChange={(event) => {
              const nextColor = event.target.value;
              setHighlightColor(nextColor);
              applyTextStyle({ 'background-color': nextColor });
            }}
          />
          Highlight
        </label>
      </div>
      <div className="toolbar-group toolbar-actions">
        <button className="toolbar-button toolbar-button--accent" type="button" onClick={handleSaveAccepted}>
          Save
        </button>
        <button className="toolbar-button toolbar-button--accent" type="button" onClick={handleSaveChanges}>
          Save Changes
        </button>
      </div>
    </div>
  );
}
