import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Wallet from './models/Wallet.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Database connected for seeding...');

    const adminEmail = 'admin@briskode.com';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log(`Admin account already exists with email: ${adminEmail}`);
      process.exit(0);
    }

    const admin = await User.create({
      name: 'Platform Admin',
      email: adminEmail,
      phone: '0000000000',
      password: 'admin123', // Will be automatically hashed by pre-save hook
      role: 'admin',
      isVerified: true,
      status: 'active'
    });

    await Wallet.create({ user: admin._id, balance: 0 });

    console.log('\n====================================');
    console.log('ADMIN SEED SUCCESSFUL!');
    console.log(`Email: ${adminEmail}`);
    console.log('Password: adminpassword123');
    console.log('====================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedAdmin();
