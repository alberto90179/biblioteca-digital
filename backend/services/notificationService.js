const EmailService = require('./emailService');

class NotificationService {
  constructor() {
    this.emailService = EmailService;
    this.notifications = [];
    this.preferences = {
      loan_created: true,
      loan_reminder: true,
      loan_overdue: true,
      welcome: true,
      security: true
    };
  }

  // Enviar notificación de bienvenida
  async sendWelcomeNotification(usuario) {
    try {
      const result = await this.emailService.sendWelcomeEmail(usuario);
      
      this.logNotification({
        type: 'welcome',
        userId: usuario._id,
        email: usuario.email,
        success: result.success,
        messageId: result.messageId,
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      console.error('Error en notificación de bienvenida:', error);
      this.logNotification({
        type: 'welcome',
        userId: usuario._id,
        email: usuario.email,
        success: false,
        error: error.message,
        timestamp: new Date()
      });
      return { success: false, error: error.message };
    }
  }

  // Enviar notificación de nuevo préstamo
  async sendLoanCreatedNotification(prestamo, usuario, libro) {
    try {
      if (!this.preferences.loan_created) {
        return { success: true, skipped: true, reason: 'preference_disabled' };
      }

      const result = await this.emailService.sendLoanCreatedEmail(prestamo, usuario, libro);
      
      this.logNotification({
        type: 'loan_created',
        userId: usuario._id,
        prestamoId: prestamo._id,
        libroId: libro._id,
        success: result.success,
        messageId: result.messageId,
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      console.error('Error en notificación de préstamo creado:', error);
      this.logNotification({
        type: 'loan_created',
        userId: usuario._id,
        prestamoId: prestamo._id,
        libroId: libro._id,
        success: false,
        error: error.message,
        timestamp: new Date()
      });
      return { success: false, error: error.message };
    }
  }

  // Enviar recordatorio de devolución
  async sendLoanReminderNotification(prestamo, usuario, libro) {
    try {
      if (!this.preferences.loan_reminder) {
        return { success: true, skipped: true, reason: 'preference_disabled' };
      }

      const fechaDevolucion = new Date(prestamo.fechaDevolucion);
      const hoy = new Date();
      const diasRestantes = Math.ceil((fechaDevolucion - hoy) / (1000 * 60 * 60 * 24));

      const result = await this.emailService.sendLoanReminderEmail(
        prestamo, 
        usuario, 
        libro, 
        diasRestantes
      );
      
      this.logNotification({
        type: 'loan_reminder',
        userId: usuario._id,
        prestamoId: prestamo._id,
        libroId: libro._id,
        diasRestantes,
        success: result.success,
        messageId: result.messageId,
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      console.error('Error en notificación de recordatorio:', error);
      this.logNotification({
        type: 'loan_reminder',
        userId: usuario._id,
        prestamoId: prestamo._id,
        libroId: libro._id,
        success: false,
        error: error.message,
        timestamp: new Date()
      });
      return { success: false, error: error.message };
    }
  }

  // Enviar notificación de préstamo vencido
  async sendOverdueNotification(prestamo, usuario, libro) {
    try {
      if (!this.preferences.loan_overdue) {
        return { success: true, skipped: true, reason: 'preference_disabled' };
      }

      const fechaDevolucion = new Date(prestamo.fechaDevolucion);
      const hoy = new Date();
      const diasRetraso = Math.ceil((hoy - fechaDevolucion) / (1000 * 60 * 60 * 24));
      const montoMulta = diasRetraso * 5; // $5 por día

      const result = await this.emailService.sendOverdueNoticeEmail(
        prestamo, 
        usuario, 
        libro, 
        diasRetraso,
        montoMulta
      );
      
      this.logNotification({
        type: 'loan_overdue',
        userId: usuario._id,
        prestamoId: prestamo._id,
        libroId: libro._id,
        diasRetraso,
        montoMulta,
        success: result.success,
        messageId: result.messageId,
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      console.error('Error en notificación de préstamo vencido:', error);
      this.logNotification({
        type: 'loan_overdue',
        userId: usuario._id,
        prestamoId: prestamo._id,
        libroId: libro._id,
        success: false,
        error: error.message,
        timestamp: new Date()
      });
      return { success: false, error: error.message };
    }
  }

  // Enviar notificación de seguridad
  async sendSecurityNotification(usuario, eventType, details) {
    try {
      if (!this.preferences.security) {
        return { success: true, skipped: true, reason: 'preference_disabled' };
      }

      const subject = this.getSecuritySubject(eventType);
      const message = this.getSecurityMessage(eventType, details, usuario);

      const result = await this.emailService.sendCustomEmail(
        usuario.email,
        subject,
        message,
        false
      );
      
      this.logNotification({
        type: 'security',
        subType: eventType,
        userId: usuario._id,
        success: result.success,
        messageId: result.messageId,
        timestamp: new Date(),
        details
      });

      return result;
    } catch (error) {
      console.error('Error en notificación de seguridad:', error);
      this.logNotification({
        type: 'security',
        subType: eventType,
        userId: usuario._id,
        success: false,
        error: error.message,
        timestamp: new Date(),
        details
      });
      return { success: false, error: error.message };
    }
  }

  // Obtener asunto para notificación de seguridad
  getSecuritySubject(eventType) {
    const subjects = {
      login_new_device: '🔒 Nuevo inicio de sesión detectado',
      password_changed: '🔒 Contraseña actualizada',
      profile_updated: '👤 Perfil actualizado',
      suspicious_activity: '⚠️ Actividad sospechosa detectada'
    };
    
    return subjects[eventType] || '🔒 Notificación de seguridad - Biblioteca Digital';
  }

  // Obtener mensaje para notificación de seguridad
  getSecurityMessage(eventType, details, usuario) {
    const baseMessage = `Hola ${usuario.nombre},\n\n`;
    
    const messages = {
      login_new_device: `
Se ha detectado un nuevo inicio de sesión en tu cuenta:

📅 Fecha: ${new Date().toLocaleString('es-ES')}
💻 Dispositivo: ${details.device || 'Desconocido'}
📍 Ubicación: ${details.location || 'No disponible'}
🌐 IP: ${details.ip || 'No disponible'}

Si no reconoces esta actividad, por favor cambia tu contraseña inmediatamente y contacta con el administrador.

Saludos,
Equipo de Biblioteca Digital
      `,
      
      password_changed: `
Tu contraseña ha sido actualizada exitosamente.

📅 Fecha: ${new Date().toLocaleString('es-ES')}

Si no realizaste este cambio, por favor contacta con el administrador inmediatamente.

Saludos,
Equipo de Biblioteca Digital
      `,
      
      profile_updated: `
Tu perfil ha sido actualizado exitosamente.

📅 Fecha: ${new Date().toLocaleString('es-ES')}
📝 Cambios realizados: ${details.changes || 'Información del perfil'}

Si no realizaste estos cambios, por favor contacta con el administrador.

Saludos,
Equipo de Biblioteca Digital
      `,
      
      suspicious_activity: `
Hemos detectado actividad sospechosa en tu cuenta:

📅 Fecha: ${new Date().toLocaleString('es-ES')}
⚠️ Actividad: ${details.activity || 'Actividad inusual detectada'}
🌐 IP: ${details.ip || 'No disponible'}

Por seguridad, te recomendamos:
1. Cambiar tu contraseña
2. Revisar tu actividad reciente
3. Contactar con el administrador si necesitas ayuda

Saludos,
Equipo de Biblioteca Digital
      `
    };
    
    return baseMessage + (messages[eventType] || 'Se ha producido un evento de seguridad en tu cuenta.');
  }

  // Procesar recordatorios automáticos
  async processAutomaticReminders() {
    try {
      const Prestamo = require('../models/Prestamo');
      const Usuario = require('../models/Usuario');
      const Libro = require('../models/Libro');

      // Obtener préstamos activos
      const prestamosActivos = await Prestamo.find({ 
        estado: 'activo',
        activo: true 
      }).populate('libroId').populate('usuarioId');

      const hoy = new Date();
      let remindersSent = 0;
      let overdueNoticesSent = 0;

      for (const prestamo of prestamosActivos) {
        const fechaDevolucion = new Date(prestamo.fechaDevolucion);
        const diasRestantes = Math.ceil((fechaDevolucion - hoy) / (1000 * 60 * 60 * 24));
        const diasRetraso = Math.ceil((hoy - fechaDevolucion) / (1000 * 60 * 60 * 24));

        // Recordatorio 3 días antes
        if (diasRestantes === 3) {
          await this.sendLoanReminderNotification(prestamo, prestamo.usuarioId, prestamo.libroId);
          remindersSent++;
        }
        
        // Notificación de vencimiento (1 día de retraso)
        if (diasRetraso === 1) {
          await this.sendOverdueNotification(prestamo, prestamo.usuarioId, prestamo.libroId);
          overdueNoticesSent++;
        }
      }

      return {
        success: true,
        remindersSent,
        overdueNoticesSent,
        totalProcessed: prestamosActivos.length
      };
    } catch (error) {
      console.error('Error procesando recordatorios automáticos:', error);
      return { success: false, error: error.message };
    }
  }

  // Log de notificación
  logNotification(notification) {
    this.notifications.push({
      id: Date.now().toString(),
      ...notification
    });

    // Mantener solo las últimas 1000 notificaciones
    if (this.notifications.length > 1000) {
      this.notifications = this.notifications.slice(-1000);
    }
  }

  // Obtener estadísticas de notificaciones
  getStatistics() {
    const total = this.notifications.length;
    const successful = this.notifications.filter(n => n.success).length;
    const failed = total - successful;
    
    const byType = this.notifications.reduce((acc, notification) => {
      acc[notification.type] = (acc[notification.type] || 0) + 1;
      return acc;
    }, {});

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(2) + '%' : '0%',
      byType,
      lastNotification: this.notifications[this.notifications.length - 1]
    };
  }

  // Obtener historial de notificaciones
  getNotificationHistory(limit = 50, type = null) {
    let filtered = this.notifications;
    
    if (type) {
      filtered = filtered.filter(n => n.type === type);
    }
    
    return filtered.slice(-limit).reverse();
  }

  // Actualizar preferencias
  updatePreferences(newPreferences) {
    this.preferences = { ...this.preferences, ...newPreferences };
    return this.preferences;
  }

  // Obtener estado del servicio
  getStatus() {
    return {
      emailService: this.emailService.getStatus(),
      preferences: this.preferences,
      statistics: this.getStatistics(),
      lastActivity: this.notifications[this.notifications.length - 1]?.timestamp || null
    };
  }
}

module.exports = new NotificationService();