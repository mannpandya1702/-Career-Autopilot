import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', invalid, ...props },
  ref,
) {
  return (
    <input
      type={type}
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex h-9 w-full rounded-md border bg-surface px-3 py-1.5 text-sm text-foreground shadow-elevation-1',
        'placeholder:text-muted-foreground transition-colors duration-150',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-ring',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted',
        invalid
          ? 'border-destructive focus-visible:ring-destructive/70'
          : 'border-input hover:border-muted-foreground/30',
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground shadow-elevation-1',
        'placeholder:text-muted-foreground transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-ring',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted',
        invalid
          ? 'border-destructive focus-visible:ring-destructive/70'
          : 'border-input hover:border-muted-foreground/30',
        className,
      )}
      {...props}
    />
  );
});

export function Label({
  className,
  children,
  required,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn('mb-1.5 block text-xs font-medium text-foreground/80', className)}
      {...props}
    >
      {children}
      {required ? <span className="ml-0.5 text-destructive">*</span> : null}
    </label>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {children}
    </p>
  );
}

export function HelperText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-muted-foreground">{children}</p>;
}
