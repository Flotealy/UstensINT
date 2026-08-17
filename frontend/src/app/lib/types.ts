/** Types miroir des schémas Pydantic du backend (backend/app/schemas). */

export type Role = "user" | "moderator" | "admin";

export type ReservationStatus = "active" | "approved" | "returned" | "cancelled";

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  is_blocked: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

/** Ce qu'un utilisateur standard voit du matériel. */
export interface Equipment {
  id: string;
  name: string;
  label: string;
  category: Category | null;
  deposit_amount: number | null;
  status: string;
  photo_url: string | null;
  photo_upload: string | null;
}

/** Champs supplémentaires réservés aux mandats/administrateurs. */
export interface EquipmentDetail extends Equipment {
  location: string | null;
  purchase_cost: number | null;
  comments: string | null;
  is_archived: boolean;
  archive_comment: string | null;
  created_at: string;
}

export interface ReservationItem {
  id: string;
  equipment: Equipment;
}

export interface Reservation {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  status: ReservationStatus;
  total_deposit: number;
  deposit_type: string | null;
  phone: string | null;
  comments: string | null;
  cancel_comment: string | null;
  returned_at: string | null;
  created_at: string;
  items: ReservationItem[];
}

/** Réservation vue par un mandat/admin (avec l'emprunteur et la note interne privée). */
export interface ReservationDetail extends Reservation {
  user: UserProfile;
  returned_by_user: UserProfile | null;
  staff_comment: string | null;
}

export interface Setting {
  key: string;
  value: string;
}

/** Paramètres exposés à tous les utilisateurs connectés (GET /settings/public). */
export interface PublicSettings {
  max_reservation_days: number;
  max_advance_days: number;
  deposit_types: string[];
  equipment_statuses: string[];
  blocking_equipment_statuses: string[];
  auto_approve_reservations: boolean;
  require_phone: boolean;
  require_comments: boolean;
}

export const FALLBACK_SETTINGS: PublicSettings = {
  max_reservation_days: 14,
  max_advance_days: 0,
  deposit_types: ["Liquide", "Virement", "Chèque"],
  equipment_statuses: ["Neuf", "Bon état", "Usé", "En réparation", "Hors service"],
  blocking_equipment_statuses: ["En réparation", "Hors service"],
  auto_approve_reservations: false,
  require_phone: false,
  require_comments: false,
};

/** États qui empêchent la réservation. */
export const UNRESERVABLE_STATUSES = ["Hors service", "En réparation"];

export function isReservable(equipment: Equipment, blockingStatuses?: string[]): boolean {
  const blocking = blockingStatuses && blockingStatuses.length > 0 ? blockingStatuses : UNRESERVABLE_STATUSES;
  return !blocking.includes(equipment.status);
}

export function photoOf(equipment: Equipment): string | null {
  return equipment.photo_upload || equipment.photo_url || null;
}

/** Élément du stock & nourriture du club (Cook'It). */
export interface StockItem {
  id: string;
  name: string;
  category: string | null;
  quantity: string;
  status: string;
  location: string | null;
  comments: string | null;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

/** Entrée du journal d'audit. */
export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}
