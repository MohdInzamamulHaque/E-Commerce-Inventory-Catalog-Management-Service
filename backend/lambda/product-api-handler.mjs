import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'

const REGION = process.env.AWS_REGION || 'ap-south-1'
const TABLE_NAME = process.env.PRODUCT_TABLE || 'Product'
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || ''
const LOW_STOCK_ALERTS_ENABLED = process.env.LOW_STOCK_ALERTS_ENABLED !== 'false'
const DEFAULT_REORDER_THRESHOLD = Number(process.env.DEFAULT_REORDER_THRESHOLD ?? 10)

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }))
const sns = new SNSClient({ region: REGION })

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
  'Content-Type': 'application/json',
}

const response = (statusCode, body) => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
})

const parseJson = (value) => {
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const evaluateLowStock = (item) => {
  if (!item) return null

  const currentStock = toNumber(item.quantity ?? item.current_stock ?? item.stock, 0)
  const reorderThreshold =
    item.reorder_threshold !== undefined && item.reorder_threshold !== null && item.reorder_threshold !== ''
      ? toNumber(item.reorder_threshold, NaN)
      : toNumber(DEFAULT_REORDER_THRESHOLD, NaN)

  if (!Number.isFinite(reorderThreshold)) return null

  return {
    currentStock,
    reorderThreshold,
    isLowStock: currentStock <= reorderThreshold,
  }
}

const publishLowStockAlert = async (item, eventType) => {
  if (!LOW_STOCK_ALERTS_ENABLED || !SNS_TOPIC_ARN) return

  const lowStock = evaluateLowStock(item)
  if (!lowStock?.isLowStock) return

  const message = {
    event_type: eventType,
    product_id: item.product_id,
    product_name: item.product_name || item.name || 'Unknown Product',
    vendor_id: item.vendor_id || 'UNKNOWN-VENDOR',
    current_stock: lowStock.currentStock,
    reorder_threshold: lowStock.reorderThreshold,
    timestamp: new Date().toISOString(),
  }

  await sns.send(
    new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: `Low stock alert: ${message.product_id}`,
      Message: JSON.stringify(message),
    }),
  )
}

const buildUpdateExpression = (payload) => {
  const blockedFields = ['product_id']
  const keys = Object.keys(payload).filter(
    (key) => !blockedFields.includes(key) && payload[key] !== undefined,
  )
  if (!keys.length) return null

  const names = {}
  const values = {}
  const sets = keys.map((key) => {
    names[`#${key}`] = key
    values[`:${key}`] = payload[key]
    return `#${key} = :${key}`
  })

  return {
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }
}

export const handler = async (event) => {
  try {
    const method = event.httpMethod
    const path = event.resource || event.path || ''
    const productId = event.pathParameters?.product_id

    if (method === 'OPTIONS') return response(200, { ok: true })

    if (method === 'GET' && path.endsWith('/products')) {
      const vendorId = event.queryStringParameters?.vendor_id

      if (vendorId) {
        const vendorScan = await ddb.send(
          new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: '#vendor_id = :vendor_id',
            ExpressionAttributeNames: { '#vendor_id': 'vendor_id' },
            ExpressionAttributeValues: { ':vendor_id': vendorId },
          }),
        )
        return response(200, { items: vendorScan.Items || [] })
      }

      const scan = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }))
      return response(200, { items: scan.Items || [] })
    }

    if (method === 'GET' && path.includes('/products/') && productId) {
      const getItem = await ddb.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { product_id: productId },
        }),
      )

      if (!getItem.Item) return response(404, { message: 'Product not found' })
      return response(200, getItem.Item)
    }

    if (method === 'POST' && path.endsWith('/products')) {
      const payload = parseJson(event.body)
      if (!payload) return response(400, { message: 'Invalid JSON body' })

      if (payload.quantity === undefined) {
        payload.quantity = 0
      }

      if (payload.reorder_threshold === undefined || payload.reorder_threshold === null || payload.reorder_threshold === '') {
        payload.reorder_threshold = DEFAULT_REORDER_THRESHOLD
      }

      const required = ['product_id', 'product_name', 'vendor_id', 'price']
      const missing = required.filter((field) => payload[field] === undefined || payload[field] === '')
      if (missing.length) {
        return response(400, { message: `Missing required fields: ${missing.join(', ')}` })
      }

      await ddb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: payload,
          ConditionExpression: 'attribute_not_exists(product_id)',
        }),
      )

      try {
        await publishLowStockAlert(payload, 'product_created')
      } catch (snsError) {
        console.error('SNS publish failed after product create', snsError)
      }

      return response(201, { message: 'Product created', item: payload })
    }

    if (method === 'PUT' && path.includes('/products/') && productId) {
      const payload = parseJson(event.body)
      if (!payload) return response(400, { message: 'Invalid JSON body' })

      const update = buildUpdateExpression(payload)
      if (!update) return response(400, { message: 'No valid fields to update' })

      const result = await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { product_id: productId },
          ...update,
          ConditionExpression: 'attribute_exists(product_id)',
          ReturnValues: 'ALL_NEW',
        }),
      )

      try {
        await publishLowStockAlert(result.Attributes, 'product_updated')
      } catch (snsError) {
        console.error('SNS publish failed after product update', snsError)
      }

      return response(200, { message: 'Product updated', item: result.Attributes })
    }

    if (method === 'DELETE' && path.includes('/products/') && productId) {
      await ddb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { product_id: productId },
          ConditionExpression: 'attribute_exists(product_id)',
        }),
      )

      return response(200, { message: 'Product deleted', product_id: productId })
    }

    return response(404, { message: 'Route not found' })
  } catch (error) {
    console.error('API error', error)

    if (error.name === 'ConditionalCheckFailedException') {
      return response(409, { message: 'Conflict or item not found for requested operation' })
    }

    return response(500, { message: 'Internal server error', detail: error.message })
  }
}
