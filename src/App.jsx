import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  adjustStock,
  createProductInApi,
  createInitialState,
  deleteProductInApi,
  fetchProductsFromApi,
  getLowStockItems,
  summarizeInventory,
  toggleNotificationChannel,
  updateProductQuantityInApi,
} from './services/inventoryService'

const PRODUCTS_API_BASE = 'https://sz76ruzkqe.execute-api.us-east-1.amazonaws.com/prod'

function App() {
  const [state, setState] = useState(createInitialState)
  const [selectedVendorId, setSelectedVendorId] = useState('VENDOR-100')
  const [syncError, setSyncError] = useState('')
  const [newProduct, setNewProduct] = useState({
    productId: '',
    name: '',
    category: '',
    description: '',
    imageUrl: '',
    reorderThreshold: '',
    price: '',
    stock: '',
  })
  const [stockDelta, setStockDelta] = useState({})

  const vendorOptions = useMemo(
    () => [...new Set(state.products.map((product) => product.vendor_id).filter(Boolean))].sort(),
    [state.products],
  )

  const vendorCatalog = useMemo(
    () => state.products.filter((product) => product.vendor_id === selectedVendorId),
    [state.products, selectedVendorId],
  )

  const vendorTransactions = useMemo(
    () => state.transactions.filter((transaction) => transaction.vendor_id === selectedVendorId),
    [state.transactions, selectedVendorId],
  )

  const vendorAlerts = useMemo(
    () => state.alerts.filter((alert) => alert.vendor_id === selectedVendorId),
    [state.alerts, selectedVendorId],
  )

  const summary = summarizeInventory(vendorCatalog)
  const lowStockItems = getLowStockItems(vendorCatalog)

  const onVendorChange = (event) => {
    setSelectedVendorId(event.target.value)
  }

  const onNewProductFieldChange = (field, value) => {
    setNewProduct((current) => ({ ...current, [field]: value }))
  }

  const handleAddProduct = async (event) => {
    event.preventDefault()
    if (!newProduct.productId || !newProduct.name) {
      return
    }

    const payload = {
      product_id: newProduct.productId.trim(),
      product_name: newProduct.name.trim(),
      vendor_id: selectedVendorId,
      category: newProduct.category || 'General',
      description: newProduct.description || 'No description available',
      image_url: newProduct.imageUrl || '',
      popularity_score: 0,
      price: Number(newProduct.price || 0),
      quantity: Number(newProduct.stock || 0),
      sales_count: 0,
      reorder_threshold: Number(newProduct.reorderThreshold || 10),
    }

    try {
      await createProductInApi(PRODUCTS_API_BASE, payload)
      const refreshedProducts = await fetchProductsFromApi(PRODUCTS_API_BASE)
      setState((current) => ({ ...current, products: refreshedProducts }))
      setSyncError('')
      setNewProduct({
        productId: '',
        name: '',
        category: '',
        description: '',
        imageUrl: '',
        reorderThreshold: '',
        price: '',
        stock: '',
      })
    } catch (error) {
      console.error('Failed to create product in API', error)
      setSyncError('Could not create product in Product API. Please check required fields and API deployment.')
    }
  }

  const deleteProduct = async (productId) => {
    try {
      await deleteProductInApi(PRODUCTS_API_BASE, productId)
      const refreshedProducts = await fetchProductsFromApi(PRODUCTS_API_BASE)
      setState((current) => ({ ...current, products: refreshedProducts }))
      setSyncError('')
    } catch (error) {
      console.error('Failed to delete product in API', error)
      setSyncError('Could not delete product from Product API. Please check API deployment and permissions.')
    }
  }

  const runStockAdjustment = async (productId, sku, direction) => {
    const key = `${productId}:${sku}`
    const quantity = Number(stockDelta[key] || 0)
    if (!quantity) return

    const product = state.products.find((item) => item.product_id === productId)
    if (!product) return

    const signedQty = direction === 'increase' ? quantity : quantity * -1
    const currentQuantity = Number(product.quantity ?? 0)
    const nextQuantity = Math.max(0, currentQuantity + signedQty)

    try {
      await updateProductQuantityInApi(PRODUCTS_API_BASE, productId, nextQuantity)
      setSyncError('')
      setState((current) =>
        adjustStock(current, {
          productId,
          sku,
          quantity,
          action: direction,
        }),
      )
      setStockDelta((current) => ({ ...current, [key]: '' }))
    } catch (error) {
      console.error('Failed to persist quantity in API', error)
      setSyncError('Could not update quantity in Product API. Check API Gateway PUT /products/{product_id} deployment.')
    }
  }

  const notificationSettings = state.notifications[selectedVendorId]

  const updateNotification = (channel) => {
    setState((current) => toggleNotificationChannel(current, selectedVendorId, channel))
  }

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const apiProducts = await fetchProductsFromApi(PRODUCTS_API_BASE)
        if (!apiProducts.length) {
          return
        }

        setState((current) => ({ ...current, products: apiProducts }))
        setSelectedVendorId((currentVendorId) => {
          if (apiProducts.some((item) => item.vendor_id === currentVendorId)) {
            return currentVendorId
          }
          return apiProducts[0].vendor_id
        })
      } catch (error) {
        console.error('API unavailable. Showing local sample data.', error)
      }
    }

    loadProducts()
  }, [])

  return (
    <div className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">E-Commerce Inventory & Catalog Management</p>
          <h1>Vendor Inventory Dashboard</h1>
          <p className="subtitle">Manage stock, catalog entries, low-stock alerts, and order event impacts.</p>
        </div>
        <div className="vendor-picker">
          <label htmlFor="vendor-select">Active Vendor</label>
          <select id="vendor-select" value={selectedVendorId} onChange={onVendorChange}>
            {vendorOptions.map((vendorId) => (
              <option key={vendorId} value={vendorId}>
                {vendorId}
              </option>
            ))}
          </select>
        </div>
      </header>

      {syncError && (
        <section className="panel">
          <p className="muted" style={{ color: '#b91c1c' }}>
            {syncError}
          </p>
        </section>
      )}

      <section className="metric-grid">
        <article className="metric-card">
          <p>Total Products</p>
          <h2>{summary.productCount}</h2>
        </article>
        <article className="metric-card">
          <p>Total SKU Variants</p>
          <h2>{summary.skuCount}</h2>
        </article>
        <article className="metric-card warning">
          <p>Low-Stock SKUs</p>
          <h2>{lowStockItems.length}</h2>
        </article>
        <article className="metric-card">
          <p>Inventory Units</p>
          <h2>{summary.totalUnits}</h2>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <h3>Add New Product</h3>
          <form className="form-grid" onSubmit={handleAddProduct}>
            <input
              placeholder="Product ID (e.g. PROD010)"
              value={newProduct.productId}
              onChange={(event) => onNewProductFieldChange('productId', event.target.value)}
            />
            <input
              placeholder="Product name"
              value={newProduct.name}
              onChange={(event) => onNewProductFieldChange('name', event.target.value)}
            />
            <input
              placeholder="Category"
              value={newProduct.category}
              onChange={(event) => onNewProductFieldChange('category', event.target.value)}
            />
            <input
              placeholder="Description"
              value={newProduct.description}
              onChange={(event) => onNewProductFieldChange('description', event.target.value)}
            />
            <input
              placeholder="Image URL"
              value={newProduct.imageUrl}
              onChange={(event) => onNewProductFieldChange('imageUrl', event.target.value)}
            />
            <input
              type="number"
              min="1"
              placeholder="Reorder alert threshold"
              value={newProduct.reorderThreshold}
              onChange={(event) => onNewProductFieldChange('reorderThreshold', event.target.value)}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Unit price"
              value={newProduct.price}
              onChange={(event) => onNewProductFieldChange('price', event.target.value)}
            />
            <input
              type="number"
              min="0"
              placeholder="Initial quantity in stock"
              value={newProduct.stock}
              onChange={(event) => onNewProductFieldChange('stock', event.target.value)}
            />
            <button type="submit">Add Product</button>
          </form>
        </article>

        <article className="panel">
          <h3>Low-Stock Notifications (SNS Style Demo)</h3>
          <p className="muted">Vendor: {selectedVendorId}</p>
          <div className="toggle-row">
            <label>
              <input
                type="checkbox"
                checked={notificationSettings?.email ?? false}
                onChange={() => updateNotification('email')}
              />
              Email Alerts
            </label>
            <label>
              <input
                type="checkbox"
                checked={notificationSettings?.sms ?? false}
                onChange={() => updateNotification('sms')}
              />
              SMS Alerts
            </label>
          </div>
          <div className="alert-feed">
            {vendorAlerts.slice(0, 4).map((alert) => (
              <div key={alert.alert_id} className="alert-row">
                <strong>{alert.sku}</strong>
                <span>
                  Stock {alert.current_stock} below threshold {alert.reorder_threshold}
                </span>
              </div>
            ))}
            {vendorAlerts.length === 0 && <p className="muted">No low-stock alerts triggered yet.</p>}
          </div>
        </article>
      </section>

      <section className="panel">
        <h3>Catalog & Stock Levels</h3>
        {vendorCatalog.map((product) => (
          <div key={product.product_id} className="product-block">
            <div className="product-overview">
              <img
                src={product.image_url}
                alt={product.name}
                className="product-image"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
              <div className="product-meta">
                <div className="product-head">
                  <div>
                    <h4>{product.name}</h4>
                    <p className="muted">{product.category}</p>
                  </div>
                  <button type="button" onClick={() => deleteProduct(product.product_id)}>
                    Delete Product
                  </button>
                </div>
                <p className="muted">{product.description || 'No description available'}</p>
                <div className="meta-row">
                  <span>ID: {product.product_id}</span>
                  <span>Vendor: {product.vendor_id}</span>
                  <span>Quantity: {product.quantity ?? 0}</span>
                  <span>Popularity: {product.popularity_score?.toFixed?.(1) ?? '4.3'}</span>
                  <span>Sales: {product.sales_count ?? 0}</span>
                  <span>Reorder threshold: {product.reorder_threshold}</span>
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Price</th>
                    <th>Current Stock</th>
                    <th>Stock Action</th>
                  </tr>
                </thead>
                <tbody>
                  {product.sku_variants.map((variant) => {
                    const key = `${product.product_id}:${variant.sku}`
                    const isLow = variant.current_stock <= product.reorder_threshold
                    return (
                      <tr key={variant.sku}>
                        <td>{variant.sku}</td>
                        <td>₹{variant.price.toLocaleString()}</td>
                        <td>
                          {variant.current_stock}
                          {isLow && <span className="badge">LOW</span>}
                        </td>
                        <td>
                          <div className="stock-action">
                            <input
                              type="number"
                              min="1"
                              placeholder="Qty"
                              value={stockDelta[key] || ''}
                              onChange={(event) =>
                                setStockDelta((current) => ({ ...current, [key]: event.target.value }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() => runStockAdjustment(product.product_id, variant.sku, 'increase')}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => runStockAdjustment(product.product_id, variant.sku, 'decrease')}
                            >
                              -
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {vendorCatalog.length === 0 && <p>No catalog entries for this vendor yet.</p>}
      </section>

      <section className="panel-grid">
        <article className="panel">
          <h3>Current Low-Stock Indicators</h3>
          <div className="lowstock-list">
            {lowStockItems.map((item) => (
              <div key={item.sku} className="lowstock-row">
                <strong>{item.sku}</strong>
                <span>{item.product_name}</span>
                <span>
                  {item.current_stock}/{item.reorder_threshold}
                </span>
              </div>
            ))}
            {lowStockItems.length === 0 && <p className="muted">All SKUs are healthy.</p>}
          </div>
        </article>
      </section>

      <section className="panel">
        <h3>Stock Transaction History</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Previous</th>
                <th>Current</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {vendorTransactions.slice(0, 15).map((transaction) => (
                <tr key={transaction.transaction_id}>
                  <td>{new Date(transaction.timestamp).toLocaleString()}</td>
                  <td>{transaction.type}</td>
                  <td>{transaction.sku}</td>
                  <td>{transaction.quantity}</td>
                  <td>{transaction.previous_stock}</td>
                  <td>{transaction.new_stock}</td>
                  <td>{transaction.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default App
