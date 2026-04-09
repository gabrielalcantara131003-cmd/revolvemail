function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validateRequired(fields, body) {
  const missing = [];
  for (const field of fields) {
    if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
      missing.push(field);
    }
  }
  return missing;
}

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '').trim();
}

module.exports = { validateEmail, validateRequired, sanitizeString };
