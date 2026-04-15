// ============================================================
// 세탁물 관리 앱 - 공통 타입 정의 (v2)
// ============================================================

// 거래처 타입
export type ClientType = 'hotel' | 'pension' | 'resort' | 'etc';

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  address: string;
  phone?: string;
  businessNo?: string;      // 사업자번호
  ownerName?: string;       // 대표자명
  email?: string;           // 거래처 이메일
  managerName?: string;     // 담당자명
  managerPhone?: string;    // 담당자 연락처
  managerEmail?: string;    // 담당자 이메일
  memo?: string;
  createdAt: string;
}

// 세탁 품목 카테고리
export type LaundryCategory = 'towel' | 'sheet' | 'uniform' | 'all';

// 세탁물 상태 (defect 제거됨)
export type LaundryItemStatus = 'received' | 'washing' | 'completed' | 'stock' | 'shipped';

export type LaundryStatusCounts = Record<LaundryItemStatus, number>;

// 세탁 품목
export interface LaundryItem {
  id: string;
  clientId: string;
  category: string;
  name: string;   // 고정 타입 대신 string으로 변경 (동적 추가 가능)
  counts: LaundryStatusCounts;
  updatedAt: string;
}

// 세탁완료 수정 작업 종류
export type CompletedActionType = 'add' | 'set';

// 세탁완료 수정 이력 항목 (단일 액션)
export interface CompletedLogEntry {
  id: string;
  laundryItemId: string;
  clientId: string;
  itemName: string;
  category: Exclude<LaundryCategory, 'all'>;
  actionType: CompletedActionType;  // 'add' = 추가, 'set' = 변경
  delta: number;          // add면 더한 값, set이면 변경 전 값과의 차이
  before: number;         // 변경 전 세탁완료 수
  after: number;          // 변경 후 세탁완료 수
  createdAt: string;      // ISO 8601 - 기록 시각
  date: string;           // YYYY-MM-DD - 당일 날짜 (출고 후 삭제 기준)
}

// 출고(배송) 기록
export interface ShipmentItem {
  laundryItemId: string;
  itemName: string;
  category: Exclude<LaundryCategory, 'all'>;
  quantity: number;
}

export interface Shipment {
  id: string;
  clientId: string;
  items: ShipmentItem[];
  driverId: string;
  memo?: string;
  shippedAt: string;
  createdAt: string;
}

// 배송기사
export interface Driver {
  id: string;
  name: string;
  phone: string;
  memo?: string;
}

// 관리자 사용자
export interface AdminUser {
  id: string;
  username: string;
  passwordHash: string;   // 실제 앱에서는 bcrypt 등, 여기서는 plain string 시뮬레이션
  role: 'admin' | 'manager';
  name: string;
  email?: string;
  phone?: string;
  createdAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

// 클라이언트 메모 (거래처에서 보낸 메모)
export interface ClientMemo {
  id: string;
  clientId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

// ============================================================
// 청구서 관련 타입
// ============================================================

// 거래처별 품목 단가 설정 (기본 단가 - 상품관리에서 관리)
export interface ClientItemPrice {
  clientId: string;
  category: string;
  itemName: string;
  unitPrice: number;   // 원/개
}

// 거래처별 기간 단가 규칙 (청구 페이지에서 관리, 기본 단가 override)
export interface ClientItemPriceRule {
  id: string;
  clientId: string;
  category: string;
  itemName: string;
  unitPrice: number;   // 원/개
  validFrom: string;   // YYYY-MM-DD
  validTo?: string | null;  // YYYY-MM-DD, null = 이 날짜부터 쭉 (무기한)
  memo?: string;
  createdAt: string;
}

// 거래처 계약 정보
export interface ClientContract {
  id: string;
  clientId: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  memo?: string;
  createdAt: string;
}

// 청구서 라인 (품목별 집계)
export interface InvoiceLine {
  category: Exclude<LaundryCategory, 'all'>;
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;      // quantity * unitPrice
}

// 청구서
export interface Invoice {
  id: string;
  clientId: string;
  periodFrom: string;  // YYYY-MM-DD
  periodTo: string;    // YYYY-MM-DD
  lines: InvoiceLine[];
  totalAmount: number;
  memo?: string;
  createdAt: string;
  status: 'draft' | 'issued';
}

// 스토어 상태 타입
export type ThemeOption = 'a' | 'b' | 'admin';

export interface StoreState {
  clients: Client[];
  laundryItems: LaundryItem[];
  shipments: Shipment[];
  drivers: Driver[];
  completedLogs: CompletedLogEntry[];
  adminUsers: AdminUser[];
  clientMemos: ClientMemo[];
  clientItemPrices: ClientItemPrice[];
  clientItemPriceRules: ClientItemPriceRule[];
  clientContracts: ClientContract[];
  invoices: Invoice[];
  selectedClientId: string | null;
  selectedTheme: ThemeOption;
}

// 유틸리티 타입
export interface CategorySummary {
  category: LaundryCategory;
  items: LaundryItem[];
  totals: LaundryStatusCounts;
}

export interface DateRange {
  from: string;
  to: string;
}