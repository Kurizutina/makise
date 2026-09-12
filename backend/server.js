const express = require('express');
const cors = require('cors');
const pool = require('./database/connection');
const {
  authenticate,
  createToken,
  findUserByEmail,
  findUserById,
  publicUser,
  register,
  validateRegistration,
  verifyToken
} = require('./auth');

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000' }));

const requireAuth = async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'authentication required' });

  try {
    const claims = verifyToken(token);
    req.user = await findUserById(claims.sub);
    if (!req.user) return res.status(401).json({ error: 'invalid authentication token' });
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid authentication token' });
  }
};

app.post('/api/auth/register', async (req, res) => {
  const validationError = validateRegistration(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    if (await findUserByEmail(req.body.email)) {
      return res.status(409).json({ error: 'email is already registered' });
    }
    const user = await register(req.body);
    return res.status(201).json({ user: publicUser(user), token: createToken(user) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'email is already registered' });
    console.error(`Registration failed: ${error.message}`);
    return res.status(500).json({ error: 'registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'email, password, and role are required' });
  }
  try {
    const user = await authenticate(email, password, role);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    return res.json({ user: publicUser(user), token: createToken(user) });
  } catch (error) {
    console.error(`Login failed: ${error.message}`);
    return res.status(500).json({ error: 'login failed' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get('/api/health/db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS databaseName');
    return res.json({ status: 'connected', database: rows[0].databaseName });
  } catch (error) {
    console.error(`Database health check failed: ${error.message}`);
    return res.status(503).json({ status: 'disconnected' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Otu-Zan backend listening on http://localhost:${port}`);
  });
}

module.exports = app;
