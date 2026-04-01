import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, SELECTION_CHANGE_COMMAND } from 'lexical';
import { $patchStyleText } from '@lexical/selection';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { BackendTrackedWord } from './tracking';
import type { EditorDisplayMode } from './TrackedChangesPlugin';

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

function ToolbarIcon({ children }: { children: ReactNode }) {
  return <span className="toolbar-button__icon">{children}</span>;
}

function BoldIcon() {
  return (
    <ToolbarIcon>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M8 5h6a4 4 0 0 1 0 8H8zm0 8h7a4 4 0 1 1 0 8H8z" fill="currentColor" />
      </svg>
    </ToolbarIcon>
  );
}

function ItalicIcon() {
  return (
    <ToolbarIcon>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M10 4h10v2h-4l-4 12h4v2H6v-2h4l4-12h-4z" fill="currentColor" />
      </svg>
    </ToolbarIcon>
  );
}

function UnderlineIcon() {
  return (
    <ToolbarIcon>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M7 4v7a5 5 0 0 0 10 0V4h-2v7a3 3 0 0 1-6 0V4zM5 20h14v-2H5z" fill="currentColor" />
      </svg>
    </ToolbarIcon>
  );
}

function StrikeIcon() {
  return (
    <ToolbarIcon>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M13 4c-3.3 0-5.5 1.8-5.5 4.4 0 1.2.4 2.2 1.1 3H5v2h14v-2h-4.3c1-.6 1.8-1.6 1.8-3 0-1.1-.4-2-1.2-2.7-.8-.7-2-1.2-3.3-1.4V4zm-1 12c-1.7 0-3-.7-3.7-2H6.2c.7 2.5 3 4 5.8 4 3.4 0 5.8-1.8 5.8-4.5 0-.6-.1-1.1-.3-1.5h-2.2c.3.4.4.9.4 1.4 0 1.5-1.4 2.6-3.7 2.6z"
          fill="currentColor"
        />
      </svg>
    </ToolbarIcon>
  );
}

function SaveIcon() {
  return (
    <ToolbarIcon>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M5 4h11l3 3v13H5zm2 2v12h10V8.2L15.8 6zM9 6h5v4H9zm0 8h6v2H9z"
          fill="currentColor"
        />
      </svg>
    </ToolbarIcon>
  );
}

function SaveAllIcon() {
  return (
    <ToolbarIcon>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M6 3h9l3 3v3h-2V6.8L14.2 5H8v4H6zm-2 6h14v12H4zm3 3v2h8v-2zm0 4v2h5v-2z"
          fill="currentColor"
        />
      </svg>
    </ToolbarIcon>
  );
}

function ViewModeIcon({ displayMode }: { displayMode: EditorDisplayMode }) {
  return (
    <ToolbarIcon>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        {displayMode === 'tracked' ? (
          <path
            d="M4 6h16v10H4zm2 2v6h12V8zm1 9h10v2H7z"
            fill="currentColor"
          />
        ) : (
          <path
            d="M3 7h8v10H3zm10 0h8v10h-8zM5 9v6h4V9zm10 0v6h4V9z"
            fill="currentColor"
          />
        )}
      </svg>
    </ToolbarIcon>
  );
}

function SwatchIcon({ color }: { color: string }) {
  return (
    <ToolbarIcon>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 15l8-8 6 6-8 8H5z" fill={color} />
        <path d="M4 20h16v2H4z" fill="currentColor" opacity="0.26" />
      </svg>
    </ToolbarIcon>
  );
}

function FormatButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={`toolbar-button toolbar-button--icon${active ? ' is-active' : ''}`}
      data-tooltip={label}
      title={label}
      type="button"
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

type ToolbarPluginProps = {
  acceptedText: string;
  displayMode: EditorDisplayMode;
  onDisplayModeChange: (mode: EditorDisplayMode) => void;
  onSaveAccepted?: (payload: { acceptedText: string; lexicalState: unknown }) => void;
  onSaveChanges?: (payload: BackendTrackedWord[]) => void;
  trackedWordsPayload: BackendTrackedWord[];
};

export function ToolbarPlugin({
  acceptedText,
  displayMode,
  onDisplayModeChange,
  onSaveAccepted,
  onSaveChanges,
  trackedWordsPayload,
}: ToolbarPluginProps) {
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
        acceptedText,
        lexicalState: editor.getEditorState().toJSON(),
      };

      onSaveAccepted?.(payload);
      if (!onSaveAccepted) {
        console.log('save', payload);
      }
    });
  };

  const handleSaveChanges = () => {
    const payload = trackedWordsPayload;
    onSaveChanges?.(payload);
    if (!onSaveChanges) {
      console.log('save_changes', payload);
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <FormatButton
          active={formatState.bold}
          icon={<BoldIcon />}
          label="Bold"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        />
        <FormatButton
          active={formatState.italic}
          icon={<ItalicIcon />}
          label="Italic"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        />
        <FormatButton
          active={formatState.underline}
          icon={<UnderlineIcon />}
          label="Underline"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        />
        <FormatButton
          active={formatState.strikethrough}
          icon={<StrikeIcon />}
          label="Strike"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
        />
      </div>
      <div className="toolbar-group">
        <label className="toolbar-color" data-tooltip="Font color" title="Font color">
          <SwatchIcon color={fontColor} />
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
        </label>
        <label className="toolbar-color" data-tooltip="Highlight" title="Highlight">
          <SwatchIcon color={highlightColor} />
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
        </label>
      </div>
      <div className="toolbar-group toolbar-actions">
        <button
          aria-label={displayMode === 'tracked' ? 'Show Accepted Text' : 'Show Tracked Text'}
          className={`toolbar-button${displayMode === 'accepted' ? ' is-active' : ''}`}
          data-tooltip={displayMode === 'tracked' ? 'Show Accepted Text' : 'Show Tracked Text'}
          title={displayMode === 'tracked' ? 'Show Accepted Text' : 'Show Tracked Text'}
          type="button"
          onClick={() => onDisplayModeChange(displayMode === 'tracked' ? 'accepted' : 'tracked')}
        >
          <ViewModeIcon displayMode={displayMode} />
        </button>
        <button
          aria-label="Save"
          className="toolbar-button toolbar-button--accent"
          data-tooltip="Save"
          title="Save"
          type="button"
          onClick={handleSaveAccepted}
        >
          <SaveIcon />
        </button>
        <button
          aria-label="Save Changes"
          className="toolbar-button toolbar-button--accent"
          data-tooltip="Save Changes"
          title="Save Changes"
          type="button"
          onClick={handleSaveChanges}
        >
          <SaveAllIcon />
        </button>
      </div>
    </div>
  );
}
