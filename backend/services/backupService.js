const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const mongoose = require('mongoose');

const execPromise = util.promisify(exec);

class BackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '../../backups');
    this.ensureBackupDir();
    this.backupHistory = [];
    this.loadBackupHistory();
  }

  // Asegurar que existe el directorio de backups
  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log('✅ Directorio de backups creado:', this.backupDir);
    }
  }

  // Cargar historial de backups
  loadBackupHistory() {
    const historyFile = path.join(this.backupDir, 'backup-history.json');
    
    try {
      if (fs.existsSync(historyFile)) {
        const data = fs.readFileSync(historyFile, 'utf8');
        this.backupHistory = JSON.parse(data);
        console.log(`✅ Historial de backups cargado: ${this.backupHistory.length} backups`);
      }
    } catch (error) {
      console.error('❌ Error cargando historial de backups:', error);
      this.backupHistory = [];
    }
  }

  // Guardar historial de backups
  saveBackupHistory() {
    const historyFile = path.join(this.backupDir, 'backup-history.json');
    
    try {
      fs.writeFileSync(historyFile, JSON.stringify(this.backupHistory, null, 2));
    } catch (error) {
      console.error('❌ Error guardando historial de backups:', error);
    }
  }

  // Crear backup de la base de datos
  async createBackup(backupName = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup-${timestamp}`;
    const backupFileName = backupName ? `${backupName}-${timestamp}` : backupId;
    
    const backupPath = path.join(this.backupDir, `${backupFileName}.json`);
    const logPath = path.join(this.backupDir, `${backupFileName}.log`);

    const startTime = Date.now();
    let backupData = {
      metadata: {
        version: '1.0',
        database: 'biblioteca-digital',
        timestamp: new Date().toISOString(),
        backupId,
        backupName: backupName || 'automático'
      },
      collections: {}
    };

    const log = (message) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ${message}\n`;
      console.log(`📦 Backup: ${message}`);
      fs.appendFileSync(logPath, logMessage);
    };

    try {
      log('🚀 Iniciando proceso de backup...');
      
      // Obtener todas las colecciones
      const collections = await mongoose.connection.db.listCollections().toArray();
      log(`📊 Encontradas ${collections.length} colecciones`);

      // Backup de cada colección
      for (const collectionInfo of collections) {
        const collectionName = collectionInfo.name;
        
        // Saltar colecciones del sistema
        if (collectionName.startsWith('system.')) {
          log(`⏭️  Saltando colección del sistema: ${collectionName}`);
          continue;
        }

        log(`📝 Respaldando colección: ${collectionName}`);
        
        const collection = mongoose.connection.db.collection(collectionName);
        const documents = await collection.find({}).toArray();
        
        backupData.collections[collectionName] = {
          count: documents.length,
          documents: documents
        };

        log(`✅ Colección ${collectionName} respaldada: ${documents.length} documentos`);
      }

      // Guardar archivo de backup
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      const totalDocuments = Object.values(backupData.collections).reduce(
        (total, collection) => total + collection.count, 0
      );

      // Registrar en historial
      const backupRecord = {
        id: backupId,
        name: backupName,
        filename: `${backupFileName}.json`,
        path: backupPath,
        timestamp: new Date().toISOString(),
        duration: `${duration}s`,
        size: this.getFileSize(backupPath),
        collections: Object.keys(backupData.collections),
        totalCollections: Object.keys(backupData.collections).length,
        totalDocuments,
        status: 'completed'
      };

      this.backupHistory.push(backupRecord);
      this.saveBackupHistory();

      log(`🎉 Backup completado exitosamente en ${duration} segundos`);
      log(`📊 Resumen: ${totalDocuments} documentos en ${backupRecord.totalCollections} colecciones`);
      log(`💾 Archivo: ${backupPath}`);

      // Limpiar backups antiguos (mantener últimos 10)
      this.cleanOldBackups();

      return {
        success: true,
        backupId,
        backupPath,
        duration: `${duration}s`,
        totalCollections: backupRecord.totalCollections,
        totalDocuments,
        size: backupRecord.size
      };

    } catch (error) {
      const errorMessage = `❌ Error en backup: ${error.message}`;
      log(errorMessage);
      
      const backupRecord = {
        id: backupId,
        name: backupName,
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: error.message
      };

      this.backupHistory.push(backupRecord);
      this.saveBackupHistory();

      return {
        success: false,
        error: error.message,
        backupId
      };
    }
  }

  // Restaurar base de datos desde backup
  async restoreBackup(backupIdOrPath) {
    let backupPath;
    
    // Buscar backup por ID o usar path directo
    if (backupIdOrPath.includes('/') || backupIdOrPath.includes('\\')) {
      backupPath = backupIdOrPath;
    } else {
      const backupRecord = this.backupHistory.find(b => b.id === backupIdOrPath);
      if (!backupRecord) {
        return { success: false, error: 'Backup no encontrado' };
      }
      backupPath = backupRecord.path;
    }

    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Archivo de backup no encontrado' };
    }

    const startTime = Date.now();
    const log = (message) => {
      const timestamp = new Date().toISOString();
      console.log(`🔄 Restore: ${message}`);
    };

    try {
      log('🚀 Iniciando proceso de restauración...');
      
      // Leer archivo de backup
      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      log(`📁 Backup cargado: ${backupData.metadata.backupId}`);

      // Verificar versión
      if (backupData.metadata.version !== '1.0') {
        return { success: false, error: 'Versión de backup no compatible' };
      }

      // Restaurar cada colección
      for (const [collectionName, collectionData] of Object.entries(backupData.collections)) {
        log(`📝 Restaurando colección: ${collectionName}`);
        
        const collection = mongoose.connection.db.collection(collectionName);
        
        // Limpiar colección existente
        await collection.deleteMany({});
        log(`🧹 Colección ${collectionName} limpiada`);

        // Insertar documentos
        if (collectionData.documents && collectionData.documents.length > 0) {
          await collection.insertMany(collectionData.documents);
          log(`✅ Colección ${collectionName} restaurada: ${collectionData.documents.length} documentos`);
        }
      }

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      const totalDocuments = Object.values(backupData.collections).reduce(
        (total, collection) => total + collection.count, 0
      );

      log(`🎉 Restauración completada en ${duration} segundos`);
      log(`📊 Total: ${totalDocuments} documentos restaurados`);

      return {
        success: true,
        duration: `${duration}s`,
        totalCollections: Object.keys(backupData.collections).length,
        totalDocuments,
        backupId: backupData.metadata.backupId
      };

    } catch (error) {
      const errorMessage = `❌ Error en restauración: ${error.message}`;
      log(errorMessage);
      return { success: false, error: error.message };
    }
  }

  // Crear backup usando mongodump (más eficiente para grandes volúmenes)
  async createMongoDumpBackup(backupName = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `mongodump-${timestamp}`;
    const backupDirName = backupName ? `${backupName}-${timestamp}` : backupId;
    
    const backupPath = path.join(this.backupDir, backupDirName);
    const logPath = path.join(this.backupDir, `${backupDirName}.log`);

    const startTime = Date.now();
    const log = (message) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ${message}\n`;
      console.log(`📦 MongoDump: ${message}`);
      fs.appendFileSync(logPath, logMessage);
    };

    try {
      log('🚀 Iniciando mongodump backup...');

      // Verificar que mongodump esté disponible
      try {
        await execPromise('mongodump --version');
      } catch (error) {
        return { 
          success: false, 
          error: 'mongodump no encontrado. Instala MongoDB Database Tools.' 
        };
      }

      // Crear comando mongodump
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/biblioteca-digital';
      const command = `mongodump --uri="${mongoUri}" --out="${backupPath}"`;

      log(`📋 Ejecutando: ${command}`);
      
      const { stdout, stderr } = await execPromise(command);
      
      if (stderr) {
        log(`⚠️  Advertencia: ${stderr}`);
      }

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      // Calcular tamaño del backup
      const size = this.getDirectorySize(backupPath);

      // Registrar en historial
      const backupRecord = {
        id: backupId,
        name: backupName,
        type: 'mongodump',
        path: backupPath,
        timestamp: new Date().toISOString(),
        duration: `${duration}s`,
        size,
        status: 'completed'
      };

      this.backupHistory.push(backupRecord);
      this.saveBackupHistory();

      log(`🎉 MongoDump completado en ${duration} segundos`);
      log(`💾 Backup guardado en: ${backupPath}`);
      log(`📊 Tamaño: ${size}`);

      // Limpiar backups antiguos
      this.cleanOldBackups();

      return {
        success: true,
        backupId,
        backupPath,
        duration: `${duration}s`,
        size,
        type: 'mongodump'
      };

    } catch (error) {
      const errorMessage = `❌ Error en mongodump: ${error.message}`;
      log(errorMessage);
      
      const backupRecord = {
        id: backupId,
        name: backupName,
        type: 'mongodump',
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: error.message
      };

      this.backupHistory.push(backupRecord);
      this.saveBackupHistory();

      return {
        success: false,
        error: error.message,
        backupId
      };
    }
  }

  // Limpiar backups antiguos
  cleanOldBackups(maxBackups = 10) {
    try {
      // Ordenar backups por fecha (más reciente primero)
      const sortedBackups = [...this.backupHistory]
        .filter(b => b.status === 'completed')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Mantener solo los últimos maxBackups
      const backupsToKeep = sortedBackups.slice(0, maxBackups);
      const backupsToDelete = sortedBackups.slice(maxBackups);

      // Eliminar backups antiguos
      for (const backup of backupsToDelete) {
        try {
          if (backup.type === 'mongodump') {
            // Eliminar directorio completo
            if (fs.existsSync(backup.path)) {
              fs.rmSync(backup.path, { recursive: true });
            }
          } else {
            // Eliminar archivo JSON
            const jsonFile = path.join(this.backupDir, `${backup.filename}`);
            if (fs.existsSync(jsonFile)) {
              fs.unlinkSync(jsonFile);
            }
            
            // Eliminar archivo log
            const logFile = path.join(this.backupDir, `${backup.filename.replace('.json', '')}.log`);
            if (fs.existsSync(logFile)) {
              fs.unlinkSync(logFile);
            }
          }
          
          console.log(`🗑️  Backup eliminado: ${backup.id}`);
        } catch (error) {
          console.error(`❌ Error eliminando backup ${backup.id}:`, error);
        }
      }

      // Actualizar historial
      this.backupHistory = [...backupsToKeep, ...this.backupHistory.filter(b => b.status === 'failed')];
      this.saveBackupHistory();

      return {
        deleted: backupsToDelete.length,
        kept: backupsToKeep.length
      };

    } catch (error) {
      console.error('❌ Error limpiando backups antiguos:', error);
      return { success: false, error: error.message };
    }
  }

  // Obtener tamaño de archivo
  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      return `${sizeInMB} MB`;
    } catch (error) {
      return '0 MB';
    }
  }

  // Obtener tamaño de directorio
  getDirectorySize(dirPath) {
    try {
      let totalSize = 0;
      
      const calculateSize = (currentPath) => {
        const items = fs.readdirSync(currentPath);
        
        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          const stats = fs.statSync(itemPath);
          
          if (stats.isDirectory()) {
            calculateSize(itemPath);
          } else {
            totalSize += stats.size;
          }
        }
      };

      if (fs.existsSync(dirPath)) {
        calculateSize(dirPath);
        const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
        return `${sizeInMB} MB`;
      }
      
      return '0 MB';
    } catch (error) {
      return '0 MB';
    }
  }

  // Obtener lista de backups
  getBackupList() {
    return this.backupHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(backup => ({
        id: backup.id,
        name: backup.name,
        type: backup.type || 'json',
        timestamp: backup.timestamp,
        duration: backup.duration,
        size: backup.size,
        status: backup.status,
        collections: backup.collections,
        totalDocuments: backup.totalDocuments
      }));
  }

  // Obtener estadísticas de backups
  getBackupStatistics() {
    const completedBackups = this.backupHistory.filter(b => b.status === 'completed');
    const failedBackups = this.backupHistory.filter(b => b.status === 'failed');
    
    const totalSize = completedBackups.reduce((total, backup) => {
      const sizeMB = parseFloat(backup.size) || 0;
      return total + sizeMB;
    }, 0);

    const jsonBackups = completedBackups.filter(b => !b.type || b.type === 'json');
    const mongodumpBackups = completedBackups.filter(b => b.type === 'mongodump');

    return {
      totalBackups: this.backupHistory.length,
      completed: completedBackups.length,
      failed: failedBackups.length,
      successRate: this.backupHistory.length > 0 
        ? ((completedBackups.length / this.backupHistory.length) * 100).toFixed(2) + '%'
        : '0%',
      totalSize: `${totalSize.toFixed(2)} MB`,
      byType: {
        json: jsonBackups.length,
        mongodump: mongodumpBackups.length
      },
      lastBackup: completedBackups[0] || null,
      oldestBackup: completedBackups[completedBackups.length - 1] || null
    };
  }

  // Programar backup automático
  scheduleAutoBackup(cronExpression = '0 2 * * *') { // Cada día a las 2 AM
    // En una implementación real, usar node-cron o similar
    console.log(`⏰ Backup automático programado: ${cronExpression}`);
    console.log('📝 Nota: Para backups automáticos reales, implementa con node-cron');
    
    return {
      scheduled: true,
      cronExpression,
      nextRun: 'Cada día a las 2:00 AM'
    };
  }

  // Obtener estado del servicio
  getStatus() {
    return {
      backupDir: this.backupDir,
      exists: fs.existsSync(this.backupDir),
      statistics: this.getBackupStatistics(),
      availableSpace: this.getAvailableSpace(),
      lastBackup: this.backupHistory[0] || null
    };
  }

  // Obtener espacio disponible
  getAvailableSpace() {
    try {
      // Esta es una implementación simplificada
      // En producción, usaría un método más robusto
      return 'Verificar manualmente';
    } catch (error) {
      return 'No disponible';
    }
  }
}

module.exports = new BackupService();