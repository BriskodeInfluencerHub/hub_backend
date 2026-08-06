const ROLE_CONTACT_MATRIX = {
  admin: ['brand', 'influencer', 'agency', 'coordinator'],
  brand: ['influencer', 'admin', 'agency', 'coordinator'],
  influencer: ['brand', 'admin', 'agency', 'coordinator'],
  agency: ['brand', 'influencer', 'admin'],
  coordinator: ['brand', 'influencer', 'admin'],
};

/**
 * Returns allowed contact roles for a given user role.
 * Returns null if the user role is unknown or unsupported.
 * 
 * @param {string} userRole 
 * @returns {string[] | null}
 */
export const getAllowedContactRoles = (userRole) => {
  if (!userRole || typeof userRole !== 'string') {
    return null;
  }
  const normalizedRole = userRole.toLowerCase();
  return ROLE_CONTACT_MATRIX[normalizedRole] || null;
};

/**
 * Validates whether currentUserRole is authorized to initiate a chat with targetUserRole.
 * Pure function: no database calls, no HTTP objects, no Mongoose models.
 * 
 * @param {string} currentUserRole 
 * @param {string} targetUserRole 
 * @returns {boolean}
 */
export const canInitiateChat = (currentUserRole, targetUserRole) => {
  if (!currentUserRole || !targetUserRole) return false;
  const allowedRoles = getAllowedContactRoles(currentUserRole);
  if (!allowedRoles) return false;
  return allowedRoles.includes(targetUserRole.toLowerCase());
};

