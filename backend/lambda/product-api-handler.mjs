import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'

const REGION = process.env.AWS_REGION || 'ap-south-1'
const TABLE_NAME = process.env.PRODUCT_TABLE || 'Product'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }))

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
