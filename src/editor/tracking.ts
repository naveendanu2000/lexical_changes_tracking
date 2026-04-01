import {
  $createParagraphNode,
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type ElementNode,
  type LexicalNode,
  type PointType,
  type RangeSelection,
  type TextNode,
} from 'lexical';
import { $createTrackTextNode, $isTrackTextNode, type TrackStatus } from './TrackTextNode';

export type BaseChar = {
  char: string;
  createdBy: string;
  format: number;
  statusHint: TrackStatus;
  style: string;
};

export type TrackedChar = BaseChar & {
  formatChanged: boolean;
  originalFormat: number | null;
  originalStyle: string | null;
  status: TrackStatus;
};

export type AcceptedSelectionOffsets = {
  anchor: number;
  backward: boolean;
  focus: number;
};

type DiffCell = {
  length: number;
};

type InternalSegment = {
  createdBy: string;
  format: number;
  formatChanged: boolean;
  originalFormat: number | null;
  originalStyle: string | null;
  status: TrackStatus;
  style: string;
  text: string;
};

const DELETED_NEWLINE_GLYPH = '[NL]';
const CARET_ANCHOR = '\u200b';
const DEFAULT_CREATED_BY = 'Unknown';

export type BackendTrackedWord = {
  created_by: string;
  type: TrackStatus;
  word: string;
};

function stripCaretAnchor(text: string): string {
  return text.split(CARET_ANCHOR).join('');
}

function getAcceptedTextForTextNode(node: TextNode): string {
  if ($isTrackTextNode(node) && node.isAnchor()) {
    return stripCaretAnchor(node.getTextContent());
  }

  return node.getTextContent();
}

function getAcceptedOffsetForTextNode(node: TextNode, rawOffset: number): number {
  const text = node.getTextContent();

  if (!$isTrackTextNode(node) || !node.isAnchor()) {
    return Math.min(rawOffset, text.length);
  }

  const anchorCharsBeforeOffset = text.slice(0, rawOffset).split(CARET_ANCHOR).length - 1;
  const acceptedText = stripCaretAnchor(text);
  return Math.min(Math.max(rawOffset - anchorCharsBeforeOffset, 0), acceptedText.length);
}

function canTreatAsRetained(original: BaseChar, current: BaseChar): boolean {
  if (current.statusHint === 'inserted') {
    return false;
  }

  if (current.char !== original.char) {
    return false;
  }

  return true;
}

export function normalizeStyle(style: string): string {
  return style
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [property, ...rest] = part.split(':');
      return `${property.trim().toLowerCase()}:${rest.join(':').trim()}`;
    })
    .sort()
    .join(';');
}

function createDiffTable(original: BaseChar[], current: BaseChar[]): DiffCell[][] {
  const rows = original.length + 1;
  const cols = current.length + 1;
  const table: DiffCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ length: 0 })),
  );

  for (let i = original.length - 1; i >= 0; i -= 1) {
    for (let j = current.length - 1; j >= 0; j -= 1) {
      if (original[i].char === current[j].char) {
        table[i][j].length = table[i + 1][j + 1].length + 1;
      } else {
        table[i][j].length = Math.max(table[i + 1][j].length, table[i][j + 1].length);
      }
    }
  }

  return table;
}

type BuildTrackedCharsOptions = {
  insertedCreatedBy: string;
};

export function buildTrackedChars(
  original: BaseChar[],
  current: BaseChar[],
  options: BuildTrackedCharsOptions = { insertedCreatedBy: DEFAULT_CREATED_BY },
): TrackedChar[] {
  const table = createDiffTable(original, current);
  const tracked: TrackedChar[] = [];

  let i = 0;
  let j = 0;

  while (i < original.length && j < current.length) {
    if (canTreatAsRetained(original[i], current[j])) {
      const style = normalizeStyle(current[j].style);
      const originalStyle = normalizeStyle(original[i].style);
      tracked.push({
        char: current[j].char,
        createdBy: current[j].createdBy || original[i].createdBy,
        format: current[j].format,
        formatChanged: current[j].format !== original[i].format || style !== originalStyle,
        originalFormat: original[i].format,
        originalStyle,
        status: 'retained',
        statusHint: 'retained',
        style,
      });
      i += 1;
      j += 1;
      continue;
    }

    if (table[i][j + 1].length >= table[i + 1][j].length) {
      tracked.push({
        char: current[j].char,
        createdBy:
          current[j].statusHint === 'inserted'
            ? current[j].createdBy
            : options.insertedCreatedBy,
        format: current[j].format,
        formatChanged: false,
        originalFormat: null,
        originalStyle: null,
        status: 'inserted',
        statusHint: 'inserted',
        style: normalizeStyle(current[j].style),
      });
      j += 1;
      continue;
    }

    tracked.push({
      char: original[i].char,
      createdBy: original[i].createdBy,
      format: original[i].format,
      formatChanged: false,
      originalFormat: original[i].format,
      originalStyle: normalizeStyle(original[i].style),
      status: 'deleted',
      statusHint: 'deleted',
      style: normalizeStyle(original[i].style),
    });
    i += 1;
  }

  while (i < original.length) {
    tracked.push({
      char: original[i].char,
      createdBy: original[i].createdBy,
      format: original[i].format,
      formatChanged: false,
      originalFormat: original[i].format,
      originalStyle: normalizeStyle(original[i].style),
      status: 'deleted',
      statusHint: 'deleted',
      style: normalizeStyle(original[i].style),
    });
    i += 1;
  }

  while (j < current.length) {
    tracked.push({
      char: current[j].char,
      createdBy:
        current[j].statusHint === 'inserted'
          ? current[j].createdBy
          : options.insertedCreatedBy,
      format: current[j].format,
      formatChanged: false,
      originalFormat: null,
      originalStyle: null,
      status: 'inserted',
      statusHint: 'inserted',
      style: normalizeStyle(current[j].style),
    });
    j += 1;
  }

  return tracked;
}

type CollectionMode = 'accepted' | 'original';

function collectCharsFromNode(node: LexicalNode, mode: CollectionMode, chars: BaseChar[]): void {
  if ($isTextNode(node)) {
    const isTrackNode = $isTrackTextNode(node);
    if (isTrackNode && node.isAnchor() && stripCaretAnchor(node.getTextContent()).length === 0) {
      return;
    }

    const trackStatus = isTrackNode ? node.getTrackStatus() : 'retained';
    if (mode === 'accepted' && trackStatus === 'deleted') {
      return;
    }
    if (mode === 'original' && trackStatus === 'inserted') {
      return;
    }

    const text = getAcceptedTextForTextNode(node);
    for (const char of text) {
      chars.push({
        char,
        createdBy: isTrackNode ? node.getCreatedBy() : DEFAULT_CREATED_BY,
        format: node.getFormat(),
        statusHint: trackStatus,
        style: normalizeStyle(node.getStyle()),
      });
    }
    return;
  }

  if ($isElementNode(node)) {
    for (const child of node.getChildren()) {
      collectCharsFromNode(child, mode, chars);
    }
  }
}

export function collectAcceptedChars(): BaseChar[] {
  const root = $getRoot();
  const paragraphs = root.getChildren().filter($isParagraphNode);
  const chars: BaseChar[] = [];

  paragraphs.forEach((child, index) => {
    collectCharsFromNode(child, 'accepted', chars);
    if (index < paragraphs.length - 1) {
      chars.push({
        char: '\n',
        createdBy: DEFAULT_CREATED_BY,
        format: 0,
        statusHint: 'retained',
        style: '',
      });
    }
  });

  return chars;
}

export function collectOriginalChars(): BaseChar[] {
  const root = $getRoot();
  const paragraphs = root.getChildren().filter($isParagraphNode);
  const chars: BaseChar[] = [];

  paragraphs.forEach((child, index) => {
    collectCharsFromNode(child, 'original', chars);
    if (index < paragraphs.length - 1) {
      chars.push({
        char: '\n',
        createdBy: DEFAULT_CREATED_BY,
        format: 0,
        statusHint: 'retained',
        style: '',
      });
    }
  });

  return chars;
}

function acceptedTextLength(node: LexicalNode): number {
  if ($isTextNode(node)) {
    if ($isTrackTextNode(node) && node.getTrackStatus() === 'deleted') {
      return 0;
    }
    return getAcceptedTextForTextNode(node).length;
  }

  if ($isElementNode(node)) {
    return node.getChildren().reduce((total, child) => total + acceptedTextLength(child), 0);
  }

  return 0;
}

function countAcceptedCharsBeforeChild(element: ElementNode, childIndex: number): number {
  let count = 0;
  const children = element.getChildren();
  const limit = Math.min(childIndex, children.length);

  for (let index = 0; index < limit; index += 1) {
    count += acceptedTextLength(children[index]);
  }

  return count;
}

function countAcceptedCharsBeforeNode(root: ElementNode, targetNode: LexicalNode): number {
  let count = 0;
  let found = false;

  function visit(node: LexicalNode): void {
    if (found) {
      return;
    }

    if (node.getKey() === targetNode.getKey()) {
      found = true;
      return;
    }

    if ($isTextNode(node)) {
      count += acceptedTextLength(node);
      return;
    }

    if ($isElementNode(node)) {
      for (const child of node.getChildren()) {
        visit(child);
        if (found) {
          return;
        }
      }
    }
  }

  for (const child of root.getChildren()) {
    visit(child);
    if (found) {
      break;
    }
  }

  return count;
}

function acceptedOffsetWithinParagraph(node: LexicalNode, point: PointType): number {
  if (point.type === 'text') {
    const textNode = node as TextNode;
    if ($isTrackTextNode(textNode) && textNode.getTrackStatus() === 'deleted') {
      return 0;
    }
    return getAcceptedOffsetForTextNode(textNode, point.offset);
  }

  const element = node as ElementNode;
  return countAcceptedCharsBeforeChild(element, point.offset);
}

function paragraphOffsetFromPoint(point: PointType): { index: number; offset: number } | null {
  const node = point.getNode();
  const paragraph = $isParagraphNode(node) ? node : node.getParent();

  if (!paragraph || !$isParagraphNode(paragraph)) {
    return null;
  }

  const root = $getRoot();
  const paragraphs = root.getChildren().filter($isParagraphNode);
  const paragraphIndex = paragraphs.findIndex((item) => item.getKey() === paragraph.getKey());

  if (paragraphIndex === -1) {
    return null;
  }

  const offset = point.type === 'element' && node.getKey() === paragraph.getKey()
    ? countAcceptedCharsBeforeChild(paragraph, point.offset)
    : countAcceptedCharsBeforeNode(paragraph, node) + acceptedOffsetWithinParagraph(node, point);

  return {
    index: paragraphIndex,
    offset,
  };
}

function selectionPointToAcceptedOffset(point: PointType): number | null {
  const position = paragraphOffsetFromPoint(point);

  if (!position) {
    return null;
  }

  const root = $getRoot();
  const paragraphs = root.getChildren().filter($isParagraphNode);
  let acceptedOffset = 0;

  for (let index = 0; index < position.index; index += 1) {
    acceptedOffset += acceptedTextLength(paragraphs[index]);
    acceptedOffset += 1;
  }

  acceptedOffset += position.offset;
  return acceptedOffset;
}

export function getAcceptedSelectionOffsets(selection: RangeSelection | null): AcceptedSelectionOffsets | null {
  if (!selection || !$isRangeSelection(selection)) {
    return null;
  }

  const anchor = selectionPointToAcceptedOffset(selection.anchor);
  const focus = selectionPointToAcceptedOffset(selection.focus);

  if (anchor === null || focus === null) {
    return null;
  }

  return {
    anchor,
    backward: selection.isBackward(),
    focus,
  };
}

function shouldSplitSegment(previous: TrackedChar | null, current: TrackedChar): boolean {
  if (!previous) {
    return false;
  }

  if (
    previous.status !== current.status ||
    previous.createdBy !== current.createdBy ||
    previous.format !== current.format ||
    previous.style !== current.style ||
    previous.formatChanged !== current.formatChanged ||
    previous.originalFormat !== current.originalFormat ||
    previous.originalStyle !== current.originalStyle
  ) {
    return true;
  }

  return /\s/.test(previous.char) !== /\s/.test(current.char);
}

function charsToParagraphs(trackedChars: TrackedChar[]): TrackedChar[][] {
  const paragraphs: TrackedChar[][] = [[]];

  for (const trackedChar of trackedChars) {
    if (trackedChar.char === '\n' && trackedChar.status !== 'deleted') {
      paragraphs.push([]);
      continue;
    }

    if (trackedChar.char === '\n' && trackedChar.status === 'deleted') {
      paragraphs[paragraphs.length - 1].push({
        ...trackedChar,
        char: DELETED_NEWLINE_GLYPH,
      });
      continue;
    }

    paragraphs[paragraphs.length - 1].push(trackedChar);
  }

  return paragraphs;
}

function groupParagraphSegments(chars: TrackedChar[]): InternalSegment[] {
  const segments: InternalSegment[] = [];

  for (const trackedChar of chars) {
    const previousChar = segments.length > 0
      ? ({
          ...segments[segments.length - 1],
          char: segments[segments.length - 1].text.slice(-1),
          statusHint: segments[segments.length - 1].status,
        } as TrackedChar)
      : null;

    if (
      segments.length === 0 ||
      shouldSplitSegment(previousChar, trackedChar)
    ) {
      segments.push({
        createdBy: trackedChar.createdBy,
        format: trackedChar.format,
        formatChanged: trackedChar.formatChanged,
        originalFormat: trackedChar.originalFormat,
        originalStyle: trackedChar.originalStyle,
        status: trackedChar.status,
        style: trackedChar.style,
        text: trackedChar.char,
      });
      continue;
    }

    segments[segments.length - 1].text += trackedChar.char;
  }

  return segments;
}

export function applyTrackedDocument(trackedChars: TrackedChar[]): void {
  const root = $getRoot();
  root.clear();

  const paragraphChars = charsToParagraphs(trackedChars);

  for (const chars of paragraphChars) {
    const paragraph = $createParagraphNode();
    const segments = groupParagraphSegments(chars);
    let hasEditableContent = false;
    let hasAnyTrackedContent = false;

    for (const segment of segments) {
      hasAnyTrackedContent = true;
      const node = $createTrackTextNode(
        segment.text,
        segment.status,
        segment.formatChanged,
        segment.createdBy,
      );
      node.setFormat(segment.format);
      node.setStyle(segment.style);
      paragraph.append(node);
      if (segment.status !== 'deleted') {
        hasEditableContent = true;
      }
    }

    if (hasAnyTrackedContent && !hasEditableContent) {
      paragraph.append($createTrackTextNode(CARET_ANCHOR, 'retained', false, DEFAULT_CREATED_BY, true));
    }

    root.append(paragraph);
  }

  if (root.getChildrenSize() === 0) {
    root.append($createParagraphNode());
  }
}

type ResolvedPoint = {
  node: TextNode | ElementNode;
  offset: number;
  type: 'element' | 'text';
};

function resolvePointAtParagraphStart(paragraph: ElementNode): ResolvedPoint {
  const firstChild = paragraph.getChildren().find(
    (child) =>
      $isTextNode(child) &&
      (!$isTrackTextNode(child) || (child.getTrackStatus() !== 'deleted' && !child.isAnchor())),
  );
  if (firstChild && $isTextNode(firstChild)) {
    return {
      node: firstChild,
      offset: 0,
      type: 'text',
    };
  }

  return {
    node: paragraph,
    offset: 0,
    type: 'element',
  };
}

function resolvePointAtParagraphEnd(paragraph: ElementNode): ResolvedPoint {
  const children = paragraph.getChildren();
  let anchorNode: TextNode | null = null;

  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index];
    if ($isTrackTextNode(child) && child.isAnchor()) {
      anchorNode = child;
      continue;
    }

    if ($isTextNode(child) && (!$isTrackTextNode(child) || child.getTrackStatus() !== 'deleted')) {
      return {
        node: child,
        offset: child.getTextContentSize(),
        type: 'text',
      };
    }
  }

  if (anchorNode) {
    return {
      node: anchorNode,
      offset: 0,
      type: 'text',
    };
  }

  return {
    node: paragraph,
    offset: paragraph.getChildrenSize(),
    type: 'element',
  };
}

export function resolveAcceptedOffset(offset: number): ResolvedPoint {
  const root = $getRoot();
  const paragraphs = root.getChildren().filter($isParagraphNode);
  let remaining = Math.max(offset, 0);

  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const paragraph = paragraphs[paragraphIndex];
    const paragraphLength = acceptedTextLength(paragraph);

    if (remaining <= paragraphLength) {
      const textNodes = paragraph.getChildren().filter($isTextNode);
      let anchorNode: TextNode | null = null;
      let localRemaining = remaining;

      for (const textNode of textNodes) {
        if ($isTrackTextNode(textNode) && textNode.isAnchor()) {
          anchorNode = textNode;
          continue;
        }

        if ($isTrackTextNode(textNode) && textNode.getTrackStatus() === 'deleted') {
          continue;
        }

        const textLength = textNode.getTextContentSize();
        if (localRemaining <= textLength) {
          return {
            node: textNode,
            offset: localRemaining,
            type: 'text',
          };
        }

        localRemaining -= textLength;
      }

      if (anchorNode && remaining === 0) {
        return {
          node: anchorNode,
          offset: 0,
          type: 'text',
        };
      }

      return resolvePointAtParagraphEnd(paragraph);
    }

    remaining -= paragraphLength;

    if (paragraphIndex < paragraphs.length - 1) {
      if (remaining === 0) {
        return resolvePointAtParagraphEnd(paragraph);
      }

      remaining -= 1;
      if (remaining < 0) {
        return resolvePointAtParagraphStart(paragraphs[paragraphIndex + 1]);
      }
    }
  }

  const lastParagraph = paragraphs[paragraphs.length - 1];
  return lastParagraph ? resolvePointAtParagraphEnd(lastParagraph) : { node: root, offset: 0, type: 'element' };
}

export function restoreSelectionFromOffsets(offsets: AcceptedSelectionOffsets | null): void {
  if (!offsets) {
    return;
  }

  const anchorOffset = offsets.backward ? offsets.focus : offsets.anchor;
  const focusOffset = offsets.backward ? offsets.anchor : offsets.focus;
  const anchor = resolveAcceptedOffset(anchorOffset);
  const focus = resolveAcceptedOffset(focusOffset);
  const selection = $createRangeSelection();

  selection.anchor.set(anchor.node.getKey(), anchor.offset, anchor.type);
  selection.focus.set(focus.node.getKey(), focus.offset, focus.type);
  $setSelection(selection);
}

export function initializeDocumentFromText(text: string, createdBy = DEFAULT_CREATED_BY): void {
  const root = $getRoot();
  root.clear();

  const paragraphs = text.split('\n');

  for (const paragraphText of paragraphs) {
    const paragraph = $createParagraphNode();
    if (paragraphText.length > 0) {
      paragraph.append($createTrackTextNode(paragraphText, 'retained', false, createdBy));
    }
    root.append(paragraph);
  }

  if (paragraphs.length === 0) {
    root.append($createParagraphNode());
  }
}

export function initializeDocumentFromBackendWords(words: BackendTrackedWord[]): void {
  const root = $getRoot();
  root.clear();

  let paragraph = $createParagraphNode();
  root.append(paragraph);

  const appendToken = (
    text: string,
    type: TrackStatus,
    createdBy: string,
    addTrailingSpace: boolean,
  ): void => {
    if (text.length > 0) {
      paragraph.append($createTrackTextNode(text, type, false, createdBy || DEFAULT_CREATED_BY));
    }

    if (addTrailingSpace) {
      paragraph.append($createTrackTextNode(' ', type, false, createdBy || DEFAULT_CREATED_BY));
    }
  };

  words.forEach((entry, index) => {
    const createdBy = entry.created_by || DEFAULT_CREATED_BY;
    const parts = entry.word.split('\n');

    parts.forEach((part, partIndex) => {
      const endsParagraph = partIndex < parts.length - 1;
      const nextEntry = words[index + 1];
      const hasNextWordOnSameLine =
        !endsParagraph &&
        typeof nextEntry !== 'undefined' &&
        !entry.word.endsWith('\n');

      appendToken(part, entry.type, createdBy, hasNextWordOnSameLine && part.length > 0);

      if (endsParagraph) {
        paragraph = $createParagraphNode();
        root.append(paragraph);
      }
    });
  });

  if (root.getChildrenSize() === 0) {
    root.append($createParagraphNode());
  }
}

export function getAcceptedTextFromBackendWords(words: BackendTrackedWord[]): string {
  return words
    .filter((entry) => entry.type !== 'deleted')
    .map((entry, index) => {
      const nextEntry = words[index + 1];
      const separator = index < words.length - 1 && nextEntry && !entry.word.endsWith('\n') ? ' ' : '';
      return `${entry.word}${separator}`;
    })
    .join('')
    .replace(/ \n/g, '\n')
    .replace(/\n /g, '\n')
    .trimEnd();
}

export function getAcceptedText(): string {
  return collectAcceptedChars()
    .map((item) => item.char)
    .join('');
}

export function getCurrentSelection(): RangeSelection | null {
  const selection = $getSelection();
  return $isRangeSelection(selection) ? selection : null;
}
