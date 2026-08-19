import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Product, Category } from '../types/product';
import { calcPrecioBruto, calcTotal } from '../utils/price';

// ------------------------------------------------------------------
// Styles — Paleta verde oliva con grilla tipo Excel
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

  // ── Column widths (4 columns) ──
  colProducto: { width: '33%' },
  colNeto: { width: '23%' },
  colBruto: { width: '22%' },
  colTotal: { width: '22%' },

  // ── Header row (dark olive) ──
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
  headerTextCenter: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#ffffff',
    textAlign: 'center',
  },

  // ── Category header (medium olive) ──
  categoryRow: {
    flexDirection: 'row',
    backgroundColor: '#7a8e5e',
    marginTop: 8,
  },
  categoryCell: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#6b8056',
  },
  categoryText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#ffffff',
  },

  // ── Data rows ──
  dataRow: {
    flexDirection: 'row',
    // minHeight prevents react-pdf from splitting a row across pages (a row
    // that doesn't fully fit is pushed whole to the next page instead of
    // leaving the product name on one page and its price columns on the next).
    minHeight: 20,
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
  cellBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#333',
  },
  cellBoldRight: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#333',
    textAlign: 'right',
  },
  formatoInline: {
    fontSize: 8,
    color: '#7a8e5e',
  },

  // ── Footer (normal flow, no overlap) ──
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
const CATEGORY_ORDER: Category[] = [
  'Frutos Secos',
  'Semillas/Cereal',
  'Fruta Deshidratada',
  'Legumbres',
];

function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear());
  return `${d}/${m}/${y}`;
}

function formatPrice(value: number): string {
  return `$ ${value.toLocaleString('es-CL')}`;
}

function groupByCategory(products: Product[]): Partial<Record<Category, Product[]>> {
  const groups: Partial<Record<Category, Product[]>> = {};
  for (const cat of CATEGORY_ORDER) {
    groups[cat] = [];
  }
  for (const p of products) {
    const entry = groups[p.categoria];
    if (entry) {
      entry.push(p);
    } else {
      groups[p.categoria] = [p];
    }
  }
  return groups;
}

function sortProducts(products: Product[]): Product[] {
  return [...products].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
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
      <View style={[styles.headerCell, styles.colNeto]}>
        <Text style={styles.headerTextRight}>PRECIO NETO</Text>
      </View>
      <View style={[styles.headerCell, styles.colBruto]}>
        <Text style={styles.headerTextRight}>PRECIO BRUTO</Text>
      </View>
      <View style={[styles.headerCellLast, styles.colTotal]}>
        <Text style={styles.headerTextRight}>TOTAL</Text>
      </View>
    </View>
  );
}

function ProductRow({ product, index }: { product: Product; index: number }) {
  const bruto = calcPrecioBruto(product.precioNeto);
  const total = calcTotal(product.formato, bruto);
  const rowStyle = index % 2 === 0 ? styles.dataRowEven : styles.dataRowOdd;

  return (
    <View style={[styles.dataRow, rowStyle]}>
      <View style={[styles.cell, styles.colProducto]}>
        <Text style={styles.cellText}>
          <Text>{product.nombre}</Text>
          <Text style={styles.formatoInline}>{'  —  '}{product.formato} kg</Text>
        </Text>
      </View>
      <View style={[styles.cell, styles.colNeto]}>
        <Text style={styles.cellTextRight}>{formatPrice(product.precioNeto)}</Text>
      </View>
      <View style={[styles.cell, styles.colBruto]}>
        <Text style={styles.cellBoldRight}>{formatPrice(bruto)}</Text>
      </View>
      <View style={[styles.cellLast, styles.colTotal]}>
        <Text style={styles.cellBoldRight}>{formatPrice(total)}</Text>
      </View>
    </View>
  );
}

function CategorySection({
  category,
  products,
  startIndex,
}: {
  category: string;
  products: Product[];
  startIndex: number;
}) {
  if (products.length === 0) return null;
  const sorted = sortProducts(products);

  return (
    <View>
      <View style={styles.categoryRow}>
        <View style={[styles.categoryCell, { width: '100%' }]}>
          <Text style={styles.categoryText}>{category}</Text>
        </View>
      </View>
      {sorted.map((p, i) => (
        <ProductRow key={p.id ?? p.nombre} product={p} index={startIndex + i} />
      ))}
    </View>
  );
}

// ------------------------------------------------------------------
// Main Document
// ------------------------------------------------------------------
interface ProductPDFDocumentProps {
  products?: Product[];
}

export function ProductPDFDocument({ products: propProducts }: ProductPDFDocumentProps) {
  const liveProducts = useLiveQuery(() => db.products.toArray(), []);
  const products = (propProducts ?? liveProducts ?? []).filter(p => p.disponible);

  const today = new Date();
  const grouped = groupByCategory(products);

  // Compute cumulative indices so alternating colors flow across categories
  const categorySections = CATEGORY_ORDER.reduce<{ cat: Category; products: Product[]; startIndex: number }[]>((sections, cat) => {
    const categoryProducts = grouped[cat] ?? [];
    const startIndex = sections.reduce((sum, s) => sum + s.products.length, 0);
    sections.push({ cat, products: categoryProducts, startIndex });
    return sections;
  }, []);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.contentWrap}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Lista de Precios</Text>
              <Text style={styles.subtitle}>{formatDate(today)}</Text>
            </View>
            <Text style={styles.company}>Andes Granel</Text>
          </View>

          {/* Table */}
          <View style={styles.table}>
            <TableHeader />
            {categorySections.map(({ cat, products, startIndex }) => (
              <CategorySection
                key={cat}
                category={cat}
                products={products}
                startIndex={startIndex}
              />
            ))}
          </View>
        </View>

        {/* Footer — normal flow, no overlap */}
        <Text style={styles.footer}>
          Generado el {formatDate(today)} — Andes Granel — {products.length} productos
        </Text>
      </Page>
    </Document>
  );
}

// Re-export PDFDownloadLink for consumers
export { PDFDownloadLink } from '@react-pdf/renderer';
