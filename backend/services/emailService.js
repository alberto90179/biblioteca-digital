const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.init();
  }

  async init() {
    try {
      // Configuración para desarrollo (usar Ethereal Email)
      if (process.env.NODE_ENV === 'development' || !process.env.EMAIL_USER) {
        // Crear cuenta de prueba en ethereal.email
        const testAccount = await nodemailer.createTestAccount();
        
        this.transporter = nodemailer.createTransporter({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });

        console.log('📧 EmailService: Modo desarrollo - Ethereal Email');
        console.log(`📧 Credenciales: ${testAccount.user} / ${testAccount.pass}`);
      } else {
        // Configuración para producción
        this.transporter = nodemailer.createTransporter({
          service: process.env.EMAIL_SERVICE || 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        // Verificar configuración
        await this.transporter.verify();
        console.log('✅ EmailService: Configurado correctamente para producción');
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Error inicializando EmailService:', error);
      this.initialized = false;
    }
  }

  // Plantillas de email
  getTemplates() {
    return {
      welcome: {
        subject: '¡Bienvenido a la Biblioteca Digital!',
        template: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .footer { background: #34495e; color: white; padding: 10px; text-align: center; }
        .button { background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Biblioteca Digital</h1>
        </div>
        <div class="content">
            <h2>¡Bienvenido, {{nombre}}!</h2>
            <p>Tu cuenta ha sido creada exitosamente en nuestro sistema de Biblioteca Digital.</p>
            <p><strong>Email:</strong> {{email}}</p>
            <p><strong>Rol:</strong> {{rol}}</p>
            <p>Ahora puedes:</p>
            <ul>
                <li>🔍 Buscar libros en nuestro catálogo</li>
                <li>📖 Ver tus préstamos activos</li>
                <li>👤 Actualizar tu perfil</li>
                {{#if isAdmin}}
                <li>⚙️ Acceder al panel de administración</li>
                {{/if}}
            </ul>
            <p style="text-align: center;">
                <a href="{{appUrl}}" class="button">Ir a la Biblioteca</a>
            </p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Biblioteca Digital. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
        `
      },
      loanCreated: {
        subject: '📖 Préstamo Registrado - Biblioteca Digital',
        template: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #27ae60; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .book-info { background: white; padding: 15px; border-left: 4px solid #27ae60; margin: 10px 0; }
        .footer { background: #2c3e50; color: white; padding: 10px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Préstamo Registrado</h1>
        </div>
        <div class="content">
            <h2>Hola, {{usuarioNombre}}</h2>
            <p>Se ha registrado un nuevo préstamo a tu nombre:</p>
            
            <div class="book-info">
                <h3>{{libroTitulo}}</h3>
                <p><strong>Autor:</strong> {{libroAutor}}</p>
                <p><strong>ISBN:</strong> {{libroIsbn}}</p>
                <p><strong>Fecha de préstamo:</strong> {{fechaPrestamo}}</p>
                <p><strong>Fecha de devolución:</strong> {{fechaDevolucion}}</p>
                <p><strong>Días de préstamo:</strong> {{diasPrestamo}}</p>
            </div>

            <p><strong>📋 Recordatorio importante:</strong></p>
            <ul>
                <li>Puedes renovar el préstamo hasta 2 veces</li>
                <li>La devolución tardía genera multas</li>
                <li>Máximo 3 préstamos activos simultáneos</li>
            </ul>

            <p>¡Disfruta de tu lectura!</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Biblioteca Digital</p>
        </div>
    </div>
</body>
</html>
        `
      },
      loanReminder: {
        subject: '⏰ Recordatorio de Devolución - Biblioteca Digital',
        template: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f39c12; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .book-info { background: white; padding: 15px; border-left: 4px solid #f39c12; margin: 10px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; }
        .footer { background: #2c3e50; color: white; padding: 10px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Recordatorio de Devolución</h1>
        </div>
        <div class="content">
            <h2>Hola, {{usuarioNombre}}</h2>
            <p>Te recordamos que tienes un préstamo próximo a vencer:</p>
            
            <div class="book-info">
                <h3>{{libroTitulo}}</h3>
                <p><strong>Autor:</strong> {{libroAutor}}</p>
                <p><strong>Fecha de devolución:</strong> {{fechaDevolucion}}</p>
                <p><strong>Días restantes:</strong> {{diasRestantes}}</p>
            </div>

            <div class="warning">
                <p><strong>⚠️ Importante:</strong></p>
                <p>Si no devuelves el libro a tiempo, se aplicará una multa de $5 por día de retraso.</p>
            </div>

            <p>Puedes renovar el préstamo si necesitas más tiempo (máximo 2 renovaciones).</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Biblioteca Digital</p>
        </div>
    </div>
</body>
</html>
        `
      },
      overdueNotice: {
        subject: '🚨 Préstamo Vencido - Biblioteca Digital',
        template: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .book-info { background: white; padding: 15px; border-left: 4px solid #e74c3c; margin: 10px 0; }
        .urgent { background: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 5px; color: #721c24; }
        .footer { background: #2c3e50; color: white; padding: 10px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Préstamo Vencido</h1>
        </div>
        <div class="content">
            <h2>Hola, {{usuarioNombre}}</h2>
            
            <div class="urgent">
                <p><strong>¡ATENCIÓN! Tu préstamo ha vencido.</strong></p>
            </div>
            
            <div class="book-info">
                <h3>{{libroTitulo}}</h3>
                <p><strong>Autor:</strong> {{libroAutor}}</p>
                <p><strong>Fecha de vencimiento:</strong> {{fechaDevolucion}}</p>
                <p><strong>Días de retraso:</strong> {{diasRetraso}}</p>
                <p><strong>Multa acumulada:</strong> ${{montoMulta}}</p>
            </div>

            <p><strong>Por favor, devuelve el libro lo antes posible para evitar que la multa siga aumentando.</strong></p>
            
            <p>La multa se calcula en $5 por cada día de retraso.</p>
            
            <p>Si ya devolviste el libro, contacta con la biblioteca para actualizar el estado.</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Biblioteca Digital</p>
        </div>
    </div>
</body>
</html>
        `
      }
    };
  }

  // Renderizar plantilla con variables
  renderTemplate(template, variables) {
    let rendered = template;
    
    Object.keys(variables).forEach(key => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(placeholder, variables[key] || '');
    });

    // Limpiar placeholders no utilizados
    rendered = rendered.replace(/{{\w+}}/g, '');
    
    return rendered;
  }

  // Enviar email
  async sendEmail(to, subject, html, text = null) {
    if (!this.initialized || !this.transporter) {
      console.warn('⚠️ EmailService no inicializado, no se puede enviar email');
      return { success: false, error: 'EmailService no inicializado' };
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_USER || '"Biblioteca Digital" <noreply@biblioteca.com>',
        to,
        subject,
        html,
        text: text || this.htmlToText(html)
      };

      const info = await this.transporter.sendMail(mailOptions);

      // En desarrollo, mostrar URL de preview
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 Email enviado (desarrollo):', nodemailer.getTestMessageUrl(info));
      }

      return { 
        success: true, 
        messageId: info.messageId,
        previewUrl: process.env.NODE_ENV === 'development' ? nodemailer.getTestMessageUrl(info) : null
      };
    } catch (error) {
      console.error('❌ Error enviando email:', error);
      return { success: false, error: error.message };
    }
  }

  // Convertir HTML a texto plano
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Métodos específicos de la aplicación

  // Enviar email de bienvenida
  async sendWelcomeEmail(usuario) {
    const templates = this.getTemplates();
    const template = templates.welcome;
    
    const variables = {
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      isAdmin: usuario.rol === 'admin',
      appUrl: process.env.APP_URL || 'http://localhost:8000'
    };

    const html = this.renderTemplate(template.template, variables);
    
    return await this.sendEmail(
      usuario.email,
      template.subject,
      html
    );
  }

  // Enviar notificación de nuevo préstamo
  async sendLoanCreatedEmail(prestamo, usuario, libro) {
    const templates = this.getTemplates();
    const template = templates.loanCreated;
    
    const variables = {
      usuarioNombre: usuario.nombre,
      libroTitulo: libro.titulo,
      libroAutor: libro.autor,
      libroIsbn: libro.isbn,
      fechaPrestamo: new Date(prestamo.fechaPrestamo).toLocaleDateString('es-ES'),
      fechaDevolucion: new Date(prestamo.fechaDevolucion).toLocaleDateString('es-ES'),
      diasPrestamo: prestamo.diasPrestamo
    };

    const html = this.renderTemplate(template.template, variables);
    
    return await this.sendEmail(
      usuario.email,
      template.subject,
      html
    );
  }

  // Enviar recordatorio de devolución
  async sendLoanReminderEmail(prestamo, usuario, libro, diasRestantes) {
    const templates = this.getTemplates();
    const template = templates.loanReminder;
    
    const variables = {
      usuarioNombre: usuario.nombre,
      libroTitulo: libro.titulo,
      libroAutor: libro.autor,
      fechaDevolucion: new Date(prestamo.fechaDevolucion).toLocaleDateString('es-ES'),
      diasRestantes: diasRestantes
    };

    const html = this.renderTemplate(template.template, variables);
    
    return await this.sendEmail(
      usuario.email,
      template.subject,
      html
    );
  }

  // Enviar aviso de préstamo vencido
  async sendOverdueNoticeEmail(prestamo, usuario, libro, diasRetraso, montoMulta) {
    const templates = this.getTemplates();
    const template = templates.overdueNotice;
    
    const variables = {
      usuarioNombre: usuario.nombre,
      libroTitulo: libro.titulo,
      libroAutor: libro.autor,
      fechaDevolucion: new Date(prestamo.fechaDevolucion).toLocaleDateString('es-ES'),
      diasRetraso: diasRetraso,
      montoMulta: montoMulta
    };

    const html = this.renderTemplate(template.template, variables);
    
    return await this.sendEmail(
      usuario.email,
      template.subject,
      html
    );
  }

  // Enviar email personalizado
  async sendCustomEmail(to, subject, message, isHtml = false) {
    let html, text;
    
    if (isHtml) {
      html = message;
      text = this.htmlToText(message);
    } else {
      text = message;
      html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
                .content { background: #f9f9f9; padding: 20px; white-space: pre-line; }
                .footer { background: #34495e; color: white; padding: 10px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📚 Biblioteca Digital</h1>
                </div>
                <div class="content">${message}</div>
                <div class="footer">
                    <p>&copy; 2024 Biblioteca Digital</p>
                </div>
            </div>
        </body>
        </html>
      `;
    }

    return await this.sendEmail(to, subject, html, text);
  }

  // Verificar estado del servicio
  getStatus() {
    return {
      initialized: this.initialized,
      service: process.env.EMAIL_SERVICE || 'ethereal (development)',
      canSend: this.initialized && this.transporter !== null
    };
  }
}

module.exports = new EmailService();