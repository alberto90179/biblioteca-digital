const crypto = require('crypto');
const securityConfig = require('../config/security');

class EncryptionService {
  constructor() {
    this.algorithm = securityConfig.encryption.algorithm;
    this.key = Buffer.from(securityConfig.encryption.key, 'utf8');
    this.ivLength = securityConfig.encryption.ivLength;
  }

  // Encriptar datos sensibles
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        iv: iv.toString('hex'),
        data: encrypted,
        tag: authTag.toString('hex')
      };
    } catch (error) {
      console.error('Error en encriptación:', error);
      throw new Error('Error al encriptar datos');
    }
  }

  // Desencriptar datos
  decrypt(encryptedData) {
    try {
      const decipher = crypto.createDecipheriv(
        this.algorithm, 
        this.key, 
        Buffer.from(encryptedData.iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Error en desencriptación:', error);
      throw new Error('Error al desencriptar datos');
    }
  }

  // Hash seguro para datos
  createHash(data) {
    return crypto
      .createHash('sha256')
      .update(data + securityConfig.encryption.key)
      .digest('hex');
  }

  // Generar token seguro
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Validar integridad de datos
  validateIntegrity(data, originalHash) {
    const currentHash = this.createHash(JSON.stringify(data));
    return currentHash === originalHash;
  }
}

module.exports = new EncryptionService();