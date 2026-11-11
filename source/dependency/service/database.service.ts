import mongoose from 'mongoose';
import { configService } from './config.service.js';

class DatabaseService {
  constructor() {}

  connect = async () => {
    try {
      await mongoose.connect(String(configService.get('DATABASE_URI')));
      console.log({ database: `Connected to database` });
    } catch (error) {
      console.log({ database: `Error connecting to database: ${error}` });

      throw error;
    }
  };
}
export const databaseService = new DatabaseService();
