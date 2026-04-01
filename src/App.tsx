import { useState } from 'react';
import { TrackedChangesEditor } from './editor/TrackedChangesEditor';
import type { BackendTrackedWord } from './editor/tracking';

const backendWords = [
  { word: 'This', type: 'retained', created_by: 'Aarav' },
  { word: 'editor', type: 'retained', created_by: 'Aarav' },
  { word: 'starts', type: 'retained', created_by: 'Aarav' },
  { word: 'with', type: 'retained', created_by: 'Aarav' },
  { word: 'tracked', type: 'inserted', created_by: 'Priya' },
  { word: 'content.', type: 'retained', created_by: 'Aarav' },
  { word: 'Hover', type: 'retained', created_by: 'Aarav' },
  { word: 'any', type: 'retained', created_by: 'Aarav' },
  { word: 'word', type: 'retained', created_by: 'Aarav' },
  { word: 'to', type: 'retained', created_by: 'Aarav' },
  { word: 'see', type: 'retained', created_by: 'Aarav' },
  { word: 'who', type: 'deleted', created_by: 'Neha', deleted_by: 'Naveen' },
  { word: 'created', type: 'retained', created_by: 'Aarav' },
  { word: 'it.', type: 'retained', created_by: 'Aarav' },
] as const;

export default function App() {
  const [acceptedPayload, setAcceptedPayload] = useState('');
  const [changesPayload, setChangesPayload] = useState('');

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Lexical + React + TypeScript</p>
        <h1>Tracked changes editor</h1>
        <p className="intro">
          The editor now accepts backend word records with `word`, `type`, and `created_by`. Hover any tracked word to
          see who created it.
        </p>
        <TrackedChangesEditor
          currentUserName="Naveen"
          initialWords={[...backendWords]}
          onSaveAccepted={(payload) => {
            setAcceptedPayload(JSON.stringify(payload, null, 2));
          }}
          onSaveChanges={(payload: BackendTrackedWord[]) => {
            setChangesPayload(JSON.stringify(payload, null, 2));
          }}
        />
        <section className="payload-grid">
          <div className="payload-card">
            <p className="payload-title">Save payload</p>
            <pre>{acceptedPayload || 'Click Save to capture the accepted content payload.'}</pre>
          </div>
          <div className="payload-card">
            <p className="payload-title">Save Changes payload</p>
            <pre>{changesPayload || 'Click Save Changes to capture the tracked backend payload.'}</pre>
          </div>
        </section>
      </section>
    </main>
  );
}
