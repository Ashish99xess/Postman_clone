import express from 'express';
import cors from 'cors';
import axios from 'axios';
import 'dotenv/config';
import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'postman_clone';
const JWT_SECRET = process.env.JWT_SECRET;
const mongoClient = new MongoClient(MONGODB_URI);
let database;

// Enable CORS for frontend client
app.use(cors());

// Parse various request bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.text({ limit: '50mb' }));
app.use(express.raw({ limit: '50mb', type: '*/*' }));

const historyCollection = () => database.collection('history');
const collectionsCollection = () => database.collection('collections');
const usersCollection = () => database.collection('users');
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const jwtKey = () => new TextEncoder().encode(JWT_SECRET);

const publicUser = user => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt
});

const createAccessToken = user => new SignJWT({ email: user.email, name: user.name })
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(user.id)
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(jwtKey());

const requireAuth = asyncRoute(async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Bearer token is required' });
  }

  try {
    const { payload } = await jwtVerify(token, jwtKey(), { algorithms: ['HS256'] });
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ---------------- API ENDPOINTS ----------------

// Authentication endpoints
app.post('/api/auth/signup', asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (name.length < 2) {
    return res.status(400).json({ error: 'Name must contain at least 2 characters' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must contain at least 8 characters' });
  }

  const user = {
    id: randomUUID(),
    name,
    email,
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    createdAt: new Date().toISOString()
  };

  try {
    await usersCollection().insertOne(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    throw error;
  }

  res.status(201).json({ user: publicUser(user) });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await usersCollection().findOne({ email });

  if (!user || !(await argon2.verify(user.passwordHash, password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const accessToken = await createAccessToken(user);
  res.json({ accessToken, tokenType: 'Bearer', expiresIn: 3600, user: publicUser(user) });
}));

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const user = await usersCollection().findOne({ id: req.auth.sub });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
}));

// Proxy endpoint to make API requests without CORS issues
app.post('/api/proxy', async (req, res) => {
  const { url, method, headers = {}, body, bodyType } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Prepend http:// if no protocol specified
  let formattedUrl = url.trim();
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = 'http://' + formattedUrl;
  }

  // Set up request config
  const config = {
    method: method || 'GET',
    url: formattedUrl,
    headers: {},
    validateStatus: () => true, // Don't throw on non-2xx status codes
    responseType: 'arraybuffer', // Get raw bytes to handle various formats (JSON, images, etc.)
    timeout: 30000 // 30s timeout
  };

  // Map request headers from client, filter out host/origin to avoid issues
  Object.keys(headers).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== 'host' && lowerKey !== 'origin') {
      config.headers[key] = headers[key];
    }
  });

  // Prepare request body
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase()) && body !== undefined && body !== null && body !== '') {
    if (bodyType === 'json') {
      if (typeof body === 'string' && body.trim() !== '') {
        try {
          config.data = JSON.parse(body);
        } catch (e) {
          config.data = body;
        }
      } else {
        config.data = body;
      }
      if (!config.headers['content-type']) {
        config.headers['content-type'] = 'application/json';
      }
    } else if (bodyType === 'form-data') {
      // For simple key-value pairs
      const params = new URLSearchParams();
      if (Array.isArray(body)) {
        body.forEach(item => {
          if (item.key) params.append(item.key, item.value || '');
        });
      } else if (typeof body === 'object') {
        Object.entries(body).forEach(([k, v]) => params.append(k, String(v)));
      }
      config.data = params.toString();
      if (!config.headers['content-type']) {
        config.headers['content-type'] = 'application/x-www-form-urlencoded';
      }
    } else {
      // Raw or text
      config.data = body;
    }
  }

  const startTime = process.hrtime();

  try {
    const response = await axios(config);
    const diff = process.hrtime(startTime);
    const durationMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6); // Calculate duration in ms

    const responseHeaders = response.headers;
    const contentType = responseHeaders['content-type'] || '';

    let responseBody;
    let sizeBytes = response.data ? response.data.length : 0;

    // Convert Buffer data to appropriate type
    if (contentType.includes('application/json')) {
      try {
        responseBody = JSON.parse(Buffer.from(response.data).toString('utf8'));
      } catch (e) {
        responseBody = Buffer.from(response.data).toString('utf8');
      }
    } else if (contentType.includes('image/')) {
      // For images, return base64 data URL
      const base64 = Buffer.from(response.data).toString('base64');
      responseBody = `data:${contentType};base64,${base64}`;
    } else {
      responseBody = Buffer.from(response.data).toString('utf8');
    }

    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      time: durationMs,
      size: sizeBytes
    });
  } catch (error) {
    const diff = process.hrtime(startTime);
    const durationMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

    res.status(500).json({
      error: error.message,
      time: durationMs,
      status: 0,
      statusText: 'Error'
    });
  }
});

// History Endpoints
app.get('/api/history', requireAuth, asyncRoute(async (req, res) => {
  const history = await historyCollection().find({ userId: req.auth.sub }).sort({ timestamp: -1 }).limit(100).toArray();
  res.json(history);
}));

app.post('/api/history', requireAuth, asyncRoute(async (req, res) => {
  const newHistoryItem = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    userId: req.auth.sub,
    ...req.body
  };

  await historyCollection().insertOne(newHistoryItem);
  const oldItems = await historyCollection().find({ userId: req.auth.sub }, { projection: { _id: 1 } })
    .sort({ timestamp: -1 }).skip(100).toArray();
  if (oldItems.length) {
    await historyCollection().deleteMany({ _id: { $in: oldItems.map(item => item._id) } });
  }
  res.status(201).json(newHistoryItem);
}));

app.delete('/api/history', requireAuth, asyncRoute(async (req, res) => {
  await historyCollection().deleteMany({ userId: req.auth.sub });
  res.json({ message: 'History cleared' });
}));

app.delete('/api/history/:id', requireAuth, asyncRoute(async (req, res) => {
  await historyCollection().deleteOne({ id: req.params.id, userId: req.auth.sub });
  res.json({ message: 'History item removed' });
}));

// Collections Endpoints
app.options('/api/collections', (req, res) => {
  res.set('Allow', 'GET, HEAD, POST, OPTIONS').status(204).end();
});

app.options('/api/collections/:id', (req, res) => {
  res.set('Allow', 'HEAD, PUT, PATCH, DELETE, OPTIONS').status(204).end();
});

app.head('/api/collections', requireAuth, asyncRoute(async (req, res) => {
  const count = await collectionsCollection().countDocuments({ userId: req.auth.sub });
  res.set('X-Total-Count', String(count)).status(200).end();
}));

app.head('/api/collections/:id', requireAuth, asyncRoute(async (req, res) => {
  const collection = await collectionsCollection().findOne(
    { id: req.params.id, userId: req.auth.sub },
    { projection: { _id: 1 } }
  );
  if (!collection) return res.status(404).end();
  res.status(200).end();
}));

app.get('/api/collections', requireAuth, asyncRoute(async (req, res) => {
  const collections = await collectionsCollection().find({ userId: req.auth.sub }).sort({ createdAt: 1 }).toArray();
  res.json(collections);
}));

app.post('/api/collections', requireAuth, asyncRoute(async (req, res) => {
  const { name, description = '' } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Collection name is required' });
  }

  const newCollection = {
    id: Date.now().toString(),
    userId: req.auth.sub,
    name,
    description,
    requests: [],
    createdAt: new Date().toISOString()
  };

  await collectionsCollection().insertOne(newCollection);
  res.status(201).json(newCollection);
}));

app.put('/api/collections/:id', requireAuth, asyncRoute(async (req, res) => {
  const { name, description } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  const collection = await collectionsCollection().findOneAndUpdate(
    { id: req.params.id, userId: req.auth.sub }, { $set: updates }, { returnDocument: 'after' }
  );
  if (!collection) return res.status(404).json({ error: 'Collection not found' });
  res.json(collection);
}));

app.patch('/api/collections/:id', requireAuth, asyncRoute(async (req, res) => {
  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.description !== undefined) updates.description = req.body.description;

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'Provide name or description to update' });
  }

  const collection = await collectionsCollection().findOneAndUpdate(
    { id: req.params.id, userId: req.auth.sub },
    { $set: updates },
    { returnDocument: 'after' }
  );
  if (!collection) return res.status(404).json({ error: 'Collection not found' });
  res.json(collection);
}));

app.delete('/api/collections/:id', requireAuth, asyncRoute(async (req, res) => {
  const result = await collectionsCollection().deleteOne({ id: req.params.id, userId: req.auth.sub });
  if (!result.deletedCount) return res.status(404).json({ error: 'Collection not found' });
  res.json({ message: 'Collection deleted' });
}));

// Add Request to Collection
app.post('/api/collections/:colId/requests', requireAuth, asyncRoute(async (req, res) => {
  const { colId } = req.params;
  const newReq = {
    id: Date.now().toString(),
    name: req.body.name || 'Untitled Request',
    url: req.body.url || '',
    method: req.body.method || 'GET',
    headers: req.body.headers || [],
    body: req.body.body || '',
    bodyType: req.body.bodyType || 'none',
    auth: req.body.auth || { type: 'none' },
    queryParams: req.body.queryParams || []
  };

  const result = await collectionsCollection().updateOne({ id: colId, userId: req.auth.sub }, { $push: { requests: newReq } });
  if (!result.matchedCount) return res.status(404).json({ error: 'Collection not found' });
  res.status(201).json(newReq);
}));

// Update Request inside Collection
app.put('/api/collections/:colId/requests/:reqId', requireAuth, asyncRoute(async (req, res) => {
  const { colId, reqId } = req.params;
  const existing = await collectionsCollection().findOne(
    { id: colId, userId: req.auth.sub, 'requests.id': reqId }, { projection: { requests: { $elemMatch: { id: reqId } } } }
  );
  if (!existing) return res.status(404).json({ error: 'Request not found in collection' });
  const updatedRequest = { ...existing.requests[0], ...req.body, id: reqId };
  await collectionsCollection().updateOne(
    { id: colId, userId: req.auth.sub, 'requests.id': reqId }, { $set: { 'requests.$': updatedRequest } }
  );
  res.json(updatedRequest);
}));

// Delete Request from Collection
app.delete('/api/collections/:colId/requests/:reqId', requireAuth, asyncRoute(async (req, res) => {
  const { colId, reqId } = req.params;
  const result = await collectionsCollection().updateOne({ id: colId, userId: req.auth.sub }, { $pull: { requests: { id: reqId } } });
  if (!result.matchedCount) return res.status(404).json({ error: 'Collection not found' });
  res.json({ message: 'Request deleted from collection' });
}));

// Local sandbox mock DB data (resets on server restart)
let mockProduct = {
  id: 101,
  name: "Premium Wireless Headphones",
  price: 199.99,
  category: "Electronics",
  inStock: true,
  tags: ["audio", "wireless", "anc"],
  lastUpdated: "2026-07-15T12:00:00Z"
};

// Mock resource endpoint for PUT, PATCH, GET, DELETE testing
app.all('/api/test/resource', (req, res) => {
  const method = req.method.toUpperCase();
  const requestBody = req.body;

  if (method === 'HEAD') {
    res.set('Content-Type', 'application/json');
    return res.status(200).end();
  }

  if (method === 'GET') {
    return res.json({
      message: "Fetched mock product details (GET)",
      resource: mockProduct
    });
  }

  if (method === 'PUT') {
    // PUT replaces the resource entirely
    if (!requestBody || (typeof requestBody !== 'object' && typeof requestBody !== 'string')) {
      return res.status(400).json({
        error: "Bad Request",
        message: "PUT body must be a JSON object or parsed request data."
      });
    }

    let parsedBody = requestBody;
    if (typeof requestBody === 'string') {
      try {
        parsedBody = JSON.parse(requestBody);
      } catch (e) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Could not parse PUT body as JSON."
        });
      }
    }

    const oldProduct = { ...mockProduct };
    mockProduct = {
      id: 101, // Keep original ID
      ...parsedBody,
      lastUpdated: new Date().toISOString()
    };
    return res.json({
      message: "Resource fully replaced (PUT)",
      previous: oldProduct,
      current: mockProduct,
      headersReceived: req.headers,
      queryReceived: req.query
    });
  }

  if (method === 'PATCH') {
    // PATCH updates only fields provided
    if (!requestBody || (typeof requestBody !== 'object' && typeof requestBody !== 'string')) {
      return res.status(400).json({
        error: "Bad Request",
        message: "PATCH body must be a JSON object or parsed request data."
      });
    }

    let parsedBody = requestBody;
    if (typeof requestBody === 'string') {
      try {
        parsedBody = JSON.parse(requestBody);
      } catch (e) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Could not parse PATCH body as JSON."
        });
      }
    }

    const oldProduct = { ...mockProduct };
    mockProduct = {
      ...mockProduct,
      ...parsedBody,
      id: 101, // ID remains unchangeable
      lastUpdated: new Date().toISOString()
    };
    return res.json({
      message: "Resource partially updated (PATCH)",
      previous: oldProduct,
      current: mockProduct,
      headersReceived: req.headers,
      queryReceived: req.query
    });
  }

  if (method === 'DELETE') {
    return res.json({
      message: "Resource deleted (DELETE)",
      resourceId: 101,
      status: "deleted"
    });
  }

  res.status(405).json({ error: "Method Not Allowed" });
});

// Serve static assets in production (if built)
if (fs.existsSync(path.join(__dirname, '../client/dist'))) {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Database operation failed' });
});

const startServer = async () => {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set in server/.env and contain at least 32 characters');
  }
  await mongoClient.connect();
  database = mongoClient.db(MONGODB_DB);
  await historyCollection().createIndex({ timestamp: -1 });
  await collectionsCollection().createIndex({ id: 1 }, { unique: true });
  await usersCollection().createIndex({ email: 1 }, { unique: true });
  app.listen(PORT, () => {
    console.log(`Postman Backend Proxy Server running on port ${PORT}`);
    console.log(`Connected to MongoDB database: ${MONGODB_DB}`);
  });
};

startServer().catch(error => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
