// ===========================================
// EXPRESS TYPE AUGMENTATION
// Extend Express Request interface
// ===========================================

import { IUser, IDeviceInfo } from './index';

// Module augmentation for express
declare module 'express-serve-static-core' {
  interface Request {
    user?: IUser;
    userId?: string;
    deviceInfo?: IDeviceInfo;
  }
}

export {};
