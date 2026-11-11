import { NotFoundException } from './dependency/exception/main.exception.js';
import { utilService, UtilService } from './dependency/service/util.service.js';

export class AppService {
  constructor(private readonly utilService: UtilService) {}

  public mainService() {
    return this.utilService.responseFormatter({
      handler: () => ({
        messageCode: 101,
      }),
    });
  }

  public notFoundService() {
    throw new NotFoundException('Route Not Found', {
      messageCode: 102,
    });
  }
}

export const appService = new AppService(utilService);
