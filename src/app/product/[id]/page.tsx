"use client";
import { products } from "@/data/products";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import AgentPanel from "@/components/AgentPanel";

export default function ProductPage() {
  const params = useParams();
  const product = products.find((p) => p.id === params.id);
  const [selectedImage, setSelectedImage] = useState(0);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl mb-4">😕</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Product not found</h1>
          <Link href="/" className="text-pink-600 hover:underline">← Back to shop</Link>
        </div>
      </div>
    );
  }

  const similar = products
    .filter((p) => p.tags[0] === product.tags[0] && p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-6 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            🛍️ Sundari Silks
          </Link>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>🛒 Cart (0)</span>
            <span>❤️ Wishlist</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-pink-600">Home</Link>
          <span className="mx-2">›</span>
          <Link href={`/?category=${product.tags[0]}`} className="hover:text-pink-600">{product.tags[0]}</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-800">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Images */}
          <div>
            <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-4 aspect-[4/5]">
              <img
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-3">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-20 h-24 rounded-lg overflow-hidden border-2 ${selectedImage === i ? "border-pink-600" : "border-gray-200"}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <p className="text-sm text-gray-500 mb-1">{product.seller}</p>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-green-600 text-white px-2 py-0.5 rounded text-sm font-medium">
                {product.rating.toFixed(1)} ★
              </span>
              <span className="text-gray-500 text-sm">{product.reviewCount} ratings</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-bold text-gray-900">₹{product.price.toLocaleString()}</span>
              {product.discount > 0 && (
                <>
                  <span className="text-xl text-gray-400 line-through">₹{product.mrp.toLocaleString()}</span>
                  <span className="text-lg text-green-600 font-semibold">{product.discount}% off</span>
                </>
              )}
            </div>

            {/* Stock */}
            {product.inventory <= 3 && product.inventory > 0 && (
              <p className="text-orange-600 text-sm font-medium mb-4">⚡ Only {product.inventory} left in stock!</p>
            )}
            {product.inventory === 0 && (
              <p className="text-red-600 text-sm font-medium mb-4">❌ Out of stock</p>
            )}

            {/* Details Table */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">Product Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Fabric:</span> <span className="font-medium">{product.fabric}</span></div>
                <div><span className="text-gray-500">Color:</span> <span className="font-medium">{product.color}</span></div>
                <div><span className="text-gray-500">Region:</span> <span className="font-medium">{product.tags[0]}</span></div>
                <div><span className="text-gray-500">Weave:</span> <span className="font-medium">{product.style}</span></div>
                <div><span className="text-gray-500">Weight:</span> <span className="font-medium">{product.fabric}</span></div>
                <div><span className="text-gray-500">Style:</span> <span className="font-medium">{product.style}</span></div>
                <div><span className="text-gray-500">Occasion:</span> <span className="font-medium">{product.occasion.join(", ")}</span></div>
              </div>
            </div>

            <p className="text-gray-600 text-sm mb-6">{product.description}</p>

            {/* Buttons */}
            <div className="flex gap-3 mb-8">
              <button className="flex-1 bg-pink-600 text-white py-3 rounded-xl font-semibold hover:bg-pink-700 transition-colors text-lg">
                🛒 Add to Cart
              </button>
              <button className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors text-lg">
                ⚡ Buy Now
              </button>
              <button className="w-14 border-2 border-gray-300 rounded-xl hover:border-pink-600 hover:text-pink-600 transition-colors text-xl">
                ♡
              </button>
            </div>

            {/* Tags */}
            <div className="flex gap-2 flex-wrap">
              {product.tags.map((tag) => (
                <span key={tag} className="bg-pink-50 text-pink-600 text-xs px-3 py-1 rounded-full border border-pink-200">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="mt-12 bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Reviews ({product.reviewCount})</h2>
          <div className="space-y-4">
            {product.reviews.map((review, i) => (
              <div key={i} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded text-white ${review.rating >= 4 ? "bg-green-600" : review.rating >= 3 ? "bg-yellow-500" : "bg-red-500"}`}>
                    {review.rating} ★
                  </span>
                  <span className="text-sm font-medium text-gray-800">{review.name}</span>
                  <span className="text-xs text-gray-400">{review.date}</span>
                </div>
                <p className="text-sm text-gray-600">{review.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Similar Products */}
        {similar.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Similar Sarees</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {similar.map((p) => (
                <Link key={p.id} href={`/product/${p.id}`} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="aspect-[4/5] bg-gray-100">
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-800 line-clamp-1">{p.name}</h3>
                    <p className="text-lg font-bold">₹{p.price.toLocaleString()}</p>
                    <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">{p.rating.toFixed(1)} ★</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
      {/* Agent Panel */}
      <aside className="w-[25%] min-w-[320px] max-w-[400px] hidden md:block border-l border-gray-200">
        <AgentPanel />
      </aside>
    </div>
  );
}
