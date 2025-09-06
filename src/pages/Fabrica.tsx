import React from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProducts } from "@/hooks/useProducts";
import { useSyncProducts } from "@/hooks/useSyncProducts";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Fabrica() {
  const { products, loading, error, addProduct } = useProducts();
  const { syncStatus, syncProducts } = useSyncProducts();
  const isMobile = useIsMobile();

  const [newProductName, setNewProductName] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('');

  const handleAddProduct = () => {
    if (newProductName.trim()) {
      addProduct({
        name: newProductName.trim(),
        category: selectedCategory || undefined,
      });
      setNewProductName('');
      setSelectedCategory('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddProduct();
    }
  };

  return (
    <div className={`container mx-auto p-4 ${isMobile ? 'max-w-full' : 'max-w-4xl'}`}>
      <h1 className="text-3xl font-bold mb-8">Fabrica</h1>

      {/* Add Product Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Add New Product</h2>
        <div className="flex gap-4 flex-col sm:flex-row">
          <Input
            placeholder="Product name"
            value={newProductName}
            onChange={(e) => setNewProductName(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="electronics">Electronics</SelectItem>
              <SelectItem value="clothing">Clothing</SelectItem>
              <SelectItem value="books">Books</SelectItem>
              <SelectItem value="home">Home</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={handleAddProduct}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            disabled={!newProductName.trim()}
          >
            Add Product
          </button>
        </div>
      </div>

      {/* Sync Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Sync Status</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={syncProducts}
            disabled={syncStatus.isSyncing}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {syncStatus.isSyncing ? 'Syncing...' : 'Sync Products'}
          </button>
          {syncStatus.lastSyncedAt && (
            <span className="text-sm text-gray-600">
              Last synced: {syncStatus.lastSyncedAt.toLocaleString()}
            </span>
          )}
        </div>
        {syncStatus.error && (
          <div className="mt-2 text-red-600 text-sm">
            Error: {syncStatus.error}
          </div>
        )}
      </div>

      {/* Products List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Products</h2>

        {loading && <div className="text-center py-4">Loading products...</div>}

        {error && (
          <div className="text-red-600 text-center py-4">
            Error loading products: {error}
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="text-gray-500 text-center py-4">
            No products yet. Add your first product above!
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="space-y-2">
            {products.map((product) => (
              <div key={product.id} className="border rounded p-3">
                <h3 className="font-medium">{product.name}</h3>
                {product.category && (
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {product.category}
                  </span>
                )}
                {product.description && (
                  <p className="text-sm text-gray-700 mt-1">{product.description}</p>
                )}
                {product.price && (
                  <p className="text-sm font-medium text-green-600 mt-1">
                    ${product.price.toFixed(2)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

