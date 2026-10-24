import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './BigButton.module.css';
import { cx } from './cx';

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Decorative; hidden from screen readers so the label stays clean. */
  readonly icon?: ReactNode;
  readonly variant?: 'primary' | 'plain';
  /** Gently pulses to draw a small child's eye to the next step. */
  readonly pulse?: boolean;
}

export function BigButton({
  icon,
  variant = 'primary',
  pulse = false,
  className,
  children,
  type = 'button',
  ...rest
}: BigButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], pulse && styles.pulse, className)}
      {...rest}
    >
      {icon !== undefined && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </button>
  );
}
