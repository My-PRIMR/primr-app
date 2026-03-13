import type { WizardState } from '@/types/outline'
import styles from './Step1Form.module.css'

interface Props {
  state: WizardState
  onField: (field: string, value: string) => void
  onSubmit: () => void
}

const EXAMPLES = [
  { title: 'How TCP/IP Handshakes Work', topic: 'Explain the three-way handshake in TCP, how connections are established and torn down, and common issues.' },
  { title: 'The Basics of Compound Interest', topic: 'Teach the concept of compound interest, the formula, and how it applies to savings and debt.' },
  { title: 'Introduction to Git Branching', topic: 'Cover creating branches, merging, rebasing, and resolving merge conflicts in Git.' },
]

export default function Step1Form({ state, onField, onSubmit }: Props) {
  const canSubmit = state.title.trim() && state.topic.trim()

  return (
    <div className={styles.form}>
      <h1 className={styles.heading}>Create a new lesson</h1>
      <p className={styles.sub}>Fill in the basics and we'll generate an outline for you to review.</p>

      <label className={styles.label}>
        Lesson title
        <input
          className={styles.input}
          placeholder="e.g. How TCP/IP Handshakes Work"
          value={state.title}
          onChange={e => onField('title', e.target.value)}
          autoFocus
        />
      </label>

      <label className={styles.label}>
        What should this lesson teach?
        <textarea
          className={styles.textarea}
          placeholder="Describe the topic, key concepts to cover, and any specific examples you'd like to include..."
          value={state.topic}
          onChange={e => onField('topic', e.target.value)}
          rows={4}
        />
      </label>

      <div className={styles.row}>
        <label className={styles.label}>
          Audience
          <input
            className={styles.input}
            placeholder="e.g. Junior developers"
            value={state.audience}
            onChange={e => onField('audience', e.target.value)}
          />
        </label>

        <label className={styles.label}>
          Level
          <select
            className={styles.select}
            value={state.level}
            onChange={e => onField('level', e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
      </div>

      <div className={styles.examples}>
        <span className={styles.examplesLabel}>Try an example:</span>
        {EXAMPLES.map(ex => (
          <button
            key={ex.title}
            type="button"
            className={styles.exampleChip}
            onClick={() => { onField('title', ex.title); onField('topic', ex.topic) }}
          >
            {ex.title}
          </button>
        ))}
      </div>

      {state.error && <p className={styles.error}>{state.error}</p>}

      <button
        className={styles.submit}
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        Generate outline →
      </button>
    </div>
  )
}
