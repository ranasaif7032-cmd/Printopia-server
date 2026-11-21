import mongoose from 'mongoose'

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    image: { type: String, default: '' },
    badge: { type: String, default: 'HOT' },
    category: { type: String, default: '' },
    targetLink: { type: String, default: '' },
    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: '' },
    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
)

offerSchema.index({ isActive: 1, isDeleted: 1, expiryDate: 1 })
offerSchema.index({ createdAt: -1 })

export default mongoose.model('Offer', offerSchema)

