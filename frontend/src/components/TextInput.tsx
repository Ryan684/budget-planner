import styles from './TextInput.module.css'

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function TextInput({ value, onChange, placeholder, autoFocus }: TextInputProps) {
  return (
    <input
      className={styles.input}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  )
}
