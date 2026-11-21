import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret || !secret.trim()) {
    throw new Error('Missing required environment variable: JWT_SECRET. Create a server/.env file and set it before starting the app.')
  }
  return secret.trim()
}

export const protect = async (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authorized, no token' })
  }
  try {
    const token = header.split(' ')[1]
    const decoded = jwt.verify(token, getJwtSecret())
    const user = await User.findOne({ uid: decoded.uid, isDeleted: false }).select('-password')
    if (!user) return res.status(401).json({ error: 'User not found' })
    if (user.status === 'blocked') return res.status(403).json({ error: 'Account blocked' })
    req.user = user
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' })
    }
    if (err.message?.includes('JWT_SECRET')) {
      return res.status(500).json({ error: err.message })
    }
    return res.status(401).json({ error: 'Token invalid' })
  }
}

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

export const signToken = (uid, role) => {
  return jwt.sign({ uid, role }, getJwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
}
