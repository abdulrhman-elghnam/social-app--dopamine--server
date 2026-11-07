import { ReportModel } from '../model/report.model.js';
import type { IReport } from '../../dep/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class ReportRepository extends DatabaseRepository<IReport> {
  constructor() {
    super(ReportModel);
  }
}

export const reportRepository = new ReportRepository();
