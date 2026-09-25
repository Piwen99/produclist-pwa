import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { QuoteItem, QuoteTotals } from '../types/quote';
import { formatCurrency, tryParseChileanNumber } from '../utils/price';

// ------------------------------------------------------------------
// Styles — same olive palette as the product price list PDF
// ------------------------------------------------------------------
const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#333',
    backgroundColor: '#fafaf5',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#5a6e3e',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#5a6e3e',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 9,
    color: '#7a8e5e',
  },
  cliente: {
    fontSize: 9,
    color: '#333',
    marginTop: 2,
  },
  company: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#5a6e3e',
    textAlign: 'right',
  },

  // Table wrapper
  table: {
    width: '100%',
  },

  // ── Column widths (5 columns) ──
  colProducto: { width: '36%' },
  colFormato: { width: '14%' },
  colCantidad: { width: '10%' },
  colPrecio: { width: '18%' },
  colSubtotal: { width: '22%' },

  // ── Header row ──
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#5a6e3e',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  headerCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRightWidth: 0.5,
    borderRightColor: '#6b8056',
  },
  headerCellLast: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#ffffff',
  },
  headerTextRight: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#ffffff',
    textAlign: 'right',
  },

  // ── Data rows ──
  dataRow: {
    flexDirection: 'row',
    borderLeftWidth: 0.5,
    borderLeftColor: '#d5d9c5',
    borderRightWidth: 0.5,
    borderRightColor: '#d5d9c5',
  },
  dataRowEven: {
    backgroundColor: '#ffffff',
  },
  dataRowOdd: {
    backgroundColor: '#f4f6eb',
  },
  cell: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRightWidth: 0.5,
    borderRightColor: '#d5d9c5',
    borderBottomWidth: 0.5,
    borderBottomColor: '#d5d9c5',
  },
  cellLast: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#d5d9c5',
  },

  // ── Cell text styles ──
  cellText: {
    fontSize: 9,
    color: '#333',
  },
  cellTextRight: {
    fontSize: 9,
    color: '#333',
    textAlign: 'right',
  },
  cellBoldRight: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#333',
    textAlign: 'right',
  },

  // ── Empty state ──
  empty: {
    paddingVertical: 32,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 10,
    color: '#7a8e5e',
  },

  // ── Totals block ──
  totals: {
    marginTop: 12,
    width: '45%',
    alignSelf: 'flex-end',
    borderWidth: 0.5,
    borderColor: '#d5d9c5',
    backgroundColor: '#ffffff',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e3e6d8',
  },
  totalsRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#5a6e3e',
  },
  totalsLabel: {
    fontSize: 9,
    color: '#666',
  },
  totalsValue: {
    fontSize: 9,
    color: '#333',
  },
  totalsLabelBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#333',
  },
  totalsValueBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#5a6e3e',
  },

  // ── Footer ──
  contentWrap: {
    flex: 1,
  },
  footer: {
    marginTop: 20,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#d5d9c5',
    textAlign: 'center',
    fontSize: 8,
    color: '#b0b0a8',
  },
});

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear());
  return `${d}/${m}/${y}`;
}

function formatKg(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} kg`;
}

function itemSubtotal(item: QuoteItem): number {
  const kg = (tryParseChileanNumber(item.formato) ?? 0) * item.cantidad;
  return kg * item.precioKg;
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------
function TableHeader() {
  return (
    <View style={styles.headerRow}>
      <View style={[styles.headerCell, styles.colProducto]}>
        <Text style={styles.headerText}>PRODUCTO</Text>
      </View>
      <View style={[styles.headerCell, styles.colFormato]}>
        <Text style={styles.headerTextRight}>FORMATO</Text>
      </View>
      <View style={[styles.headerCell, styles.colCantidad]}>
        <Text style={styles.headerTextRight}>CANT.</Text>
      </View>
      <View style={[styles.headerCell, styles.colPrecio]}>
        <Text style={styles.headerTextRight}>$/kg</Text>
      </View>
      <View style={[styles.headerCellLast, styles.colSubtotal]}>
        <Text style={styles.headerTextRight}>SUBTOTAL</Text>
      </View>
    </View>
  );
}

function QuoteRow({ item, index }: { item: QuoteItem; index: number }) {
  const rowStyle = index % 2 === 0 ? styles.dataRowEven : styles.dataRowOdd;

  return (
    // wrap={false} keeps the whole row on one page, mirroring the product PDF.
    <View style={[styles.dataRow, rowStyle]} wrap={false}>
      <View style={[styles.cell, styles.colProducto]}>
        <Text style={styles.cellText}>{item.nombre}</Text>
      </View>
      <View style={[styles.cell, styles.colFormato]}>
        <Text style={styles.cellTextRight}>{item.formato}</Text>
      </View>
      <View style={[styles.cell, styles.colCantidad]}>
        <Text style={styles.cellTextRight}>{item.cantidad}</Text>
      </View>
      <View style={[styles.cell, styles.colPrecio]}>
        <Text style={styles.cellTextRight}>{formatCurrency(item.precioKg)}</Text>
      </View>
      <View style={[styles.cellLast, styles.colSubtotal]}>
        <Text style={styles.cellBoldRight}>{formatCurrency(itemSubtotal(item))}</Text>
      </View>
    </View>
  );
}

function TotalsBlock({ totals }: { totals: QuoteTotals }) {
  return (
    <View style={styles.totals} minPresenceAhead={60}>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Total kg</Text>
        <Text style={styles.totalsValue}>{formatKg(totals.totalKg)}</Text>
      </View>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Subtotal Neto</Text>
        <Text style={styles.totalsValue}>{formatCurrency(totals.subtotal)}</Text>
      </View>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>IVA 19%</Text>
        <Text style={styles.totalsValue}>{formatCurrency(totals.iva)}</Text>
      </View>
      <View style={styles.totalsRowLast}>
        <Text style={styles.totalsLabelBold}>Total a pagar</Text>
        <Text style={styles.totalsValueBold}>{formatCurrency(totals.total)}</Text>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------
// Main Document
// ------------------------------------------------------------------
interface QuotePDFDocumentProps {
  items: QuoteItem[];
  totals: QuoteTotals;
  cliente?: string;
}

export function QuotePDFDocument({ items, totals, cliente }: QuotePDFDocumentProps) {
  const today = new Date();
  const clienteName = cliente?.trim();

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.contentWrap}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Cotización</Text>
              <Text style={styles.subtitle}>{formatDate(today)}</Text>
              {clienteName ? (
                <Text style={styles.cliente}>Cliente: {clienteName}</Text>
              ) : null}
            </View>
            <Text style={styles.company}>Andes Granel</Text>
          </View>

          {/* Table or empty state */}
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Sin productos</Text>
            </View>
          ) : (
            <View style={styles.table}>
              <TableHeader />
              {items.map((item, i) => (
                <QuoteRow key={item.id} item={item} index={i} />
              ))}
            </View>
          )}

          <TotalsBlock totals={totals} />
        </View>

        {/* Footer — normal flow, no overlap */}
        <Text style={styles.footer}>
          Generado el {formatDate(today)} — Andes Granel — {items.length} ítems
        </Text>
      </Page>
    </Document>
  );
}

// Re-export PDFDownloadLink so consumers can lazy-load the whole PDF pipeline.
export { PDFDownloadLink } from '@react-pdf/renderer';