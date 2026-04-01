import type { EditorConfig, LexicalNode, NodeKey, SerializedTextNode, Spread } from 'lexical';
import { TextNode } from 'lexical';

export type TrackStatus = 'retained' | 'inserted' | 'deleted';

export type SerializedTrackTextNode = Spread<
  {
    createdBy: string;
    isAnchor: boolean;
    formatChanged: boolean;
    trackStatus: TrackStatus;
    type: 'track-text';
    version: 1;
  },
  SerializedTextNode
>;

export class TrackTextNode extends TextNode {
  __createdBy: string;
  __trackStatus: TrackStatus;
  __formatChanged: boolean;
  __isAnchor: boolean;

  static getType(): string {
    return 'track-text';
  }

  static clone(node: TrackTextNode): TrackTextNode {
    const clone = new TrackTextNode(
      node.__text,
      node.__trackStatus,
      node.__formatChanged,
      node.__createdBy,
      node.__isAnchor,
      node.__key,
    );
    clone.__format = node.__format;
    clone.__style = node.__style;
    clone.__mode = node.__mode;
    clone.__detail = node.__detail;
    return clone;
  }

  static importJSON(serializedNode: SerializedTrackTextNode): TrackTextNode {
    const node = $createTrackTextNode(
      serializedNode.text,
      serializedNode.trackStatus,
      serializedNode.formatChanged,
      serializedNode.createdBy,
      serializedNode.isAnchor,
    );
    node.setFormat(serializedNode.format);
    node.setStyle(serializedNode.style);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    return node;
  }

  constructor(
    text: string,
    trackStatus: TrackStatus,
    formatChanged = false,
    createdBy = '',
    isAnchor = false,
    key?: NodeKey,
  ) {
    super(text, key);
    this.__createdBy = createdBy;
    this.__trackStatus = trackStatus;
    this.__formatChanged = formatChanged;
    this.__isAnchor = isAnchor;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    this.updateTrackedAttributes(dom);
    return dom;
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    const updated = super.updateDOM(prevNode, dom, config);
    if (
      updated ||
      prevNode.__createdBy !== this.__createdBy ||
      prevNode.__trackStatus !== this.__trackStatus ||
      prevNode.__formatChanged !== this.__formatChanged ||
      prevNode.__isAnchor !== this.__isAnchor
    ) {
      this.updateTrackedAttributes(dom);
    }
    return updated;
  }

  exportJSON(): SerializedTrackTextNode {
    return {
      ...super.exportJSON(),
      createdBy: this.__createdBy,
      isAnchor: this.__isAnchor,
      formatChanged: this.__formatChanged,
      trackStatus: this.__trackStatus,
      type: 'track-text',
      version: 1,
    };
  }

  getTrackStatus(): TrackStatus {
    return this.getLatest().__trackStatus;
  }

  getCreatedBy(): string {
    return this.getLatest().__createdBy;
  }

  getFormatChanged(): boolean {
    return this.getLatest().__formatChanged;
  }

  isAnchor(): boolean {
    return this.getLatest().__isAnchor;
  }

  setTrackStatus(trackStatus: TrackStatus): this {
    const writable = this.getWritable();
    writable.__trackStatus = trackStatus;
    if (trackStatus === 'deleted') {
      writable.setMode('token');
    }
    return writable;
  }

  setCreatedBy(createdBy: string): this {
    const writable = this.getWritable();
    writable.__createdBy = createdBy;
    return writable;
  }

  setFormatChanged(formatChanged: boolean): this {
    const writable = this.getWritable();
    writable.__formatChanged = formatChanged;
    return writable;
  }

  setAnchor(isAnchor: boolean): this {
    const writable = this.getWritable();
    writable.__isAnchor = isAnchor;
    return writable;
  }

  canInsertTextBefore(): boolean {
    return this.getTrackStatus() !== 'deleted';
  }

  canInsertTextAfter(): boolean {
    return this.getTrackStatus() !== 'deleted';
  }

  isTextEntity(): boolean {
    return this.getTrackStatus() === 'deleted';
  }

  updateTrackedAttributes(dom: HTMLElement): void {
    dom.dataset.trackStatus = this.getTrackStatus();
    dom.dataset.createdBy = this.getCreatedBy();
    dom.dataset.formatChange = this.getFormatChanged() ? 'true' : 'false';
    dom.dataset.trackAnchor = this.isAnchor() ? 'true' : 'false';
    dom.title = this.isAnchor() || !this.getCreatedBy() ? '' : `Created by: ${this.getCreatedBy()}`;
  }
}

export function $createTrackTextNode(
  text: string,
  trackStatus: TrackStatus,
  formatChanged = false,
  createdBy = '',
  isAnchor = false,
): TrackTextNode {
  const node = new TrackTextNode(text, trackStatus, formatChanged, createdBy, isAnchor);
  if (trackStatus === 'deleted') {
    node.setMode('token');
  }
  return node;
}

export function $isTrackTextNode(node: LexicalNode | null | undefined): node is TrackTextNode {
  return node instanceof TrackTextNode;
}
