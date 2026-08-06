import User from '../models/User.js';
import { getAllowedContactRoles } from '../helpers/chatRolePermission.js';

/**
 * Escapes special regex characters in search strings to prevent regex injection / malformed regex errors.
 * 
 * @param {string} str 
 * @returns {string}
 */
const sanitizeRegexString = (str) => {
  return str.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Fetches lightweight chat contacts with role-based filtering, search, pagination, and deterministic sorting.
 * 
 * @param {Object} params
 * @param {string|Object} params.currentUserId - Authenticated user ID
 * @param {string} params.currentUserRole - Authenticated user role
 * @param {number} params.page - Page number (>= 1)
 * @param {number} params.limit - Items per page (1 to 50)
 * @param {string} [params.q] - Search query
 * @returns {Promise<{ contacts: Array, pagination: Object }>}
 */
export const fetchContacts = async ({ currentUserId, currentUserRole, page, limit, q }) => {
  const targetRoles = getAllowedContactRoles(currentUserRole);
  if (!targetRoles) {
    const error = new Error(`Role '${currentUserRole}' is not authorized to access chat contacts`);
    error.statusCode = 403;
    throw error;
  }

  const filter = {
    _id: { $ne: currentUserId },
    role: { $in: targetRoles },
    status: 'active',
    isVerified: true,
    isDeleted: { $ne: true },
  };

  if (q && typeof q === 'string' && q.trim()) {
    const safeQ = sanitizeRegexString(q);
    filter.$or = [
      { name: { $regex: safeQ, $options: 'i' } },
      { email: { $regex: safeQ, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [contacts, total] = await Promise.all([
    User.find(filter)
      .select('_id name email role profileImage status')
      .sort({ name: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const pages = Math.ceil(total / limit) || 1;

  return {
    contacts,
    pagination: {
      total,
      page,
      limit,
      pages,
    },
  };
};
