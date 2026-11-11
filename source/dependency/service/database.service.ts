import mongoose from 'mongoose';
import { configService } from './config.service.js';

class DatabaseService {
  constructor() {}

  connect = async () => {
    try {
      await mongoose.connect(configService.getOrThrow('DATABASE_URI'), {
        // Fail fast instead of hanging a request (or a serverless invocation) for the 30s default.
        serverSelectionTimeoutMS: 5_000,
        maxPoolSize: Number(configService.get('DATABASE_POOL_SIZE', '10')),
      });
      console.log({ database: `Connected to database` });
    } catch (error) {
      console.log({ database: `Error connecting to database: ${error}` });

      throw error;
    }
  };
}
export const databaseService = new DatabaseService();
