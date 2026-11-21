import dns from 'dns'
import mongoose from 'mongoose'

const getRequiredEnv = (name) => {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}. Create a server/.env file and set it before starting the app.`)
  }
  return value.trim()
}

if (!process.env.VERCEL) {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4'])
  } catch {}
}

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection
    }

    const uri = getRequiredEnv('MONGODB_URI')
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    })
    console.log(`MongoDB connected: ${conn.connection.host}`)
    return conn.connection
  } catch (err) {
    console.error('MongoDB connection error:', err.message)
    throw err
  }
}

export default connectDB
