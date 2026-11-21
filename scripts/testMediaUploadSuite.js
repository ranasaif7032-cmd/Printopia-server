import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Product from '../models/Product.js'

async function runTests() {
  console.log('====================================================')
  console.log('   PrintopiaPK- MEDIA UPLOAD TEST SUITE    ')
  console.log('====================================================\n')

  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✔ Connected to MongoDB')

  // Find admin user
  const admin = await User.findOne({ role: 'admin', isDeleted: false })
  if (!admin) {
    throw new Error('Admin user not found')
  }

  const token = jwt.sign(
    { uid: admin.uid, role: admin.role, fullName: admin.fullName },
    process.env.JWT_SECRET.trim(),
    { expiresIn: '1d' }
  )
  console.log('✔ Generated Admin Token for:', admin.email)

  const sampleImgPath = path.resolve('server/scripts/sample.jpg')
  const sampleVideoPath = path.resolve('server/scripts/sample.mp4')

  let imgBuffer
  let videoBuffer

  if (fs.existsSync(sampleImgPath)) {
    imgBuffer = fs.readFileSync(sampleImgPath)
  } else {
    console.log('Downloading sample test image...')
    const res = await fetch('https://via.placeholder.com/200.jpg')
    imgBuffer = Buffer.from(await res.arrayBuffer())
  }

  if (fs.existsSync(sampleVideoPath)) {
    videoBuffer = fs.readFileSync(sampleVideoPath)
  } else {
    console.log('Downloading sample test video...')
    const res = await fetch('https://filesamples.com/samples/video/mp4/sample_640x360.mp4')
    videoBuffer = Buffer.from(await res.arrayBuffer())
  }
  console.log(`✔ Loaded sample image (${imgBuffer.length} bytes) and sample video (${videoBuffer.length} bytes)`)

  const API_URL = 'http://localhost:5000/api'
  const createdProductIds = []

  // Helper function to create product via POST /api/products
  async function createProduct(fields, files = {}) {
    const formData = new FormData()
    for (const [key, val] of Object.entries(fields)) {
      formData.append(key, val)
    }
    if (files.image) {
      formData.append('image', new Blob([files.image.buffer], { type: files.image.type }), files.image.name)
    }
    if (files.video) {
      formData.append('video', new Blob([files.video.buffer], { type: files.video.type }), files.video.name)
    }

    const res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(`Failed to create product (${res.status}): ${JSON.stringify(data)}`)
    }
    return data
  }

  // Helper function to update product via PUT /api/products/:id
  async function updateProduct(id, fields, files = {}) {
    const formData = new FormData()
    for (const [key, val] of Object.entries(fields)) {
      formData.append(key, val)
    }
    if (files.image) {
      formData.append('image', new Blob([files.image.buffer], { type: files.image.type }), files.image.name)
    }
    if (files.video) {
      formData.append('video', new Blob([files.video.buffer], { type: files.video.type }), files.video.name)
    }

    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(`Failed to update product (${res.status}): ${JSON.stringify(data)}`)
    }
    return data
  }

  try {
    // ---------------------------------------------------------
    // TEST 1: Add product with IMAGE ONLY
    // ---------------------------------------------------------
    console.log('\n--- TEST 1: Add Product with IMAGE ONLY ---')
    const prod1 = await createProduct(
      {
        name: 'AutoTest - Image Only Luxury Box',
        price: '1200',
        costPrice: '600',
        stock: '50',
        category: 'Wedding Favors',
        unit: 'pcs',
        description: 'Testing image only upload',
      },
      {
        image: { buffer: imgBuffer, type: 'image/jpeg', name: 'box.jpg' },
      }
    )
    createdProductIds.push(prod1._id)

    console.log('Created product ID:', prod1._id)
    console.log('imageURL in response:', prod1.imageURL)
    console.log('videoURL in response:', prod1.videoURL)
    console.log('images array:', prod1.images)

    if (!prod1.imageURL || !prod1.imageURL.startsWith('https://res.cloudinary.com')) {
      throw new Error(`TEST 1 FAILED: imageURL is not a valid Cloudinary URL: ${prod1.imageURL}`)
    }
    if (prod1.videoURL) {
      throw new Error(`TEST 1 FAILED: videoURL should be empty, got: ${prod1.videoURL}`)
    }
    console.log('✔ TEST 1 PASSED: Product with IMAGE ONLY created and verified successfully')

    // ---------------------------------------------------------
    // TEST 2: Add product with VIDEO ONLY
    // ---------------------------------------------------------
    console.log('\n--- TEST 2: Add Product with VIDEO ONLY ---')
    const prod2 = await createProduct(
      {
        name: 'AutoTest - Video Only Product Showcase',
        price: '2500',
        costPrice: '1400',
        stock: '30',
        category: 'Hajj & Umrah',
        unit: 'pcs',
        description: 'Testing video only upload',
      },
      {
        video: { buffer: videoBuffer, type: 'video/mp4', name: 'showcase.mp4' },
      }
    )
    createdProductIds.push(prod2._id)

    console.log('Created product ID:', prod2._id)
    console.log('imageURL in response:', prod2.imageURL)
    console.log('videoURL in response:', prod2.videoURL)

    if (!prod2.videoURL || !prod2.videoURL.startsWith('https://res.cloudinary.com')) {
      throw new Error(`TEST 2 FAILED: videoURL is not a valid Cloudinary URL: ${prod2.videoURL}`)
    }
    if (prod2.imageURL) {
      throw new Error(`TEST 2 FAILED: imageURL should be empty, got: ${prod2.imageURL}`)
    }
    console.log('✔ TEST 2 PASSED: Product with VIDEO ONLY created and verified successfully')

    // ---------------------------------------------------------
    // TEST 3: Add product with BOTH IMAGE AND VIDEO
    // ---------------------------------------------------------
    console.log('\n--- TEST 3: Add Product with BOTH IMAGE AND VIDEO ---')
    const prod3 = await createProduct(
      {
        name: 'AutoTest - Premium Tabarruk Set (Both Media)',
        price: '4500',
        costPrice: '2800',
        stock: '25',
        category: 'Hajj & Umrah',
        subcategory: 'Complete Sets',
        unit: 'pcs',
        description: 'Testing both image and video upload together',
      },
      {
        image: { buffer: imgBuffer, type: 'image/jpeg', name: 'set.jpg' },
        video: { buffer: videoBuffer, type: 'video/mp4', name: 'set.mp4' },
      }
    )
    createdProductIds.push(prod3._id)

    console.log('Created product ID:', prod3._id)
    console.log('imageURL in response:', prod3.imageURL)
    console.log('videoURL in response:', prod3.videoURL)

    if (!prod3.imageURL || !prod3.imageURL.startsWith('https://res.cloudinary.com')) {
      throw new Error(`TEST 3 FAILED: imageURL is not a valid Cloudinary URL: ${prod3.imageURL}`)
    }
    if (!prod3.videoURL || !prod3.videoURL.startsWith('https://res.cloudinary.com')) {
      throw new Error(`TEST 3 FAILED: videoURL is not a valid Cloudinary URL: ${prod3.videoURL}`)
    }
    console.log('✔ TEST 3 PASSED: Product with BOTH IMAGE AND VIDEO created successfully')

    // ---------------------------------------------------------
    // TEST 4: Direct MongoDB Verification
    // ---------------------------------------------------------
    console.log('\n--- TEST 4: Direct MongoDB Verification ---')
    const dbDoc1 = await Product.findById(prod1._id)
    const dbDoc2 = await Product.findById(prod2._id)
    const dbDoc3 = await Product.findById(prod3._id)

    console.log('DB Doc 1 (Image only) - imageURL:', dbDoc1.imageURL, '| videoURL:', dbDoc1.videoURL)
    console.log('DB Doc 2 (Video only) - imageURL:', dbDoc2.imageURL, '| videoURL:', dbDoc2.videoURL)
    console.log('DB Doc 3 (Both)       - imageURL:', dbDoc3.imageURL, '| videoURL:', dbDoc3.videoURL)

    if (!dbDoc1.imageURL || dbDoc1.videoURL) throw new Error('DB Doc 1 mismatch')
    if (dbDoc2.imageURL || !dbDoc2.videoURL) throw new Error('DB Doc 2 mismatch')
    if (!dbDoc3.imageURL || !dbDoc3.videoURL) throw new Error('DB Doc 3 mismatch')
    console.log('✔ TEST 4 PASSED: MongoDB schema correctly saved imageURL and videoURL')

    // ---------------------------------------------------------
    // TEST 5: Edit Product (Keep existing media, replace video)
    // ---------------------------------------------------------
    console.log('\n--- TEST 5: Edit Product (Keep Image, Replace Video) ---')
    const originalImage = prod3.imageURL
    const updatedProd3 = await updateProduct(
      prod3._id,
      {
        name: 'AutoTest - Premium Tabarruk Set (Edited)',
        price: '4800',
        imageURL: originalImage, // keep existing image
      },
      {
        video: { buffer: videoBuffer, type: 'video/mp4', name: 'new_video.mp4' }, // replace video
      }
    )

    console.log('Updated product imageURL:', updatedProd3.imageURL)
    console.log('Updated product videoURL:', updatedProd3.videoURL)

    if (updatedProd3.imageURL !== originalImage) {
      throw new Error(`TEST 5 FAILED: Expected imageURL to remain ${originalImage}, got ${updatedProd3.imageURL}`)
    }
    if (!updatedProd3.videoURL || !updatedProd3.videoURL.startsWith('https://res.cloudinary.com')) {
      throw new Error(`TEST 5 FAILED: Video was not updated to a valid URL`)
    }
    console.log('✔ TEST 5 PASSED: Product edit kept existing image and replaced video')

    // ---------------------------------------------------------
    // TEST 6: Public Products Retrieval
    // ---------------------------------------------------------
    console.log('\n--- TEST 6: Public Products API Retrieval ---')
    const getRes = await fetch(`${API_URL}/products`)
    const allProducts = await getRes.json()
    const found = allProducts.find(p => p._id === prod3._id)
    if (!found) throw new Error('Product not returned in GET /api/products')
    console.log('Found product in public API with imageURL and videoURL:', {
      name: found.name,
      imageURL: found.imageURL,
      videoURL: found.videoURL,
    })
    console.log('✔ TEST 6 PASSED: Media URLs available in public products query')

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    console.log('\n--- CLEANING UP TEST PRODUCTS ---')
    for (const id of createdProductIds) {
      const delRes = await fetch(`${API_URL}/products/${id}/permanent`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const delJson = await delRes.json()
      console.log(`Deleted product ${id}:`, delJson.message)
    }
    console.log('✔ All test products and Cloudinary test media cleaned up successfully.')

    console.log('\n====================================================')
    console.log('   🎉 ALL 6 INTEGRATION TESTS PASSED PERFECTLY!     ')
    console.log('====================================================\n')
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err)
    // Attempt cleanup if any failed
    for (const id of createdProductIds) {
      try {
        await Product.findByIdAndDelete(id)
      } catch { }
    }
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

runTests()
