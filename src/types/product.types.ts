/**
 * Normalized Product Model for the Dropshipping Application
 */

export interface NormalizedSkuVariantProperty {
  propertyId: number;
  propertyName: string;
  valueId: number;
  valueName: string;
  skuImage?: string;
}

export interface NormalizedSku {
  skuId: string;
  originalPrice: number;
  salePrice: number;
  currency: string;
  availableStock: number;
  skuCode?: string;
  barcode?: string;
  properties: NormalizedSkuVariantProperty[];
}

export interface NormalizedProductAttribute {
  id: number;
  name: string;
  valueId: number;
  value: string;
}

export interface NormalizedVideo {
  id: string;
  posterUrl: string;
  videoUrl: string;
}

export interface NormalizedPackageInfo {
  isCustomPackage: boolean;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
}

export interface NormalizedShippingInfo {
  estimatedDeliveryDays?: number;
  shipToCountry?: string;
  shippingFee?: number;
  carrierName?: string;
}

export interface NormalizedProduct {
  productId: string;
  title: string;
  categoryId: number;
  status: string;
  currency: string;
  priceRange: {
    minOriginalPrice: number;
    maxOriginalPrice: number;
    minSalePrice: number;
    maxSalePrice: number;
  };
  totalStock: number;
  images: string[];
  videos: NormalizedVideo[];
  attributes: NormalizedProductAttribute[];
  skus: NormalizedSku[];
  packageInfo?: NormalizedPackageInfo;
  shippingInfo?: NormalizedShippingInfo;
  descriptionHtml?: string;
  rating?: {
    averageRating: number;
    totalReviews: number;
  };
  createdAt?: string;
  updatedAt?: string;
  rawResponse?: unknown;
}
