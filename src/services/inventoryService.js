const nowIso = () => new Date().toISOString()

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`

const sampleVendors = [
  { vendor_id: 'VENDOR-100', name: 'Northstar Retail', email: 'northstar@vendor.com', phone: '+91-9000000100' },
  { vendor_id: 'VENDOR-200', name: 'Urban Loom', email: 'urbanloom@vendor.com', phone: '+91-9000000200' },
  { vendor_id: 'VENDOR-300', name: 'Peak Outfitters', email: 'peak@vendor.com', phone: '+91-9000000300' },
]

const sampleProducts = [
  {
    product_id: 'PROD-TSHIRT-001',
    vendor_id: 'VENDOR-100',
    name: 'Classic Cotton T-Shirt',
    category: 'Apparel',
    description: 'Premium cotton everyday t-shirt with regular fit.',
    image_url:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&auto=format&fit=crop&q=60',
    popularity_score: 4.5,
    sales_count: 512,
    quantity: 26,
    reorder_threshold: 15,
    last_updated: nowIso(),
    sku_variants: [
      { sku: 'SKU-TS-BLK-M', variant_label: 'Black / M', price: 799, current_stock: 18 },
      { sku: 'SKU-TS-WHT-L', variant_label: 'White / L', price: 799, current_stock: 8 },
    ],
  },
  {
    product_id: 'PROD-HOODIE-002',
    vendor_id: 'VENDOR-100',
    name: 'Everyday Hoodie',
    category: 'Apparel',
    description: 'Soft fleece hoodie for all-day comfort and style.',
    image_url:
      'https://images.unsplash.com/photo-1618354691321-e851c56960d1?w=600&auto=format&fit=crop&q=60',
    popularity_score: 4.7,
    sales_count: 389,
    quantity: 20,
    reorder_threshold: 10,
    last_updated: nowIso(),
    sku_variants: [
      { sku: 'SKU-HD-NVY-L', variant_label: 'Navy / L', price: 1699, current_stock: 14 },
      { sku: 'SKU-HD-GRY-M', variant_label: 'Grey / M', price: 1699, current_stock: 6 },
    ],
  },
  {
    product_id: 'PROD-MUG-003',
    vendor_id: 'VENDOR-200',
    name: 'Ceramic Coffee Mug',
    category: 'Home',
    description: 'Durable ceramic mug, ideal for hot and cold beverages.',
    image_url:
      'https://images.unsplash.com/photo-1514228742587-6b1558fcf93a?w=600&auto=format&fit=crop&q=60',
    popularity_score: 4.1,
    sales_count: 245,
    quantity: 22,
    reorder_threshold: 20,
    last_updated: nowIso(),
    sku_variants: [{ sku: 'SKU-MUG-BLU-350', variant_label: 'Blue / 350ml', price: 499, current_stock: 22 }],
  },
  {
    product_id: 'PROD-BAG-004',
    vendor_id: 'VENDOR-300',
    name: 'Day Trek Backpack',
    category: 'Outdoor',
    description: 'Weather-resistant backpack with multi-pocket organization.',
    image_url:
      'https://images.unsplash.com/photo-1491637639811-60e2756cc1c7?w=600&auto=format&fit=crop&q=60',
    popularity_score: 4.6,
    sales_count: 301,
    quantity: 25,
    reorder_threshold: 12,
    last_updated: nowIso(),
    sku_variants: [
      { sku: 'SKU-BAG-OLV-25', variant_label: 'Olive / 25L', price: 2499, current_stock: 9 },
      { sku: 'SKU-BAG-BLK-25', variant_label: 'Black / 25L', price: 2499, current_stock: 16 },
    ],
  },
]

const sampleTransactions = [
  {
    transaction_id: uid('TXN'),
    vendor_id: 'VENDOR-100',
    product_id: 'PROD-TSHIRT-001',
    sku: 'SKU-TS-WHT-L',
    type: 'stock_adjustment',
    quantity: 4,
    previous_stock: 4,
    new_stock: 8,
    reason: 'Warehouse replenishment',
    timestamp: nowIso(),
  },
]

const defaultNotifications = {
  'VENDOR-100': { email: true, sms: false },
  'VENDOR-200': { email: true, sms: true },
  'VENDOR-300': { email: false, sms: true },
}

const getVendorInventory = (products, vendorId) => products.filter((product) => product.vendor_id === vendorId)

const cloneState = (state) => ({
  ...state,
  products: state.products.map((product) => ({
    ...product,
    sku_variants: product.sku_variants.map((variant) => ({ ...variant })),
  })),
  transactions: [...state.transactions],
  alerts: [...state.alerts],
  notifications: { ...state.notifications },
})

const registerLowStockAlert = (nextState, product, variant) => {
  if (variant.current_stock > product.reorder_threshold) return

  nextState.alerts.unshift({
    alert_id: uid('ALERT'),
    vendor_id: product.vendor_id,
    product_id: product.product_id,
    sku: variant.sku,
    current_stock: variant.current_stock,
    reorder_threshold: product.reorder_threshold,
    channels: nextState.notifications[product.vendor_id],
    timestamp: nowIso(),
  })
}

const addTransaction = (nextState, payload) => {
  nextState.transactions.unshift({
    transaction_id: uid('TXN'),
    timestamp: nowIso(),
    ...payload,
  })
}

const toPrimitive = (value) => {
  if (value && typeof value === 'object') {
    if ('S' in value) return value.S
    if ('N' in value) return Number(value.N)
    if ('BOOL' in value) return Boolean(value.BOOL)
  }
  return value
}

const isDynamoTypedItem = (item) => {
  if (!item || typeof item !== 'object') return false
  return Object.values(item).some(
    (value) => value && typeof value === 'object' && ('S' in value || 'N' in value || 'BOOL' in value),
  )
}

const normalizeApiItem = (item) => {
  if (!item || typeof item !== 'object') return null

  const normalized = isDynamoTypedItem(item)
    ? Object.fromEntries(Object.entries(item).map(([key, value]) => [key, toPrimitive(value)]))
    : item

  const productId = normalized.product_id || uid('PROD')
  const productName = normalized.product_name || normalized.name || 'Unnamed product'

  return {
    product_id: productId,
    vendor_id: normalized.vendor_id || 'UNASSIGNED-VENDOR',
    name: productName,
    category: normalized.category || 'General',
    description: normalized.description || 'No description available',
    image_url: normalized.image_url || '',
    popularity_score: Number(normalized.popularity_score ?? 0),
    sales_count: Number(normalized.sales_count ?? 0),
    quantity: Number(normalized.quantity ?? normalized.current_stock ?? 0),
    reorder_threshold: Number(normalized.reorder_threshold ?? 10),
    last_updated: nowIso(),
    sku_variants: [
      {
        sku: normalized.sku || `${productId}-STD`,
        variant_label: normalized.variant_label || 'Default Variant',
        price: Number(normalized.price ?? 0),
        current_stock: Number(normalized.current_stock ?? 0),
      },
    ],
  }
}

export const updateProductQuantityInApi = async (apiBaseUrl, productId, quantity) => {
  const response = await fetch(`${apiBaseUrl}/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  })

  if (!response.ok) {
    throw new Error(`Failed to update quantity (${response.status})`)
  }

  return response.json()
}

export const fetchProductsFromApi = async (apiBaseUrl) => {
  const response = await fetch(`${apiBaseUrl}/products`)
  if (!response.ok) {
    throw new Error(`Products API request failed (${response.status})`)
  }

  const payload = await response.json()
  const rawItems = Array.isArray(payload) ? payload : payload.items || payload.data || []
  return rawItems.map(normalizeApiItem).filter(Boolean)
}

export const createInitialState = () => ({
  vendors: sampleVendors,
  products: sampleProducts,
  transactions: sampleTransactions,
  alerts: [],
  notifications: defaultNotifications,
})

export const summarizeInventory = (products) => {
  const summary = {
    productCount: products.length,
    skuCount: 0,
    totalUnits: 0,
  }

  products.forEach((product) => {
    summary.skuCount += product.sku_variants.length
    summary.totalUnits += product.sku_variants.reduce((acc, variant) => acc + variant.current_stock, 0)
  })

  return summary
}

export const getLowStockItems = (products) => {
  const lowStock = []

  products.forEach((product) => {
    product.sku_variants.forEach((variant) => {
      if (variant.current_stock <= product.reorder_threshold) {
        lowStock.push({
          product_name: product.name,
          product_id: product.product_id,
          sku: variant.sku,
          current_stock: variant.current_stock,
          reorder_threshold: product.reorder_threshold,
        })
      }
    })
  })

  return lowStock
}

export const addProduct = (state, vendorId, payload) => {
  const nextState = cloneState(state)
  const existingProduct = nextState.products.find(
    (product) => product.vendor_id === vendorId && product.name.toLowerCase() === payload.name.toLowerCase(),
  )

  const newVariant = {
    sku: payload.sku,
    variant_label: payload.variantLabel,
    price: payload.price,
    current_stock: payload.stock,
  }

  if (existingProduct) {
    existingProduct.sku_variants.push(newVariant)
    existingProduct.reorder_threshold = payload.reorderThreshold
    existingProduct.last_updated = nowIso()

    addTransaction(nextState, {
      vendor_id: vendorId,
      product_id: existingProduct.product_id,
      sku: payload.sku,
      type: 'product_created',
      quantity: payload.stock,
      previous_stock: 0,
      new_stock: payload.stock,
      reason: 'New SKU variant added to existing catalog item',
    })

    registerLowStockAlert(nextState, existingProduct, newVariant)
    return nextState
  }

  const newProduct = {
    product_id: uid('PROD'),
    vendor_id: vendorId,
    name: payload.name,
    category: payload.category,
    description: payload.description || 'No description available',
    image_url: payload.imageUrl || '',
    popularity_score: 4.3,
    sales_count: 0,
    quantity: Number(payload.stock || 0),
    reorder_threshold: payload.reorderThreshold,
    last_updated: nowIso(),
    sku_variants: [newVariant],
  }

  nextState.products.unshift(newProduct)

  addTransaction(nextState, {
    vendor_id: vendorId,
    product_id: newProduct.product_id,
    sku: payload.sku,
    type: 'product_created',
    quantity: payload.stock,
    previous_stock: 0,
    new_stock: payload.stock,
    reason: 'New product catalog entry created',
  })

  registerLowStockAlert(nextState, newProduct, newVariant)
  return nextState
}

export const updateCatalogDetails = (state, payload) => {
  const nextState = cloneState(state)
  const product = nextState.products.find((item) => item.product_id === payload.productId)
  if (!product) return state

  product.name = payload.name
  product.category = payload.category
  product.description = payload.description || product.description
  product.image_url = payload.imageUrl ?? product.image_url
  if (payload.quantity !== undefined) product.quantity = Number(payload.quantity)
  product.reorder_threshold = payload.reorderThreshold
  product.last_updated = nowIso()

  addTransaction(nextState, {
    vendor_id: product.vendor_id,
    product_id: product.product_id,
    sku: '-',
    type: 'catalog_updated',
    quantity: 0,
    previous_stock: 0,
    new_stock: 0,
    reason: 'Catalog metadata updated by vendor',
  })

  return nextState
}

export const adjustStock = (state, payload) => {
  const nextState = cloneState(state)
  const product = nextState.products.find((item) => item.product_id === payload.productId)
  if (!product) return state

  const variant = product.sku_variants.find((item) => item.sku === payload.sku)
  if (!variant) return state

  const previous = variant.current_stock
  const signedQty = payload.action === 'increase' ? payload.quantity : payload.quantity * -1
  variant.current_stock = Math.max(0, variant.current_stock + signedQty)
  const previousQuantity = Number(product.quantity ?? 0)
  product.quantity = Math.max(0, previousQuantity + signedQty)
  product.last_updated = nowIso()

  addTransaction(nextState, {
    vendor_id: product.vendor_id,
    product_id: product.product_id,
    sku: variant.sku,
    type: 'stock_adjustment',
    quantity: signedQty,
    previous_stock: previous,
    new_stock: variant.current_stock,
    reason: payload.action === 'increase' ? 'Manual stock increase' : 'Manual stock decrease',
  })

  registerLowStockAlert(nextState, product, variant)
  return nextState
}

export const applyOrderEvent = (state, vendorId, eventType, orderItems) => {
  const nextState = cloneState(state)
  const vendorProducts = getVendorInventory(nextState.products, vendorId)
  const isReduce = eventType === 'order_placed'

  orderItems.forEach((item) => {
    vendorProducts.forEach((product) => {
      const variant = product.sku_variants.find((entry) => entry.sku === item.sku)
      if (!variant) return

      const previous = variant.current_stock
      const delta = isReduce ? item.quantity * -1 : item.quantity
      variant.current_stock = Math.max(0, variant.current_stock + delta)
      product.last_updated = nowIso()

      addTransaction(nextState, {
        vendor_id: vendorId,
        product_id: product.product_id,
        sku: variant.sku,
        type: eventType,
        quantity: delta,
        previous_stock: previous,
        new_stock: variant.current_stock,
        reason: isReduce ? 'Order placed event consumed stock' : 'Order cancelled/refunded restored stock',
      })

      registerLowStockAlert(nextState, product, variant)
    })
  })

  return nextState
}

export const toggleNotificationChannel = (state, vendorId, channel) => {
  const nextState = cloneState(state)
  const existing = nextState.notifications[vendorId] || { email: false, sms: false }
  nextState.notifications[vendorId] = {
    ...existing,
    [channel]: !existing[channel],
  }
  return nextState
}
