import { Router } from 'express'
import { Readable } from 'node:stream'
import mongoose from 'mongoose'
import Product from '../models/Product.js'
import cloudinary from '../config/cloudinary.js'
import { protect, adminOnly } from '../middleware/auth.js'
import { productMediaUpload } from '../middleware/upload.js'

const router = Router()

const uploadToCloudinary = (fileBuffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error)
      resolve(result)
    })
    Readable.from(fileBuffer).pipe(stream)
  })
}

const deleteCloudinaryMedia = async (product) => {
  const imageUrls = new Set([
    ...(Array.isArray(product.images) ? product.images : []),
    product.imageURL,
    product.imageURL2,
  ].filter(Boolean))

  for (const url of imageUrls) {
    try {
      const parts = url.split('/')
      const idx = parts.indexOf('upload')
      if (idx !== -1) {
        const publicId = parts.slice(idx + 1).join('/').replace(/\.[^.]+$/, '').replace(/^v\d+\//, '')
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
      }
    } catch { }
  }

  if (product.videoURL) {
    try {
      const parts = product.videoURL.split('/')
      const idx = parts.indexOf('upload')
      if (idx !== -1) {
        const publicId = parts.slice(idx + 1).join('/').replace(/\.[^.]+$/, '').replace(/^v\d+\//, '')
        await cloudinary.uploader.destroy(publicId, { resource_type: 'video' })
      }
    } catch { }
  }
}



// GET /api/products - List products with optional filters (all, featured, category, search)
router.get('/', async (req, res) => {
  try {
    const { all, featured, category, search } = req.query
    const conditions = []

    if (all !== 'true') {
      conditions.push({ isDeleted: { $ne: true } })
    }

    if (featured === 'true') {
      conditions.push({ featured: true })
    }

    if (category) {
      conditions.push({
        $or: [
          { category: new RegExp(`^${category}$`, 'i') },
          { parentCategory: new RegExp(`^${category}$`, 'i') },
          { subcategory: new RegExp(`^${category}$`, 'i') },
        ],
      })
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i')
      conditions.push({
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { parentCategory: searchRegex },
          { subcategory: searchRegex },
        ],
      })
    }

    const filter = conditions.length > 0 ? { $and: conditions } : {}
    const products = await Product.find(filter).sort({ featuredOrder: 1, position: 1, createdAt: -1 })
    res.json(products)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', protect, adminOnly, productMediaUpload, async (req, res) => {
  try {
    const data = { ...req.body }
    if (data.price !== undefined) data.price = Number(data.price)
    if (data.costPrice !== undefined) data.costPrice = Number(data.costPrice)
    if (data.stock !== undefined) data.stock = Number(data.stock)
    if (data.position !== undefined) data.position = Number(data.position)
    if (data.featured !== undefined) data.featured = data.featured === 'true' || data.featured === true

    // Normalize category, parentCategory and subcategory
    if (data.category) data.category = String(data.category).trim()
    if (data.parentCategory) data.parentCategory = String(data.parentCategory).trim()
    if (data.subcategory) data.subcategory = String(data.subcategory).trim()

    if (data.parentCategory && !data.category) {
      data.category = data.parentCategory
    }
    if (!data.parentCategory && data.category) {
      data.parentCategory = data.category
    }

    // Extract Image Files (Supporting Image 1, Image 2, or images array)
    const image1File = req.files?.image1?.[0] || req.files?.image?.[0] || req.files?.images?.[0] || req.file
    const image2File = req.files?.image2?.[0] || (req.files?.images?.[1] && req.files.images[1] !== image1File ? req.files.images[1] : undefined)
    const videoFile = req.files?.video?.[0]

    let img1Url = ''
    let img2Url = ''

    // Handle Image 1
    if (image1File) {
      const result = await uploadToCloudinary(image1File.buffer, {
        folder: 'products',
        resource_type: 'image',
      })
      img1Url = result.secure_url
    } else if (data.imageURL) {
      img1Url = String(data.imageURL).trim()
    } else if (data.image1URL) {
      img1Url = String(data.image1URL).trim()
    } else if (Array.isArray(data.images) && data.images[0]) {
      img1Url = String(data.images[0]).trim()
    } else if (typeof data.images === 'string' && data.images) {
      img1Url = String(data.images).trim()
    }

    // Handle Image 2
    if (image2File) {
      const result = await uploadToCloudinary(image2File.buffer, {
        folder: 'products',
        resource_type: 'image',
      })
      img2Url = result.secure_url
    } else if (data.imageURL2) {
      img2Url = String(data.imageURL2).trim()
    } else if (data.image2URL) {
      img2Url = String(data.image2URL).trim()
    } else if (Array.isArray(data.images) && data.images[1]) {
      img2Url = String(data.images[1]).trim()
    }

    // Combine images: exactly up to 2 images
    const finalImages = [img1Url, img2Url].filter(Boolean).slice(0, 2)
    data.images = finalImages
    data.imageURL = finalImages[0] || ''
    data.imageURL2 = finalImages[1] || ''

    // Handle Video Upload (exactly up to 1 video)
    if (videoFile) {
      const result = await uploadToCloudinary(videoFile.buffer, {
        folder: 'products/videos',
        resource_type: 'video',
      })
      data.videoURL = result.secure_url
    } else if (data.videoURL) {
      data.videoURL = String(data.videoURL).trim()
    } else {
      data.videoURL = ''
    }

    delete data.image1URL
    delete data.image2URL

    const product = await Product.create(data)
    res.status(201).json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/bulk/permanent', protect, adminOnly, async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: true })
    for (const product of products) {
      await deleteCloudinaryMedia(product)
    }
    await Product.deleteMany({ isDeleted: true })
    res.json({ message: 'All deleted products permanently removed' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/bulk/restore', protect, adminOnly, async (req, res) => {
  try {
    await Product.updateMany({ isDeleted: true }, { isDeleted: false, deletedAt: null, deletedBy: '' })
    res.json({ message: 'All deleted products restored' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Product not found' })
    }
    const product = await Product.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', protect, adminOnly, productMediaUpload, async (req, res) => {
  try {
    const update = { ...req.body }
    if (update.price !== undefined) update.price = Number(update.price)
    if (update.costPrice !== undefined) update.costPrice = Number(update.costPrice)
    if (update.stock !== undefined) update.stock = Number(update.stock)
    if (update.position !== undefined) update.position = Number(update.position)
    if (update.featured !== undefined) update.featured = update.featured === 'true' || update.featured === true

    if (update.category) update.category = String(update.category).trim()
    if (update.parentCategory) update.parentCategory = String(update.parentCategory).trim()
    if (update.subcategory !== undefined) update.subcategory = String(update.subcategory).trim()

    if (update.parentCategory && !update.category) {
      update.category = update.parentCategory
    }
    if (!update.parentCategory && update.category) {
      update.parentCategory = update.category
    }

    const existingProduct = await Product.findById(req.params.id)
    if (!existingProduct) return res.status(404).json({ error: 'Product not found' })

    const image1File = req.files?.image1?.[0] || req.files?.image?.[0] || req.files?.images?.[0] || req.file
    const image2File = req.files?.image2?.[0] || (req.files?.images?.[1] && req.files.images[1] !== image1File ? req.files.images[1] : undefined)
    const videoFile = req.files?.video?.[0]

    let finalImage1 = existingProduct.imageURL || existingProduct.images?.[0] || ''
    let finalImage2 = existingProduct.imageURL2 || existingProduct.images?.[1] || ''

    // Handle Image 1 (upload new, remove, or retain/update)
    if (image1File) {
      const result = await uploadToCloudinary(image1File.buffer, {
        folder: 'products',
        resource_type: 'image',
      })
      finalImage1 = result.secure_url
    } else if (update.removeImage1 === 'true' || update.removeImage1 === true || update.removeImage === 'true' || update.removeImage === true) {
      finalImage1 = ''
    } else if (update.imageURL !== undefined) {
      finalImage1 = String(update.imageURL).trim()
    } else if (update.image1URL !== undefined) {
      finalImage1 = String(update.image1URL).trim()
    }

    // Handle Image 2 (upload new, remove, or retain/update)
    if (image2File) {
      const result = await uploadToCloudinary(image2File.buffer, {
        folder: 'products',
        resource_type: 'image',
      })
      finalImage2 = result.secure_url
    } else if (update.removeImage2 === 'true' || update.removeImage2 === true) {
      finalImage2 = ''
    } else if (update.imageURL2 !== undefined) {
      finalImage2 = String(update.imageURL2).trim()
    } else if (update.image2URL !== undefined) {
      finalImage2 = String(update.image2URL).trim()
    }

    // Finalize images (strictly up to 2 images)
    const finalImages = [finalImage1, finalImage2].filter(Boolean).slice(0, 2)
    update.images = finalImages
    update.imageURL = finalImages[0] || ''
    update.imageURL2 = finalImages[1] || ''

    // Handle Video replacement, retention or removal
    if (videoFile) {
      const result = await uploadToCloudinary(videoFile.buffer, {
        folder: 'products/videos',
        resource_type: 'video',
      })
      update.videoURL = result.secure_url
    } else if (update.removeVideo === 'true' || update.removeVideo === true) {
      update.videoURL = ''
    } else if (update.videoURL !== undefined) {
      update.videoURL = String(update.videoURL).trim()
    } else {
      update.videoURL = existingProduct.videoURL || ''
    }

    delete update.removeImage
    delete update.removeImage1
    delete update.removeImage2
    delete update.removeVideo
    delete update.image1URL
    delete update.image2URL

    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
      deletedAt: Date.now(),
      deletedBy: req.user.fullName || req.user.email || req.user.uid || 'Unknown',
    }, { new: true })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json({ message: 'Product soft deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/restore', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, {
      isDeleted: false,
      deletedAt: null,
      deletedBy: '',
    }, { new: true })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id/permanent', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    await deleteCloudinaryMedia(product)
    res.json({ message: 'Product permanently deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/stock', protect, adminOnly, async (req, res) => {
  try {
    const { stock } = req.body
    const product = await Product.findByIdAndUpdate(req.params.id, { stock: Number(stock) }, { new: true })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/featured-order', protect, adminOnly, async (req, res) => {
  try {
    const { featuredOrder } = req.body
    const product = await Product.findByIdAndUpdate(req.params.id, { featuredOrder: Number(featuredOrder) }, { new: true })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
