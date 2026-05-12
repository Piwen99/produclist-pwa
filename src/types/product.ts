export type Category = 
  | 'Frutos Secos' 
  | 'Semillas/Cereal' 
  | 'Fruta Deshidratada' 
  | 'Legumbres';

export interface Product {
  id?: number;
  nombre: string;
  categoria: Category;
  formato: string;
  precioNeto: number;
  disponible: boolean;
}

export interface ProductInput {
  nombre: string;
  categoria: Category;
  formato: string;
  precioNeto: number;
  disponible: boolean;
}
