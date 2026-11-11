import type { Types } from 'mongoose';
import { BlockModel } from '../model/block.model.js';
import type { IBlock } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class BlockRepository extends DatabaseRepository<IBlock> {
  constructor() {
    super(BlockModel);
  }

  async isBlockedEither(a: Types.ObjectId, b: Types.ObjectId): Promise<boolean> {
    const block = await this.findOne({
      filter: {
        $or: [
          { blocker: a, blocked: b },
          { blocker: b, blocked: a },
        ],
      },
      options: { select: '_id', lean: true },
    });
    return block !== null;
  }

  /** Ids of everyone the user blocked or was blocked by — hidden from each other everywhere. */
  async hiddenUserIds(userId: Types.ObjectId): Promise<string[]> {
    const [blocked, blockers] = await Promise.all([this.distinctIds('blocked', { blocker: userId }), this.distinctIds('blocker', { blocked: userId })]);
    return [...new Set([...blocked, ...blockers])];
  }
}

export const blockRepository = new BlockRepository();
