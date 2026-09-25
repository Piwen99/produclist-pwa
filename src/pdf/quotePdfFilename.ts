function buildDatePart(): string {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalize a client name into a safe filename slug.
 * Lowercases, strips accents, collapses any run of non [a-z0-9] into a single
 * dash, then trims leading/trailing dashes. Returns '' when nothing is left.
 */
export function slugifyCliente(cliente: string): string {
  return cliente
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build the download name for a quote PDF.
 * `cotizacion-YYYY-MM-DD.pdf`, or `cotizacion-YYYY-MM-DD-{cliente-slug}.pdf`
 * when the client slug is non-empty. Never contains slashes or spaces.
 */
export function getQuotePDFFileName(cliente?: string): string {
  const date = buildDatePart();
  const slug = cliente ? slugifyCliente(cliente) : '';
  return slug ? `cotizacion-${date}-${slug}.pdf` : `cotizacion-${date}.pdf`;
}