export type Member = {
  id: string;
  name: string;
  avatar: number;
  role: "admin" | "member" | "guest";
  active: boolean;
  joinedMonth: string;
  leftMonth?: string;
  guestMonth?: string;
  registered: boolean;
  accessVersion: number;
  inviteHash?: string;
};
export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  archived: boolean;
};
export type Expense = {
  id: string;
  title: string;
  amount: number;
  categoryId: string;
  month: string;
  date: string;
  authorId: string;
  payerId: string;
  shares: { memberId: string; amount: number }[];
  createdAt: string;
  updatedAt?: string;
};
export type Payment = {
  id: string;
  memberId: string;
  month: string;
  amount: number;
  direction: "to_admin" | "from_admin";
  authorId: string;
  createdAt: string;
  voidedAt?: string;
  voidedBy?: string;
};
export type Comment = {
  id: string;
  month: string;
  authorId: string;
  body: string;
  createdAt: string;
};
export type Announcement = {
  id: string;
  authorId: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt?: string;
};
export type HouseCalendar = {
  id: string;
  name: string;
  color: string;
  authorId: string;
};
export type HouseEvent = {
  id: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  kind: "event" | "absence" | "chore";
  authorId: string;
  assigneeId?: string;
  completed: boolean;
  rotationId?: string;
  occurrence?: number;
  deleted?: boolean;
  version: number;
  syncedVersion: number;
  syncError?: string;
};
export type Rotation = {
  id: string;
  title: string;
  calendarId: string;
  start: string;
  everyWeeks: number;
  memberIds: string[];
  authorId: string;
  active: boolean;
};
export type Audit = {
  id: string;
  authorId: string;
  action: string;
  entityId: string;
  month?: string;
  at: string;
};
export type GoogleConnection = {
  calendarId?: string;
  calendarName?: string;
  encryptedToken?: string;
  reconnect?: boolean;
  leaseUntil?: string;
  lastSync?: string;
};
export type Community = {
  id: string;
  name: string;
  address: string;
  ownerKey: string;
  createdAt: string;
  members: Member[];
  categories: Category[];
  boards: string[];
  expenses: Expense[];
  payments: Payment[];
  comments: Comment[];
  announcements: Announcement[];
  calendars: HouseCalendar[];
  events: HouseEvent[];
  rotations: Rotation[];
  audit: Audit[];
  google: GoogleConnection;
};
export type Actor = {
  communityId: string;
  memberId: string;
  accessVersion: number;
};
export type PublicCommunity = Omit<
  Community,
  "ownerKey" | "google" | "members"
> & {
  members: Omit<Member, "inviteHash">[];
  google: Omit<GoogleConnection, "encryptedToken" | "leaseUntil"> & {
    connected: boolean;
  };
};
export type Balance = {
  memberId: string;
  share: number;
  advanced: number;
  paid: number;
  refunded: number;
  pending: number;
};
