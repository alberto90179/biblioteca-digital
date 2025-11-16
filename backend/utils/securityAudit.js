const EncryptionService = require('../middleware/encryption');

class SecurityAudit {
  constructor() {
    this.auditLog = [];
  }

  logSecurityEvent(eventType, details, userId = null, severity = 'info') {
    const event = {
      id: EncryptionService.generateSecureToken(16),
      timestamp: new Date().toISOString(),
      eventType,
      severity,
      userId,
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown'
    };

    this.auditLog.push(event);
    
    // En producción, guardar en base de datos
    if (process.env.NODE_ENV === 'production') {
      this.saveToDatabase(event);
    }

    console.log(`[SECURITY ${severity.toUpperCase()}] ${eventType}:`, {
      userId,
      ip: details.ip,
      ...details
    });
  }

  logLoginAttempt(email, success, details, userId = null) {
    this.logSecurityEvent(
      success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      { email, ...details },
      userId,
      success ? 'info' : 'warning'
    );
  }

  logDataAccess(userId, resource, action, details) {
    this.logSecurityEvent(
      'DATA_ACCESS',
      { resource, action, ...details },
      userId,
      'info'
    );
  }

  logSecurityBreach(details, userId = null) {
    this.logSecurityEvent(
      'SECURITY_BREACH',
      details,
      userId,
      'error'
    );
  }

  logRateLimitExceeded(ip, endpoint) {
    this.logSecurityEvent(
      'RATE_LIMIT_EXCEEDED',
      { ip, endpoint },
      null,
      'warning'
    );
  }

  // Método para generar reportes
  generateSecurityReport() {
    const last24Hours = this.auditLog.filter(
      event => new Date(event.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const report = {
      totalEvents: last24Hours.length,
      loginAttempts: last24Hours.filter(e => e.eventType.includes('LOGIN')).length,
      failedLogins: last24Hours.filter(e => e.eventType === 'LOGIN_FAILED').length,
      securityBreaches: last24Hours.filter(e => e.eventType === 'SECURITY_BREACH').length,
      rateLimitEvents: last24Hours.filter(e => e.eventType === 'RATE_LIMIT_EXCEEDED').length,
      suspiciousActivities: last24Hours.filter(e => e.severity === 'warning' || e.severity === 'error').length,
      eventsByType: this.groupEventsByType(last24Hours),
      eventsBySeverity: this.groupEventsBySeverity(last24Hours)
    };

    return report;
  }

  groupEventsByType(events) {
    return events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {});
  }

  groupEventsBySeverity(events) {
    return events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {});
  }

  // Simulación de guardado en base de datos
  async saveToDatabase(event) {
    // En una implementación real, guardar en MongoDB
    try {
      // await SecurityLog.create(event);
      console.log('🔒 Evento de seguridad guardado en BD:', event.id);
    } catch (error) {
      console.error('Error guardando evento de seguridad:', error);
    }
  }

  // Obtener eventos recientes
  getRecentEvents(limit = 50) {
    return this.auditLog
      .slice(-limit)
      .reverse();
  }

  // Limpiar eventos antiguos (más de 7 días)
  cleanupOldEvents() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.auditLog = this.auditLog.filter(
      event => new Date(event.timestamp) > sevenDaysAgo
    );
  }
}

module.exports = new SecurityAudit();