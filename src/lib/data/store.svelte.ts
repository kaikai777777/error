// ============================================================
// 세탁물 관리 앱 - 글로벌 스토어 (Svelte 5 Runes)
// ============================================================

import type {
	Client,
	Driver,
	LaundryCategory,
	LaundryItem,
	LaundryItemName,
	LaundryItemStatus,
	LaundryStatusCounts,
	Shipment,

	ThemeOption
} from './types.js';

// ------------------------------------------------------------------
// 상수: 카테고리별 품목 목록
// ------------------------------------------------------------------

export const TOWEL_ITEMS: LaundryItemName[] = [
	'대타올',
	'중타올',
	'소타올',
	'목욕가운',
	'슬리퍼타올'
];

export const SHEET_ITEMS: LaundryItemName[] = [
	'시트S',
	'시트D',
	'시트Q',
	'시트K',
	'두베커버S',
	'두베커버D',
	'두베커버K',
	'베개커버'
];

export const UNIFORM_ITEMS: LaundryItemName[] = ['상의', '하의', '앞치마', '조끼', '모자'];

export const CATEGORY_ITEMS: Record<Exclude<LaundryCategory, 'all'>, LaundryItemName[]> = {
	towel: TOWEL_ITEMS,
	sheet: SHEET_ITEMS,
	uniform: UNIFORM_ITEMS
};

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
	defect: '불량',
	stock: '재고',
	shipped: '출고'
};

// ------------------------------------------------------------------
// 유틸: 랜덤 숫자 생성
// ------------------------------------------------------------------

function rand(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomCounts(): LaundryStatusCounts {
	return {
		received: rand(20, 100),
		washing: rand(5, 30),
		completed: rand(10, 50),
		defect: rand(0, 5),
		stock: rand(5, 20),
		shipped: rand(10, 60)
	};
}

// ------------------------------------------------------------------
// 유틸: ID 생성
// ------------------------------------------------------------------

function generateId(): string {
	return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

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
		memo: 'VIP 거래처',
		createdAt: '2024-01-10T09:00:00.000Z'
	},
	{
		id: 'client-002',
		name: '씨뷰펜션',
		type: 'pension',
		address: '강원도 강릉시 해안로 456',
		phone: '033-456-7890',
		memo: '주말 수거',
		createdAt: '2024-02-15T09:00:00.000Z'
	},
	{
		id: 'client-003',
		name: '파크리조트',
		type: 'resort',
		address: '경기도 가평군 청평면 789',
		phone: '031-789-0123',
		memo: '월 2회 정기 수거',
		createdAt: '2024-03-01T09:00:00.000Z'
	},
	{
		id: 'client-004',
		name: '스카이호텔',
		type: 'hotel',
		address: '부산광역시 해운대구 마린시티로 321',
		phone: '051-321-6540',
		memo: '이틀 전 예약 필수',
		createdAt: '2024-03-20T09:00:00.000Z'
	},
	{
		id: 'client-005',
		name: '오션펜션',
		type: 'pension',
		address: '제주특별자치도 서귀포시 중문관광로 654',
		phone: '064-654-9870',
		createdAt: '2024-04-05T09:00:00.000Z'
	}
];

// ------------------------------------------------------------------
// 초기 데이터: 세탁 품목 (거래처별 × 전 품목)
// ------------------------------------------------------------------

function buildLaundryItems(): LaundryItem[] {
	const items: LaundryItem[] = [];
	const now = new Date().toISOString();

	for (const client of initialClients) {
		for (const [cat, names] of Object.entries(CATEGORY_ITEMS) as [
			Exclude<LaundryCategory, 'all'>,
			LaundryItemName[]
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
// 초기 데이터: 출고 기록 (샘플)
// ------------------------------------------------------------------

const initialShipments: Shipment[] = [
	{
		id: 'ship-001',
		clientId: 'client-001',
		items: [
			{
				laundryItemId: 'client-001__대타올',
				itemName: '대타올',
				category: 'towel',
				quantity: 30
			},
			{
				laundryItemId: 'client-001__시트D',
				itemName: '시트D',
				category: 'sheet',
				quantity: 20
			}
		],
		driverId: 'driver-001',
		memo: '오전 배송',
		shippedAt: '2025-06-01T08:00:00.000Z',
		createdAt: '2025-06-01T07:30:00.000Z'
	},
	{
		id: 'ship-002',
		clientId: 'client-002',
		items: [
			{
				laundryItemId: 'client-002__중타올',
				itemName: '중타올',
				category: 'towel',
				quantity: 15
			},
			{
				laundryItemId: 'client-002__베개커버',
				itemName: '베개커버',
				category: 'sheet',
				quantity: 25
			}
		],
		driverId: 'driver-002',
		shippedAt: '2025-06-03T10:00:00.000Z',
		createdAt: '2025-06-03T09:45:00.000Z'
	},
	{
		id: 'ship-003',
		clientId: 'client-003',
		items: [
			{
				laundryItemId: 'client-003__상의',
				itemName: '상의',
				category: 'uniform',
				quantity: 10
			},
			{
				laundryItemId: 'client-003__하의',
				itemName: '하의',
				category: 'uniform',
				quantity: 10
			}
		],
		driverId: 'driver-003',
		memo: '유니폼 정기 배송',
		shippedAt: '2025-06-05T14:00:00.000Z',
		createdAt: '2025-06-05T13:30:00.000Z'
	}
];

// ------------------------------------------------------------------
// 스토어 클래스 (Svelte 5 Runes)
// ------------------------------------------------------------------

class LaundryStore {
	// ── 상태 ──────────────────────────────────────────────────────
	clients = $state<Client[]>(initialClients);
	laundryItems = $state<LaundryItem[]>(buildLaundryItems());
	shipments = $state<Shipment[]>(initialShipments);
	drivers = $state<Driver[]>(initialDrivers);
	selectedClientId = $state<string | null>(initialClients[0]?.id ?? null);
	selectedTheme = $state<ThemeOption>('a');

	// ── 파생 상태 ($derived) ───────────────────────────────────────

	/** 현재 선택된 거래처 객체 */
	selectedClient = $derived(
		this.clients.find((c) => c.id === this.selectedClientId) ?? null
	);

	/** 현재 선택된 거래처의 세탁 품목 */
	selectedClientItems = $derived(
		this.laundryItems.filter((item) => item.clientId === this.selectedClientId)
	);

	/** 전체 거래처 수 */
	clientCount = $derived(this.clients.length);

	/** 전체 출고 건수 */
	shipmentCount = $derived(this.shipments.length);

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

		// 새 거래처의 세탁 품목 자동 생성
		const now = new Date().toISOString();
		const newItems: LaundryItem[] = [];
		for (const [cat, names] of Object.entries(CATEGORY_ITEMS) as [
			Exclude<LaundryCategory, 'all'>,
			LaundryItemName[]
		][]) {
			for (const name of names) {
				newItems.push({
					id: `${newClient.id}__${name}`,
					clientId: newClient.id,
					category: cat,
					name,
					counts: { received: 0, washing: 0, completed: 0, defect: 0, stock: 0, shipped: 0 },
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
		if (this.selectedClientId === id) {
			this.selectedClientId = this.clients[0]?.id ?? null;
		}
	}

	// ------------------------------------------------------------------
	// 세탁 품목 업데이트
	// ------------------------------------------------------------------

	/**
	 * 특정 거래처의 특정 품목 상태 수량 업데이트
	 * @param clientId  거래처 ID
	 * @param itemId    품목 ID (예: "client-001__대타올")
	 * @param field     상태 필드 (LaundryItemStatus)
	 * @param value     새 수량
	 */
	updateLaundryItem(
		clientId: string,
		itemId: string,
		field: LaundryItemStatus,
		value: number
	): void {
		this.laundryItems = this.laundryItems.map((item) => {
			if (item.id === itemId && item.clientId === clientId) {
				return {
					...item,
					counts: { ...item.counts, [field]: Math.max(0, value) },
					updatedAt: new Date().toISOString()
				};
			}
			return item;
		});
	}

	/**
	 * 특정 품목의 여러 상태 수량 일괄 업데이트
	 */
	updateLaundryItemCounts(
		clientId: string,
		itemId: string,
		counts: Partial<LaundryStatusCounts>
	): void {
		this.laundryItems = this.laundryItems.map((item) => {
			if (item.id === itemId && item.clientId === clientId) {
				return {
					...item,
					counts: { ...item.counts, ...counts },
					updatedAt: new Date().toISOString()
				};
			}
			return item;
		});
	}

	// ------------------------------------------------------------------
	// 출고 기록 CRUD
	// ------------------------------------------------------------------

	addShipment(
		shipment: Omit<Shipment, 'id' | 'createdAt'>
	): Shipment {
		const newShipment: Shipment = {
			...shipment,
			id: `ship-${generateId()}`,
			createdAt: new Date().toISOString()
		};
		this.shipments = [newShipment, ...this.shipments];
		return newShipment;
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
		const newDriver: Driver = {
			...driver,
			id: `driver-${generateId()}`
		};
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
	// 조회 헬퍼
	// ------------------------------------------------------------------

	/**
	 * 특정 거래처의 카테고리별 품목 목록 반환
	 * category = 'all' 이면 전체 반환
	 */
	getItemsByCategory(clientId: string, category: LaundryCategory): LaundryItem[] {
		const items = this.laundryItems.filter((item) => item.clientId === clientId);
		if (category === 'all') return items;
		return items.filter((item) => item.category === category);
	}

	/**
	 * 특정 거래처의 날짜 범위 내 출고 기록 반환
	 * @param clientId  거래처 ID (null 이면 전체 거래처)
	 * @param from      시작 ISO 8601 문자열
	 * @param to        종료 ISO 8601 문자열
	 */
	getShipmentsByDateRange(
		clientId: string | null,
		from: string,
		to: string
	): Shipment[] {
		const fromTs = new Date(from).getTime();
		const toTs = new Date(to).getTime();

		return this.shipments.filter((s) => {
			const ts = new Date(s.shippedAt).getTime();
			const inRange = ts >= fromTs && ts <= toTs;
			const matchClient = clientId === null || s.clientId === clientId;
			return inRange && matchClient;
		});
	}

	/**
	 * 특정 거래처의 카테고리별 상태 합산 반환
	 */
	getCategorySummary(
		clientId: string,
		category: LaundryCategory
	): LaundryStatusCounts {
		const items = this.getItemsByCategory(clientId, category);
		const totals: LaundryStatusCounts = {
			received: 0,
			washing: 0,
			completed: 0,
			defect: 0,
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

	/**
	 * 배송기사 ID로 기사 정보 반환
	 */
	getDriverById(id: string): Driver | undefined {
		return this.drivers.find((d) => d.id === id);
	}

	/**
	 * 거래처 ID로 거래처 정보 반환
	 */
	getClientById(id: string): Client | undefined {
		return this.clients.find((c) => c.id === id);
	}

	// ------------------------------------------------------------------
	// 선택 상태 변경
	// ------------------------------------------------------------------

	selectClient(clientId: string | null): void {
		this.selectedClientId = clientId;
	}

	selectTheme(theme: ThemeOption): void {
		this.selectedTheme = theme;
	}
}

// ------------------------------------------------------------------
// 싱글톤 스토어 인스턴스 export
// ------------------------------------------------------------------

export const store = new LaundryStore();