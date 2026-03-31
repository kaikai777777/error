<script lang="ts">
	import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
	import type { LaundryCategory } from '$lib/data/types.js';
	import { SvelteMap } from 'svelte/reactivity';

	// ── 기간 선택 ──────────────────────────────────────────────────
	type PeriodMode = 'daily' | 'monthly' | 'yearly';
	let periodMode = $state<PeriodMode>('yearly');

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

	let dailyFrom = $state(firstDayOfMonth());
	let dailyTo   = $state(todayStr());

	let monthlyValue = $state((() => {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
	})());

	let yearlyValue = $state(new Date().getFullYear());

	let queriedFrom = $state(`${new Date().getFullYear()}-01-01`);
	let queriedTo   = $state(`${new Date().getFullYear()}-12-31`);
	let queriedMode = $state<PeriodMode>('yearly');

	function doQuery() {
		if (periodMode === 'daily') {
			queriedFrom = dailyFrom;
			queriedTo   = dailyTo;
		} else if (periodMode === 'monthly') {
			const [y, m] = monthlyValue.split('-').map(Number);
			const lastDay = new Date(y, m, 0).getDate();
			const pad = (n: number) => String(n).padStart(2, '0');
			queriedFrom = `${y}-${pad(m)}-01`;
			queriedTo   = `${y}-${pad(m)}-${pad(lastDay)}`;
		} else {
			queriedFrom = `${yearlyValue}-01-01`;
			queriedTo   = `${yearlyValue}-12-31`;
		}
		queriedMode = periodMode;
	}
	doQuery();

	const periodLabel = $derived(
		queriedMode === 'daily'   ? `${queriedFrom} ~ ${queriedTo}` :
		queriedMode === 'monthly' ? queriedFrom.slice(0, 7) :
		                            queriedFrom.slice(0, 4) + '년'
	);

	// ── 거래처 필터 ────────────────────────────────────────────────
	let filterClientId = $state<string | null>(null);
	const filterClient = $derived(
		filterClientId ? (store.clients.find((c) => c.id === filterClientId) ?? null) : null
	);

	// ── 탭 ────────────────────────────────────────────────────────
	type StatsTab = 'shipout' | 'completed';
	let activeTab = $state<StatsTab>('shipout');

	// ── 색상/뱃지 상수 ─────────────────────────────────────────────
	const categoryColors: Record<Exclude<LaundryCategory, 'all'>, string> = {
		towel:   'bg-sky-400',
		sheet:   'bg-indigo-400',
		uniform: 'bg-amber-400',
	};
	const categoryBadge: Record<Exclude<LaundryCategory, 'all'>, string> = {
		towel:   'bg-sky-100 text-sky-700',
		sheet:   'bg-indigo-100 text-indigo-700',
		uniform: 'bg-amber-100 text-amber-700',
	};

	// ══════════════════════════════════════════════════════════════
	// 출고 통계 derived
	// ══════════════════════════════════════════════════════════════
	const allStats = $derived(store.getStatsByDateRange(queriedFrom, queriedTo));

	const stats = $derived.by(() => {
		if (!filterClientId) return allStats;

		const fromTs = new Date(queriedFrom + 'T00:00:00.000Z').getTime();
		const toTs   = new Date(queriedTo   + 'T23:59:59.999Z').getTime();
		const inRange = store.shipments.filter((s) => {
			const ts = new Date(s.shippedAt).getTime();
			return ts >= fromTs && ts <= toTs && s.clientId === filterClientId;
		});

		const catMap  = new Map<string, { shipmentCount: number; totalQuantity: number }>();
		const itemMap = new Map<string, { itemName: string; category: Exclude<LaundryCategory,'all'>; totalQuantity: number }>();
		let totalQty  = 0;

		for (const ship of inRange) {
			for (const item of ship.items) {
				totalQty += item.quantity;
				const cat = item.category;
				if (!catMap.has(cat)) catMap.set(cat, { shipmentCount: 0, totalQuantity: 0 });
				const cs = catMap.get(cat)!;
				cs.shipmentCount++;
				cs.totalQuantity += item.quantity;

				const key = `${cat}__${item.itemName}`;
				if (!itemMap.has(key)) itemMap.set(key, { itemName: item.itemName, category: cat as Exclude<LaundryCategory,'all'>, totalQuantity: 0 });
				itemMap.get(key)!.totalQuantity += item.quantity;
			}
		}

		const clientRow = allStats.byClient.find((c) => c.clientId === filterClientId);
		return {
			shipmentCount: inRange.length,
			totalQuantity: totalQty,
			byClient:   clientRow ? [clientRow] : [],
			byCategory: [...catMap.entries()].map(([category, s]) => ({ category: category as Exclude<LaundryCategory,'all'>, ...s })),
			byItem:     [...itemMap.values()],
		};
	});

	const kpiCount   = $derived(stats.shipmentCount);
	const kpiQty     = $derived(stats.totalQuantity);
	const kpiClients = $derived(filterClientId ? 1 : allStats.byClient.length);

	const clientMaxQty = $derived.by(() => {
		const vals = stats.byClient.map((c) => c.totalQuantity);
		return vals.length > 0 ? Math.max(...vals, 1) : 1;
	});
	const categoryTotal = $derived(stats.byCategory.reduce((s, c) => s + c.totalQuantity, 0));
	const topItems = $derived([...stats.byItem].sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 10));

	// ── 월별 출고 추이 차트 ────────────────────────────────────────
	const showMonthlyChart = $derived.by(() => {
		if (queriedMode === 'monthly' || queriedMode === 'yearly') return true;
		const diff = (new Date(queriedTo).getTime() - new Date(queriedFrom).getTime()) / 86400000;
		return diff >= 30;
	});

	const monthlyChartData = $derived.by(() => {
		const map    = new SvelteMap<string, number>();
		const fromTs = new Date(queriedFrom + 'T00:00:00').getTime();
		const toTs   = new Date(queriedTo   + 'T23:59:59').getTime();
		for (const ship of store.shipments) {
			if (filterClientId && ship.clientId !== filterClientId) continue;
			const d  = new Date(ship.shippedAt);
			const ts = d.getTime();
			if (ts < fromTs || ts > toTs) continue;
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			const qty = ship.items.reduce((s, i) => s + i.quantity, 0);
			map.set(key, (map.get(key) ?? 0) + qty);
		}
		return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	});

	const SVG_W = 600; const SVG_H = 200;
	const PAD_LEFT = 50; const PAD_RIGHT = 20; const PAD_TOP = 20; const PAD_BOTTOM = 40;

	const chartPoints = $derived.by(() => {
		const data = monthlyChartData;
		type Pt = { x: number; y: number; val: number; label: string };
		if (data.length === 0) return { points: [] as Pt[], path: '', areaPath: '', maxVal: 0 };
		const maxVal = Math.max(...data.map(([, v]) => v), 1);
		const n      = data.length;
		const xStep  = n > 1 ? (SVG_W - PAD_LEFT - PAD_RIGHT) / (n - 1) : (SVG_W - PAD_LEFT - PAD_RIGHT) / 2;
		const points: Pt[] = data.map(([label, val], i) => ({
			x: PAD_LEFT + (n > 1 ? i * xStep : xStep),
			y: PAD_TOP + (1 - val / maxVal) * (SVG_H - PAD_TOP - PAD_BOTTOM),
			val, label,
		}));
		const path     = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
		const areaPath = `${path} L ${points[points.length-1].x.toFixed(1)} ${SVG_H-PAD_BOTTOM} L ${points[0].x.toFixed(1)} ${SVG_H-PAD_BOTTOM} Z`;
		return { points, path, areaPath, maxVal };
	});

	const yTicks = $derived.by(() => {
		const mv = chartPoints.maxVal;
		if (mv === 0) return [] as number[];
		const step = Math.ceil(mv / 4);
		return [0, step, step*2, step*3, step*4].filter((v) => v <= mv + step);
	});

	// ══════════════════════════════════════════════════════════════
	// 세탁완료 현황 derived  (버그 수정: filter(total>0) 제거)
	// ══════════════════════════════════════════════════════════════
	const filteredLaundryItems = $derived(
		filterClientId
			? store.laundryItems.filter((i) => i.clientId === filterClientId)
			: store.laundryItems
	);

	// 거래처별 완료 현황 — 전체 클라이언트 목록 기준, total=0도 포함해 렌더 후 처리
	const completedByClient = $derived.by(() => {
		const clientList = filterClientId
			? store.clients.filter((c) => c.id === filterClientId)
			: store.clients;
		return clientList
			.map((c) => {
				const items = store.laundryItems.filter((i) => i.clientId === c.id);
				const towel   = items.filter((i) => i.category === 'towel'  ).reduce((s, i) => s + i.counts.completed, 0);
				const sheet   = items.filter((i) => i.category === 'sheet'  ).reduce((s, i) => s + i.counts.completed, 0);
				const uniform = items.filter((i) => i.category === 'uniform').reduce((s, i) => s + i.counts.completed, 0);
				const total   = towel + sheet + uniform;
				return { clientId: c.id, clientName: c.name, clientType: c.type, total, byCategory: { towel, sheet, uniform } };
			})
			.filter((r) => r.total > 0)
			.sort((a, b) => b.total - a.total);
	});

	const completedByCategory = $derived.by(() => {
		const towel   = filteredLaundryItems.filter((i) => i.category === 'towel'  ).reduce((s, i) => s + i.counts.completed, 0);
		const sheet   = filteredLaundryItems.filter((i) => i.category === 'sheet'  ).reduce((s, i) => s + i.counts.completed, 0);
		const uniform = filteredLaundryItems.filter((i) => i.category === 'uniform').reduce((s, i) => s + i.counts.completed, 0);
		return ([
			{ category: 'towel'   as const, total: towel   },
			{ category: 'sheet'   as const, total: sheet   },
			{ category: 'uniform' as const, total: uniform },
		] as const).filter((r) => r.total > 0);
	});

	const completedTotal      = $derived(filteredLaundryItems.reduce((s, i) => s + i.counts.completed, 0));
	const completedMaxClient  = $derived(Math.max(...completedByClient.map((r) => r.total), 1));
	const completedItemCount  = $derived(filteredLaundryItems.filter((i) => i.counts.completed > 0).length);

	// 거래처 개별 선택 시 — 품목별 상세
	const completedItemsForClient = $derived.by(() => {
		if (!filterClientId) return [] as { name: string; category: Exclude<LaundryCategory,'all'>; completed: number }[];
		return filteredLaundryItems
			.map((i) => ({ name: i.name, category: i.category, completed: i.counts.completed }))
			.filter((i) => i.completed > 0)
			.sort((a, b) => b.completed - a.completed);
	});
	const completedItemMax = $derived(Math.max(...completedItemsForClient.map((i) => i.completed), 1));

	// 전체 모드 Top 10
	const completedTopItems = $derived(
		filteredLaundryItems
			.map((i) => ({ name: i.name, category: i.category, completed: i.counts.completed }))
			.filter((i) => i.completed > 0)
			.sort((a, b) => b.completed - a.completed)
			.slice(0, 10)
	);
</script>

<svelte:head>
	<title>통계 — 세탁 관리자</title>
</svelte:head>

<div class="space-y-5 px-8 py-6">

	<!-- ── 헤더 + 탭 버튼 ─────────────────────────────────────────── -->
	<div class="flex items-center justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold text-slate-800">통계</h2>
			<p class="mt-0.5 text-sm text-slate-400">
				{#if filterClient}
					<span class="font-semibold text-indigo-600">{filterClient.name}</span> 거래처 통계
				{:else}
					전체 거래처 통계
				{/if}
			</p>
		</div>
		<!-- 탭 -->
		<div class="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
			<button
				type="button"
				class="rounded-lg px-4 py-1.5 text-sm font-semibold transition-all
					{activeTab === 'shipout' ? 'bg-sky-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}"
				onclick={() => { activeTab = 'shipout'; }}
			>📦 출고 통계</button>
			<button
				type="button"
				class="rounded-lg px-4 py-1.5 text-sm font-semibold transition-all
					{activeTab === 'completed' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}"
				onclick={() => { activeTab = 'completed'; }}
			>✅ 세탁완료 현황</button>
		</div>
	</div>

	<!-- ── 거래처 필터 — 드롭다운 ─────────────────────────────────── -->
	<div class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-3 shadow-sm">
		<span class="shrink-0 text-[11px] font-bold uppercase tracking-widest text-slate-400">거래처</span>
		<div class="relative">
			<select
				class="appearance-none cursor-pointer rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100
					{filterClientId ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : ''}"
				value={filterClientId ?? ''}
				onchange={(e) => {
					const v = (e.currentTarget as HTMLSelectElement).value;
					filterClientId = v === '' ? null : v;
				}}
			>
				<option value="">전체 거래처</option>
				{#each store.clients as c (c.id)}
					<option value={c.id}>{c.name}</option>
				{/each}
			</select>
			<!-- 드롭다운 화살표 아이콘 -->
			<div class="pointer-events-none absolute inset-y-0 right-2 flex items-center">
				<svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
				</svg>
			</div>
		</div>
		<!-- 선택된 거래처 표시 배지 -->
		{#if filterClient}
			<span class="flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
				<span class="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
				{filterClient.name} 선택 중
				<button
					type="button"
					class="ml-0.5 text-indigo-400 hover:text-indigo-700"
					onclick={() => { filterClientId = null; }}
					aria-label="선택 해제"
				>✕</button>
			</span>
		{/if}
	</div>

	<!-- ════════════════════════════════════════════════════════════ -->
	<!-- 출고 통계 탭                                                  -->
	<!-- ════════════════════════════════════════════════════════════ -->
	{#if activeTab === 'shipout'}

		<!-- 기간 선택 카드 -->
		<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="flex flex-wrap items-end gap-4">
				<div class="flex gap-1 rounded-xl border border-slate-200 p-1">
					{#each ([['daily','일별'],['monthly','월별'],['yearly','연별']] as const) as [mode, label] (mode)}
						<button
							type="button"
							class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all
								{periodMode === mode ? 'bg-sky-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}"
							onclick={() => (periodMode = mode)}
						>{label}</button>
					{/each}
				</div>

				{#if periodMode === 'daily'}
					<div class="flex items-end gap-2">
						<div class="flex flex-col gap-1">
							<label for="s-from" class="text-xs font-semibold text-slate-500">시작일</label>
							<input id="s-from" type="date" bind:value={dailyFrom}
								class="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none" />
						</div>
						<span class="mb-2.5 text-slate-400">~</span>
						<div class="flex flex-col gap-1">
							<label for="s-to" class="text-xs font-semibold text-slate-500">종료일</label>
							<input id="s-to" type="date" bind:value={dailyTo}
								class="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none" />
						</div>
					</div>
				{:else if periodMode === 'monthly'}
					<div class="flex flex-col gap-1">
						<label for="s-month" class="text-xs font-semibold text-slate-500">월 선택</label>
						<input id="s-month" type="month" bind:value={monthlyValue}
							class="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none" />
					</div>
				{:else}
					<div class="flex flex-col gap-1">
						<label for="s-year" class="text-xs font-semibold text-slate-500">연도 선택</label>
						<input id="s-year" type="number" bind:value={yearlyValue} min="2020" max="2099"
							class="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none" />
					</div>
				{/if}

				<button
					type="button"
					class="rounded-xl bg-sky-500 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-sky-600 active:scale-95"
					onclick={doQuery}
				>조회</button>
				<span class="mb-0.5 text-xs text-slate-400">
					조회 기간: <span class="font-semibold text-slate-600">{periodLabel}</span>
					{#if filterClient}<span class="ml-2 font-semibold text-indigo-600">· {filterClient.name}</span>{/if}
				</span>
			</div>
		</div>

		<!-- KPI 3개 -->
		<div class="grid grid-cols-3 gap-4">
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<div class="flex items-start justify-between">
					<div>
						<p class="text-sm text-slate-500">총 출고 건수</p>
						<p class="mt-1 text-3xl font-black text-slate-800">{kpiCount.toLocaleString()}</p>
					</div>
					<div class="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-xl">📦</div>
				</div>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<div class="flex items-start justify-between">
					<div>
						<p class="text-sm text-slate-500">총 출고 수량</p>
						<p class="mt-1 text-3xl font-black text-sky-600">{kpiQty.toLocaleString()}</p>
					</div>
					<div class="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-xl">🧺</div>
				</div>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<div class="flex items-start justify-between">
					<div>
						<p class="text-sm text-slate-500">{filterClientId ? '선택 거래처' : '출고 거래처 수'}</p>
						<p class="mt-1 text-3xl font-black text-slate-800">
							{filterClientId ? (filterClient?.name ?? '') : kpiClients.toLocaleString()}
						</p>
					</div>
					<div class="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-xl">🏢</div>
				</div>
			</div>
		</div>

		<!-- 거래처별 출고 현황 (전체 모드만) -->
		{#if !filterClientId}
			<div class="rounded-2xl border border-slate-100 bg-white shadow-sm">
				<div class="border-b border-slate-100 px-5 py-4">
					<h3 class="text-base font-bold text-slate-800">거래처별 출고 현황</h3>
					<p class="mt-0.5 text-xs text-slate-400">{periodLabel} 기준</p>
				</div>
				{#if stats.byClient.length === 0}
					<p class="px-5 py-10 text-center text-sm text-slate-400">해당 기간 출고 데이터가 없습니다.</p>
				{:else}
					<div class="grid grid-cols-2 divide-x divide-slate-100">
						<div class="overflow-hidden">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-slate-100 bg-slate-50">
										<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">거래처</th>
										<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">출고 건수</th>
										<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">출고 수량</th>
									</tr>
								</thead>
								<tbody>
									{#each stats.byClient as row (row.clientId)}
										<tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50">
											<td class="px-5 py-3 font-medium text-slate-700">{row.clientName}</td>
											<td class="px-5 py-3 text-right text-slate-600">{row.shipmentCount}</td>
											<td class="px-5 py-3 text-right font-bold text-slate-800">{row.totalQuantity.toLocaleString()}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<div class="space-y-3 p-5">
							<p class="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">수량 기준 비교</p>
							{#each stats.byClient as row (row.clientId)}
								{@const ratio = row.totalQuantity / clientMaxQty}
								<div class="flex items-center gap-3">
									<span class="w-24 shrink-0 truncate text-right text-xs font-medium text-slate-600" title={row.clientName}>{row.clientName}</span>
									<div class="flex-1 overflow-hidden rounded-full bg-slate-100" style="height:10px;">
										<div class="h-full rounded-full bg-sky-400 transition-all duration-500"
											style="width:{Math.max(ratio*100, row.totalQuantity>0?2:0)}%"></div>
									</div>
									<span class="w-14 shrink-0 text-right text-xs font-bold text-slate-700">{row.totalQuantity.toLocaleString()}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- 카테고리별 출고 현황 -->
		<div class="rounded-2xl border border-slate-100 bg-white shadow-sm">
			<div class="border-b border-slate-100 px-5 py-4">
				<h3 class="text-base font-bold text-slate-800">카테고리별 출고 현황</h3>
				<p class="mt-0.5 text-xs text-slate-400">
					{periodLabel}{#if filterClient} · {filterClient.name}{/if}
				</p>
			</div>
			{#if stats.byCategory.length === 0}
				<p class="px-5 py-10 text-center text-sm text-slate-400">해당 기간 출고 데이터가 없습니다.</p>
			{:else}
				<div class="grid grid-cols-2 divide-x divide-slate-100">
					<div class="overflow-hidden">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-slate-100 bg-slate-50">
									<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">카테고리</th>
									<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">출고 건수</th>
									<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">출고 수량</th>
								</tr>
							</thead>
							<tbody>
								{#each stats.byCategory as row (row.category)}
									<tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50">
										<td class="px-5 py-3">
											<span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {categoryBadge[row.category]}">
												{CATEGORY_LABELS[row.category]}
											</span>
										</td>
										<td class="px-5 py-3 text-right text-slate-600">{row.shipmentCount}</td>
										<td class="px-5 py-3 text-right font-bold text-slate-800">{row.totalQuantity.toLocaleString()}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<div class="p-5">
						<p class="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">카테고리 비율</p>
						{#if categoryTotal > 0}
							<div class="mb-4 flex h-8 w-full overflow-hidden rounded-full">
								{#each stats.byCategory as row (row.category)}
									{@const pct = (row.totalQuantity / categoryTotal) * 100}
									<div class="{categoryColors[row.category]} flex items-center justify-center text-[11px] font-bold text-white"
										style="width:{pct}%" title="{CATEGORY_LABELS[row.category]}: {pct.toFixed(1)}%">
										{pct >= 10 ? pct.toFixed(0)+'%' : ''}
									</div>
								{/each}
							</div>
						{/if}
						<div class="space-y-2.5">
							{#each stats.byCategory as row (row.category)}
								{@const pct = categoryTotal > 0 ? (row.totalQuantity / categoryTotal) * 100 : 0}
								<div class="flex items-center gap-3">
									<div class="h-3 w-3 shrink-0 rounded-full {categoryColors[row.category]}"></div>
									<span class="w-16 text-sm font-medium text-slate-700">{CATEGORY_LABELS[row.category]}</span>
									<div class="flex-1 overflow-hidden rounded-full bg-slate-100" style="height:6px;">
										<div class="{categoryColors[row.category]} h-full rounded-full transition-all duration-500" style="width:{pct}%"></div>
									</div>
									<span class="w-12 shrink-0 text-right text-xs font-semibold text-slate-600">{pct.toFixed(1)}%</span>
									<span class="w-14 shrink-0 text-right text-xs text-slate-500">{row.totalQuantity.toLocaleString()}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- 품목별 출고 순위 Top 10 -->
		<div class="rounded-2xl border border-slate-100 bg-white shadow-sm">
			<div class="border-b border-slate-100 px-5 py-4">
				<h3 class="text-base font-bold text-slate-800">
					품목별 출고 순위 <span class="text-sm font-medium text-slate-400">Top 10</span>
				</h3>
				<p class="mt-0.5 text-xs text-slate-400">
					{periodLabel}{#if filterClient} · {filterClient.name}{/if}
				</p>
			</div>
			{#if topItems.length === 0}
				<p class="px-5 py-10 text-center text-sm text-slate-400">해당 기간 출고 데이터가 없습니다.</p>
			{:else}
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-100 bg-slate-50">
							<th class="w-12 px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">순위</th>
							<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">품목명</th>
							<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">카테고리</th>
							<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">출고 수량</th>
						</tr>
					</thead>
					<tbody>
						{#each topItems as item, idx (item.itemName + item.category)}
							<tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50">
								<td class="px-5 py-3 text-center">
									{#if idx === 0}<span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-white">1</span>
									{:else if idx === 1}<span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 text-xs font-black text-white">2</span>
									{:else if idx === 2}<span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-400 text-xs font-black text-white">3</span>
									{:else}<span class="text-sm text-slate-500">{idx+1}</span>
									{/if}
								</td>
								<td class="px-5 py-3 font-medium text-slate-700">{item.itemName}</td>
								<td class="px-5 py-3">
									<span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {categoryBadge[item.category]}">
										{CATEGORY_LABELS[item.category]}
									</span>
								</td>
								<td class="px-5 py-3 text-right font-bold text-slate-800">{item.totalQuantity.toLocaleString()}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>

		<!-- 월별 출고 추이 차트 -->
		{#if showMonthlyChart}
			{@const cp = chartPoints}
			<div class="rounded-2xl border border-slate-100 bg-white shadow-sm">
				<div class="border-b border-slate-100 px-5 py-4">
					<h3 class="text-base font-bold text-slate-800">
						월별 출고 추이
						{#if filterClient}<span class="text-sm font-medium text-slate-400">— {filterClient.name}</span>{/if}
					</h3>
				</div>
				{#if cp.points.length === 0}
					<p class="px-5 py-10 text-center text-sm text-slate-400">해당 기간 데이터가 없습니다.</p>
				{:else}
					<div class="p-5">
						<svg viewBox="0 0 {SVG_W} {SVG_H}" class="w-full" style="height:220px;" xmlns="http://www.w3.org/2000/svg">
							<defs>
								<linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%"   stop-color="#38bdf8" stop-opacity="0.3" />
									<stop offset="100%" stop-color="#38bdf8" stop-opacity="0.02" />
								</linearGradient>
							</defs>
							{#each yTicks as tick, i (i)}
								{@const yPos = PAD_TOP + (1 - tick/cp.maxVal) * (SVG_H-PAD_TOP-PAD_BOTTOM)}
								<line x1={PAD_LEFT} y1={yPos} x2={SVG_W-PAD_RIGHT} y2={yPos} stroke="#e2e8f0" stroke-width="1"/>
								<text x={PAD_LEFT-6} y={yPos+4} text-anchor="end" font-size="10" fill="#94a3b8">{tick.toLocaleString()}</text>
							{/each}
							<line x1={PAD_LEFT} y1={SVG_H-PAD_BOTTOM} x2={SVG_W-PAD_RIGHT} y2={SVG_H-PAD_BOTTOM} stroke="#cbd5e1" stroke-width="1"/>
							{#if cp.areaPath}<path d={cp.areaPath} fill="url(#areaGrad)"/>{/if}
							<path d={cp.path} fill="none" stroke="#0ea5e9" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
							{#each cp.points as pt, i (i)}
								<line x1={pt.x} y1={pt.y} x2={pt.x} y2={SVG_H-PAD_BOTTOM} stroke="#bae6fd" stroke-width="1" stroke-dasharray="3,3"/>
								<circle cx={pt.x} cy={pt.y} r="5" fill="white" stroke="#0ea5e9" stroke-width="2.5"/>
								<text x={pt.x} y={pt.y-10} text-anchor="middle" font-size="11" font-weight="700" fill="#0369a1">{pt.val.toLocaleString()}</text>
								<text x={pt.x} y={SVG_H-PAD_BOTTOM+16} text-anchor="middle" font-size="10" fill="#64748b">{pt.label.slice(5)}월</text>
							{/each}
						</svg>
					</div>
				{/if}
			</div>
		{/if}

	{/if}<!-- /shipout -->

	<!-- ════════════════════════════════════════════════════════════ -->
	<!-- 세탁완료 현황 탭                                              -->
	<!-- ════════════════════════════════════════════════════════════ -->
	{#if activeTab === 'completed'}

		<!-- KPI 3개 -->
		<div class="grid grid-cols-3 gap-4">
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<div class="flex items-start justify-between">
					<div>
						<p class="text-sm text-slate-500">총 세탁완료 수량</p>
						<p class="mt-1 text-3xl font-black text-emerald-600">{completedTotal.toLocaleString()}</p>
					</div>
					<div class="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-xl">✅</div>
				</div>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<div class="flex items-start justify-between">
					<div>
						<p class="text-sm text-slate-500">{filterClientId ? '선택 거래처' : '완료 보유 거래처'}</p>
						<p class="mt-1 text-3xl font-black text-slate-800">
							{filterClientId ? (filterClient?.name ?? '') : completedByClient.length}
						</p>
					</div>
					<div class="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-xl">🏢</div>
				</div>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<div class="flex items-start justify-between">
					<div>
						<p class="text-sm text-slate-500">완료 품목 수</p>
						<p class="mt-1 text-3xl font-black text-slate-800">{completedItemCount}</p>
					</div>
					<div class="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-xl">📋</div>
				</div>
			</div>
		</div>

		<!-- 전체 모드: 거래처별 현황 테이블 -->
		{#if !filterClientId}
			<div class="rounded-2xl border border-slate-100 bg-white shadow-sm">
				<div class="border-b border-slate-100 px-5 py-4">
					<h3 class="text-base font-bold text-slate-800">거래처별 세탁완료 현황</h3>
					<p class="mt-0.5 text-xs text-slate-400">현재 시점 기준</p>
				</div>
				{#if completedByClient.length === 0}
					<p class="px-5 py-10 text-center text-sm text-slate-400">세탁완료 수량이 있는 거래처가 없습니다.</p>
				{:else}
					<div class="grid grid-cols-2 divide-x divide-slate-100">
						<div class="overflow-hidden">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-slate-100 bg-slate-50">
										<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">거래처</th>
										<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">타올</th>
										<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">시트</th>
										<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">유니폼</th>
										<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">합계</th>
									</tr>
								</thead>
								<tbody>
									{#each completedByClient as row (row.clientId)}
										<tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50">
											<td class="px-5 py-3 font-medium text-slate-700">{row.clientName}</td>
											<td class="px-5 py-3 text-right text-sky-600">{row.byCategory.towel   > 0 ? row.byCategory.towel.toLocaleString()   : '—'}</td>
											<td class="px-5 py-3 text-right text-indigo-600">{row.byCategory.sheet > 0 ? row.byCategory.sheet.toLocaleString()   : '—'}</td>
											<td class="px-5 py-3 text-right text-amber-600">{row.byCategory.uniform > 0 ? row.byCategory.uniform.toLocaleString() : '—'}</td>
											<td class="px-5 py-3 text-right font-black text-emerald-700">{row.total.toLocaleString()}</td>
										</tr>
									{/each}
									<tr class="border-t-2 border-slate-200 bg-slate-50">
										<td class="px-5 py-3 font-bold text-slate-700">합계</td>
										<td class="px-5 py-3 text-right font-bold text-sky-700">
											{completedByClient.reduce((s,r)=>s+r.byCategory.towel,0).toLocaleString()}
										</td>
										<td class="px-5 py-3 text-right font-bold text-indigo-700">
											{completedByClient.reduce((s,r)=>s+r.byCategory.sheet,0).toLocaleString()}
										</td>
										<td class="px-5 py-3 text-right font-bold text-amber-700">
											{completedByClient.reduce((s,r)=>s+r.byCategory.uniform,0).toLocaleString()}
										</td>
										<td class="px-5 py-3 text-right font-black text-emerald-800">{completedTotal.toLocaleString()}</td>
									</tr>
								</tbody>
							</table>
						</div>
						<div class="space-y-3 p-5">
							<p class="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">수량 기준 비교</p>
							{#each completedByClient as row (row.clientId)}
								{@const ratio = row.total / completedMaxClient}
								<div class="flex items-center gap-3">
									<span class="w-24 shrink-0 truncate text-right text-xs font-medium text-slate-600" title={row.clientName}>{row.clientName}</span>
									<div class="flex-1 overflow-hidden rounded-full bg-slate-100" style="height:10px;">
										<div class="h-full rounded-full bg-emerald-500 transition-all duration-500"
											style="width:{Math.max(ratio*100, 2)}%"></div>
									</div>
									<span class="w-14 shrink-0 text-right text-xs font-bold text-slate-700">{row.total.toLocaleString()}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- 거래처 선택 모드: 품목별 상세 현황 -->
		{#if filterClientId}
			<div class="rounded-2xl border border-slate-100 bg-white shadow-sm">
				<div class="border-b border-slate-100 px-5 py-4">
					<h3 class="text-base font-bold text-slate-800">품목별 세탁완료 현황</h3>
					<p class="mt-0.5 text-xs text-slate-400">{filterClient?.name} · 현재 시점 기준</p>
				</div>
				{#if completedItemsForClient.length === 0}
					<p class="px-5 py-10 text-center text-sm text-slate-400">세탁완료 수량이 있는 품목이 없습니다.</p>
				{:else}
					<div class="grid grid-cols-2 divide-x divide-slate-100">
						<div class="overflow-hidden">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-slate-100 bg-slate-50">
										<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">품목명</th>
										<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">카테고리</th>
										<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">세탁완료</th>
									</tr>
								</thead>
								<tbody>
									{#each completedItemsForClient as item (item.name + item.category)}
										<tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50">
											<td class="px-5 py-3 font-medium text-slate-700">{item.name}</td>
											<td class="px-5 py-3">
												<span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {categoryBadge[item.category]}">
													{CATEGORY_LABELS[item.category]}
												</span>
											</td>
											<td class="px-5 py-3 text-right font-bold text-emerald-700">{item.completed.toLocaleString()}</td>
										</tr>
									{/each}
									<tr class="border-t-2 border-slate-200 bg-slate-50">
										<td colspan="2" class="px-5 py-3 font-bold text-slate-700">합계</td>
										<td class="px-5 py-3 text-right font-black text-emerald-800">{completedTotal.toLocaleString()}</td>
									</tr>
								</tbody>
							</table>
						</div>
						<div class="space-y-2.5 p-5">
							<p class="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">품목별 비교</p>
							{#each completedItemsForClient as item (item.name + item.category)}
								{@const ratio = item.completed / completedItemMax}
								<div class="flex items-center gap-3">
									<span class="w-20 shrink-0 truncate text-right text-xs font-medium text-slate-600" title={item.name}>{item.name}</span>
									<div class="flex-1 overflow-hidden rounded-full bg-slate-100" style="height:8px;">
										<div class="h-full rounded-full bg-emerald-400 transition-all duration-500"
											style="width:{Math.max(ratio*100, 2)}%"></div>
									</div>
									<span class="w-12 shrink-0 text-right text-xs font-bold text-slate-700">{item.completed.toLocaleString()}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- 카테고리별 세탁완료 현황 (공통) -->
		<div class="rounded-2xl border border-slate-100 bg-white shadow-sm">
			<div class="border-b border-slate-100 px-5 py-4">
				<h3 class="text-base font-bold text-slate-800">카테고리별 세탁완료 현황</h3>
				<p class="mt-0.5 text-xs text-slate-400">
					현재 시점 기준{#if filterClient} · {filterClient.name}{/if}
				</p>
			</div>
			{#if completedByCategory.length === 0}
				<p class="px-5 py-10 text-center text-sm text-slate-400">데이터가 없습니다.</p>
			{:else}
				<div class="grid grid-cols-2 divide-x divide-slate-100">
					<div class="overflow-hidden">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-slate-100 bg-slate-50">
									<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">카테고리</th>
									<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">세탁완료</th>
									<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">비율</th>
								</tr>
							</thead>
							<tbody>
								{#each completedByCategory as row (row.category)}
									{@const pct = completedTotal > 0 ? (row.total / completedTotal) * 100 : 0}
									<tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50">
										<td class="px-5 py-3">
											<span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {categoryBadge[row.category]}">
												{CATEGORY_LABELS[row.category]}
											</span>
										</td>
										<td class="px-5 py-3 text-right font-bold text-slate-800">{row.total.toLocaleString()}</td>
										<td class="px-5 py-3 text-right text-slate-500">{pct.toFixed(1)}%</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<div class="p-5">
						<p class="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">전체 대비 비율</p>
						{#if completedTotal > 0}
							<div class="mb-5 flex h-8 w-full overflow-hidden rounded-full">
								{#each completedByCategory as row (row.category)}
									{@const pct = (row.total / completedTotal) * 100}
									<div class="{categoryColors[row.category]} flex items-center justify-center text-[11px] font-bold text-white"
										style="width:{pct}%" title="{CATEGORY_LABELS[row.category]}: {pct.toFixed(1)}%">
										{pct >= 10 ? pct.toFixed(0)+'%' : ''}
									</div>
								{/each}
							</div>
						{/if}
						<div class="space-y-2.5">
							{#each completedByCategory as row (row.category)}
								{@const pct = completedTotal > 0 ? (row.total / completedTotal) * 100 : 0}
								<div class="flex items-center gap-3">
									<div class="h-3 w-3 shrink-0 rounded-full {categoryColors[row.category]}"></div>
									<span class="w-16 text-sm font-medium text-slate-700">{CATEGORY_LABELS[row.category]}</span>
									<div class="flex-1 overflow-hidden rounded-full bg-slate-100" style="height:6px;">
										<div class="{categoryColors[row.category]} h-full rounded-full transition-all duration-500" style="width:{pct}%"></div>
									</div>
									<span class="w-10 shrink-0 text-right text-xs font-semibold text-slate-600">{pct.toFixed(1)}%</span>
									<span class="w-14 shrink-0 text-right text-xs text-slate-500">{row.total.toLocaleString()}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- 전체 모드: Top 10 -->
		{#if !filterClientId}
			<div class="rounded-2xl border border-slate-100 bg-white shadow-sm">
				<div class="border-b border-slate-100 px-5 py-4">
					<h3 class="text-base font-bold text-slate-800">
						품목별 세탁완료 순위 <span class="text-sm font-medium text-slate-400">Top 10</span>
					</h3>
					<p class="mt-0.5 text-xs text-slate-400">전체 거래처 기준 · 현재 시점</p>
				</div>
				{#if completedTopItems.length === 0}
					<p class="px-5 py-10 text-center text-sm text-slate-400">데이터가 없습니다.</p>
				{:else}
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-slate-100 bg-slate-50">
								<th class="w-12 px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">순위</th>
								<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">품목명</th>
								<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">카테고리</th>
								<th class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">세탁완료</th>
							</tr>
						</thead>
						<tbody>
							{#each completedTopItems as item, idx (item.name + item.category)}
								<tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50">
									<td class="px-5 py-3 text-center">
										{#if idx === 0}<span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-white">1</span>
										{:else if idx === 1}<span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 text-xs font-black text-white">2</span>
										{:else if idx === 2}<span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-400 text-xs font-black text-white">3</span>
										{:else}<span class="text-sm text-slate-500">{idx+1}</span>
										{/if}
									</td>
									<td class="px-5 py-3 font-medium text-slate-700">{item.name}</td>
									<td class="px-5 py-3">
										<span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {categoryBadge[item.category]}">
											{CATEGORY_LABELS[item.category]}
										</span>
									</td>
									<td class="px-5 py-3 text-right font-bold text-emerald-700">{item.completed.toLocaleString()}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		{/if}

	{/if}<!-- /completed -->

</div>