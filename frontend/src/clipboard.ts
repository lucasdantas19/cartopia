export interface ClipboardWriter {
  writeText(value: string): Promise<void>
}

export async function copyText(value: string, clipboard: ClipboardWriter | null | undefined): Promise<boolean> {
  if (!clipboard) return false

  try {
    await clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}
