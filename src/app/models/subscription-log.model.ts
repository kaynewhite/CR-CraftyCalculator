export interface SubscriptionLog {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  action: 'approved' | 'rejected' | 'upgraded' | 'downgraded' | 'cancelled';
  plan: string;
  cost: number;
  approvedBy?: string;
  feedback?: string;
  timestamp: string;
  details?: string;
}

export interface SystemLog {
  id: string;
  type: 'approval' | 'rejection' | 'error' | 'system' | 'maintenance';
  message: string;
  userId?: string;
  userName?: string;
  adminId?: string;
  timestamp: string;
  details?: any;
}

export interface ActivityLog {
  id: string;
  userId?: string;
  userName?: string;
  userEmail: string;
  action: 'login' | 'logout' | 'signup';
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  timestamp: string;
}
