import { StoryViewModel } from '../model/story-view.model.js';
import type { IStoryView } from '../../dependency/interface/database.interface.js';
import { DatabaseRepository } from './base.repository.js';

export class StoryViewRepository extends DatabaseRepository<IStoryView> {
  constructor() {
    super(StoryViewModel);
  }
}

export const storyViewRepository = new StoryViewRepository();
