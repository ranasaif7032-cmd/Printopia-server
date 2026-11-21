import 'dotenv/config'
import dns from 'node:dns'
dns.setServers(['8.8.8.8', '8.8.4.4'])
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

async function run() {
  const targetEmail = (process.argv[2] || 'printopia@gmail.com').trim().toLowerCase()
  const newPassword = (process.argv[3] || 'admin123').trim()

  console.log(`Connecting to MongoDB...`)
  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`Connected to database.`)

  const hashedPassword = await bcrypt.hash(newPassword, 10)

  let user = await User.findOne({
    email: new RegExp(`^${targetEmail}$`, 'i'),
  })

  if (user) {
    user.password = hashedPassword
    user.role = 'admin'
    user.status = 'active'
    user.isDeleted = false
    await user.save()
    console.log(`✓ Successfully updated existing user "${targetEmail}" with role 'admin' and password: ${newPassword}`)
  } else {
    const uid = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    user = await User.create({
      uid,
      fullName: 'Printopia Admin',
      email: targetEmail,
      password: hashedPassword,
      phone: '+92 328 0060010',
      role: 'admin',
      status: 'active',
      isDeleted: false,
    })
    console.log(`✓ Successfully created new admin user "${targetEmail}" with password: ${newPassword}`)
  }

  // Also make sure printopiapk905@gmail.com is an admin if requested
  const secondaryEmail = 'printopiapk905@gmail.com'
  if (targetEmail !== secondaryEmail) {
    let secondAdmin = await User.findOne({ email: new RegExp(`^${secondaryEmail}$`, 'i') })
    if (!secondAdmin) {
      await User.create({
        uid: `admin_${Date.now()}_second`,
        fullName: 'Printopia PK 905',
        email: secondaryEmail,
        password: hashedPassword,
        phone: '+92 328 0060010',
        role: 'admin',
        status: 'active',
        isDeleted: false,
      })
      console.log(`✓ Also registered secondary admin account: "${secondaryEmail}" with password: ${newPassword}`)
    } else {
      secondAdmin.password = hashedPassword
      secondAdmin.role = 'admin'
      secondAdmin.status = 'active'
      await secondAdmin.save()
      console.log(`✓ Also synced password for secondary admin account: "${secondaryEmail}"`)
    }
  }

  await mongoose.disconnect()
  console.log(`Done! You can now log in using:`)
  console.log(`  Email:    ${targetEmail} (or ${secondaryEmail})`)
  console.log(`  Password: ${newPassword}`)
  process.exit(0)
}

run().catch((err) => {
  console.error('Error resetting admin:', err)
  process.exit(1)
})
