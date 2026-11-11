import { BlockModel } from '../model/block.model.js';
import type { IBlock } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class BlockRepository extends DatabaseRepository<IBlock> {
  constructor() {
    super(BlockModel);
  }
}

export const blockRepository = new BlockRepository();
