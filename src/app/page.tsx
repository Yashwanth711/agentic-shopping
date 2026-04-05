"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { products, allCategories, subcategories, fabrics, colors, occasions } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import AgentPanel from "@/components/AgentPanel";

export default function Home() {
  const [filters, setFilters] = useState({
    category: "",
    subcategory: "",
    fabric: "",
    color: "",
    occasion: "",
    priceRange: [0, 80000] as [number, number],
    sortBy: "popular",
    search: "",
  });
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [page, setPage] = useState(1);
  const productGridRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 40;

  // Get subcategories for selected category
  const activeSubcategories = useMemo(() => {
    if (!filters.category) return subcategories;
    return [...new Set(products.filter(p => p.category === filters.category).flatMap(p => p.tags.slice(0, 1)))];
  }, [filters.category]);

  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      if (filters.category && p.category !== filters.category) return false;
      if (filters.subcategory && !p.tags.includes(filters.subcategory)) return false;
      if (filters.fabric && p.fabric !== filters.fabric) return false;
      if (filters.color && p.color !== filters.color) return false;
      if (filters.occasion && !p.occasion.includes(filters.occasion)) return false;
      if (p.price < filters.priceRange[0] || p.price > filters.priceRange[1]) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q)) ||
          p.fabric.toLowerCase().includes(q) || p.color.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) || p.seller.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q);
      }
      return true;
    });

    switch (filters.sortBy) {
      case "price_low": result.sort((a, b) => a.price - b.price); break;
      case "price_high": result.sort((a, b) => b.price - a.price); break;
      case "rating": result.sort((a, b) => b.rating - a.rating); break;
      case "discount": result.sort((a, b) => b.discount - a.discount); break;
      default: result.sort((a, b) => b.reviewCount - a.reviewCount);
    }
    return result;
  }, [filters]);

  // Agent-recommended product IDs — when set, grid shows only these
  const [agentProductIds, setAgentProductIds] = useState<string[]>([]);

  // When agent recommends products, show those instead of filtered results
  const agentFilteredProducts = useMemo(() => {
    if (agentProductIds.length === 0) return null;
    return agentProductIds
      .map(id => products.find(p => p.id === id))
      .filter((p): p is typeof products[number] => !!p);
  }, [agentProductIds]);

  const paginatedProducts = filtered.slice(0, page * ITEMS_PER_PAGE);
  const hasMore = paginatedProducts.length < filtered.length;

  // Bestsellers & New Arrivals for homepage
  const bestsellers = useMemo(() => products.filter(p => p.tags.includes("Bestseller")).slice(0, 8), []);
  const showHomepage = !filters.category && !filters.subcategory && !filters.search;

  // Agent navigation handler — filters grid to show recommended products
  const handleAgentNavigate = (productIds: string | string[]) => {
    const ids = Array.isArray(productIds) ? productIds : [productIds];
    if (ids.length > 0) {
      setAgentProductIds(ids);
      // Scroll to top of product grid
      productGridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Clear agent filter
  const clearAgentFilter = () => setAgentProductIds([]);

  const categoryIcons: Record<string, string> = {
    "Sarees": "👗", "Kurtis": "👚", "Kids": "👶", "Jewelry": "💍", "Men": "👔", "Lehengas": "💃", "Dupattas": "🧣", "Blouse Pieces": "✂️",
  };

  // Rotating hero banners
  const [heroIndex, setHeroIndex] = useState(0);
  const heroBanners = [
    { title: "Discover India's Finest Collection", subtitle: "Handpicked sarees, kurtis & jewelry from master artisans across India", cta: "Shop Sarees", ctaAction: () => setFilters(f => ({ ...f, category: "Sarees" })), gradient: "from-pink-600 via-purple-600 to-indigo-600" },
    { title: "Wedding Season Specials", subtitle: "Banarasi, Kanjivaram & Designer sarees — make your big day unforgettable", cta: "Wedding Collection", ctaAction: () => setFilters(f => ({ ...f, search: "wedding" })), gradient: "from-rose-600 via-red-500 to-orange-500" },
    { title: "Kids Fashion Festival", subtitle: "Adorable outfits for your little ones — frocks, suits & ethnic wear", cta: "Shop Kids", ctaAction: () => setFilters(f => ({ ...f, category: "Kids" })), gradient: "from-cyan-600 via-blue-500 to-purple-500" },
    { title: "Men's Style Store", subtitle: "Casual & formal shirts — everyday comfort meets sharp style", cta: "Shop Men", ctaAction: () => setFilters(f => ({ ...f, category: "Men" })), gradient: "from-gray-700 via-slate-600 to-zinc-700" },
    { title: "Jewelry That Speaks", subtitle: "Kundan, gold-plated & statement pieces for every occasion", cta: "Shop Jewelry", ctaAction: () => setFilters(f => ({ ...f, category: "Jewelry" })), gradient: "from-amber-600 via-yellow-500 to-orange-500" },
  ];

  useEffect(() => {
    const timer = setInterval(() => setHeroIndex(i => (i + 1) % heroBanners.length), 5000);
    return () => clearInterval(timer);
  }, [heroBanners.length]);

  return (
    <div className="h-screen bg-gray-50">
      {/* Saheli Floating Agent */}
      <AgentPanel onNavigate={handleAgentNavigate} context="homepage" />

      {/* Main Shopping Area */}
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          {/* Top bar */}
          <div className="px-4 lg:px-6 py-2 flex items-center justify-between">
            <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent whitespace-nowrap">
              🛍️ Sundari Silks
            </h1>
            <div className="flex-1 max-w-xl mx-4">
              <div className="relative">
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => { setFilters(f => ({ ...f, search: e.target.value, category: "", subcategory: "" })); clearAgentFilter(); }}
                  placeholder="Search sarees, kurtis, lehengas, jewelry..."
                  className="w-full border border-gray-300 rounded-full px-5 py-2 pl-10 text-sm focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                />
                <span className="absolute left-3.5 top-2.5 text-gray-400">🔍</span>
                {filters.search && (
                  <button onClick={() => setFilters(f => ({ ...f, search: "" }))} className="absolute right-3 top-2 text-gray-400 hover:text-gray-600">✕</button>
                )}
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4 text-sm text-gray-600 whitespace-nowrap">
              <button className="hover:text-pink-600">❤️ Wishlist</button>
              <button className="hover:text-pink-600">🛒 Cart (0)</button>
              <button className="hover:text-pink-600">👤 Account</button>
            </div>
          </div>

          {/* Category Navigation */}
          <div className="px-4 lg:px-6 py-2 flex gap-1 overflow-x-auto border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={() => { setFilters(f => ({ ...f, category: "", subcategory: "" })); setPage(1); clearAgentFilter(); }}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                !filters.category ? "bg-pink-600 text-white shadow-sm" : "bg-white text-gray-700 hover:bg-pink-50 border border-gray-200"
              }`}
            >
              All
            </button>
            {allCategories.map((c) => (
              <button
                key={c}
                onClick={() => { setFilters(f => ({ ...f, category: c, subcategory: "" })); setPage(1); clearAgentFilter(); }}
                className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all flex items-center gap-1 ${
                  filters.category === c ? "bg-pink-600 text-white shadow-sm" : "bg-white text-gray-700 hover:bg-pink-50 border border-gray-200"
                }`}
              >
                {categoryIcons[c] || "🏷️"} {c}
              </button>
            ))}
          </div>

          {/* Subcategory pills (when a category is selected) */}
          {filters.category && (
            <div className="px-4 lg:px-6 py-2 flex gap-1 overflow-x-auto border-t border-gray-100">
              <button
                onClick={() => { setFilters(f => ({ ...f, subcategory: "" })); setPage(1); }}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                  !filters.subcategory ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700 border border-purple-200"
                }`}
              >
                All {filters.category}
              </button>
              {activeSubcategories.map((s) => (
                <button
                  key={s}
                  onClick={() => { setFilters(f => ({ ...f, subcategory: s })); setPage(1); }}
                  className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                    filters.subcategory === s ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700 border border-purple-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" ref={productGridRef}>
          {/* Homepage Hero (when no filters active) */}
          {showHomepage && (
            <div>
              {/* Rotating Hero Banner */}
              <div className={`bg-gradient-to-r ${heroBanners[heroIndex].gradient} text-white px-6 py-10 lg:py-16 transition-all duration-700 relative overflow-hidden`}>
                <div className="max-w-3xl relative z-10">
                  <h2 className="text-3xl lg:text-4xl font-bold mb-3 transition-all duration-500">{heroBanners[heroIndex].title}</h2>
                  <p className="text-white/80 text-lg mb-6">{heroBanners[heroIndex].subtitle}</p>
                  <button onClick={heroBanners[heroIndex].ctaAction}
                    className="bg-white text-gray-900 px-6 py-2.5 rounded-full font-semibold hover:bg-gray-100 transition-colors">
                    {heroBanners[heroIndex].cta} →
                  </button>
                </div>
                {/* Dots */}
                <div className="flex gap-2 mt-6 relative z-10">
                  {heroBanners.map((_, i) => (
                    <button key={i} onClick={() => setHeroIndex(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === heroIndex ? "bg-white w-6" : "bg-white/40 hover:bg-white/60"}`} />
                  ))}
                </div>
              </div>

              {/* Category Cards */}
              <div className="px-6 py-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Shop by Category</h3>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {allCategories.map((c) => {
                    const count = products.filter(p => p.category === c).length;
                    return (
                      <button
                        key={c}
                        onClick={() => setFilters(f => ({ ...f, category: c }))}
                        className="bg-white rounded-xl p-4 text-center hover:shadow-md transition-all border border-gray-100 hover:border-pink-200 group"
                      >
                        <span className="text-3xl block mb-2">{categoryIcons[c] || "🏷️"}</span>
                        <span className="text-sm font-semibold text-gray-800 group-hover:text-pink-600">{c}</span>
                        <span className="text-xs text-gray-400 block">{count} items</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bestsellers */}
              {bestsellers.length > 0 && (
                <div className="px-6 pb-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">⭐ Bestsellers</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {bestsellers.map((p) => (
                      <div key={p.id} id={`product-${p.id}`} className="transition-all duration-300 rounded-lg">
                        <ProductCard product={p} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Products */}
              <div className="px-6 pb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">🆕 Fresh Arrivals</h3>
              </div>
            </div>
          )}

          {/* Filtered View */}
          <div className="px-4 lg:px-6 pb-6">
            {!showHomepage && (
              <div className="flex items-center justify-between mb-4 pt-4">
                <div>
                  <p className="text-sm text-gray-600">
                    <strong>{filtered.length}</strong> products found
                    {filters.category && <span> in <strong>{filters.category}</strong></span>}
                    {filters.subcategory && <span> → <strong>{filters.subcategory}</strong></span>}
                    {filters.search && <span> for &quot;<strong>{filters.search}</strong>&quot;</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value }))}
                    className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:border-pink-500"
                  >
                    <option value="popular">Most Popular</option>
                    <option value="price_low">Price: Low → High</option>
                    <option value="price_high">Price: High → Low</option>
                    <option value="rating">Highest Rated</option>
                    <option value="discount">Biggest Discount</option>
                  </select>
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 flex items-center gap-1"
                  >
                    🔽 Filters
                  </button>
                </div>
              </div>
            )}

            {/* Quick Filters Bar */}
            {showMobileFilters && !showHomepage && (
              <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100 flex flex-wrap gap-3">
                <select value={filters.fabric} onChange={(e) => setFilters(f => ({ ...f, fabric: e.target.value }))} className="text-sm border rounded-lg px-3 py-1.5">
                  <option value="">All Fabrics</option>
                  {fabrics.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={filters.color} onChange={(e) => setFilters(f => ({ ...f, color: e.target.value }))} className="text-sm border rounded-lg px-3 py-1.5">
                  <option value="">All Colors</option>
                  {colors.sort().map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filters.occasion} onChange={(e) => setFilters(f => ({ ...f, occasion: e.target.value }))} className="text-sm border rounded-lg px-3 py-1.5">
                  <option value="">All Occasions</option>
                  {occasions.sort().map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Max ₹</span>
                  <input
                    type="range" min={0} max={80000} step={1000}
                    value={filters.priceRange[1]}
                    onChange={(e) => setFilters(f => ({ ...f, priceRange: [0, Number(e.target.value)] }))}
                    className="w-32 accent-pink-600"
                  />
                  <span className="text-gray-700 font-medium">₹{filters.priceRange[1].toLocaleString()}</span>
                </div>
                <button
                  onClick={() => setFilters(f => ({ ...f, fabric: "", color: "", occasion: "", priceRange: [0, 80000] }))}
                  className="text-sm text-pink-600 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Agent Recommendation Banner */}
            {agentFilteredProducts && agentFilteredProducts.length > 0 && (
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-xl p-4 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🙏</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Saheli&apos;s Picks for You</p>
                    <p className="text-xs text-gray-500">{agentFilteredProducts.length} products recommended based on your conversation</p>
                  </div>
                </div>
                <button
                  onClick={clearAgentFilter}
                  className="text-sm text-pink-600 hover:text-pink-700 font-medium px-3 py-1.5 rounded-full border border-pink-200 hover:bg-pink-50 transition-colors"
                >
                  Show All Products
                </button>
              </div>
            )}

            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
              {(agentFilteredProducts && agentFilteredProducts.length > 0
                ? agentFilteredProducts
                : showHomepage ? products.slice(0, 40) : paginatedProducts
              ).map((p) => (
                <div key={p.id} id={`product-${p.id}`} className="transition-all duration-300 rounded-lg">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>

            {/* Load More */}
            {!showHomepage && !agentFilteredProducts && hasMore && (
              <div className="text-center py-8">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="bg-pink-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-pink-700 transition-colors"
                >
                  Load More ({filtered.length - paginatedProducts.length} remaining)
                </button>
              </div>
            )}

            {filtered.length === 0 && !showHomepage && (
              <div className="text-center py-16">
                <p className="text-5xl mb-4">🔍</p>
                <p className="text-lg text-gray-600 font-medium">No products found</p>
                <p className="text-sm text-gray-400 mt-1">Try different filters or ask Saheli for help! →</p>
                <button
                  onClick={() => setFilters({ category: "", subcategory: "", fabric: "", color: "", occasion: "", priceRange: [0, 80000], sortBy: "popular", search: "" })}
                  className="mt-4 text-pink-600 hover:underline text-sm"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="bg-gray-900 text-gray-400 px-6 py-8 mt-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div>
                <h4 className="text-white font-semibold mb-3">Shop</h4>
                {allCategories.map(c => (
                  <button key={c} onClick={() => setFilters(f => ({ ...f, category: c }))} className="block hover:text-pink-400 mb-1">{c}</button>
                ))}
              </div>
              <div>
                <h4 className="text-white font-semibold mb-3">Customer Service</h4>
                <p className="mb-1">Track Order</p>
                <p className="mb-1">Returns & Exchanges</p>
                <p className="mb-1">Size Guide</p>
                <p className="mb-1">FAQ</p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-3">About</h4>
                <p className="mb-1">Our Story</p>
                <p className="mb-1">Artisan Partners</p>
                <p className="mb-1">Sustainability</p>
                <p className="mb-1">Blog</p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-3">Contact</h4>
                <p className="mb-1">📞 +91 9876 543210</p>
                <p className="mb-1">📧 help@sundarisilks.com</p>
                <p className="mb-1">📍 Chennai, India</p>
                <p className="mt-3 text-xs text-gray-500">Powered by Agentic Shopping AI</p>
              </div>
            </div>
          </footer>
        </div>
      </div>

    </div>
  );
}
