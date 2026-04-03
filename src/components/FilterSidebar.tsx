"use client";
import { subcategories as categories, fabrics, colors, occasions } from "@/data/products";

interface FilterState {
  category: string;
  fabric: string;
  color: string;
  occasion: string;
  priceRange: [number, number];
  sortBy: string;
}

export default function FilterSidebar({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const set = (key: keyof FilterState, val: string | [number, number]) =>
    onChange({ ...filters, [key]: val });

  return (
    <div className="space-y-6">
      <h2 className="font-bold text-lg text-gray-800">Filters</h2>

      {/* Sort */}
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">Sort By</label>
        <select
          value={filters.sortBy}
          onChange={(e) => set("sortBy", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="popular">Most Popular</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
          <option value="rating">Highest Rated</option>
          <option value="newest">New Arrivals</option>
          <option value="discount">Biggest Discount</option>
        </select>
      </div>

      {/* Price Range */}
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          Price Range: ₹{filters.priceRange[0].toLocaleString()} - ₹{filters.priceRange[1].toLocaleString()}
        </label>
        <input
          type="range"
          min={0}
          max={50000}
          step={500}
          value={filters.priceRange[1]}
          onChange={(e) => set("priceRange", [filters.priceRange[0], Number(e.target.value)])}
          className="w-full accent-pink-600"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>₹0</span>
          <span>₹50,000</span>
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">Category</label>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          <button
            onClick={() => set("category", "")}
            className={`block w-full text-left px-3 py-1.5 rounded text-sm ${!filters.category ? "bg-pink-100 text-pink-700 font-medium" : "hover:bg-gray-100"}`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => set("category", c)}
              className={`block w-full text-left px-3 py-1.5 rounded text-sm ${filters.category === c ? "bg-pink-100 text-pink-700 font-medium" : "hover:bg-gray-100"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Fabric */}
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">Fabric</label>
        <select
          value={filters.fabric}
          onChange={(e) => set("fabric", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Fabrics</option>
          {fabrics.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Color */}
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">Color</label>
        <select
          value={filters.color}
          onChange={(e) => set("color", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Colors</option>
          {colors.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Occasion */}
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">Occasion</label>
        <select
          value={filters.occasion}
          onChange={(e) => set("occasion", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Occasions</option>
          {occasions.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {/* Clear */}
      <button
        onClick={() => onChange({ category: "", fabric: "", color: "", occasion: "", priceRange: [0, 50000], sortBy: "popular" })}
        className="w-full text-sm text-pink-600 hover:text-pink-700 py-2 border border-pink-200 rounded-lg hover:bg-pink-50 transition-colors"
      >
        Clear All Filters
      </button>
    </div>
  );
}
