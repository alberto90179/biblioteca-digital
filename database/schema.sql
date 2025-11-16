-- =============================================
-- ESQUEMA RELACIONAL EQUIVALENTE
-- Sistema de Biblioteca Digital - MongoDB Equivalent
-- =============================================

-- Este archivo representa el esquema relacional equivalente
-- para el sistema implementado en MongoDB con Mongoose

-- =============================================
-- TABLA: usuarios
-- =============================================
CREATE TABLE usuarios (
    id VARCHAR(36) PRIMARY KEY,
    nombre_encrypted JSON NOT NULL COMMENT 'Nombre encriptado con AES-256-GCM',
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL COMMENT 'Hash BCrypt con 12 rounds',
    rol ENUM('admin', 'usuario') DEFAULT 'usuario',
    refresh_token_encrypted JSON NULL COMMENT 'Refresh token encriptado',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMP NULL,
    intentos_login INT DEFAULT 0,
    bloqueado_hasta TIMESTAMP NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Índices para usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);
CREATE INDEX idx_usuarios_bloqueado ON usuarios(bloqueado_hasta);

-- =============================================
-- TABLA: libros
-- =============================================
CREATE TABLE libros (
    id VARCHAR(36) PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    autor VARCHAR(100) NOT NULL,
    isbn VARCHAR(20) UNIQUE NOT NULL,
    editorial VARCHAR(100),
    año INT CHECK (año >= 1000 AND año <= YEAR(CURRENT_DATE)),
    genero VARCHAR(50),
    descripcion TEXT,
    ejemplares INT NOT NULL DEFAULT 1 CHECK (ejemplares >= 0),
    ejemplares_disponibles INT NOT NULL DEFAULT 1 CHECK (ejemplares_disponibles >= 0 AND ejemplares_disponibles <= ejemplares),
    imagen VARCHAR(500),
    ubicacion VARCHAR(100),
    estado ENUM('disponible', 'prestado', 'mantenimiento', 'retirado') DEFAULT 'disponible',
    fecha_adquisicion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Índices para libros
CREATE INDEX idx_libros_titulo ON libros(titulo);
CREATE INDEX idx_libros_autor ON libros(autor);
CREATE INDEX idx_libros_isbn ON libros(isbn);
CREATE INDEX idx_libros_genero ON libros(genero);
CREATE INDEX idx_libros_estado ON libros(estado);
CREATE INDEX idx_libros_ejemplares_disponibles ON libros(ejemplares_disponibles);
CREATE INDEX idx_libros_activo ON libros(activo);
CREATE FULLTEXT INDEX idx_libros_busqueda ON libros(titulo, autor, genero);

-- =============================================
-- TABLA: prestamos
-- =============================================
CREATE TABLE prestamos (
    id VARCHAR(36) PRIMARY KEY,
    libro_id VARCHAR(36) NOT NULL,
    usuario_id VARCHAR(36) NOT NULL,
    fecha_prestamo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_devolucion TIMESTAMP NOT NULL,
    fecha_devolucion_real TIMESTAMP NULL,
    estado ENUM('activo', 'devuelto', 'vencido', 'perdido') DEFAULT 'activo',
    dias_prestamo INT DEFAULT 15 CHECK (dias_prestamo >= 1 AND dias_prestamo <= 90),
    renovaciones INT DEFAULT 0 CHECK (renovaciones <= 2),
    observaciones TEXT,
    multa_monto DECIMAL(10,2) DEFAULT 0.00 CHECK (multa_monto >= 0),
    multa_motivo VARCHAR(255),
    multa_fecha_pago TIMESTAMP NULL,
    multa_pagada BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Claves foráneas
    FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    
    -- Restricciones de integridad
    CHECK (fecha_devolucion > fecha_prestamo),
    CHECK (fecha_devolucion_real IS NULL OR fecha_devolucion_real >= fecha_prestamo)
);

-- Índices para préstamos
CREATE INDEX idx_prestamos_libro_id ON prestamos(libro_id);
CREATE INDEX idx_prestamos_usuario_id ON prestamos(usuario_id);
CREATE INDEX idx_prestamos_estado ON prestamos(estado);
CREATE INDEX idx_prestamos_fecha_prestamo ON prestamos(fecha_prestamo);
CREATE INDEX idx_prestamos_fecha_devolucion ON prestamos(fecha_devolucion);
CREATE INDEX idx_prestamos_activo ON prestamos(activo);

-- Índice compuesto para búsquedas frecuentes
CREATE INDEX idx_prestamos_usuario_estado ON prestamos(usuario_id, estado);
CREATE INDEX idx_prestamos_libro_estado ON prestamos(libro_id, estado);

-- =============================================
-- TABLA: tags (para relación muchos-a-muchos con libros)
-- =============================================
CREATE TABLE tags (
    id VARCHAR(36) PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE libro_tags (
    libro_id VARCHAR(36) NOT NULL,
    tag_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (libro_id, tag_id),
    FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- =============================================
-- TABLA: auditoria_seguridad
-- =============================================
CREATE TABLE auditoria_seguridad (
    id VARCHAR(36) PRIMARY KEY,
    tipo_evento VARCHAR(50) NOT NULL,
    severidad ENUM('info', 'warning', 'error') DEFAULT 'info',
    usuario_id VARCHAR(36) NULL,
    detalles JSON NOT NULL,
    ip VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para auditoría
CREATE INDEX idx_auditoria_tipo_evento ON auditoria_seguridad(tipo_evento);
CREATE INDEX idx_auditoria_usuario_id ON auditoria_seguridad(usuario_id);
CREATE INDEX idx_auditoria_timestamp ON auditoria_seguridad(timestamp);
CREATE INDEX idx_auditoria_severidad ON auditoria_seguridad(severidad);

-- =============================================
-- TABLA: notificaciones
-- =============================================
CREATE TABLE notificaciones (
    id VARCHAR(36) PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    subtipo VARCHAR(50) NULL,
    usuario_id VARCHAR(36) NOT NULL,
    prestamo_id VARCHAR(36) NULL,
    libro_id VARCHAR(36) NULL,
    exito BOOLEAN NOT NULL,
    mensaje_id VARCHAR(255) NULL,
    error TEXT NULL,
    detalles JSON NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (prestamo_id) REFERENCES prestamos(id) ON DELETE SET NULL,
    FOREIGN KEY (libro_id) REFERENCES libros(id) ON DELETE SET NULL
);

-- Índices para notificaciones
CREATE INDEX idx_notificaciones_usuario_id ON notificaciones(usuario_id);
CREATE INDEX idx_notificaciones_tipo ON notificaciones(tipo);
CREATE INDEX idx_notificaciones_timestamp ON notificaciones(timestamp);

-- =============================================
-- TABLA: backups
-- =============================================
CREATE TABLE backups (
    id VARCHAR(36) PRIMARY KEY,
    nombre VARCHAR(255) NULL,
    tipo ENUM('json', 'mongodump') NOT NULL,
    archivo_ruta TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duracion VARCHAR(20),
    tamaño VARCHAR(50),
    colecciones JSON,
    total_documentos INT DEFAULT 0,
    estado ENUM('completado', 'fallido') NOT NULL,
    error TEXT NULL
);

-- Índices para backups
CREATE INDEX idx_backups_timestamp ON backups(timestamp);
CREATE INDEX idx_backups_estado ON backups(estado);

-- =============================================
-- VISTAS PARA REPORTES
-- =============================================

-- Vista: Estadísticas generales
CREATE VIEW vista_estadisticas_generales AS
SELECT 
    (SELECT COUNT(*) FROM usuarios WHERE activo = TRUE) as total_usuarios,
    (SELECT COUNT(*) FROM libros WHERE activo = TRUE) as total_libros,
    (SELECT SUM(ejemplares) FROM libros WHERE activo = TRUE) as total_ejemplares,
    (SELECT SUM(ejemplares_disponibles) FROM libros WHERE activo = TRUE) as total_disponibles,
    (SELECT COUNT(*) FROM prestamos WHERE activo = TRUE) as total_prestamos,
    (SELECT COUNT(*) FROM prestamos WHERE estado = 'activo' AND activo = TRUE) as prestamos_activos,
    (SELECT COUNT(*) FROM prestamos WHERE estado = 'vencido' AND activo = TRUE) as prestamos_vencidos;

-- Vista: Libros más populares
CREATE VIEW vista_libros_populares AS
SELECT 
    l.id,
    l.titulo,
    l.autor,
    l.genero,
    l.ejemplares,
    l.ejemplares_disponibles,
    COUNT(p.id) as total_prestamos,
    ROUND(COUNT(p.id) * 100.0 / NULLIF(l.ejemplares, 0), 2) as porcentaje_uso
FROM libros l
LEFT JOIN prestamos p ON l.id = p.libro_id AND p.activo = TRUE
WHERE l.activo = TRUE
GROUP BY l.id, l.titulo, l.autor, l.genero, l.ejemplares, l.ejemplares_disponibles
ORDER BY total_prestamos DESC;

-- Vista: Usuarios más activos
CREATE VIEW vista_usuarios_activos AS
SELECT 
    u.id,
    u.email,
    u.rol,
    u.fecha_registro,
    COUNT(p.id) as total_prestamos,
    SUM(CASE WHEN p.estado = 'activo' THEN 1 ELSE 0 END) as prestamos_activos,
    SUM(CASE WHEN p.estado = 'vencido' THEN 1 ELSE 0 END) as prestamos_vencidos,
    MAX(p.fecha_prestamo) as ultimo_prestamo
FROM usuarios u
LEFT JOIN prestamos p ON u.id = p.usuario_id AND p.activo = TRUE
WHERE u.activo = TRUE
GROUP BY u.id, u.email, u.rol, u.fecha_registro
ORDER BY total_prestamos DESC;

-- Vista: Préstamos próximos a vencer
CREATE VIEW vista_prestamos_proximos_vencer AS
SELECT 
    p.id,
    p.fecha_devolucion,
    l.titulo as libro_titulo,
    l.autor as libro_autor,
    u.email as usuario_email,
    DATEDIFF(p.fecha_devolucion, CURRENT_DATE) as dias_restantes
FROM prestamos p
JOIN libros l ON p.libro_id = l.id
JOIN usuarios u ON p.usuario_id = u.id
WHERE p.estado = 'activo' 
AND p.activo = TRUE
AND p.fecha_devolucion BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY)
ORDER BY p.fecha_devolucion ASC;

-- Vista: Multas pendientes
CREATE VIEW vista_multas_pendientes AS
SELECT 
    p.id as prestamo_id,
    u.email as usuario_email,
    l.titulo as libro_titulo,
    p.multa_monto,
    p.multa_motivo,
    DATEDIFF(CURRENT_DATE, p.fecha_devolucion) as dias_retraso
FROM prestamos p
JOIN usuarios u ON p.usuario_id = u.id
JOIN libros l ON p.libro_id = l.id
WHERE p.multa_pagada = FALSE 
AND p.multa_monto > 0
AND p.activo = TRUE
ORDER BY p.multa_monto DESC;

-- =============================================
-- PROCEDIMIENTOS ALMACENADOS
-- =============================================

-- Procedimiento: Actualizar estado de préstamos vencidos
DELIMITER //
CREATE PROCEDURE sp_actualizar_prestamos_vencidos()
BEGIN
    UPDATE prestamos 
    SET estado = 'vencido',
        updated_at = CURRENT_TIMESTAMP
    WHERE estado = 'activo' 
    AND fecha_devolucion < CURRENT_DATE
    AND activo = TRUE;
END//
DELIMITER ;

-- Procedimiento: Calcular multas automáticas
DELIMITER //
CREATE PROCEDURE sp_calcular_multas_automaticas()
BEGIN
    UPDATE prestamos 
    SET multa_monto = DATEDIFF(CURRENT_DATE, fecha_devolucion) * 5.00,
        multa_motivo = CONCAT('Retraso de ', DATEDIFF(CURRENT_DATE, fecha_devolucion), ' días'),
        updated_at = CURRENT_TIMESTAMP
    WHERE estado = 'vencido' 
    AND multa_pagada = FALSE
    AND activo = TRUE
    AND DATEDIFF(CURRENT_DATE, fecha_devolucion) > 0;
END//
DELIMITER ;

-- Procedimiento: Estadísticas por género
DELIMITER //
CREATE PROCEDURE sp_estadisticas_por_genero()
BEGIN
    SELECT 
        genero,
        COUNT(*) as total_libros,
        SUM(ejemplares) as total_ejemplares,
        SUM(ejemplares_disponibles) as disponibles,
        ROUND(SUM(ejemplares_disponibles) * 100.0 / SUM(ejemplares), 2) as porcentaje_disponible
    FROM libros 
    WHERE activo = TRUE
    GROUP BY genero
    ORDER BY total_libros DESC;
END//
DELIMITER ;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger: Actualizar ejemplares disponibles al crear préstamo
DELIMITER //
CREATE TRIGGER tr_prestamo_insert
AFTER INSERT ON prestamos
FOR EACH ROW
BEGIN
    IF NEW.estado = 'activo' THEN
        UPDATE libros 
        SET ejemplares_disponibles = ejemplares_disponibles - 1,
            estado = CASE 
                WHEN (ejemplares_disponibles - 1) = 0 THEN 'prestado' 
                ELSE estado 
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.libro_id;
    END IF;
END//
DELIMITER ;

-- Trigger: Actualizar ejemplares disponibles al devolver préstamo
DELIMITER //
CREATE TRIGGER tr_prestamo_update
AFTER UPDATE ON prestamos
FOR EACH ROW
BEGIN
    -- Si cambia de activo a devuelto
    IF OLD.estado = 'activo' AND NEW.estado = 'devuelto' THEN
        UPDATE libros 
        SET ejemplares_disponibles = ejemplares_disponibles + 1,
            estado = CASE 
                WHEN (ejemplares_disponibles + 1) > 0 THEN 'disponible' 
                ELSE estado 
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.libro_id;
    END IF;
END//
DELIMITER ;

-- Trigger: Validar que no se excedan los préstamos por usuario
DELIMITER //
CREATE TRIGGER tr_validar_max_prestamos
BEFORE INSERT ON prestamos
FOR EACH ROW
BEGIN
    DECLARE prestamos_activos INT;
    
    SELECT COUNT(*) INTO prestamos_activos
    FROM prestamos 
    WHERE usuario_id = NEW.usuario_id 
    AND estado = 'activo' 
    AND activo = TRUE;
    
    IF prestamos_activos >= 3 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El usuario ya tiene el máximo de préstamos activos (3)';
    END IF;
END//
DELIMITER ;

-- Trigger: Auditoría de cambios en usuarios
DELIMITER //
CREATE TRIGGER tr_auditoria_usuarios
AFTER UPDATE ON usuarios
FOR EACH ROW
BEGIN
    IF OLD.email != NEW.email OR OLD.rol != NEW.rol THEN
        INSERT INTO auditoria_seguridad (
            id, tipo_evento, usuario_id, detalles, ip, user_agent
        ) VALUES (
            UUID(),
            'perfil_actualizado',
            NEW.id,
            JSON_OBJECT(
                'campo', 'email/rol',
                'valor_anterior', OLD.email,
                'valor_nuevo', NEW.email,
                'rol_anterior', OLD.rol,
                'rol_nuevo', NEW.rol
            ),
            NULL,
            NULL
        );
    END IF;
END//
DELIMITER ;

-- =============================================
-- DATOS INICIALES
-- =============================================

-- Insertar tags comunes
INSERT IGNORE INTO tags (id, nombre) VALUES
(UUID(), 'ficción'),
(UUID(), 'no-ficción'),
(UUID(), 'ciencia-ficción'),
(UUID(), 'fantasía'),
(UUID(), 'romance'),
(UUID(), 'terror'),
(UUID(), 'misterio'),
(UUID(), 'biografía'),
(UUID(), 'historia'),
(UUID(), 'ciencia'),
(UUID(), 'tecnología'),
(UUID(), 'autoayuda'),
(UUID(), 'negocios'),
(UUID(), 'poesía'),
(UUID(), 'teatro');

-- Insertar usuario administrador por defecto
-- Nota: La contraseña debe ser hasheada con BCrypt en la aplicación
INSERT IGNORE INTO usuarios (id, nombre_encrypted, email, password_hash, rol) VALUES
(
    'admin-001',
    '{"iv": "initial", "data": "Administrador Principal", "tag": "initial"}',
    'admin@biblioteca.com',
    '$2a$12$LQv3c1yqBWVHxkd0L8k4Cu0pSd6nT6D9t8QY7aR6fK5X9J2mN1O', -- Admin123!
    'admin'
);

-- =============================================
-- PERMISOS Y ROLES (Ejemplo para MySQL 8.0+)
-- =============================================

/*
-- Crear usuario de aplicación
CREATE USER 'biblioteca_app'@'localhost' IDENTIFIED BY 'clave_segura_app';
CREATE USER 'biblioteca_app'@'%' IDENTIFIED BY 'clave_segura_app';

-- Conceder permisos
GRANT SELECT, INSERT, UPDATE ON biblioteca_digital.* TO 'biblioteca_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON biblioteca_digital.* TO 'biblioteca_app'@'%';

-- Permisos específicos para vistas
GRANT SELECT ON biblioteca_digital.vista_* TO 'biblioteca_app'@'localhost';
GRANT SELECT ON biblioteca_digital.vista_* TO 'biblioteca_app'@'%';

-- Permisos para ejecutar procedimientos
GRANT EXECUTE ON PROCEDURE biblioteca_digital.* TO 'biblioteca_app'@'localhost';
GRANT EXECUTE ON PROCEDURE biblioteca_digital.* TO 'biblioteca_app'@'%';

FLUSH PRIVILEGES;
*/

-- =============================================
-- COMENTARIOS FINALES
-- =============================================

/*
ESTRUCTURA EQUIVALENTE MONGODB -> SQL:

Usuarios:
- nombre -> nombre_encrypted (encriptado)
- refreshToken -> refresh_token_encrypted (encriptado)
- fechaRegistro -> fecha_registro
- ultimoAcceso -> ultimo_acceso
- intentosLogin -> intentos_login
- bloqueadoHasta -> bloqueado_hasta

Libros:
- ejemplaresDisponibles -> ejemplares_disponibles
- fechaAdquisicion -> fecha_adquisicion

Préstamos:
- libroId -> libro_id
- usuarioId -> usuario_id
- fechaPrestamo -> fecha_prestamo
- fechaDevolucion -> fecha_devolucion
- fechaDevolucionReal -> fecha_devolucion_real
- diasPrestamo -> dias_prestamo

Auditoría:
- eventType -> tipo_evento
- userId -> usuario_id
- userAgent -> user_agent

Notas:
1. Los IDs se mantienen como strings para compatibilidad
2. La encriptación se maneja a nivel de aplicación
3. Los timestamps se manejan automáticamente
4. Las validaciones de negocio se implementan con triggers y constraints
*/

SELECT '✅ Esquema de Biblioteca Digital creado exitosamente' as mensaje;