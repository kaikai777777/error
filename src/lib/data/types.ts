// ============================================================
// 세탁물 관리 앱 - 공통 타입 정의
// ============================================================

// ------------------------------------------------------------------
// 거래처 (Client)
// ------------------------------------------------------------------

export type ClientType = 'hotel' | 'pension' | 'resort' | 'etc';

export interface Client {
	id: string;
	name: string;
	type: ClientType;
	address: string;
	phone?: string;
	memo?: string;
	createdAt: string; // ISO 8601
}

// ------------------------------------------------------------------
// 세탁 품목 카테고리
// ------------------------------------------------------------------

export type LaundryCategory = 'towel' | 'sheet' | 'uniform' | 'all';

// 타올 품목
export type TowelItemName =
	| '대타올'
	| '중타올'
	| '소타올'
	| '목욕가운'
	| '슬리퍼타올';

// 시트 품목
export type SheetItemName =
	| '시트S'
	| '시트D'
	| '시트Q'
	| '시트K'
	| '두베커버S'
	| '두베커버D'
	| '두베커버K'
	| '베개커버';

// 유니폼 품목
export type UniformItemName =
	| '상의'
	| '하의'
	| '앞치마'
	| '조끼'
	| '모자';

export type LaundryItemName = TowelItemName | SheetItemName | UniformItemName;

// ------------------------------------------------------------------
// 세탁물 상태
// ------------------------------------------------------------------

export type LaundryItemStatus =
	| 'received'    // 입고
	| 'washing'     // 세탁중
	| 'completed'   // 세탁완료
	| 'defect'      // 불량
	| 'stock'       // 재고
	| 'shipped';    // 출고

export type LaundryStatusCounts = Record<LaundryItemStatus, number>;

// ------------------------------------------------------------------
// 세탁 품목 (LaundryItem)
// ------------------------------------------------------------------

export interface LaundryItem {
	id: string;                  // 고유 ID (clientId + itemName 조합)
	clientId: string;
	category: Exclude<LaundryCategory, 'all'>;
	name: LaundryItemName;
	counts: LaundryStatusCounts;
	updatedAt: string;           // ISO 8601
}

// ------------------------------------------------------------------
// 출고(배송) 기록
// ------------------------------------------------------------------

export interface ShipmentItem {
	laundryItemId: string;
	itemName: LaundryItemName;
	category: Exclude<LaundryCategory, 'all'>;
	quantity: number;
}

export interface Shipment {
	id: string;
	clientId: string;
	items: ShipmentItem[];
	driverId: string;
	memo?: string;
	shippedAt: string;  // ISO 8601
	createdAt: string;  // ISO 8601
}

// ------------------------------------------------------------------
// 배송기사 (Driver)
// ------------------------------------------------------------------

export interface Driver {
	id: string;
	name: string;
	phone: string;
	memo?: string;
}

// ------------------------------------------------------------------
// 스토어 상태 타입
// ------------------------------------------------------------------

export type ThemeOption = 'a' | 'b' | 'c';

export interface StoreState {
	clients: Client[];
	laundryItems: LaundryItem[];
	shipments: Shipment[];
	drivers: Driver[];
	selectedClientId: string | null;
	selectedTheme: ThemeOption;
}

// ------------------------------------------------------------------
// 유틸리티 타입
// ------------------------------------------------------------------

/** 카테고리별 품목 집계 결과 */
export interface CategorySummary {
	category: LaundryCategory;
	items: LaundryItem[];
	totals: LaundryStatusCounts;
}

/** 날짜 범위 */
export interface DateRange {
	from: string; // ISO 8601
	to: string;   // ISO 8601
}