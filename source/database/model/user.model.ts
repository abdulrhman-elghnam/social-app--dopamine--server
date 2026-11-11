import { HydratedDocument, model, Schema } from 'mongoose';
import {
  GenderEnum,
  ProviderEnum,
  SystemRoleEnum,
  UserPrivacyControllerEnum,
} from '../../dependency/value/database.enum.js';
import type { IUser } from '../../dependency/interface/database.interface.js';
import { securityService } from '../../dependency/service/security.service.js';

export type HUserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<HUserDocument>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    gender: { type: String, enum: GenderEnum, required: true },
    role: { type: String, enum: SystemRoleEnum, default: SystemRoleEnum.USER },
    provider: { type: String, enum: ProviderEnum, required: true },
    phone: String,
    DOB: Date,
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    image: String,
    coverImage: String,
    bio: String,
    privacyController: {
      type: String,
      enum: UserPrivacyControllerEnum,
      default: UserPrivacyControllerEnum.public,
    },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },
    changeCredentialsTime: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password') && this['password']) {
    this['password'] = await securityService.hash(this['password']);
    this['changeCredentialsTime'] = new Date();
  }
});

export const UserModel = model<IUser>('User', userSchema);
