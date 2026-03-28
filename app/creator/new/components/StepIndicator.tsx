import type { WizardStep } from '@/types/outline'
import styles from './StepIndicator.module.css'

const STEPS: { label: string }[] = [
  { label: 'Details' },
  { label: 'Generating' },
  { label: 'Preview' },
]

export default function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <div className={styles.bar}>
      {STEPS.map((s, i) => {
        const step = (i + 1) as WizardStep
        const state = step < current ? 'done' : step === current ? 'active' : 'upcoming'
        return (
          <div key={s.label} className={`${styles.step} ${styles[state]}`}>
            <div className={styles.dot}>{state === 'done' ? '✓' : step}</div>
            <span className={styles.label}>{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}
