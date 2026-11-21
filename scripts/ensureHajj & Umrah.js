import 'dotenv/config'
import mongoose from 'mongoose'
import Category from '../models/Category.js'

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  const existing = await Category.findOne({
    $or: [
      { slug: 'Hajj & Umrah' },
      { name: { $regex: /^Hajj & Umrah$/i } }
    ]
  })

  if (!existing) {
    const created = await Category.create({
      name: 'Hajj & Umrah',
      slug: 'Hajj & Umrah',
      icon: '🛍️',
      image: '',
      isDeleted: false,
    })
    console.log('Created Hajj & Umrah category:', created._id)
  } else {
    console.log('Hajj & Umrah category already exists:', existing._id)
  }

  const all = await Category.find({ isDeleted: false })
  console.log('Active categories:', all.map(c => ({ id: c._id, name: c.name, slug: c.slug })))
  await mongoose.disconnect()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
