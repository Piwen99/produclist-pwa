import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Product, Category } from '../types/product';
import { calcPrecioBruto } from '../utils/price';

// ------------------------------------------------------------------
// Styles
// ------------------------------------------------------------------
const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  date: {
    fontSize: 9,
    color: '#666',
  },
  company: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#444',
    textAlign: 'right',
  },
  table: {
    width: '100%',
    marginTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#bbb',
    paddingVertical: 6,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#222',
  },
  categoryHeader: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#222',
  },
  colProducto: { width: '35%' },
  colFormato: { width: '15%', textAlign: 'center' },
  colNeto: { width: '17.5%', textAlign: 'right' },
  colBruto: { width: '17.5%', textAlign: 'right' },
  colDisp: { width: '15%', textAlign: 'center' },
  cellText: {
    fontSize: 9,
    color: '#333',
  },
  cellBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#333',
  },
  disponibleYes: {
    fontSize: 9,
    color: '#2e7d32',
    textAlign: 'center',
  },
  disponibleNo: {
    fontSize: 9,
    color: '#c62828',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 24,
    right: 24,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
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
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function formatPrice(value: number): string {
  return `$ ${value.toLocaleString('es-CL')}`;
}

function groupByCategory(products: Product[]): Record<Category, Product[]> {
  const groups = {} as Record<Category, Product[]>;
  for (const cat of CATEGORY_ORDER) {
    groups[cat] = [];
  }
  for (const p of products) {
    if (groups[p.categoria]) {
      groups[p.categoria].push(p);
    } else {
      // Fallback for any unknown category
      (groups as Record<string, Product[]>)[p.categoria] = [p];
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
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderText, styles.colProducto]}>PRODUCTO</Text>
      <Text style={[styles.tableHeaderText, styles.colFormato]}>FORMATO</Text>
      <Text style={[styles.tableHeaderText, styles.colNeto]}>PRECIO NETO</Text>
      <Text style={[styles.tableHeaderText, styles.colBruto]}>PRECIO BRUTO</Text>
      <Text style={[styles.tableHeaderText, styles.colDisp]}>DISPONIBLE</Text>
    </View>
  );
}

function ProductRow({ product }: { product: Product }) {
  const bruto = calcPrecioBruto(product.precioNeto);
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.cellText, styles.colProducto]}>{product.nombre}</Text>
      <Text style={[styles.cellText, styles.colFormato]}>{product.formato}</Text>
      <Text style={[styles.cellText, styles.colNeto]}>{formatPrice(product.precioNeto)}</Text>
      <Text style={[styles.cellBold, styles.colBruto]}>{formatPrice(bruto)}</Text>
      <Text style={product.disponible ? styles.disponibleYes : styles.disponibleNo}>
        {product.disponible ? 'Sí' : 'No'}
      </Text>
    </View>
  );
}

function CategorySection({ category, products }: { category: string; products: Product[] }) {
  if (products.length === 0) return null;
  const sorted = sortProducts(products);
  return (
    <View>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryText}>{category}</Text>
      </View>
      {sorted.map((p) => (
        <ProductRow key={p.id ?? p.nombre} product={p} />
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
  // Task requirement: use useLiveQuery inside Document
  const liveProducts = useLiveQuery(() => db.products.toArray(), []);
  const products = propProducts ?? liveProducts ?? [];

  const today = new Date();
  const grouped = groupByCategory(products);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Lista de Precios</Text>
            <Text style={styles.date}>{formatDate(today)}</Text>
          </View>
          <Text style={styles.company}>Andes Granel</Text>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <TableHeader />
          {CATEGORY_ORDER.map((cat) => (
            <CategorySection key={cat} category={cat} products={grouped[cat]} />
          ))}
        </View>

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Generado el {formatDate(today)} — Andes Granel
        </Text>
      </Page>
    </Document>
  );
}

// ------------------------------------------------------------------
// Filename helper
// ------------------------------------------------------------------
export function getPDFFileName(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `lista-precios-${y}-${m}-${d}.pdf`;
}

// Re-export PDFDownloadLink for consumers
export { PDFDownloadLink };
