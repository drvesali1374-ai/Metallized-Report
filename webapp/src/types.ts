
export type Role = 'ADMIN' | 'USER';

export interface Signature {
  id: string;
  name: string;
  image: string; // Base64 or URL
}

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  personnelCode: string;
  gender: 'MALE' | 'FEMALE';
  email?: string;
  phone?: string;
  position: string;
  honorablePosition?: string;
  unit: string;
  directManagerId?: string;
  profileImage?: string;
  profileZoom?: number;
  profilePosX?: number;
  profilePosY?: number;
  role: Role;
  isFirstLogin: boolean;
  lastVisit?: string;
  signatures?: Signature[];
}

export type AppTheme = 
  | 'blue' | 'green' | 'purple' | 'dark' | 'light'
  | 'wood' | 'pink' | 'teal' | 'sky';

export interface Letterhead {
  id: string;
  name: string;
  imageUrl: string;
}

export interface ContactGroup {
  id: string;
  ownerId: string;
  name: string;
  memberIds: string[];
}

export interface SystemSettings {
  appName: string;
  appLogo: string;
  holidays: string[]; 
  specialOccasions: { date: string, title: string }[];
  sampleProfileImages: string[];
  letterheads: Letterhead[];
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: string;
  role: 'REQUESTER' | 'PERFORMER';
}

export interface PersonalLabel {
  id: string;
  name: string;
  color: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientIds: string[];
  ccIds: string[];
  bccIds: string[];
  subject: string;
  content: string;
  timestamp: string;
}

export interface Attachment {
  name: string;
  size: number;
  type: string;
  data?: string; // Base64 placeholder
}

export interface Letter {
  id: string;
  senderId: string;
  senderName: string;
  recipientId?: string;
  ccIds?: string[];
  bccIds?: string[];
  customRecipient?: {
    name: string;
    gender: 'MALE' | 'FEMALE';
    position: string;
  };
  letterheadId?: string;
  subject: string;
  content: string; 
  timestamp: string; // Used as visible date on letter
  createdAt: string; // Initial creation date
  lastModified?: string;
  sentAt?: string; // Date actually sent
  status: 'DRAFT' | 'SENT';
  pageSize: 'A4' | 'A5';
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  margins: { top: number; bottom: number; left: number; right: number };
  headerCoords: { x: number; y: number };
  headerColor?: string;
  attachments?: Attachment[];
  sigSize?: { w: number; h: number };
  signatureId?: string;
  signatureImage?: string; // Store the image used at the time of signing
}

export interface Station {
  id: string;
  performerId: string;
  performerName: string;
  performerPersonnelCode: string;
  deadlineDate: string;
  description: string; 
  performerNote?: string; 
  progress: number;
  isCompleted: boolean;
  completedAt?: string;
}

export interface Task {
  id: string;
  priority: number; 
  requesterId: string;
  requesterName: string;
  performerId: string; 
  performerName: string;
  performerPersonnelCode: string;
  title: string;
  description: string;
  performerNote?: string; 
  createdAt: string;
  deadlineDate: string;
  expectedProgress: number;
  actualProgress: number;
  isPerformerCompleted: boolean;
  performerCompletedAt?: string;
  isRequesterFinished: boolean; 
  requesterFinishedAt?: string;
  comments: Comment[];
  type: 'SINGLE' | 'MULTI';
  isParallel?: boolean;
  stations?: Station[];
  currentStationIndex?: number;
  labels: string[];
}

export interface AppNotification {
  id: string;
  taskId: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  userId: string;
}

export type TaskStatus = 'ACTIVE' | 'COMPLETED';
