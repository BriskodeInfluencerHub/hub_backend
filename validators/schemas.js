import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').transform((e) => e.toLowerCase()),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['influencer', 'brand', 'agency']),
  referralCode: z.string().optional(),   // ← FIX: allow referralCode through validation
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').transform((e) => e.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export const otpVerifySchema = z.object({
  email: z.string().email('Invalid email address').transform((e) => e.toLowerCase()),
  code: z.string().length(6, 'OTP code must be 6 digits'),
});

export const profileUpdateSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  profileImage: z.string().optional().nullable(),
  bio: z.string().optional(),
  location: z.string().optional(),
  categories: z.array(z.string()).optional(),
  socialAccounts: z.array(
    z.object({
      platform: z.enum(['instagram', 'youtube', 'tiktok', 'twitter', 'facebook']),
      username: z.string(),
      followers: z.number().nonnegative(),
      engagementRate: z.number().nonnegative(),
      link: z.string().optional(),
    })
  ).optional(),
  portfolio: z.array(
    z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      fileUrl: z.string().optional(),
      thumbnail: z.string().optional(),
    })
  ).optional(),
  tagline: z.string().optional(),
  pastBrands: z.string().optional(),
  featuredVideo: z.string().optional(),
  featuredVideo2: z.string().optional(),
  featuredVideo3: z.string().optional(),
  videoLayout: z.string().optional(),
  photos: z.array(z.string()).max(3).optional(),
  services: z.array(
    z.object({
      title: z.string(),
      price: z.number().nonnegative(),
      deliveryDays: z.number().positive(),
    })
  ).optional(),
  audienceGenderMale: z.number().min(0).max(100).optional(),
  audienceGenderFemale: z.number().min(0).max(100).optional(),
  audienceTopCountries: z.string().optional(),
  audienceAgeRange: z.string().optional(),
  contentFormats: z.string().optional(),
  businessEmail: z.string().optional(),
  businessPhone: z.string().optional(),
  faqs: z.array(
    z.object({
      question: z.string(),
      answer: z.string()
    })
  ).optional(),
  companyName: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  agencyName: z.string().optional(),
  revenueShare: z.number().min(0).max(100).optional(),
});

export const campaignSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
  budget: z.number().positive('Budget must be greater than 0'),
  targetAudience: z.string().optional(),
  location: z.string().optional(),
  requiredFollowers: z.number().nonnegative().optional(),
  requiredPlatforms: z.array(z.string()).optional(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start date' }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid end date' }),
});

export const applicationSchema = z.object({
  pitch: z.string().min(10, 'Pitch must be at least 10 characters'),
  proposedRate: z.number().positive('Proposed rate must be greater than 0'),
  portfolio: z.array(z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    fileUrl: z.string().optional(),
    thumbnail: z.string().optional(),
  })).optional(),
  socialStats: z.array(z.object({
    platform: z.string().optional(),
    username: z.string().optional(),
    followers: z.number().optional(),
    engagementRate: z.number().optional(),
    link: z.string().optional(),
  })).optional(),
});
export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }
};
