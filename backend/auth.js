const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./database/connection');

const accessCodes = {
  driver: process.env.DRIVER_ACCESS_CODE || 'DRIVER2024',
  admin: process.env.ADMIN_ACCESS_CODE || 'ADMIN2024'
};

const publicUser = (user) => ({
  id: user.UserID,
  username: user.UserName,
  contact: user.Contact,
  role: user.Role,
  email: user.Email
});

const validateRegistration = (body) => {
  const { email, password, role, accessCode, username, contact } = body;
  if (!email || !password || !role || !username) {
    return 'email, password, role, and username are required';
  }
  if (!['customer', 'driver', 'admin'].includes(role)) return 'invalid role';
  if (password.length < 6) return 'password must be at least 6 characters';
  if (role !== 'customer' && accessCode !== accessCodes[role]) return 'invalid access code';
  if (!contact) return 'contact is required';
  return null;
};

const findUserByEmail = async (email) => {
  const [rows] = await pool.execute(
    'SELECT UserID, UserName, Contact, Role, Email, PasswordHash FROM Users WHERE Email = ?',
    [email.trim().toLowerCase()]
  );
  return rows[0] || null;
};

const register = async (body) => {
  const email = body.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(body.password, 12);
  const [result] = await pool.execute(
    `INSERT INTO Users (UserName, Contact, Role, Email, PasswordHash)
     VALUES (?, ?, ?, ?, ?)`,
    [body.username.trim(), body.contact.trim(), body.role, email, passwordHash]
  );
  return {
    UserID: result.insertId,
    UserName: body.username.trim(),
    Contact: body.contact.trim(),
    Role: body.role,
    Email: email
  };
};

const createToken = (user) => jwt.sign(
  { sub: user.UserID, role: user.Role, email: user.Email },
  process.env.JWT_SECRET,
  { expiresIn: '2h' }
);

const authenticate = async (email, password, role) => {
  const user = await findUserByEmail(email);
  if (!user || user.Role !== role || !(await bcrypt.compare(password, user.PasswordHash))) {
    return null;
  }
  return user;
};

const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

const findUserById = async (id) => {
  const [rows] = await pool.execute(
    'SELECT UserID, UserName, Contact, Role, Email FROM Users WHERE UserID = ?',
    [id]
  );
  return rows[0] || null;
};

module.exports = {
  authenticate,
  createToken,
  findUserByEmail,
  findUserById,
  publicUser,
  register,
  validateRegistration,
  verifyToken
};