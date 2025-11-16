const bcrypt = require('bcryptjs');

class PasswordService {
  // Verificar fortaleza de contraseña
  checkPasswordStrength(password) {
    const requirements = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      notCommon: !this.isCommonPassword(password)
    };

    const isValid = Object.values(requirements).every(Boolean);
    const score = Object.values(requirements).filter(Boolean).length;

    return {
      isValid,
      score,
      requirements,
      failedRequirements: Object.keys(requirements).filter(key => !requirements[key])
    };
  }

  // Verificar si es una contraseña común
  isCommonPassword(password) {
    const commonPasswords = [
      '123456', 'password', '12345678', 'qwerty', '123456789',
      '12345', '1234', '111111', '1234567', 'dragon',
      '123123', 'baseball', 'abc123', 'football', 'monkey',
      'letmein', '696969', 'shadow', 'master', '666666'
    ];
    
    return commonPasswords.includes(password.toLowerCase());
  }

  // Generar contraseña segura
  generateSecurePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Asegurar al menos un carácter de cada tipo
    password += this.getRandomChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    password += this.getRandomChar('abcdefghijklmnopqrstuvwxyz');
    password += this.getRandomChar('0123456789');
    password += this.getRandomChar('!@#$%^&*');
    
    // Completar el resto
    for (let i = password.length; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Mezclar los caracteres
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  }

  getRandomChar(charset) {
    return charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // Hash de contraseña
  async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Comparar contraseñas
  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }
}

module.exports = new PasswordService();