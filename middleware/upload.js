import multer from 'multer'

const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  if (['image', 'image1', 'image2', 'images'].includes(file.fieldname)) {
    const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (allowedImages.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid image format. Allowed formats: JPG, JPEG, PNG, WEBP.'))
    }
  } else if (file.fieldname === 'video') {
    const allowedVideos = ['video/mp4', 'video/webm', 'video/quicktime']
    if (allowedVideos.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid video format. Allowed formats: MP4, WEBM.'))
    }
  } else {
    cb(null, true)
  }
}

// 100MB max limit to accommodate high quality product videos
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter,
})

// Specialized middleware for product media uploads (up to 2 images + 1 video)
export const productMediaUpload = (req, res, next) => {
  const handler = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'images', maxCount: 2 },
    { name: 'video', maxCount: 1 },
  ])

  handler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Maximum size for videos is 100MB, and images is 15MB.' })
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` })
    } else if (err) {
      return res.status(400).json({ error: err.message })
    }

    // Additional size validation for images specifically (15MB max per image)
    const imageFiles = [
      ...(req.files?.image || []),
      ...(req.files?.image1 || []),
      ...(req.files?.image2 || []),
      ...(req.files?.images || []),
    ]
    for (const img of imageFiles) {
      if (img.size > 15 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image file size exceeds 15MB limit.' })
      }
    }

    next()
  })
}

export default upload
