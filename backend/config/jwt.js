const securityConfig = require('./security');

module.exports = {
  secret: securityConfig.jwt.secret,
  refreshSecret: securityConfig.jwt.refreshSecret,
  expiresIn: securityConfig.jwt.expiresIn,
  refreshExpiresIn: securityConfig.jwt.refreshExpiresIn,
  issuer: securityConfig.jwt.issuer,
  audience: securityConfig.jwt.audience
};