import { NotificationModel } from '../model/notification.model.js';
import type { INotification } from '../../dep/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class NotificationRepository extends DatabaseRepository<INotification> {
  constructor() {
    super(NotificationModel);
  }
}

export const notificationRepository = new NotificationRepository();
