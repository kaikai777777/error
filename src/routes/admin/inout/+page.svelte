<script lang="ts">
	import { store } from '$lib/data/store.svelte';
	import type { LaundryCategory } from '$lib/data/types.js';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	// ── 탭 상태 ──────────────────────────────────────────────────────
	let activeTab = $state<'status' | 'history'>('status');

	// ── 탭1: 세탁완료 현황 필터 ──────────────────────────────────────
	let statusClientFilter = $state<string>('all');
	let statusCategoryFilter = $state<Exclude<LaundryCategory, 'all'> | 'all'>('all');

	const categoryButtons: Array<{ key: Exclude<LaundryCategory, 'all'> | 'all'; label: string }> = [
		{ key: 'all', label: '전체' },
		{ key: 'towel', label: '타올' },
		{ key: 'sheet', label: '시트' },
		{ key: 'uniform', label: '유니폼' }
	];

	const categoryBadge: Record<Exclude<LaundryCategory, 'all'>, string> = {
		towel: 'bg-sky-100 text-sky-700',
		sheet: 'bg-indigo-100 text-indigo-700',
		uniform: 'bg-amber-100 text-amber-700'
	};

	const categoryLabel: Record<Exclude<LaundryCategory, 'all'>, string> = {
		towel: '타올',
		sheet: '시트',
		uniform: '유니폼'
	};

	// 필터 적용 + 세탁완료>0 우선 정렬
	const filteredStatusItems = $derived.by(() => {
		let items = store.laundryItems.slice();
		if (statusClientFilter !== 'all') {
			items = items.filter((i) => i.clientId === statusClientFilter);
		}
		if (statusCategoryFilter !== 'all') {
			items = items.filter((i) => i.category === statusCategoryFilter);
		}
		// 세탁완료 > 0 우선, 그 다음 clientId, category, name 순
		items.sort((a, b) => {
			const aHas = a.counts.completed > 0 ? 0 : 1;
			const bHas = b.counts.completed > 0 ? 0 : 1;
			if (aHas !== bHas) return aHas - bHas;
			if (a.clientId !== b.clientId) return a.clientId.localeCompare(b.clientId);
			if (a.category !== b.category) return a.category.localeCompare(b.category);
			return a.name.localeCompare(b.name);
		});
		return items;
	});

	// 거래처별 소계 계산 (clientId → { completed, stock })
	const clientSubtotals = $derived.by(() => {
		const map = new SvelteMap<string, { completed: number; stock: number }>();
		for (const item of filteredStatusItems) {
			const cur = map.get(item.clientId) ?? { completed: 0, stock: 0 };
			cur.completed += item.counts.completed;
			cur.stock += item.counts.stock;
			map.set(item.clientId, cur);
		}
		return map;
	});

	// 소계 행을 삽입하기 위해 (clientId 전환점 체크용)
	function isLastOfClient(idx: number): boolean {
		const items = filteredStatusItems;
		if (idx === items.length - 1) return true;
		return items[idx].clientId !== items[idx + 1].clientId;
	}

	// ── 탭2: 출고 이력 ──────────────────────────────────────────────

	function todayStr(): string {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	function firstDayOfMonth(): string {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
	}

	let fromDate = $state(firstDayOfMonth());
	let toDate = $state(todayStr());
	let historyClientFilter = $state<string>('all');

	// 조회 결과 (버튼 클릭 시 갱신)
	let queriedFrom = $state(firstDayOfMonth());
	let queriedTo = $state(todayStr());
	let queriedClientId = $state<string | null>(null);

	let expandedShipmentIds = new SvelteSet<string>();

	function doQuery() {
		queriedFrom = fromDate;
		queriedTo = toDate;
		queriedClientId = historyClientFilter === 'all' ? null : historyClientFilter;
		expandedShipmentIds.clear();
	}

	const queryResults = $derived(
		store.getShipmentsByDateRange(queriedClientId, queriedFrom, queriedTo + 'T23:59:59')
			.slice()
			.sort((a, b) => new Date(b.shippedAt).getTime() - new Date(a.shippedAt).getTime())
	);

	// 요약 카드
	const summaryTotalCount = $derived(queryResults.length);
	const summaryTotalQty = $derived(
		queryResults.reduce((s, sh) => s + sh.items.reduce((ss, i) => ss + i.quantity, 0), 0)
	);
	const summaryClientCount = $derived(new Set(queryResults.map((s) => s.clientId)).size);

	function toggleExpand(id: string) {
		if (expandedShipmentIds.has(id)) expandedShipmentIds.delete(id);
		else expandedShipmentIds.add(id);
	}

	function formatDateTime(dateStr: string): string {
		const d = new Date(dateStr);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function shipmentSummary(ship: (typeof store.shipments)[0]): string {
		return ship.items.map((i) => `${i.itemName} ${i.quantity}개`).join(', ');
	}

	function shipmentTotalQty(ship: (typeof store.shipments)[0]): number {
		return ship.items.reduce((s, i) => s + i.quantity, 0);
	}
</script>

<svelte:head>
	<title>입출고 관리 — 세탁 관리자</title>
</svelte:head>

<div class="space-y-6 px-8 py-6">
	<!-- 헤더 -->
	<div class="flex items-end justify-between">
		<h2 class="text-2xl font-bold text-slate-800">입출고 관리</h2>
	</div>

	<!-- 탭 -->
	<div class="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
		<button
			class="rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-150
				{activeTab === 'status'
				? 'bg-sky-600 text-white shadow-sm'
				: 'text-slate-500 hover:text-slate-700'}"
			onclick={() => (activeTab = 'status')}
		>
			현재 세탁완료 현황
		</button>
		<button
			class="rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-150
				{activeTab === 'history'
				? 'bg-sky-600 text-white shadow-sm'
				: 'text-slate-500 hover:text-slate-700'}"
			onclick={() => (activeTab = 'history')}
		>
			출고 이력
		</button>
	</div>

	<!-- ══════════════════════════════════════════════════════ -->
	<!-- 탭 1: 현재 세탁완료 현황                               -->
	<!-- ══════════════════════════════════════════════════════ -->
	{#if activeTab === 'status'}
		<!-- 필터 -->
		<div class="flex flex-wrap items-center gap-3">
			<!-- 거래처 select -->
			<select
				bind:value={statusClientFilter}
				class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-300"
			>
				<option value="all">전체 거래처</option>
				{#each store.clients as client (client.id)}
					<option value={client.id}>{client.name}</option>
				{/each}
			</select>

			<!-- 카테고리 버튼 -->
			<div class="flex gap-1">
				{#each categoryButtons as btn (btn.key)}
					<button
						class="rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-150
							{statusCategoryFilter === btn.key
							? 'border-sky-500 bg-sky-600 text-white'
							: 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-600'}"
						onclick={() => (statusCategoryFilter = btn.key)}
					>
						{btn.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- 테이블 -->
		<div class="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
			{#if filteredStatusItems.length === 0}
				<p class="px-5 py-10 text-center text-sm text-slate-400">
					조건에 맞는 품목이 없습니다.
				</p>
			{:else}
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-100 bg-slate-50">
							<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
								거래처
							</th>
							<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
								카테고리
							</th>
							<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
								품목명
							</th>
							<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
								세탁완료
							</th>
							<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
								재고
							</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredStatusItems as item, idx (item.id)}
							<tr
								class="border-b border-slate-50 last:border-0 transition-colors
									{item.counts.completed > 0 ? 'hover:bg-sky-50' : 'hover:bg-slate-50 opacity-60'}"
							>
								<td class="px-5 py-3 font-medium text-slate-700">
									{store.getClientById(item.clientId)?.name ?? '—'}
								</td>
								<td class="px-5 py-3">
									<span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {categoryBadge[item.category]}">
										{categoryLabel[item.category]}
									</span>
								</td>
								<td class="px-5 py-3 text-slate-700">{item.name}</td>
								<td class="px-5 py-3 text-right font-bold {item.counts.completed > 0 ? 'text-sky-600' : 'text-slate-400'}">
									{item.counts.completed.toLocaleString()}
								</td>
								<td class="px-5 py-3 text-right text-slate-600">
									{item.counts.stock.toLocaleString()}
								</td>
							</tr>

							<!-- 소계 행 (거래처가 바뀔 때) -->
							{#if isLastOfClient(idx)}
								{@const sub = clientSubtotals.get(item.clientId)}
								<tr class="border-b border-slate-200 bg-slate-50">
									<td colspan="3" class="px-5 py-2.5 text-right text-xs font-bold text-slate-500">
										{store.getClientById(item.clientId)?.name ?? '—'} 소계
									</td>
									<td class="px-5 py-2.5 text-right text-xs font-bold text-sky-600">
										{(sub?.completed ?? 0).toLocaleString()}
									</td>
									<td class="px-5 py-2.5 text-right text-xs font-bold text-slate-600">
										{(sub?.stock ?? 0).toLocaleString()}
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}

	<!-- ══════════════════════════════════════════════════════ -->
	<!-- 탭 2: 출고 이력                                        -->
	<!-- ══════════════════════════════════════════════════════ -->
	{#if activeTab === 'history'}
		<!-- 필터 -->
		<div class="flex flex-wrap items-end gap-3">
			<div class="flex flex-col gap-1">
				<label for="history-from" class="text-xs font-semibold text-slate-500">시작일</label>
				<input
					id="history-from"
					type="date"
					bind:value={fromDate}
					class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-300"
				/>
			</div>
			<span class="mb-2.5 text-slate-400">~</span>
			<div class="flex flex-col gap-1">
				<label for="history-to" class="text-xs font-semibold text-slate-500">종료일</label>
				<input
					id="history-to"
					type="date"
					bind:value={toDate}
					class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-300"
				/>
			</div>
			<div class="flex flex-col gap-1">
				<label for="history-client" class="text-xs font-semibold text-slate-500">거래처</label>
				<select
					id="history-client"
					bind:value={historyClientFilter}
					class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-300"
				>
					<option value="all">전체 거래처</option>
					{#each store.clients as client (client.id)}
						<option value={client.id}>{client.name}</option>
					{/each}
				</select>
			</div>
			<button
				class="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700 transition-colors mb-0.5"
				onclick={doQuery}
			>
				조회
			</button>
		</div>

		<!-- 요약 카드 3개 -->
		<div class="grid grid-cols-3 gap-4">
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<p class="text-sm text-slate-500">총 출고 건수</p>
				<p class="mt-1 text-3xl font-black text-slate-800">{summaryTotalCount}</p>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<p class="text-sm text-slate-500">총 수량</p>
				<p class="mt-1 text-3xl font-black text-sky-600">{summaryTotalQty.toLocaleString()}</p>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<p class="text-sm text-slate-500">관련 거래처 수</p>
				<p class="mt-1 text-3xl font-black text-slate-800">{summaryClientCount}</p>
			</div>
		</div>

		<!-- 결과 테이블 -->
		<div class="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
			{#if queryResults.length === 0}
				<p class="px-5 py-12 text-center text-sm text-slate-400">
					해당 기간 출고 이력이 없습니다.
				</p>
			{:else}
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-100 bg-slate-50">
							<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
								출고일시
							</th>
							<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
								거래처
							</th>
							<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
								품목 내역
							</th>
							<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
								총 수량
							</th>
							<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
								메모
							</th>
						</tr>
					</thead>
					<tbody>
						{#each queryResults as ship (ship.id)}
							<!-- 메인 행 -->
							<tr
								class="cursor-pointer border-b border-slate-50 transition-colors hover:bg-sky-50
									{expandedShipmentIds.has(ship.id) ? 'bg-sky-50' : ''}"
								onclick={() => toggleExpand(ship.id)}
							>
								<td class="px-5 py-3 text-slate-600 whitespace-nowrap">
									{formatDateTime(ship.shippedAt)}
								</td>
								<td class="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">
									{store.getClientById(ship.clientId)?.name ?? '—'}
								</td>
								<td class="px-5 py-3 text-slate-600 max-w-xs">
									<span class="block overflow-hidden text-ellipsis whitespace-nowrap">
										{shipmentSummary(ship)}
									</span>
								</td>
								<td class="px-5 py-3 text-right font-bold text-slate-800">
									{shipmentTotalQty(ship).toLocaleString()}
								</td>
								<td class="px-5 py-3 text-slate-500 max-w-[140px]">
									<span class="block overflow-hidden text-ellipsis whitespace-nowrap text-xs">
										{ship.memo ?? '—'}
									</span>
								</td>
							</tr>

							<!-- 상세 펼침 행 -->
							{#if expandedShipmentIds.has(ship.id)}
								<tr class="border-b border-slate-100 bg-sky-50/60">
									<td colspan="5" class="px-8 py-4">
										<div class="rounded-xl border border-sky-100 bg-white p-4">
											<p class="mb-3 text-xs font-bold uppercase tracking-wide text-sky-600">
												출고 상세 내역
											</p>
											<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
												{#each ship.items as item (item.laundryItemId)}
													<div class="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
														<div class="flex items-center gap-2">
															<span class="rounded-full px-2 py-0.5 text-[11px] font-semibold {categoryBadge[item.category]}">
																{categoryLabel[item.category]}
															</span>
															<span class="text-sm text-slate-700">{item.itemName}</span>
														</div>
														<span class="ml-2 font-bold text-sky-700">{item.quantity.toLocaleString()}개</span>
													</div>
												{/each}
											</div>
											{#if ship.memo}
												<p class="mt-3 text-xs text-slate-500">
													<span class="font-semibold">메모:</span> {ship.memo}
												</p>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}
</div>