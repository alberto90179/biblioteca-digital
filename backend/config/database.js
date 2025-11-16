const mongoose = require('mongoose');

class Database {
  constructor() {
    this.connection = null;
    this.connect();
  }

  async connect() {
    try {
      this.connection = await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        bufferMaxEntries: 0,
        maxPoolSize: 10,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        family: 4
      });

      console.log('✅ MongoDB conectado exitosamente');
      
      // Event listeners
      mongoose.connection.on('connected', () => {
        console.log('📊 Mongoose conectado a MongoDB');
      });

      mongoose.connection.on('error', (err) => {
        console.error('❌ Error de Mongoose:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️  Mongoose desconectado');
      });

    } catch (error) {
      console.error('❌ Error conectando a MongoDB:', error);
      process.exit(1);
    }
  }

  async disconnect() {
    try {
      await mongoose.connection.close();
      console.log('✅ MongoDB desconectado');
    } catch (error) {
      console.error('❌ Error desconectando MongoDB:', error);
    }
  }

  getConnection() {
    return this.connection;
  }

  getDatabaseName() {
    return mongoose.connection.db.databaseName;
  }

  // Verificar estado de la conexión
  getStatus() {
    return {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
      database: mongoose.connection.db.databaseName,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      models: Object.keys(mongoose.connection.models)
    };
  }
}

module.exports = new Database();