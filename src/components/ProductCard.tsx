"use client";
import { Product } from "@/data/products";
import Link from "next/link";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.id}`} className="group">
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-100 overflow-hidden">
        {/* Image */}
        <div className="relative aspect-[4/5] bg-gray-100 overflow-hidden">
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {product.discount > 15 && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
              {product.discount}% OFF
            </span>
          )}
          {product.inventory <= 3 && product.inventory > 0 && (
            <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
              Only {product.inventory} left
            </span>
          )}
          {product.tags.includes("Bestseller") && (
            <span className="absolute bottom-2 left-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">
              ⭐ Bestseller
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="text-xs text-gray-500 mb-1">{product.seller}</p>
          <h3 className="text-sm font-medium text-gray-800 line-clamp-2 mb-1 group-hover:text-pink-600 transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-gray-900">₹{product.price.toLocaleString()}</span>
            {product.discount > 0 && (
              <>
                <span className="text-sm text-gray-400 line-through">₹{product.mrp.toLocaleString()}</span>
                <span className="text-sm text-green-600 font-medium">{product.discount}% off</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5">
              {product.rating.toFixed(1)} ★
            </span>
            <span className="text-xs text-gray-500">({product.reviewCount})</span>
          </div>
          <div className="flex gap-1 mt-2 flex-wrap">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{product.fabric}</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{product.tags[0]}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
