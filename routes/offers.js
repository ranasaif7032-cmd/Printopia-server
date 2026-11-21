import { Router } from 'express'
import Offer from '../models/Offer.js'
import { protect, adminOnly } from '../middleware/auth.js'

const router = Router()

/**
 * Public Endpoint: Get active customer-facing offers
 * Non-admins can only see active, non-expired, non-deleted offers
 */
router.get('/', async (req, res) => {
  try {
    const now = new Date()
    const query = {
      isActive: true,
      isDeleted: false,
      $or: [
        { expiryDate: null },
        { expiryDate: { $gte: now } },
      ],
    }

    const offers = await Offer.find(query).sort({ createdAt: -1 })
    res.json(offers)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch offers' })
  }
})

/**
 * Admin Endpoint: Get all offers (active, inactive, scheduled)
 * Protected by protect + adminOnly
 */
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const offers = await Offer.find({ isDeleted: false }).sort({ createdAt: -1 })
    res.json(offers)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch admin offers' })
  }
})

/**
 * Admin Endpoint: Create new offer
 * Protected by protect + adminOnly
 */
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const {
      title,
      description,
      discountPercentage,
      image,
      badge,
      category,
      targetLink,
      startDate,
      expiryDate,
      isActive,
    } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Offer title is required' })
    }

    const newOffer = new Offer({
      title: title.trim(),
      description: description?.trim() || '',
      discountPercentage: Number(discountPercentage) || 0,
      image: image?.trim() || '',
      badge: badge?.trim() || 'HOT',
      category: category?.trim() || '',
      targetLink: targetLink?.trim() || '',
      startDate: startDate ? new Date(startDate) : new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      createdBy: req.user?.fullName || req.user?.email || 'Admin',
    })

    await newOffer.save()
    res.status(201).json(newOffer)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create offer' })
  }
})

/**
 * Admin Endpoint: Update existing offer
 * Protected by protect + adminOnly
 */
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const offer = await Offer.findOne({ _id: id, isDeleted: false })

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' })
    }

    const {
      title,
      description,
      discountPercentage,
      image,
      badge,
      category,
      targetLink,
      startDate,
      expiryDate,
      isActive,
    } = req.body

    if (title !== undefined) offer.title = title.trim()
    if (description !== undefined) offer.description = description.trim()
    if (discountPercentage !== undefined) offer.discountPercentage = Number(discountPercentage) || 0
    if (image !== undefined) offer.image = image.trim()
    if (badge !== undefined) offer.badge = badge.trim()
    if (category !== undefined) offer.category = category.trim()
    if (targetLink !== undefined) offer.targetLink = targetLink.trim()
    if (startDate !== undefined) offer.startDate = startDate ? new Date(startDate) : new Date()
    if (expiryDate !== undefined) offer.expiryDate = expiryDate ? new Date(expiryDate) : null
    if (isActive !== undefined) offer.isActive = Boolean(isActive)

    await offer.save()
    res.json(offer)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update offer' })
  }
})

/**
 * Admin Endpoint: Toggle active status
 * Protected by protect + adminOnly
 */
router.patch('/:id/toggle', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const offer = await Offer.findOne({ _id: id, isDeleted: false })

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' })
    }

    offer.isActive = !offer.isActive
    await offer.save()
    res.json(offer)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to toggle offer status' })
  }
})

/**
 * Admin Endpoint: Delete offer (soft delete)
 * Protected by protect + adminOnly
 */
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const offer = await Offer.findOne({ _id: id, isDeleted: false })

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' })
    }

    offer.isDeleted = true
    offer.deletedAt = new Date()
    offer.deletedBy = req.user?.fullName || req.user?.email || 'Admin'
    await offer.save()

    res.json({ message: 'Offer deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete offer' })
  }
})

export default router

