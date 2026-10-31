import { Controller, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form'
import { Network, NETWORK_LABEL, Provider, PROVIDER_LABEL } from '@/api/contracts'
import { Field } from '@/components/common/Field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type Option = { value: string; label: string }
export const NETWORK_OPTIONS = Network.options.map((n) => ({ value: n, label: NETWORK_LABEL[n] }))
export const PROVIDER_OPTIONS = Provider.options.map((p) => ({ value: p, label: PROVIDER_LABEL[p] }))
export type FieldDef<T extends FieldValues> = {
  name: Path<T>
  label: string
  required?: boolean
  placeholder?: string
  type?: 'text' | 'email' | 'select' | 'ens'
  options?: Option[]
  autoComplete?: string
  hideLabel?: boolean
}

const errorOf = (errors: Record<string, unknown>, name: string) =>
  (name.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], errors) as { message?: string } | undefined)?.message

/** Renders a grid of labelled inputs/selects bound to react-hook-form (layout of the Figma forms). */
export function FormFields<T extends FieldValues>({ form, fields, className }: { form: UseFormReturn<T>; fields: FieldDef<T>[]; className?: string }) {
  return (
    <div className={cn('grid gap-x-4 gap-y-5 sm:grid-cols-2', className)}>
      {fields.map((f) => (
        <Field key={f.name} label={f.label} required={f.required} srOnlyLabel={f.hideLabel} error={errorOf(form.formState.errors, f.name)}>
          {(p) =>
            f.type === 'select' ? (
              <Controller
                control={form.control}
                name={f.name}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger {...p} onBlur={field.onBlur} className="h-10 w-full rounded-sm border-input bg-tile text-sm data-[placeholder]:text-muted-foreground">
                      <SelectValue placeholder={f.placeholder} />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
                      {f.options!.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : f.type === 'ens' ? (
              <div className="flex gap-2">
                <span className="grid h-10 shrink-0 place-items-center rounded-sm border border-input bg-tile px-3 text-sm" aria-hidden="true">.eth</span>
                <Input {...p} {...form.register(f.name)} placeholder={f.placeholder} autoComplete="off" />
              </div>
            ) : (
              <Input {...p} {...form.register(f.name)} type={f.type ?? 'text'} placeholder={f.placeholder} autoComplete={f.autoComplete} />
            )
          }
        </Field>
      ))}
    </div>
  )
}
