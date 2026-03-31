// ============================================================
// 세탁물 관리 앱 - 글로벌 스토어 (Svelte 5 Runes) v2
// ============================================================

import { SvelteSet, SvelteMap } from 'svelte/reactivity';

import type {
	AdminUser,
	Client,
	ClientContract,
	ClientItemPrice,
	ClientMemo,
	CompletedLogEntry,
	Driver,
	Invoice,
	InvoiceLine,
	LaundryCategory,
	LaundryItem,
	LaundryItemStatus,
	LaundryStatusCounts,
	Shipment,
	ThemeOption
} from './types.js';

// ------------------------------------------------------------------
// 상수
// ------------------------------------------------------------------

export const CATEGORY_LABELS: Record<LaundryCategory, string> = {
	towel: '타올',
	sheet: '시트',
	uniform: '유니폼',
	all: '전체'
};

export const STATUS_LABELS: Record<LaundryItemStatus, string> = {
	received: '입고',
	washing: '세탁중',
	completed: '세탁완료',
	stock: '재고',
	shipped: '출고'
};

// 화면에 표시할 상태 (defect 제거)
export const DISPLAY_STATUSES: Array<'completed' | 'stock'> = ['completed', 'stock'];

export const DISPLAY_STATUS_LABELS: Record<'completed' | 'stock', string> = {
	completed: '세탁완료',
	stock: '재고'
};

// ------------------------------------------------------------------
// 유틸
// ------------------------------------------------------------------

function rand(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateId(): string {
	return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function todayYMD(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** stock = completed (defect 없으므로) */
function calcStock(completed: number): number {
	return completed;
}

function randomCounts(): LaundryStatusCounts {
	const completed = rand(10, 60);
	return {
		received: 0,
		washing: 0,
		completed,
		stock: calcStock(completed),
		shipped: rand(10, 60)
	};
}

function zeroCounts(): LaundryStatusCounts {
	return { received: 0, washing: 0, completed: 0, stock: 0, shipped: 0 };
}

// ------------------------------------------------------------------
// 기본 품목 목록 (동적 추가 베이스)
// ------------------------------------------------------------------

const DEFAULT_TOWEL_ITEMS: string[] = ['대타올', '중타올', '소타올', '목욕가운', '슬리퍼타올'];
const DEFAULT_SHEET_ITEMS: string[] = [
	'시트S',
	'시트D',
	'시트Q',
	'시트K',
	'두베커버S',
	'두베커버D',
	'두베커버K',
	'베개커버'
];
const DEFAULT_UNIFORM_ITEMS: string[] = ['상의', '하의', '앞치마', '조끼', '모자'];

const DEFAULT_CATEGORY_ITEMS: Record<Exclude<LaundryCategory, 'all'>, string[]> = {
	towel: DEFAULT_TOWEL_ITEMS,
	sheet: DEFAULT_SHEET_ITEMS,
	uniform: DEFAULT_UNIFORM_ITEMS
};

// ------------------------------------------------------------------
// 초기 데이터: 거래처
// ------------------------------------------------------------------

const initialClients: Client[] = [
	{
		id: 'client-001',
		name: '그랜드호텔',
		type: 'hotel',
		address: '서울특별시 강남구 테헤란로 123',
		phone: '02-1234-5678',
		businessNo: '123-45-67890',
		ownerName: '김대표',
		managerName: '박매니저',
		managerPhone: '010-1234-5678',
		memo: 'VIP 거래처',
		createdAt: '2024-01-10T09:00:00.000Z'
	},
	{
		id: 'client-002',
		name: '씨뷰펜션',
		type: 'pension',
		address: '강원도 강릉시 해안로 456',
		phone: '033-456-7890',
		businessNo: '234-56-78901',
		ownerName: '이사장',
		managerName: '최담당',
		managerPhone: '010-2345-6789',
		memo: '주말 수거',
		createdAt: '2024-02-15T09:00:00.000Z'
	},
	{
		id: 'client-003',
		name: '파크리조트',
		type: 'resort',
		address: '경기도 가평군 청평면 789',
		phone: '031-789-0123',
		businessNo: '345-67-89012',
		ownerName: '정오너',
		managerName: '한실장',
		managerPhone: '010-3456-7890',
		memo: '월 2회 정기 수거',
		createdAt: '2024-03-01T09:00:00.000Z'
	},
	{
		id: 'client-004',
		name: '스카이호텔',
		type: 'hotel',
		address: '부산광역시 해운대구 마린시티로 321',
		phone: '051-321-6540',
		businessNo: '456-78-90123',
		ownerName: '조회장',
		managerName: '윤팀장',
		managerPhone: '010-4567-8901',
		memo: '이틀 전 예약 필수',
		createdAt: '2024-03-20T09:00:00.000Z'
	},
	{
		id: 'client-005',
		name: '오션펜션',
		type: 'pension',
		address: '제주특별자치도 서귀포시 중문관광로 654',
		phone: '064-654-9870',
		businessNo: '567-89-01234',
		ownerName: '강대표',
		managerName: '임담당',
		managerPhone: '010-5678-9012',
		createdAt: '2024-04-05T09:00:00.000Z'
	}
];

// ------------------------------------------------------------------
// 초기 데이터: 세탁 품목 (defect 필드 없음)
// ------------------------------------------------------------------

function buildLaundryItems(): LaundryItem[] {
	const items: LaundryItem[] = [];
	const now = new Date().toISOString();

	for (const client of initialClients) {
		for (const [cat, names] of Object.entries(DEFAULT_CATEGORY_ITEMS) as [
			Exclude<LaundryCategory, 'all'>,
			string[]
		][]) {
			for (const name of names) {
				items.push({
					id: `${client.id}__${name}`,
					clientId: client.id,
					category: cat,
					name,
					counts: randomCounts(),
					updatedAt: now
				});
			}
		}
	}

	return items;
}

// ------------------------------------------------------------------
// 초기 데이터: 배송기사
// ------------------------------------------------------------------

const initialDrivers: Driver[] = [
	{ id: 'driver-001', name: '김철수', phone: '010-1111-2222' },
	{ id: 'driver-002', name: '이영희', phone: '010-3333-4444' },
	{ id: 'driver-003', name: '박민준', phone: '010-5555-6666' }
];

// ------------------------------------------------------------------
// 초기 데이터: 출고 기록
// ------------------------------------------------------------------

// 샘플 데이터 날짜를 현재 연도로 동적 생성
function sampleDate(month: number, day: number, hour = 8, minute = 0): string {
	const y = new Date().getFullYear();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${y}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00.000Z`;
}

const initialShipments: Shipment[] = [
	// ── 4월 ──────────────────────────────────────────────
	{
		id: 'ship-001',
		clientId: 'client-001',
		items: [
			{ laundryItemId: 'client-001__대타올', itemName: '대타올', category: 'towel', quantity: 80 },
			{ laundryItemId: 'client-001__중타올', itemName: '중타올', category: 'towel', quantity: 60 },
			{ laundryItemId: 'client-001__시트D',  itemName: '시트D',  category: 'sheet', quantity: 40 },
			{ laundryItemId: 'client-001__베개커버', itemName: '베개커버', category: 'sheet', quantity: 50 }
		],
		driverId: 'driver-001', memo: '4월 1차 정기 배송',
		shippedAt: sampleDate(4, 5, 8, 0), createdAt: sampleDate(4, 5, 7, 30)
	},
	{
		id: 'ship-002',
		clientId: 'client-002',
		items: [
			{ laundryItemId: 'client-002__대타올', itemName: '대타올', category: 'towel', quantity: 35 },
			{ laundryItemId: 'client-002__소타올', itemName: '소타올', category: 'towel', quantity: 30 },
			{ laundryItemId: 'client-002__시트S',  itemName: '시트S',  category: 'sheet', quantity: 25 }
		],
		driverId: 'driver-002',
		shippedAt: sampleDate(4, 7, 10, 0), createdAt: sampleDate(4, 7, 9, 45)
	},
	{
		id: 'ship-003',
		clientId: 'client-003',
		items: [
			{ laundryItemId: 'client-003__상의', itemName: '상의', category: 'uniform', quantity: 30 },
			{ laundryItemId: 'client-003__하의', itemName: '하의', category: 'uniform', quantity: 30 },
			{ laundryItemId: 'client-003__앞치마', itemName: '앞치마', category: 'uniform', quantity: 20 }
		],
		driverId: 'driver-003', memo: '유니폼 정기',
		shippedAt: sampleDate(4, 10, 14, 0), createdAt: sampleDate(4, 10, 13, 30)
	},
	{
		id: 'ship-004',
		clientId: 'client-004',
		items: [
			{ laundryItemId: 'client-004__대타올',  itemName: '대타올',  category: 'towel', quantity: 100 },
			{ laundryItemId: 'client-004__목욕가운', itemName: '목욕가운', category: 'towel', quantity: 40 },
			{ laundryItemId: 'client-004__시트K',   itemName: '시트K',   category: 'sheet', quantity: 60 },
			{ laundryItemId: 'client-004__두베커버K', itemName: '두베커버K', category: 'sheet', quantity: 30 }
		],
		driverId: 'driver-001', memo: '스카이호텔 월 1차',
		shippedAt: sampleDate(4, 12, 9, 0), createdAt: sampleDate(4, 12, 8, 30)
	},
	{
		id: 'ship-005',
		clientId: 'client-005',
		items: [
			{ laundryItemId: 'client-005__대타올', itemName: '대타올', category: 'towel', quantity: 20 },
			{ laundryItemId: 'client-005__시트Q',  itemName: '시트Q',  category: 'sheet', quantity: 18 }
		],
		driverId: 'driver-002',
		shippedAt: sampleDate(4, 15, 11, 0), createdAt: sampleDate(4, 15, 10, 30)
	},
	{
		id: 'ship-006',
		clientId: 'client-001',
		items: [
			{ laundryItemId: 'client-001__대타올',   itemName: '대타올',   category: 'towel', quantity: 75 },
			{ laundryItemId: 'client-001__목욕가운',  itemName: '목욕가운',  category: 'towel', quantity: 20 },
			{ laundryItemId: 'client-001__시트D',    itemName: '시트D',    category: 'sheet', quantity: 35 },
			{ laundryItemId: 'client-001__두베커버D', itemName: '두베커버D', category: 'sheet', quantity: 25 }
		],
		driverId: 'driver-001', memo: '4월 2차',
		shippedAt: sampleDate(4, 22, 8, 0), createdAt: sampleDate(4, 22, 7, 30)
	},
	{
		id: 'ship-007',
		clientId: 'client-003',
		items: [
			{ laundryItemId: 'client-003__대타올', itemName: '대타올', category: 'towel', quantity: 55 },
			{ laundryItemId: 'client-003__시트D',  itemName: '시트D',  category: 'sheet', quantity: 45 },
			{ laundryItemId: 'client-003__베개커버', itemName: '베개커버', category: 'sheet', quantity: 40 }
		],
		driverId: 'driver-003',
		shippedAt: sampleDate(4, 25, 14, 0), createdAt: sampleDate(4, 25, 13, 30)
	},
	// ── 5월 ──────────────────────────────────────────────
	{
		id: 'ship-008',
		clientId: 'client-001',
		items: [
			{ laundryItemId: 'client-001__대타올',  itemName: '대타올',  category: 'towel', quantity: 90 },
			{ laundryItemId: 'client-001__중타올',  itemName: '중타올',  category: 'towel', quantity: 70 },
			{ laundryItemId: 'client-001__시트D',   itemName: '시트D',   category: 'sheet', quantity: 50 },
			{ laundryItemId: 'client-001__베개커버', itemName: '베개커버', category: 'sheet', quantity: 60 }
		],
		driverId: 'driver-001', memo: '5월 1차 정기',
		shippedAt: sampleDate(5, 3, 8, 0), createdAt: sampleDate(5, 3, 7, 30)
	},
	{
		id: 'ship-009',
		clientId: 'client-002',
		items: [
			{ laundryItemId: 'client-002__대타올', itemName: '대타올', category: 'towel', quantity: 40 },
			{ laundryItemId: 'client-002__중타올', itemName: '중타올', category: 'towel', quantity: 35 },
			{ laundryItemId: 'client-002__시트S',  itemName: '시트S',  category: 'sheet', quantity: 30 },
			{ laundryItemId: 'client-002__베개커버', itemName: '베개커버', category: 'sheet', quantity: 28 }
		],
		driverId: 'driver-002',
		shippedAt: sampleDate(5, 6, 10, 0), createdAt: sampleDate(5, 6, 9, 45)
	},
	{
		id: 'ship-010',
		clientId: 'client-004',
		items: [
			{ laundryItemId: 'client-004__대타올',   itemName: '대타올',   category: 'towel', quantity: 110 },
			{ laundryItemId: 'client-004__목욕가운',  itemName: '목욕가운',  category: 'towel', quantity: 45 },
			{ laundryItemId: 'client-004__시트K',    itemName: '시트K',    category: 'sheet', quantity: 65 },
			{ laundryItemId: 'client-004__두베커버K', itemName: '두베커버K', category: 'sheet', quantity: 35 }
		],
		driverId: 'driver-001', memo: '스카이호텔 5월 1차',
		shippedAt: sampleDate(5, 8, 9, 0), createdAt: sampleDate(5, 8, 8, 30)
	},
	{
		id: 'ship-011',
		clientId: 'client-003',
		items: [
			{ laundryItemId: 'client-003__상의',  itemName: '상의',  category: 'uniform', quantity: 35 },
			{ laundryItemId: 'client-003__하의',  itemName: '하의',  category: 'uniform', quantity: 35 },
			{ laundryItemId: 'client-003__앞치마', itemName: '앞치마', category: 'uniform', quantity: 25 }
		],
		driverId: 'driver-003', memo: '유니폼 5월',
		shippedAt: sampleDate(5, 12, 14, 0), createdAt: sampleDate(5, 12, 13, 30)
	},
	{
		id: 'ship-012',
		clientId: 'client-005',
		items: [
			{ laundryItemId: 'client-005__대타올', itemName: '대타올', category: 'towel', quantity: 25 },
			{ laundryItemId: 'client-005__중타올', itemName: '중타올', category: 'towel', quantity: 20 },
			{ laundryItemId: 'client-005__시트Q',  itemName: '시트Q',  category: 'sheet', quantity: 22 }
		],
		driverId: 'driver-002',
		shippedAt: sampleDate(5, 14, 11, 0), createdAt: sampleDate(5, 14, 10, 30)
	},
	{
		id: 'ship-013',
		clientId: 'client-001',
		items: [
			{ laundryItemId: 'client-001__대타올',   itemName: '대타올',   category: 'towel', quantity: 85 },
			{ laundryItemId: 'client-001__소타올',   itemName: '소타올',   category: 'towel', quantity: 40 },
			{ laundryItemId: 'client-001__시트D',    itemName: '시트D',    category: 'sheet', quantity: 45 },
			{ laundryItemId: 'client-001__두베커버D', itemName: '두베커버D', category: 'sheet', quantity: 30 }
		],
		driverId: 'driver-001', memo: '5월 2차',
		shippedAt: sampleDate(5, 20, 8, 0), createdAt: sampleDate(5, 20, 7, 30)
	},
	{
		id: 'ship-014',
		clientId: 'client-002',
		items: [
			{ laundryItemId: 'client-002__대타올', itemName: '대타올', category: 'towel', quantity: 38 },
			{ laundryItemId: 'client-002__시트S',  itemName: '시트S',  category: 'sheet', quantity: 32 }
		],
		driverId: 'driver-002',
		shippedAt: sampleDate(5, 22, 10, 0), createdAt: sampleDate(5, 22, 9, 45)
	},
	{
		id: 'ship-015',
		clientId: 'client-004',
		items: [
			{ laundryItemId: 'client-004__대타올',   itemName: '대타올',   category: 'towel', quantity: 105 },
			{ laundryItemId: 'client-004__슬리퍼타올', itemName: '슬리퍼타올', category: 'towel', quantity: 50 },
			{ laundryItemId: 'client-004__시트K',    itemName: '시트K',    category: 'sheet', quantity: 60 }
		],
		driverId: 'driver-001', memo: '스카이호텔 5월 2차',
		shippedAt: sampleDate(5, 26, 9, 0), createdAt: sampleDate(5, 26, 8, 30)
	},
	{
		id: 'ship-016',
		clientId: 'client-003',
		items: [
			{ laundryItemId: 'client-003__대타올',  itemName: '대타올',  category: 'towel', quantity: 60 },
			{ laundryItemId: 'client-003__시트D',   itemName: '시트D',   category: 'sheet', quantity: 50 },
			{ laundryItemId: 'client-003__베개커버', itemName: '베개커버', category: 'sheet', quantity: 45 }
		],
		driverId: 'driver-003',
		shippedAt: sampleDate(5, 28, 14, 0), createdAt: sampleDate(5, 28, 13, 30)
	},
	// ── 6월 ──────────────────────────────────────────────
	{
		id: 'ship-017',
		clientId: 'client-001',
		items: [
			{ laundryItemId: 'client-001__대타올',  itemName: '대타올',  category: 'towel', quantity: 95 },
			{ laundryItemId: 'client-001__중타올',  itemName: '중타올',  category: 'towel', quantity: 75 },
			{ laundryItemId: 'client-001__시트D',   itemName: '시트D',   category: 'sheet', quantity: 55 },
			{ laundryItemId: 'client-001__베개커버', itemName: '베개커버', category: 'sheet', quantity: 65 }
		],
		driverId: 'driver-001', memo: '6월 1차',
		shippedAt: sampleDate(6, 3, 8, 0), createdAt: sampleDate(6, 3, 7, 30)
	},
	{
		id: 'ship-018',
		clientId: 'client-002',
		items: [
			{ laundryItemId: 'client-002__대타올', itemName: '대타올', category: 'towel', quantity: 42 },
			{ laundryItemId: 'client-002__중타올', itemName: '중타올', category: 'towel', quantity: 36 },
			{ laundryItemId: 'client-002__시트S',  itemName: '시트S',  category: 'sheet', quantity: 33 }
		],
		driverId: 'driver-002',
		shippedAt: sampleDate(6, 5, 10, 0), createdAt: sampleDate(6, 5, 9, 45)
	},
	{
		id: 'ship-019',
		clientId: 'client-004',
		items: [
			{ laundryItemId: 'client-004__대타올',   itemName: '대타올',   category: 'towel', quantity: 115 },
			{ laundryItemId: 'client-004__목욕가운',  itemName: '목욕가운',  category: 'towel', quantity: 48 },
			{ laundryItemId: 'client-004__시트K',    itemName: '시트K',    category: 'sheet', quantity: 68 },
			{ laundryItemId: 'client-004__두베커버K', itemName: '두베커버K', category: 'sheet', quantity: 38 }
		],
		driverId: 'driver-001', memo: '스카이호텔 6월 1차',
		shippedAt: sampleDate(6, 7, 9, 0), createdAt: sampleDate(6, 7, 8, 30)
	},
	{
		id: 'ship-020',
		clientId: 'client-003',
		items: [
			{ laundryItemId: 'client-003__상의',  itemName: '상의',  category: 'uniform', quantity: 38 },
			{ laundryItemId: 'client-003__하의',  itemName: '하의',  category: 'uniform', quantity: 38 },
			{ laundryItemId: 'client-003__앞치마', itemName: '앞치마', category: 'uniform', quantity: 28 }
		],
		driverId: 'driver-003', memo: '유니폼 6월',
		shippedAt: sampleDate(6, 9, 14, 0), createdAt: sampleDate(6, 9, 13, 30)
	},
	{
		id: 'ship-021',
		clientId: 'client-005',
		items: [
			{ laundryItemId: 'client-005__대타올', itemName: '대타올', category: 'towel', quantity: 28 },
			{ laundryItemId: 'client-005__중타올', itemName: '중타올', category: 'towel', quantity: 22 },
			{ laundryItemId: 'client-005__시트Q',  itemName: '시트Q',  category: 'sheet', quantity: 24 }
		],
		driverId: 'driver-002',
		shippedAt: sampleDate(6, 11, 11, 0), createdAt: sampleDate(6, 11, 10, 30)
	},
	{
		id: 'ship-022',
		clientId: 'client-001',
		items: [
			{ laundryItemId: 'client-001__대타올',   itemName: '대타올',   category: 'towel', quantity: 88 },
			{ laundryItemId: 'client-001__소타올',   itemName: '소타올',   category: 'towel', quantity: 45 },
			{ laundryItemId: 'client-001__시트D',    itemName: '시트D',    category: 'sheet', quantity: 48 },
			{ laundryItemId: 'client-001__두베커버D', itemName: '두베커버D', category: 'sheet', quantity: 32 }
		],
		driverId: 'driver-001', memo: '6월 2차',
		shippedAt: sampleDate(6, 18, 8, 0), createdAt: sampleDate(6, 18, 7, 30)
	},
	{
		id: 'ship-023',
		clientId: 'client-002',
		items: [
			{ laundryItemId: 'client-002__대타올', itemName: '대타올', category: 'towel', quantity: 44 },
			{ laundryItemId: 'client-002__시트S',  itemName: '시트S',  category: 'sheet', quantity: 35 },
			{ laundryItemId: 'client-002__베개커버', itemName: '베개커버', category: 'sheet', quantity: 30 }
		],
		driverId: 'driver-002',
		shippedAt: sampleDate(6, 20, 10, 0), createdAt: sampleDate(6, 20, 9, 45)
	},
	{
		id: 'ship-024',
		clientId: 'client-004',
		items: [
			{ laundryItemId: 'client-004__대타올',   itemName: '대타올',   category: 'towel', quantity: 108 },
			{ laundryItemId: 'client-004__슬리퍼타올', itemName: '슬리퍼타올', category: 'towel', quantity: 52 },
			{ laundryItemId: 'client-004__시트K',    itemName: '시트K',    category: 'sheet', quantity: 62 }
		],
		driverId: 'driver-001', memo: '스카이호텔 6월 2차',
		shippedAt: sampleDate(6, 24, 9, 0), createdAt: sampleDate(6, 24, 8, 30)
	},
	{
		id: 'ship-025',
		clientId: 'client-003',
		items: [
			{ laundryItemId: 'client-003__대타올',  itemName: '대타올',  category: 'towel', quantity: 62 },
			{ laundryItemId: 'client-003__시트D',   itemName: '시트D',   category: 'sheet', quantity: 52 },
			{ laundryItemId: 'client-003__베개커버', itemName: '베개커버', category: 'sheet', quantity: 48 }
		],
		driverId: 'driver-003',
		shippedAt: sampleDate(6, 26, 14, 0), createdAt: sampleDate(6, 26, 13, 30)
	}
];

// ------------------------------------------------------------------
// 초기 데이터: 관리자 사용자
// ------------------------------------------------------------------

const initialAdminUsers: AdminUser[] = [
	{
		id: 'admin-001',
		username: 'admin',
		passwordHash: 'admin1234',
		role: 'admin',
		name: '관리자',
		email: 'admin@laundry.com',
		phone: '010-0000-0001',
		createdAt: '2024-01-01T00:00:00.000Z',
		isActive: true
	},
	{
		id: 'admin-002',
		username: 'manager1',
		passwordHash: 'manager1234',
		role: 'manager',
		name: '김실무',
		email: 'kim@laundry.com',
		phone: '010-1111-2222',
		createdAt: '2024-02-01T00:00:00.000Z',
		isActive: true
	},
	{
		id: 'admin-003',
		username: 'manager2',
		passwordHash: 'manager1234',
		role: 'manager',
		name: '이공장',
		email: 'lee@laundry.com',
		phone: '010-3333-4444',
		createdAt: '2024-03-01T00:00:00.000Z',
		isActive: true
	}
];

// ------------------------------------------------------------------
// 초기 데이터: 거래처별 품목 단가 (샘플)
// ------------------------------------------------------------------

const initialClientItemPrices: ClientItemPrice[] = [
	// 그랜드호텔 (client-001) 단가
	{ clientId: 'client-001', category: 'towel', itemName: '대타올',      unitPrice: 800  },
	{ clientId: 'client-001', category: 'towel', itemName: '중타올',      unitPrice: 600  },
	{ clientId: 'client-001', category: 'towel', itemName: '소타올',      unitPrice: 400  },
	{ clientId: 'client-001', category: 'towel', itemName: '목욕가운',    unitPrice: 2500 },
	{ clientId: 'client-001', category: 'towel', itemName: '슬리퍼타올', unitPrice: 500  },
	{ clientId: 'client-001', category: 'sheet', itemName: '시트S',       unitPrice: 1200 },
	{ clientId: 'client-001', category: 'sheet', itemName: '시트D',       unitPrice: 1500 },
	{ clientId: 'client-001', category: 'sheet', itemName: '시트Q',       unitPrice: 1800 },
	{ clientId: 'client-001', category: 'sheet', itemName: '시트K',       unitPrice: 2000 },
	{ clientId: 'client-001', category: 'sheet', itemName: '두베커버S',   unitPrice: 1500 },
	{ clientId: 'client-001', category: 'sheet', itemName: '두베커버D',   unitPrice: 1800 },
	{ clientId: 'client-001', category: 'sheet', itemName: '두베커버K',   unitPrice: 2200 },
	{ clientId: 'client-001', category: 'sheet', itemName: '베개커버',    unitPrice: 500  },
	{ clientId: 'client-001', category: 'uniform', itemName: '상의',      unitPrice: 1500 },
	{ clientId: 'client-001', category: 'uniform', itemName: '하의',      unitPrice: 1500 },
	{ clientId: 'client-001', category: 'uniform', itemName: '앞치마',    unitPrice: 800  },
	{ clientId: 'client-001', category: 'uniform', itemName: '조끼',      unitPrice: 1000 },
	{ clientId: 'client-001', category: 'uniform', itemName: '모자',      unitPrice: 500  },
	// 씨뷰펜션 (client-002) 단가
	{ clientId: 'client-002', category: 'towel', itemName: '대타올',      unitPrice: 700  },
	{ clientId: 'client-002', category: 'towel', itemName: '중타올',      unitPrice: 550  },
	{ clientId: 'client-002', category: 'towel', itemName: '소타올',      unitPrice: 350  },
	{ clientId: 'client-002', category: 'towel', itemName: '목욕가운',    unitPrice: 2200 },
	{ clientId: 'client-002', category: 'towel', itemName: '슬리퍼타올', unitPrice: 450  },
	{ clientId: 'client-002', category: 'sheet', itemName: '시트S',       unitPrice: 1100 },
	{ clientId: 'client-002', category: 'sheet', itemName: '시트D',       unitPrice: 1400 },
	{ clientId: 'client-002', category: 'sheet', itemName: '시트Q',       unitPrice: 1700 },
	{ clientId: 'client-002', category: 'sheet', itemName: '시트K',       unitPrice: 1900 },
	{ clientId: 'client-002', category: 'sheet', itemName: '두베커버S',   unitPrice: 1400 },
	{ clientId: 'client-002', category: 'sheet', itemName: '두베커버D',   unitPrice: 1700 },
	{ clientId: 'client-002', category: 'sheet', itemName: '두베커버K',   unitPrice: 2000 },
	{ clientId: 'client-002', category: 'sheet', itemName: '베개커버',    unitPrice: 450  },
	// 파크리조트 (client-003) 단가
	{ clientId: 'client-003', category: 'towel', itemName: '대타올',      unitPrice: 750  },
	{ clientId: 'client-003', category: 'towel', itemName: '중타올',      unitPrice: 580  },
	{ clientId: 'client-003', category: 'towel', itemName: '소타올',      unitPrice: 380  },
	{ clientId: 'client-003', category: 'towel', itemName: '목욕가운',    unitPrice: 2300 },
	{ clientId: 'client-003', category: 'sheet', itemName: '시트S',       unitPrice: 1150 },
	{ clientId: 'client-003', category: 'sheet', itemName: '시트D',       unitPrice: 1450 },
	{ clientId: 'client-003', category: 'sheet', itemName: '시트Q',       unitPrice: 1750 },
	{ clientId: 'client-003', category: 'sheet', itemName: '시트K',       unitPrice: 1950 },
	{ clientId: 'client-003', category: 'sheet', itemName: '베개커버',    unitPrice: 480  },
	{ clientId: 'client-003', category: 'uniform', itemName: '상의',      unitPrice: 1400 },
	{ clientId: 'client-003', category: 'uniform', itemName: '하의',      unitPrice: 1400 },
	{ clientId: 'client-003', category: 'uniform', itemName: '앞치마',    unitPrice: 750  },
];

// ------------------------------------------------------------------
// 초기 데이터: 거래처 계약 기간 (샘플)
// ------------------------------------------------------------------

const initialClientContracts: ClientContract[] = [
	{
		id: 'contract-001',
		clientId: 'client-001',
		startDate: `${new Date().getFullYear()}-01-01`,
		endDate:   `${new Date().getFullYear()}-06-30`,
		memo: '상반기 계약',
		createdAt: sampleDate(1, 1, 9, 0)
	},
	{
		id: 'contract-002',
		clientId: 'client-001',
		startDate: `${new Date().getFullYear()}-07-01`,
		endDate:   `${new Date().getFullYear()}-12-31`,
		memo: '하반기 계약',
		createdAt: sampleDate(6, 15, 9, 0)
	},
	{
		id: 'contract-003',
		clientId: 'client-002',
		startDate: `${new Date().getFullYear()}-02-15`,
		endDate:   `${new Date().getFullYear()}-08-14`,
		memo: '6개월 계약',
		createdAt: sampleDate(2, 1, 9, 0)
	},
	{
		id: 'contract-004',
		clientId: 'client-003',
		startDate: `${new Date().getFullYear()}-03-01`,
		endDate:   `${new Date().getFullYear()}-12-31`,
		memo: '연간 계약',
		createdAt: sampleDate(2, 20, 9, 0)
	},
	{
		id: 'contract-005',
		clientId: 'client-004',
		startDate: `${new Date().getFullYear()}-01-01`,
		endDate:   `${new Date().getFullYear()}-12-31`,
		memo: '연간 계약',
		createdAt: sampleDate(1, 1, 9, 0)
	},
	{
		id: 'contract-006',
		clientId: 'client-005',
		startDate: `${new Date().getFullYear()}-04-01`,
		endDate:   `${new Date().getFullYear()}-09-30`,
		memo: '성수기 계약',
		createdAt: sampleDate(3, 25, 9, 0)
	}
];

// ------------------------------------------------------------------
// 초기 데이터: 거래처 메모
// ------------------------------------------------------------------

const initialClientMemos: ClientMemo[] = [
	{
		id: 'memo-001',
		clientId: 'client-001',
		content: '이번 주 금요일에 대타올 추가 요청 드립니다. 100장 정도 필요합니다.',
		isRead: false,
		createdAt: sampleDate(6, 10, 9, 15)
	},
	{
		id: 'memo-002',
		clientId: 'client-003',
		content: '유니폼 세탁 시 삶음 처리 부탁드립니다. 위생 기준 강화로 필수입니다.',
		isRead: true,
		createdAt: sampleDate(6, 9, 14, 30)
	},
	{
		id: 'memo-003',
		clientId: 'client-005',
		content: '다음 주 배송은 오전 10시 이전으로 부탁드립니다. 체크인 준비 때문입니다.',
		isRead: false,
		createdAt: sampleDate(6, 11, 8, 0)
	}
];

// ------------------------------------------------------------------
// 통계 반환 타입
// ------------------------------------------------------------------

export interface StatsByDateRange {
	/** 총 출고 건수 */
	shipmentCount: number;
	/** 총 출고 수량 */
	totalQuantity: number;
	/** 거래처별 집계 */
	byClient: Array<{
		clientId: string;
		clientName: string;
		shipmentCount: number;
		totalQuantity: number;
	}>;
	/** 카테고리별 집계 */
	byCategory: Array<{
		category: Exclude<LaundryCategory, 'all'>;
		shipmentCount: number;
		totalQuantity: number;
	}>;
	/** 품목별 집계 */
	byItem: Array<{
		itemName: string;
		category: Exclude<LaundryCategory, 'all'>;
		totalQuantity: number;
	}>;
}

// ------------------------------------------------------------------
// 스토어 클래스
// ------------------------------------------------------------------

class LaundryStore {
	// ── 상태 ──────────────────────────────────────────────────────
	clients = $state<Client[]>(initialClients);
	laundryItems = $state<LaundryItem[]>(buildLaundryItems());
	shipments = $state<Shipment[]>(initialShipments);
	drivers = $state<Driver[]>(initialDrivers);
	completedLogs = $state<CompletedLogEntry[]>([]);
	adminUsers = $state<AdminUser[]>(initialAdminUsers);
	clientMemos = $state<ClientMemo[]>(initialClientMemos);
	clientItemPrices = $state<ClientItemPrice[]>(initialClientItemPrices);
	clientContracts = $state<ClientContract[]>(initialClientContracts);
	invoices = $state<Invoice[]>([]);
	selectedClientId = $state<string | null>(initialClients[0]?.id ?? null);
	selectedTheme = $state<ThemeOption>('b');

	// ── 파생 상태 ──────────────────────────────────────────────────

	selectedClient = $derived(
		this.clients.find((c) => c.id === this.selectedClientId) ?? null
	);

	selectedClientItems = $derived(
		this.laundryItems.filter((item) => item.clientId === this.selectedClientId)
	);

	clientCount = $derived(this.clients.length);
	shipmentCount = $derived(this.shipments.length);

	unreadMemoCount = $derived(
		this.clientMemos.filter((m) => !m.isRead).length
	);

	// ------------------------------------------------------------------
	// 동적 품목 목록 조회
	// ------------------------------------------------------------------

	/**
	 * 현재 store.laundryItems에서 카테고리별 unique name 목록 반환
	 * category = 'all'이면 전체 품목명 반환
	 */
	getCategoryItems(category: LaundryCategory): string[] {
		const items =
			category === 'all'
				? this.laundryItems
				: this.laundryItems.filter((i) => i.category === category);
		const seen = new SvelteSet<string>();
		const result: string[] = [];
		for (const item of items) {
			if (!seen.has(item.name)) {
				seen.add(item.name);
				result.push(item.name);
			}
		}
		return result;
	}

	// ------------------------------------------------------------------
	// 거래처 CRUD
	// ------------------------------------------------------------------

	addClient(client: Omit<Client, 'id' | 'createdAt'>): Client {
		const newClient: Client = {
			...client,
			id: `client-${generateId()}`,
			createdAt: new Date().toISOString()
		};
		this.clients = [...this.clients, newClient];

		// 현재 store에 있는 품목 목록을 기반으로 새 거래처에 동일 품목 추가
		const now = new Date().toISOString();
		const newItems: LaundryItem[] = [];
		for (const cat of (['towel', 'sheet', 'uniform'] as Exclude<LaundryCategory, 'all'>[]) ) {
			const names = this.getCategoryItems(cat);
			for (const name of names) {
				newItems.push({
					id: `${newClient.id}__${name}`,
					clientId: newClient.id,
					category: cat,
					name,
					counts: zeroCounts(),
					updatedAt: now
				});
			}
		}
		this.laundryItems = [...this.laundryItems, ...newItems];
		return newClient;
	}

	updateClient(id: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>): void {
		this.clients = this.clients.map((c) => (c.id === id ? { ...c, ...updates } : c));
	}

	removeClient(id: string): void {
		this.clients = this.clients.filter((c) => c.id !== id);
		this.laundryItems = this.laundryItems.filter((item) => item.clientId !== id);
		this.shipments = this.shipments.filter((s) => s.clientId !== id);
		this.completedLogs = this.completedLogs.filter((l) => l.clientId !== id);
		this.clientMemos = this.clientMemos.filter((m) => m.clientId !== id);
		if (this.selectedClientId === id) {
			this.selectedClientId = this.clients[0]?.id ?? null;
		}
	}

	// ------------------------------------------------------------------
	// 품목 동적 추가
	// ------------------------------------------------------------------

	/**
	 * 특정 거래처에 새 품목 추가
	 */
	addLaundryItemType(
		clientId: string,
		category: Exclude<LaundryCategory, 'all'>,
		name: string
	): LaundryItem | null {
		// 이미 해당 거래처에 같은 이름의 품목이 있으면 추가 안 함
		const exists = this.laundryItems.some(
			(i) => i.clientId === clientId && i.name === name && i.category === category
		);
		if (exists) return null;

		const newItem: LaundryItem = {
			id: `${clientId}__${name}`,
			clientId,
			category,
			name,
			counts: zeroCounts(),
			updatedAt: new Date().toISOString()
		};
		this.laundryItems = [...this.laundryItems, newItem];
		return newItem;
	}

	/**
	 * 모든 거래처에 같은 이름의 품목 추가
	 */
	addLaundryItemTypeToAll(
		category: Exclude<LaundryCategory, 'all'>,
		name: string
	): LaundryItem[] {
		const now = new Date().toISOString();
		const added: LaundryItem[] = [];

		for (const client of this.clients) {
			const exists = this.laundryItems.some(
				(i) => i.clientId === client.id && i.name === name && i.category === category
			);
			if (!exists) {
				const newItem: LaundryItem = {
					id: `${client.id}__${name}`,
					clientId: client.id,
					category,
					name,
					counts: zeroCounts(),
					updatedAt: now
				};
				added.push(newItem);
			}
		}

		if (added.length > 0) {
			this.laundryItems = [...this.laundryItems, ...added];
		}
		return added;
	}

	// ------------------------------------------------------------------
	// 세탁 품목 업데이트
	// ------------------------------------------------------------------

	/**
	 * 특정 품목 단일 상태 수정
	 * completed 변경 시 stock 자동 재계산
	 */
	updateLaundryItem(
		clientId: string,
		itemId: string,
		field: LaundryItemStatus,
		value: number
	): void {
		this.laundryItems = this.laundryItems.map((item) => {
			if (item.id === itemId && item.clientId === clientId) {
				const newCounts = { ...item.counts, [field]: Math.max(0, value) };
				// stock 자동 계산 (completed 기준)
				newCounts.stock = calcStock(newCounts.completed);
				return { ...item, counts: newCounts, updatedAt: new Date().toISOString() };
			}
			return item;
		});
	}

	/**
	 * 여러 상태 일괄 수정
	 * completed 포함 시 stock 자동 재계산
	 */
	updateLaundryItemCounts(
		clientId: string,
		itemId: string,
		counts: Partial<LaundryStatusCounts>
	): void {
		this.laundryItems = this.laundryItems.map((item) => {
			if (item.id === itemId && item.clientId === clientId) {
				const newCounts = { ...item.counts, ...counts };
				newCounts.stock = calcStock(newCounts.completed);
				return { ...item, counts: newCounts, updatedAt: new Date().toISOString() };
			}
			return item;
		});
	}

	// ------------------------------------------------------------------
	// 세탁완료 수정 (로그 기록 포함)
	// ------------------------------------------------------------------

	/**
	 * 기존 세탁완료 수에 delta만큼 더함
	 * CompletedLogEntry를 completedLogs에 추가
	 */
	addCompleted(clientId: string, itemId: string, delta: number): void {
		const item = this.laundryItems.find(
			(i) => i.id === itemId && i.clientId === clientId
		);
		if (!item) return;

		const before = item.counts.completed;
		const after = Math.max(0, before + delta);
		const actualDelta = after - before;

		// 세탁완료 수 업데이트
		this.laundryItems = this.laundryItems.map((i) => {
			if (i.id === itemId && i.clientId === clientId) {
				const newCounts = { ...i.counts, completed: after };
				newCounts.stock = calcStock(newCounts.completed);
				return { ...i, counts: newCounts, updatedAt: new Date().toISOString() };
			}
			return i;
		});

		// 로그 기록
		const logEntry: CompletedLogEntry = {
			id: `log-${generateId()}`,
			laundryItemId: itemId,
			clientId,
			itemName: item.name,
			category: item.category,
			actionType: 'add',
			delta: actualDelta,
			before,
			after,
			createdAt: new Date().toISOString(),
			date: todayYMD()
		};
		this.completedLogs = [...this.completedLogs, logEntry];
	}

	/**
	 * 세탁완료 수를 value로 직접 변경
	 * CompletedLogEntry를 completedLogs에 추가
	 */
	setCompleted(clientId: string, itemId: string, value: number): void {
		const item = this.laundryItems.find(
			(i) => i.id === itemId && i.clientId === clientId
		);
		if (!item) return;

		const before = item.counts.completed;
		const after = Math.max(0, value);
		const delta = after - before;

		// 세탁완료 수 업데이트
		this.laundryItems = this.laundryItems.map((i) => {
			if (i.id === itemId && i.clientId === clientId) {
				const newCounts = { ...i.counts, completed: after };
				newCounts.stock = calcStock(newCounts.completed);
				return { ...i, counts: newCounts, updatedAt: new Date().toISOString() };
			}
			return i;
		});

		// 로그 기록
		const logEntry: CompletedLogEntry = {
			id: `log-${generateId()}`,
			laundryItemId: itemId,
			clientId,
			itemName: item.name,
			category: item.category,
			actionType: 'set',
			delta,
			before,
			after,
			createdAt: new Date().toISOString(),
			date: todayYMD()
		};
		this.completedLogs = [...this.completedLogs, logEntry];
	}

	// ------------------------------------------------------------------
	// 출고 처리
	// ------------------------------------------------------------------

	addShipment(shipment: Omit<Shipment, 'id' | 'createdAt'>): Shipment {
		const newShipment: Shipment = {
			...shipment,
			id: `ship-${generateId()}`,
			createdAt: new Date().toISOString()
		};
		this.shipments = [newShipment, ...this.shipments];
		return newShipment;
	}

	/**
	 * 출고 확정: completed 차감, shipped 증가, stock 재계산
	 * 해당 clientId의 completedLogs 삭제
	 */
	applyShipout(clientId: string, items: Array<{ itemId: string; quantity: number }>): void {
		for (const { itemId, quantity } of items) {
			this.laundryItems = this.laundryItems.map((item) => {
				if (item.id === itemId && item.clientId === clientId) {
					const newCompleted = Math.max(0, item.counts.completed - quantity);
					const newShipped = item.counts.shipped + quantity;
					const newCounts = {
						...item.counts,
						completed: newCompleted,
						shipped: newShipped
					};
					newCounts.stock = calcStock(newCounts.completed);
					return { ...item, counts: newCounts, updatedAt: new Date().toISOString() };
				}
				return item;
			});
		}

		// 출고 시 해당 거래처 completedLogs 삭제
		this.completedLogs = this.completedLogs.filter((l) => l.clientId !== clientId);
	}

	updateShipment(id: string, updates: Partial<Omit<Shipment, 'id' | 'createdAt'>>): void {
		this.shipments = this.shipments.map((s) =>
			s.id === id ? { ...s, ...updates } : s
		);
	}

	removeShipment(id: string): void {
		this.shipments = this.shipments.filter((s) => s.id !== id);
	}

	// ------------------------------------------------------------------
	// 배송기사 CRUD
	// ------------------------------------------------------------------

	addDriver(driver: Omit<Driver, 'id'>): Driver {
		const newDriver: Driver = { ...driver, id: `driver-${generateId()}` };
		this.drivers = [...this.drivers, newDriver];
		return newDriver;
	}

	updateDriver(id: string, updates: Partial<Omit<Driver, 'id'>>): void {
		this.drivers = this.drivers.map((d) => (d.id === id ? { ...d, ...updates } : d));
	}

	removeDriver(id: string): void {
		this.drivers = this.drivers.filter((d) => d.id !== id);
	}

	// ------------------------------------------------------------------
	// AdminUser CRUD
	// ------------------------------------------------------------------

	addAdminUser(user: Omit<AdminUser, 'id' | 'createdAt'>): AdminUser {
		const newUser: AdminUser = {
			...user,
			id: `admin-${generateId()}`,
			createdAt: new Date().toISOString()
		};
		this.adminUsers = [...this.adminUsers, newUser];
		return newUser;
	}

	updateAdminUser(id: string, updates: Partial<Omit<AdminUser, 'id' | 'createdAt'>>): void {
		this.adminUsers = this.adminUsers.map((u) => (u.id === id ? { ...u, ...updates } : u));
	}

	removeAdminUser(id: string): void {
		this.adminUsers = this.adminUsers.filter((u) => u.id !== id);
	}

	// ------------------------------------------------------------------
	// ClientMemo CRUD
	// ------------------------------------------------------------------

	addClientMemo(memo: Omit<ClientMemo, 'id' | 'createdAt'>): ClientMemo {
		const newMemo: ClientMemo = {
			...memo,
			id: `memo-${generateId()}`,
			createdAt: new Date().toISOString()
		};
		this.clientMemos = [newMemo, ...this.clientMemos];
		return newMemo;
	}

	markMemoRead(id: string): void {
		this.clientMemos = this.clientMemos.map((m) =>
			m.id === id ? { ...m, isRead: true } : m
		);
	}

	removeClientMemo(id: string): void {
		this.clientMemos = this.clientMemos.filter((m) => m.id !== id);
	}

	// ------------------------------------------------------------------
	// 조회 헬퍼
	// ------------------------------------------------------------------

	getItemsByCategory(clientId: string, category: LaundryCategory): LaundryItem[] {
		const items = this.laundryItems.filter((item) => item.clientId === clientId);
		if (category === 'all') return items;
		return items.filter((item) => item.category === category);
	}

	getShipmentsByDateRange(clientId: string | null, from: string, to: string): Shipment[] {
		const fromTs = new Date(from).getTime();
		const toTs = new Date(to).getTime();
		return this.shipments.filter((s) => {
			const ts = new Date(s.shippedAt).getTime();
			const inRange = ts >= fromTs && ts <= toTs;
			const matchClient = clientId === null || s.clientId === clientId;
			return inRange && matchClient;
		});
	}

	getCategorySummary(clientId: string, category: LaundryCategory): LaundryStatusCounts {
		const items = this.getItemsByCategory(clientId, category);
		const totals: LaundryStatusCounts = {
			received: 0,
			washing: 0,
			completed: 0,
			stock: 0,
			shipped: 0
		};
		for (const item of items) {
			for (const key of Object.keys(totals) as LaundryItemStatus[]) {
				totals[key] += item.counts[key];
			}
		}
		return totals;
	}

	/** 거래처 전체 세탁완료 합계 */
	getTotalCompleted(clientId: string): number {
		return this.laundryItems
			.filter((i) => i.clientId === clientId)
			.reduce((sum, i) => sum + i.counts.completed, 0);
	}

	/** 거래처 전체 재고 합계 (stock = completed) */
	getTotalStock(clientId: string): number {
		return this.laundryItems
			.filter((i) => i.clientId === clientId)
			.reduce((sum, i) => sum + i.counts.stock, 0);
	}

	getDriverById(id: string): Driver | undefined {
		return this.drivers.find((d) => d.id === id);
	}

	getClientById(id: string): Client | undefined {
		return this.clients.find((c) => c.id === id);
	}

	getAdminUserByUsername(username: string): AdminUser | undefined {
		return this.adminUsers.find((u) => u.username === username);
	}

	getMemosByClient(clientId: string): ClientMemo[] {
		return this.clientMemos.filter((m) => m.clientId === clientId);
	}

	getCompletedLogsByClient(clientId: string): CompletedLogEntry[] {
		return this.completedLogs.filter((l) => l.clientId === clientId);
	}

	// ------------------------------------------------------------------
	// 통계 헬퍼
	// ------------------------------------------------------------------

	/**
	 * 날짜 범위 내 출고 기록 기반으로
	 * 거래처별, 카테고리별, 품목별 집계 반환
	 * @param fromDate YYYY-MM-DD
	 * @param toDate   YYYY-MM-DD
	 */
	getStatsByDateRange(fromDate: string, toDate: string): StatsByDateRange {
		// toDate는 해당 일의 끝까지 포함
		const fromTs = new Date(fromDate + 'T00:00:00.000Z').getTime();
		const toTs = new Date(toDate + 'T23:59:59.999Z').getTime();

		const inRange = this.shipments.filter((s) => {
			const ts = new Date(s.shippedAt).getTime();
			return ts >= fromTs && ts <= toTs;
		});

		const shipmentCount = inRange.length;
		let totalQuantity = 0;

		const clientMap = new SvelteMap<string, { shipmentCount: number; totalQuantity: number }>();
		const categoryMap = new SvelteMap<
			Exclude<LaundryCategory, 'all'>,
			{ shipmentCount: number; totalQuantity: number }
		>();
		const itemMap = new SvelteMap<
			string,
			{ itemName: string; category: Exclude<LaundryCategory, 'all'>; totalQuantity: number }
		>();

		for (const shipment of inRange) {
			const client = this.getClientById(shipment.clientId);
			const clientName = client?.name ?? shipment.clientId;

			if (!clientMap.has(shipment.clientId)) {
				clientMap.set(shipment.clientId, { shipmentCount: 0, totalQuantity: 0 });
			}
			const clientStat = clientMap.get(shipment.clientId)!;
			clientStat.shipmentCount++;

			for (const item of shipment.items) {
				totalQuantity += item.quantity;
				clientStat.totalQuantity += item.quantity;

				// 카테고리별
				const cat = item.category;
				if (!categoryMap.has(cat)) {
					categoryMap.set(cat, { shipmentCount: 0, totalQuantity: 0 });
				}
				const catStat = categoryMap.get(cat)!;
				catStat.shipmentCount++;
				catStat.totalQuantity += item.quantity;

				// 품목별 (itemName + category 복합키)
				const itemKey = `${cat}__${item.itemName}`;
				if (!itemMap.has(itemKey)) {
					itemMap.set(itemKey, {
						itemName: item.itemName,
						category: cat,
						totalQuantity: 0
					});
				}
				itemMap.get(itemKey)!.totalQuantity += item.quantity;
			}

			// clientName은 byClient에서 사용
			void clientName;
		}

		const byClient = [...clientMap.entries()].map(([clientId, stat]) => {
			const client = this.getClientById(clientId);
			return {
				clientId,
				clientName: client?.name ?? clientId,
				...stat
			};
		});

		const byCategory = [...categoryMap.entries()].map(([category, stat]) => ({
			category,
			...stat
		}));

		const byItem = [...itemMap.values()];

		return {
			shipmentCount,
			totalQuantity,
			byClient,
			byCategory,
			byItem
		};
	}

	// ------------------------------------------------------------------
	// 거래처 품목 단가 CRUD
	// ------------------------------------------------------------------

	/** 거래처의 특정 품목 단가 설정 (없으면 추가, 있으면 업데이트) */
	setClientItemPrice(
		clientId: string,
		category: Exclude<LaundryCategory, 'all'>,
		itemName: string,
		unitPrice: number
	): void {
		const exists = this.clientItemPrices.findIndex(
			(p) => p.clientId === clientId && p.category === category && p.itemName === itemName
		);
		if (exists >= 0) {
			this.clientItemPrices = this.clientItemPrices.map((p, i) =>
				i === exists ? { ...p, unitPrice } : p
			);
		} else {
			this.clientItemPrices = [
				...this.clientItemPrices,
				{ clientId, category, itemName, unitPrice }
			];
		}
	}

	/** 거래처의 모든 품목 단가 반환 */
	getClientItemPrices(clientId: string): ClientItemPrice[] {
		return this.clientItemPrices.filter((p) => p.clientId === clientId);
	}

	/** 거래처 특정 품목 단가 조회 (없으면 0) */
	getUnitPrice(
		clientId: string,
		category: Exclude<LaundryCategory, 'all'>,
		itemName: string
	): number {
		return (
			this.clientItemPrices.find(
				(p) => p.clientId === clientId && p.category === category && p.itemName === itemName
			)?.unitPrice ?? 0
		);
	}

	/** 거래처 품목 단가 일괄 저장 (해당 거래처 기존 단가 모두 교체) */
	saveClientItemPrices(clientId: string, prices: Omit<ClientItemPrice, 'clientId'>[]): void {
		const others = this.clientItemPrices.filter((p) => p.clientId !== clientId);
		const newPrices: ClientItemPrice[] = prices.map((p) => ({ ...p, clientId }));
		this.clientItemPrices = [...others, ...newPrices];
	}

	// ------------------------------------------------------------------
	// 거래처 계약 기간 CRUD
	// ------------------------------------------------------------------

	addClientContract(contract: Omit<ClientContract, 'id' | 'createdAt'>): ClientContract {
		const newContract: ClientContract = {
			...contract,
			id: `contract-${generateId()}`,
			createdAt: new Date().toISOString()
		};
		this.clientContracts = [...this.clientContracts, newContract];
		return newContract;
	}

	updateClientContract(id: string, updates: Partial<Omit<ClientContract, 'id' | 'createdAt'>>): void {
		this.clientContracts = this.clientContracts.map((c) =>
			c.id === id ? { ...c, ...updates } : c
		);
	}

	removeClientContract(id: string): void {
		this.clientContracts = this.clientContracts.filter((c) => c.id !== id);
	}

	getContractsByClient(clientId: string): ClientContract[] {
		return this.clientContracts
			.filter((c) => c.clientId === clientId)
			.sort((a, b) => b.startDate.localeCompare(a.startDate));
	}

	// ------------------------------------------------------------------
	// 청구서 생성 및 관리
	// ------------------------------------------------------------------

	/**
	 * 특정 거래처의 기간 내 출고 기록을 기반으로 청구서 라인 계산
	 * (저장하지 않고 미리보기용 데이터 반환)
	 */
	buildInvoiceLines(clientId: string, fromDate: string, toDate: string): InvoiceLine[] {
		const fromTs = new Date(fromDate + 'T00:00:00.000Z').getTime();
		const toTs = new Date(toDate + 'T23:59:59.999Z').getTime();

		const shipments = this.shipments.filter((s) => {
			if (s.clientId !== clientId) return false;
			const ts = new Date(s.shippedAt).getTime();
			return ts >= fromTs && ts <= toTs;
		});

		// 품목별 수량 집계
		const lineMap = new SvelteMap<string, InvoiceLine>();
		for (const shipment of shipments) {
			for (const item of shipment.items) {
				const key = `${item.category}__${item.itemName}`;
				if (!lineMap.has(key)) {
					const unitPrice = this.getUnitPrice(clientId, item.category, item.itemName);
					lineMap.set(key, {
						category: item.category,
						itemName: item.itemName,
						quantity: 0,
						unitPrice,
						amount: 0
					});
				}
				const line = lineMap.get(key)!;
				line.quantity += item.quantity;
				line.amount = line.quantity * line.unitPrice;
			}
		}

		// 카테고리 → 품목명 순으로 정렬
		const catOrder: Record<Exclude<LaundryCategory, 'all'>, number> = {
			towel: 0,
			sheet: 1,
			uniform: 2
		};
		return [...lineMap.values()].sort((a, b) => {
			const co = catOrder[a.category] - catOrder[b.category];
			if (co !== 0) return co;
			return a.itemName.localeCompare(b.itemName);
		});
	}

	/** 청구서 저장 */
	saveInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>): Invoice {
		const newInvoice: Invoice = {
			...invoice,
			id: `inv-${generateId()}`,
			createdAt: new Date().toISOString()
		};
		this.invoices = [newInvoice, ...this.invoices];
		return newInvoice;
	}

	updateInvoice(id: string, updates: Partial<Omit<Invoice, 'id' | 'createdAt'>>): void {
		this.invoices = this.invoices.map((inv) =>
			inv.id === id ? { ...inv, ...updates } : inv
		);
	}

	removeInvoice(id: string): void {
		this.invoices = this.invoices.filter((inv) => inv.id !== id);
	}

	getInvoicesByClient(clientId: string): Invoice[] {
		return this.invoices
			.filter((inv) => inv.clientId === clientId)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}

	// ------------------------------------------------------------------
	// UI 상태 조작
	// ------------------------------------------------------------------

	selectClient(clientId: string | null): void {
		this.selectedClientId = clientId;
	}

	selectTheme(theme: ThemeOption): void {
		this.selectedTheme = theme;
	}
}

// ------------------------------------------------------------------
// 싱글톤 export
// ------------------------------------------------------------------

export const store = new LaundryStore();