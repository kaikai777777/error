<script lang="ts">
	import { goto } from '$app/navigation';
	import { store } from '$lib/data/store.svelte';

	// 오늘 날짜 포맷
	function formatToday(): string {
		const d = new Date();
		const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
		const year = d.getFullYear();
		const month = d.getMonth() + 1;
		const date = d.getDate();
		const day = days[d.getDay()];
		return `${year}년 ${month}월 ${date}일 ${day}`;
	}

	const today = formatToday();

	// KPI: 세탁완료 합계
	const totalCompleted = $derived(
		store.laundryItems.reduce((s, i) => s + i.counts.completed, 0)
	);

	// 최근 출고 5건 (shippedAt 내림차순)
	const recentShipments = $derived(
		[...store.shipments]
			.sort((a, b) => new Date(b.shippedAt).getTime() - new Date(a.shippedAt).getTime())
			.slice(0, 5)
	);

	// 미읽은 메모 최대 3개 (최신순)
	const unreadMemos = $derived(
		[...store.clientMemos]
			.filter((m) => !m.isRead)
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, 3)
	);

	// 거래처별 세탁완료 현황
	const clientCompletedStats = $derived(() => {
		const stats = store.clients.map((client) => {
			const completed = store.laundryItems
				.filter((item) => item.clientId === client.id)
				.reduce((s, i) => s + i.counts.completed, 0);
			return { client, completed };
		});
		const max = Math.max(...stats.map((s) => s.completed), 1);
		return stats.map((s) => ({ ...s, ratio: s.completed / max }));
	});

	// 날짜 포맷 (YYYY-MM-DD → M/D)
	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return `${d.getMonth() + 1}/${d.getDate()}`;
	}

	// 출고 품목 수 & 총수량
	function shipmentItemCount(shipment: (typeof store.shipments)[0]): number {
		return shipment.items.length;
	}

	function shipmentTotalQty(shipment: (typeof store.shipments)[0]): number {
		return shipment.items.reduce((s, i) => s + i.quantity, 0);
	}
</script>

<svelte:head>
	<title>대시보드 — 세탁 관리자</title>
</svelte:head>

<div class="space-y-6 px-8 py-6">
	<!-- 헤더 -->
	<div class="flex items-end justify-between">
		<div>
			<h2 class="text-2xl font-bold text-slate-800">대시보드</h2>
			<p class="mt-0.5 text-sm text-slate-500">{today}</p>
		</div>
	</div>

	<!-- KPI 카드 4개 -->
	<div class="grid grid-cols-4 gap-4">
		<!-- 총 거래처 -->
		<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="flex items-start justify-between">
				<div>
					<p class="text-sm text-slate-500">총 거래처</p>
					<p class="mt-1 text-3xl font-black text-slate-800">{store.clientCount}</p>
				</div>
				<div class="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-xl">
					🏢
				</div>
			</div>
		</div>

		<!-- 총 출고 건수 -->
		<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="flex items-start justify-between">
				<div>
					<p class="text-sm text-slate-500">총 출고 건수</p>
					<p class="mt-1 text-3xl font-black text-slate-800">{store.shipmentCount}</p>
				</div>
				<div class="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-xl">
					📦
				</div>
			</div>
		</div>

		<!-- 미읽은 메모 -->
		<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="flex items-start justify-between">
				<div>
					<p class="text-sm text-slate-500">미읽은 메모</p>
					<p
						class="mt-1 text-3xl font-black {store.unreadMemoCount > 0
							? 'text-amber-500'
							: 'text-slate-400'}"
					>
						{store.unreadMemoCount}
					</p>
				</div>
				<div
					class="flex h-11 w-11 items-center justify-center rounded-full text-xl
					{store.unreadMemoCount > 0 ? 'bg-amber-100' : 'bg-slate-100'}"
				>
					💬
				</div>
			</div>
		</div>

		<!-- 세탁완료 합계 -->
		<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="flex items-start justify-between">
				<div>
					<p class="text-sm text-slate-500">세탁완료 합계</p>
					<p class="mt-1 text-3xl font-black text-slate-800">{totalCompleted}</p>
				</div>
				<div
					class="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-xl"
				>
					✅
				</div>
			</div>
		</div>
	</div>

	<!-- 최근 출고 + 미읽은 메모 -->
	<div class="grid grid-cols-2 gap-6">
		<!-- 최근 출고 5건 -->
		<div class="rounded-2xl border border-slate-100 bg-white shadow-sm">
			<div class="border-b border-slate-100 px-5 py-4">
				<h3 class="text-base font-bold text-slate-800">최근 출고 현황</h3>
			</div>
			<div class="p-0">
				{#if recentShipments.length === 0}
					<p class="px-5 py-8 text-center text-sm text-slate-400">출고 내역이 없습니다.</p>
				{:else}
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-slate-100">
								<th
									class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
									>출고일</th
								>
								<th
									class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400"
									>거래처</th
								>
								<th
									class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400"
									>품목수</th
								>
								<th
									class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400"
									>총수량</th
								>
							</tr>
						</thead>
						<tbody>
							{#each recentShipments as shipment (shipment.id)}
								<tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50">
									<td class="px-5 py-3 text-slate-600">{formatDate(shipment.shippedAt)}</td>
									<td class="px-5 py-3 font-medium text-slate-800">
										{store.getClientById(shipment.clientId)?.name ?? '—'}
									</td>
									<td class="px-5 py-3 text-right text-slate-600"
										>{shipmentItemCount(shipment)}종</td
									>
									<td class="px-5 py-3 text-right font-semibold text-slate-800"
										>{shipmentTotalQty(shipment).toLocaleString()}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</div>

		<!-- 미읽은 메모 -->
		<div class="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm">
			<div class="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
				<h3 class="text-base font-bold text-slate-800">미읽은 메모</h3>
				{#if store.unreadMemoCount > 0}
					<span
						class="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white"
					>
						{store.unreadMemoCount}
					</span>
				{/if}
			</div>

			<div class="flex-1 p-2">
				{#if unreadMemos.length === 0}
					<div class="flex h-full items-center justify-center py-10">
						<p class="text-sm text-slate-400">미읽은 메모가 없습니다.</p>
					</div>
				{:else}
					<div class="space-y-1">
						{#each unreadMemos as memo (memo.id)}
							<div class="rounded-xl bg-amber-50 px-4 py-3">
								<div class="mb-1 flex items-center justify-between gap-2">
									<span class="text-xs font-bold text-slate-700">
										{store.getClientById(memo.clientId)?.name ?? '알 수 없는 거래처'}
									</span>
									<span class="shrink-0 text-[11px] text-slate-400"
										>{formatDate(memo.createdAt)}</span
									>
								</div>
								<p class="line-clamp-2 text-sm leading-relaxed text-slate-600">{memo.content}</p>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="border-t border-slate-100 px-5 py-3">
				<button
					class="text-sm font-semibold text-sky-600 hover:text-sky-700"
					onclick={() => void goto('/admin/memos')}
				>
					전체 보기 →
				</button>
			</div>
		</div>
	</div>

	<!-- 거래처별 세탁완료 현황 -->
	<div class="rounded-2xl border border-slate-100 bg-white shadow-sm">
		<div class="border-b border-slate-100 px-5 py-4">
			<h3 class="text-base font-bold text-slate-800">거래처별 세탁완료 현황</h3>
		</div>
		<div class="space-y-3 p-5">
			{#if store.clients.length === 0}
				<p class="text-center text-sm text-slate-400 py-4">거래처 데이터가 없습니다.</p>
			{:else}
				{#each clientCompletedStats() as item (item.client.id)}
					<div class="flex items-center gap-4">
						<span class="w-28 shrink-0 truncate text-sm font-medium text-slate-700">
							{item.client.name}
						</span>
						<div class="flex-1 overflow-hidden rounded-full bg-slate-100" style="height:10px;">
							<div
								class="h-full rounded-full bg-sky-500 transition-all duration-500"
								style="width: {Math.max(item.ratio * 100, item.completed > 0 ? 2 : 0)}%"
							></div>
						</div>
						<span class="w-12 shrink-0 text-right text-sm font-bold text-slate-700">
							{item.completed.toLocaleString()}
						</span>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>