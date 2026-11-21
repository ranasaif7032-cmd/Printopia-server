import 'dotenv/config'
import dns from 'node:dns'
dns.setServers(['8.8.8.8', '8.8.4.4'])
import mongoose from 'mongoose'
import Category from '../models/Category.js'
import Offer from '../models/Offer.js'

async function run() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected.')

  const initialCategories = [
    { name: 'Hajj & Umrah', slug: 'hajj-umrah', icon: '🕋' },
    { name: 'Boxes', slug: 'boxes', icon: '📦' },
    { name: 'Wedding Bids & Favors', slug: 'wedding-bids-favors', icon: '💍' },
    { name: 'Stickers & Labels', slug: 'stickers-labels', icon: '🏷️' },
    { name: 'Corporate Branding', slug: 'corporate-branding', icon: '💼' },
    { name: 'Events Essentials', slug: 'events-essentials', icon: '🎉' },
  ]

  for (const cat of initialCategories) {
    const existing = await Category.findOne({
      $or: [{ name: new RegExp(`^${cat.name}$`, 'i') }, { slug: cat.slug }],
    })
    if (!existing) {
      await Category.create({ ...cat, isDeleted: false })
      console.log(`✓ Created Category: ${cat.name}`)
    } else {
      console.log(`• Category already exists: ${cat.name}`)
    }
  }

  // Create a default welcome offer if none exist
  const existingOffer = await Offer.findOne({ isDeleted: false })
  if (!existingOffer) {
    await Offer.create({
      title: 'Welcome to Printopia PK',
      description: 'Get exclusive 10% discount on personalized boxes & event sets!',
      discountPercentage: 10,
      badge: 'NEW',
      category: 'Special Offers',
      targetLink: '/shop',
      isActive: true,
      createdBy: 'System Seed',
    })
    console.log('✓ Created Welcome Offer.')
  }

  await mongoose.disconnect()
  console.log('Seed completed successfully!')
  process.exit(0)
}

run().catch((err) => {
  console.error('Seed error:', err)
  process.exit(1)
})
