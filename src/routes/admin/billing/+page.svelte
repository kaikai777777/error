<script lang="ts">
	import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
	import type { ClientContract, ClientItemPrice, InvoiceLine } from '$lib/data/types.js';

	// ── 탭 ──────────────────────────────────────────────────────────
	type BillingTab = 'invoice' | 'pricing' | 'contracts';
	let activeTab = $state<BillingTab>('invoice');

	// ── 거래처 선택 ─────────────────────────────────────────────────
	let selectedClientId = $state<string>(store.clients[0]?.id ?? '');
	const selectedClient = $derived(store.clients.find((c) => c.id === selectedClientId) ?? null);

	// ── 기간 설정 ───────────────────────────────────────────────────
	let periodFrom = $state('2025-04-01');
	let periodTo   = $state('2025-06-30');

	function applyContract(contract: ClientContract) {
		periodFrom = contract.startDate;
		periodTo   = contract.endDate;
	}

	function setThisMonth() {
		const d   = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const y   = d.getFullYear();
		const m   = d.getMonth() + 1;
		const last = new Date(y, m, 0).getDate();
		periodFrom = `${y}-${pad(m)}-01`;
		periodTo   = `${y}-${pad(m)}-${pad(last)}`;
	}
	function setLastMonth() {
		const d   = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		let y = d.getFullYear();
		let m = d.getMonth(); // 0-based = 현재달-1
		if (m === 0) { m = 12; y--; }
		const last = new Date(y, m, 0).getDate();
		periodFrom = `${y}-${pad(m)}-01`;
		periodTo   = `${y}-${pad(m)}-${pad(last)}`;
	}

	// ── 청구서 미리보기 데이터 ────────────────────────────────────────
	const invoiceLines = $derived.by((): InvoiceLine[] => {
		if (!selectedClientId) return [];
		return store.buildInvoiceLines(selectedClientId, periodFrom, periodTo);
	});

	const invoiceTotal    = $derived(invoiceLines.reduce((s, l) => s + l.amount,   0));
	const invoiceTotalQty = $derived(invoiceLines.reduce((s, l) => s + l.quantity, 0));

	const invoiceByCategory = $derived.by(() => {
		const cats: Record<string, { qty: number; amount: number }> = {};
		for (const line of invoiceLines) {
			if (!cats[line.category]) cats[line.category] = { qty: 0, amount: 0 };
			cats[line.category].qty    += line.quantity;
			cats[line.category].amount += line.amount;
		}
		return cats;
	});

	const unpricedCount = $derived(invoiceLines.filter((l) => l.unitPrice === 0).length);

	// ── 품목 단가 설정 ───────────────────────────────────────────────
	const clientItems = $derived(
		selectedClientId ? store.laundryItems.filter((i) => i.clientId === selectedClientId) : []
	);

	let priceEdits = $state<Record<string, string>>({});

	$effect(() => {
		if (!selectedClientId) return;
		const map: Record<string, string> = {};
		for (const item of store.laundryItems.filter((i) => i.clientId === selectedClientId)) {
			const key   = `${item.category}__${item.name}`;
			const price = store.getUnitPrice(selectedClientId, item.category, item.name);
			map[key] = price > 0 ? String(price) : '';
		}
		priceEdits = map;
	});

	function savePrices() {
		if (!selectedClientId) return;
		const prices: Omit<ClientItemPrice, 'clientId'>[] = [];
		for (const [key, val] of Object.entries(priceEdits)) {
			const [category, ...rest] = key.split('__');
			const itemName  = rest.join('__');
			const unitPrice = parseInt(val, 10);
			if (!isNaN(unitPrice) && unitPrice >= 0) {
				prices.push({ category: category as 'towel' | 'sheet' | 'uniform', itemName, unitPrice });
			}
		}
		store.saveClientItemPrices(selectedClientId, prices);
		priceSaved = true;
		setTimeout(() => (priceSaved = false), 2000);
	}

	let priceSaved = $state(false);

	const clientItemsByCategory = $derived.by(() => {
		const groups: Record<string, typeof clientItems> = { towel: [], sheet: [], uniform: [] };
		for (const item of clientItems) {
			if (groups[item.category]) groups[item.category].push(item);
		}
		return groups;
	});

	// ── 계약 기간 관리 ──────────────────────────────────────────────
	const contracts = $derived(
		selectedClientId ? store.getContractsByClient(selectedClientId) : []
	);

	let showContractModal  = $state(false);
	let editingContractId  = $state<string | null>(null);
	let contractFrom       = $state('');
	let contractTo         = $state('');
	let contractMemo       = $state('');

	function openAddContract() {
		editingContractId = null;
		const d = new Date(); const pad = (n: number) => String(n).padStart(2,'0');
		contractFrom = `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`;
		contractTo   = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(new Date(d.getFullYear(), d.getMonth()+1, 0).getDate())}`;
		contractMemo = '';
		showContractModal = true;
	}
	function openEditContract(c: ClientContract) {
		editingContractId = c.id;
		contractFrom = c.startDate;
		contractTo   = c.endDate;
		contractMemo = c.memo ?? '';
		showContractModal = true;
	}
	function saveContract() {
		if (!selectedClientId || !contractFrom || !contractTo) return;
		if (editingContractId) {
			store.updateClientContract(editingContractId, {
				startDate: contractFrom, endDate: contractTo, memo: contractMemo || undefined
			});
		} else {
			store.addClientContract({
				clientId: selectedClientId, startDate: contractFrom, endDate: contractTo, memo: contractMemo || undefined
			});
		}
		showContractModal = false;
	}

	// ── 인쇄 / PDF ──────────────────────────────────────────────────
	let invoiceMemo = $state('');

	function printInvoice() {
		window.print();
	}

	// ── 저장된 청구서 ─────────────────────────────────────────────────
	const savedInvoices = $derived(
		selectedClientId ? store.getInvoicesByClient(selectedClientId) : []
	);

	let showSaveConfirm = $state(false);
	let savedMsg        = $state(false);

	function doSaveInvoice() {
		if (!selectedClientId || invoiceLines.length === 0) return;
		store.saveInvoice({
			clientId: selectedClientId,
			periodFrom, periodTo,
			lines: invoiceLines,
			totalAmount: invoiceTotal,
			memo: invoiceMemo || undefined,
			status: 'issued'
		});
		showSaveConfirm = false;
		savedMsg = true;
		setTimeout(() => (savedMsg = false), 2500);
	}

	let viewingInvoiceId = $state<string | null>(null);
	const viewingInvoice = $derived(
		viewingInvoiceId ? store.invoices.find((i) => i.id === viewingInvoiceId) ?? null : null
	);

	// ── 헬퍼 ────────────────────────────────────────────────────────
	const categoryBadge: Record<string, string> = {
		towel:   'bg-sky-100 text-sky-700',
		sheet:   'bg-indigo-100 text-indigo-700',
		uniform: 'bg-amber-100 text-amber-700'
	};
	const categoryColor: Record<string, string> = {
		towel:   'bg-sky-400',
		sheet:   'bg-indigo-400',
		uniform: 'bg-amber-400'
	};

	function formatDate(d: string) { return d.replace(/-/g, '.').slice(0, 10); }
	function formatMoney(n: number) { return n.toLocaleString('ko-KR') + '원'; }
</script>

<svelte:head>
	<title>청구서 관리 — 세탁 관리자</title>

	<!-- ════════════════════════════════════════════════════════════
	     전역 인쇄 스타일 — head 에 넣어야 레이아웃 사이드바 포함
	     모든 DOM 에 적용됨
	     ════════════════════════════════════════════════════════════ -->
	{@html `<style id="billing-print-style">
@media screen {
  #billing-invoice-print { display: none !important; }
}
@media print {
  /* 화면 전체를 visibility:hidden 으로 덮은 뒤 인쇄 영역만 visible 복원
     — SvelteKit 의 display:contents 래퍼 때문에 body>* 셀렉터가 동작하지
       않으므로 visibility 방식으로 전환 */
  body {
    visibility: hidden !important;
  }

  /* 인쇄 전용 영역과 그 모든 자손만 보이게 */
  #billing-invoice-print,
  #billing-invoice-print * {
    visibility: visible !important;
  }

  /* 인쇄 전용 레이어 위치 초기화 */
  #billing-invoice-print {
    display: block !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    background: white !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* 기본 페이지 여백 */
  @page {
    margin: 15mm 15mm 15mm 15mm;
    size: A4 portrait;
  }

  /* 색상 정확도 보장 */
  #billing-invoice-print * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    box-sizing: border-box;
  }

  /* 테이블 셀 줄바꿈 방지 */
  #billing-invoice-print td,
  #billing-invoice-print th {
    white-space: nowrap !important;
    overflow: hidden !important;
  }

  /* 품목명 셀만 줄바꿈 허용 */
  #billing-invoice-print td.cell-name {
    white-space: normal !important;
    word-break: keep-all !important;
  }
}
</style>`}
</svelte:head>

<!-- ══════════════════════════════════════════════════════════════ -->
<!-- 화면 UI (인쇄 시 JS로 숨김)                                    -->
<!-- ══════════════════════════════════════════════════════════════ -->
<div class="min-h-screen bg-slate-50 px-8 py-6" id="billing-screen-ui">
	<!-- 헤더 -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<h2 class="text-2xl font-extrabold text-slate-800">🧾 청구서 관리</h2>
		<div class="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
			{#each ([['invoice', '📄 청구서 작성'], ['pricing', '💰 품목 단가'], ['contracts', '📅 계약 기간']] as const) as [tab, label] (tab)}
				<button
					class="rounded-lg px-4 py-1.5 text-sm font-semibold transition-all {activeTab === tab ? 'bg-indigo-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'}"
					onclick={() => (activeTab = tab)}
				>{label}</button>
			{/each}
		</div>
	</div>

	<!-- 거래처 선택 -->
	<div class="mb-6 flex flex-wrap items-center gap-3">
		<span class="text-sm font-bold text-slate-500">거래처:</span>
		<div class="flex flex-wrap gap-2">
			{#each store.clients as c (c.id)}
				<button
					class="rounded-full border px-4 py-1.5 text-sm font-semibold transition-all {selectedClientId === c.id ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'}"
					onclick={() => (selectedClientId = c.id)}
				>{c.name}</button>
			{/each}
		</div>
	</div>

	<!-- ── 탭 1: 청구서 작성 ─────────────────────────────────────── -->
	{#if activeTab === 'invoice'}
		<div class="grid grid-cols-12 gap-5">
			<!-- 좌측 -->
			<div class="col-span-8 space-y-5">
				<!-- 기간 설정 -->
				<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<h3 class="mb-4 text-sm font-bold text-slate-700">청구 기간 설정</h3>
					<div class="flex flex-wrap items-end gap-3">
						<div class="flex flex-col gap-1">
							<label for="inv-from" class="text-xs font-semibold text-slate-500">시작일</label>
							<input id="inv-from" type="date" bind:value={periodFrom}
								class="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
						</div>
						<span class="mb-2.5 text-slate-400">~</span>
						<div class="flex flex-col gap-1">
							<label for="inv-to" class="text-xs font-semibold text-slate-500">종료일</label>
							<input id="inv-to" type="date" bind:value={periodTo}
								class="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
						</div>
						<div class="flex gap-2">
							<button class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100" onclick={setThisMonth}>이번 달</button>
							<button class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100" onclick={setLastMonth}>지난 달</button>
						</div>
					</div>
					{#if contracts.length > 0}
						<div class="mt-4 border-t border-slate-100 pt-4">
							<p class="mb-2 text-xs font-semibold text-slate-400">등록된 계약 기간으로 빠른 설정:</p>
							<div class="flex flex-wrap gap-2">
								{#each contracts as c (c.id)}
									<button
										class="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
										onclick={() => applyContract(c)}
									>
										{formatDate(c.startDate)} ~ {formatDate(c.endDate)}
										{#if c.memo}<span class="ml-1 opacity-60">({c.memo})</span>{/if}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- 청구 내역 테이블 -->
				<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
						<div>
							<h3 class="text-base font-bold text-slate-800">청구 내역</h3>
							<p class="mt-0.5 text-xs text-slate-400">{formatDate(periodFrom)} ~ {formatDate(periodTo)} 출고 기준</p>
						</div>
						{#if unpricedCount > 0}
							<span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
								⚠ 단가 미설정 {unpricedCount}개 품목
							</span>
						{/if}
					</div>

					{#if invoiceLines.length === 0}
						<div class="py-16 text-center">
							<p class="text-slate-400">해당 기간에 출고 데이터가 없습니다.</p>
							<p class="mt-1 text-xs text-slate-300">기간을 변경하거나 출고 기록을 확인하세요.</p>
						</div>
					{:else}
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-slate-100 bg-slate-50">
									<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">품목명</th>
									<th class="w-20 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">카테고리</th>
									<th class="w-20 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">수량</th>
									<th class="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">단가</th>
									<th class="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">금액</th>
								</tr>
							</thead>
							<tbody>
								{#each (['towel', 'sheet', 'uniform'] as const) as cat}
									{@const catLines = invoiceLines.filter((l) => l.category === cat)}
									{#if catLines.length > 0}
										<tr class="bg-slate-50/50">
											<td colspan="5" class="px-5 py-2">
												<span class="rounded-full px-2.5 py-0.5 text-xs font-bold {categoryBadge[cat]}">
													{CATEGORY_LABELS[cat]}
												</span>
											</td>
										</tr>
										{#each catLines as line (line.category + line.itemName)}
											<tr class="border-b border-slate-50 hover:bg-slate-50/70">
												<td class="px-5 py-3 pl-8 font-medium text-slate-700">{line.itemName}</td>
												<td class="w-20 px-4 py-3">
													<span class="rounded-full px-2 py-0.5 text-xs font-semibold {categoryBadge[line.category]}">
														{CATEGORY_LABELS[line.category]}
													</span>
												</td>
												<td class="w-20 px-4 py-3 text-right text-slate-700">{line.quantity.toLocaleString()}</td>
												<td class="w-28 whitespace-nowrap px-4 py-3 text-right {line.unitPrice === 0 ? 'font-semibold text-amber-500' : 'text-slate-600'}">
													{line.unitPrice === 0 ? '미설정' : formatMoney(line.unitPrice)}
												</td>
												<td class="w-28 whitespace-nowrap px-4 py-3 text-right font-bold {line.amount === 0 ? 'text-slate-300' : 'text-slate-800'}">
													{line.amount === 0 ? '—' : formatMoney(line.amount)}
												</td>
											</tr>
										{/each}
										{#if catLines.length > 1}
											<tr class="bg-slate-50">
												<td colspan="2" class="px-5 py-2 pl-8 text-xs font-semibold text-slate-400">{CATEGORY_LABELS[cat]} 소계</td>
												<td class="w-20 px-4 py-2 text-right text-xs font-bold text-slate-600">{invoiceByCategory[cat]?.qty.toLocaleString() ?? 0}</td>
												<td class="w-28 px-4 py-2"></td>
												<td class="w-28 whitespace-nowrap px-4 py-2 text-right text-xs font-bold text-slate-700">{formatMoney(invoiceByCategory[cat]?.amount ?? 0)}</td>
											</tr>
										{/if}
									{/if}
								{/each}
							</tbody>
							<tfoot>
								<tr class="border-t-2 border-slate-200 bg-indigo-50">
									<td colspan="2" class="px-5 py-4 text-sm font-extrabold text-slate-700">합계</td>
									<td class="w-20 px-4 py-4 text-right text-sm font-extrabold text-slate-700">{invoiceTotalQty.toLocaleString()}</td>
									<td class="w-28 px-4 py-4"></td>
									<td class="w-28 whitespace-nowrap px-4 py-4 text-right text-lg font-black text-indigo-700">{formatMoney(invoiceTotal)}</td>
								</tr>
							</tfoot>
						</table>
					{/if}
				</div>

				<!-- 메모 -->
				{#if invoiceLines.length > 0}
					<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<label for="inv-memo" class="mb-2 block text-sm font-bold text-slate-600">청구서 메모 (선택)</label>
						<textarea id="inv-memo" bind:value={invoiceMemo} rows="2"
							placeholder="특이사항, 입금 계좌 등을 입력하세요..."
							class="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none"
						></textarea>
					</div>
				{/if}
			</div>

			<!-- 우측 요약 + 액션 -->
			<div class="col-span-4 space-y-5">
				{#if selectedClient}
					<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p class="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">청구 대상</p>
						<p class="text-lg font-extrabold text-slate-800">{selectedClient.name}</p>
						{#if selectedClient.businessNo}<p class="mt-1 text-xs text-slate-500">사업자: {selectedClient.businessNo}</p>{/if}
						{#if selectedClient.ownerName}<p class="text-xs text-slate-500">대표자: {selectedClient.ownerName}</p>{/if}
						{#if selectedClient.managerName}<p class="text-xs text-slate-500">담당자: {selectedClient.managerName}</p>{/if}
						{#if selectedClient.phone}<p class="text-xs text-slate-500">연락처: {selectedClient.phone}</p>{/if}
					</div>
				{/if}

				<div class="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
					<p class="mb-3 text-xs font-bold uppercase tracking-wide text-indigo-400">청구 요약</p>
					<div class="space-y-2">
						<div class="flex justify-between text-sm">
							<span class="text-slate-500">청구 기간</span>
							<span class="text-right text-xs font-semibold text-slate-700">{formatDate(periodFrom)} ~ {formatDate(periodTo)}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-slate-500">총 출고 수량</span>
							<span class="font-bold text-slate-800">{invoiceTotalQty.toLocaleString()}개</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-slate-500">품목 종류</span>
							<span class="font-bold text-slate-800">{invoiceLines.length}종</span>
						</div>
						{#if unpricedCount > 0}
							<div class="flex justify-between text-sm">
								<span class="text-amber-600">단가 미설정</span>
								<span class="font-bold text-amber-600">{unpricedCount}종</span>
							</div>
						{/if}
						<div class="mt-3 border-t border-indigo-200 pt-3">
							<div class="flex justify-between">
								<span class="font-bold text-slate-700">청구 총액</span>
								<span class="text-xl font-black text-indigo-700">{formatMoney(invoiceTotal)}</span>
							</div>
						</div>
					</div>
				</div>

				{#if invoiceLines.length > 0}
					<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p class="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">카테고리별</p>
						<div class="space-y-2">
							{#each (['towel', 'sheet', 'uniform'] as const) as cat}
								{#if invoiceByCategory[cat]}
									<div class="flex items-center gap-2">
										<div class="h-2.5 w-2.5 shrink-0 rounded-full {categoryColor[cat]}"></div>
										<span class="flex-1 text-xs font-medium text-slate-600">{CATEGORY_LABELS[cat]}</span>
										<span class="text-xs text-slate-500">{invoiceByCategory[cat].qty.toLocaleString()}개</span>
										<span class="w-24 shrink-0 text-right text-xs font-bold text-slate-700">{formatMoney(invoiceByCategory[cat].amount)}</span>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/if}

				{#if invoiceLines.length > 0}
					<div class="space-y-2">
						<button
							class="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-600 active:scale-95"
							onclick={() => (showSaveConfirm = true)}
						>💾 청구서 저장</button>
						<button
							class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95"
							onclick={printInvoice}
						>🖨️ 인쇄 / PDF 저장</button>
						<p class="text-center text-xs text-slate-400">인쇄 창 → 대상: <strong>PDF로 저장</strong> 선택</p>
						{#if savedMsg}
							<p class="text-center text-xs font-semibold text-emerald-600">✅ 청구서가 저장되었습니다!</p>
						{/if}
					</div>
				{/if}

				{#if savedInvoices.length > 0}
					<div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
						<div class="border-b border-slate-100 px-4 py-3">
							<p class="text-xs font-bold text-slate-600">저장된 청구서</p>
						</div>
						<div class="divide-y divide-slate-50">
							{#each savedInvoices.slice(0, 5) as inv (inv.id)}
								<button
									class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
									onclick={() => (viewingInvoiceId = inv.id)}
								>
									<span class="mt-0.5 text-base">📄</span>
									<div class="min-w-0 flex-1">
										<p class="text-xs font-semibold text-slate-700">{formatDate(inv.periodFrom)} ~ {formatDate(inv.periodTo)}</p>
										<p class="text-xs font-bold text-indigo-600">{formatMoney(inv.totalAmount)}</p>
										<p class="text-[11px] text-slate-400">{inv.createdAt.slice(0, 10)} 저장</p>
									</div>
									<span class="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">발행</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

	<!-- ── 탭 2: 품목 단가 설정 ──────────────────────────────────── -->
	{:else if activeTab === 'pricing'}
		<div class="space-y-5">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-base font-bold text-slate-800">{selectedClient?.name ?? '거래처 선택'} — 품목 단가 설정</h3>
					<p class="mt-0.5 text-xs text-slate-400">거래처별로 품목 단가를 다르게 설정할 수 있습니다. 0원이면 청구서에서 단가 미설정으로 표시됩니다.</p>
				</div>
				<div class="flex items-center gap-3">
					{#if priceSaved}<span class="text-sm font-semibold text-emerald-600">✅ 저장 완료</span>{/if}
					<button
						class="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-600 active:scale-95"
						onclick={savePrices}
					>단가 저장</button>
				</div>
			</div>

			{#if clientItems.length === 0}
				<div class="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-sm">
					<p class="text-slate-400">등록된 품목이 없습니다.</p>
				</div>
			{:else}
				{#each (['towel', 'sheet', 'uniform'] as const) as cat}
					{#if clientItemsByCategory[cat].length > 0}
						<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
							<div class="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
								<span class="rounded-full px-3 py-1 text-xs font-bold {categoryBadge[cat]}">{CATEGORY_LABELS[cat]}</span>
								<span class="text-xs text-slate-400">{clientItemsByCategory[cat].length}개 품목</span>
							</div>
							<div class="grid grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-4">
								{#each clientItemsByCategory[cat] as item (item.id)}
									{@const key = `${item.category}__${item.name}`}
									<div class="flex items-center justify-between gap-3 border-b border-r border-slate-50 px-5 py-3.5">
										<span class="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{item.name}</span>
										<div class="flex shrink-0 items-center gap-1">
											<input type="number" min="0" step="100" placeholder="0"
												bind:value={priceEdits[key]}
												class="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm focus:border-indigo-400 focus:outline-none"
											/>
											<span class="text-xs text-slate-400">원</span>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
				<div class="flex justify-end">
					<button
						class="rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-600 active:scale-95"
						onclick={savePrices}
					>💾 단가 저장</button>
				</div>
			{/if}
		</div>

	<!-- ── 탭 3: 계약 기간 관리 ─────────────────────────────────── -->
	{:else}
		<div class="space-y-5">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-base font-bold text-slate-800">{selectedClient?.name ?? '거래처 선택'} — 계약 기간 관리</h3>
					<p class="mt-0.5 text-xs text-slate-400">계약 기간을 등록하면 청구서 작성 시 빠른 기간 선택이 가능합니다.</p>
				</div>
				<button
					class="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-600 active:scale-95"
					onclick={openAddContract}
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 4v16m8-8H4"/></svg>
					계약 기간 추가
				</button>
			</div>

			{#if contracts.length === 0}
				<div class="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-sm">
					<p class="text-slate-400">등록된 계약 기간이 없습니다.</p>
					<button class="mt-4 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-100" onclick={openAddContract}>계약 기간 추가하기</button>
				</div>
			{:else}
				<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-slate-100 bg-slate-50">
								<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">시작일</th>
								<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">종료일</th>
								<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">기간</th>
								<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">메모</th>
								<th class="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">액션</th>
							</tr>
						</thead>
						<tbody>
							{#each contracts as c (c.id)}
								{@const days = Math.round((new Date(c.endDate).getTime() - new Date(c.startDate).getTime()) / 86400000) + 1}
								<tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50">
									<td class="px-5 py-3.5 font-semibold text-slate-700">{formatDate(c.startDate)}</td>
									<td class="px-5 py-3.5 font-semibold text-slate-700">{formatDate(c.endDate)}</td>
									<td class="px-5 py-3.5">
										<span class="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">{days}일</span>
									</td>
									<td class="px-5 py-3.5 text-slate-500">{c.memo ?? '—'}</td>
									<td class="px-5 py-3.5">
										<div class="flex items-center justify-center gap-3">
											<button class="text-xs font-semibold text-indigo-600 hover:text-indigo-800" onclick={() => openEditContract(c)}>수정</button>
											<span class="text-slate-200">|</span>
											<button class="text-xs font-semibold text-red-500 hover:text-red-700" onclick={() => store.removeClientContract(c.id)}>삭제</button>
											<span class="text-slate-200">|</span>
											<button class="text-xs font-semibold text-slate-500 hover:text-slate-700" onclick={() => { applyContract(c); activeTab = 'invoice'; }}>청구서 작성</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>


<!-- ══════════════════════════════════════════════════════════════ -->
<!-- 인쇄 전용 청구서 — id 로 JS/CSS 에서 직접 제어                  -->
<!-- ══════════════════════════════════════════════════════════════ -->
{#if true}
	{@const inv          = viewingInvoice}
	{@const printLines   = inv ? inv.lines   : invoiceLines}
	{@const printFrom    = inv ? inv.periodFrom : periodFrom}
	{@const printTo      = inv ? inv.periodTo   : periodTo}
	{@const printTotal   = inv ? inv.totalAmount : invoiceTotal}
	{@const printMemo    = inv ? inv.memo        : invoiceMemo}
	{@const printClient  = selectedClient}

	<div id="billing-invoice-print">
		<div style="max-width:700px; margin:0 auto; font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif; color:#1e293b;">

			<!-- 제목 -->
			<div style="text-align:center; margin-bottom:28px; padding-bottom:16px; border-bottom:2px solid #e2e8f0;">
				<h1 style="margin:0; font-size:28px; font-weight:900; letter-spacing:0.15em; color:#0f172a;">청 구 서</h1>
				<p style="margin:6px 0 0; font-size:13px; color:#64748b;">세탁 서비스 청구서</p>
			</div>

			<!-- 거래처 정보 + 청구 정보 (2열) -->
			<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
				<!-- 왼쪽: 청구 대상 -->
				<div style="border:1px solid #e2e8f0; border-radius:8px; padding:16px;">
					<p style="margin:0 0 8px; font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em;">청구 대상</p>
					<p style="margin:0 0 4px; font-size:16px; font-weight:800; color:#0f172a;">{printClient?.name ?? ''} &nbsp;귀중</p>
					{#if printClient?.businessNo}
						<p style="margin:2px 0; font-size:11px; color:#475569;">사업자등록번호: {printClient.businessNo}</p>
					{/if}
					{#if printClient?.ownerName}
						<p style="margin:2px 0; font-size:11px; color:#475569;">대표자: {printClient.ownerName}</p>
					{/if}
					{#if printClient?.address}
						<p style="margin:2px 0; font-size:11px; color:#475569;">주소: {printClient.address}</p>
					{/if}
					{#if printClient?.phone}
						<p style="margin:2px 0; font-size:11px; color:#475569;">연락처: {printClient.phone}</p>
					{/if}
				</div>
				<!-- 오른쪽: 청구 정보 -->
				<div style="border:1px solid #e2e8f0; border-radius:8px; padding:16px;">
					<p style="margin:0 0 8px; font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em;">청구 정보</p>
					<table style="width:100%; border-collapse:collapse; font-size:12px;">
							<tbody>
								<tr>
									<td style="padding:3px 0; color:#64748b; width:70px;">청구 기간</td>
									<td style="padding:3px 0; font-weight:600; color:#334155; text-align:right;">{formatDate(printFrom)} ~ {formatDate(printTo)}</td>
								</tr>
								<tr>
									<td style="padding:3px 0; color:#64748b;">발행일</td>
									<td style="padding:3px 0; font-weight:600; color:#334155; text-align:right;">{new Date().toLocaleDateString('ko-KR')}</td>
								</tr>
								<tr>
									<td style="padding:3px 0; color:#64748b;">품목 수</td>
									<td style="padding:3px 0; font-weight:600; color:#334155; text-align:right;">{printLines.length}종</td>
								</tr>
								<tr style="border-top:1px solid #e2e8f0;">
									<td style="padding:8px 0 3px; font-weight:800; color:#334155; font-size:13px;">청구 총액</td>
									<td style="padding:8px 0 3px; font-weight:900; color:#4338ca; text-align:right; font-size:18px; white-space:nowrap;">{formatMoney(printTotal)}</td>
								</tr>
							</tbody>
						</table>
				</div>
			</div>

			<!-- 품목 테이블 -->
			<table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:20px;">
				<colgroup>
					<col style="width:30%;" />
					<col style="width:12%;" />
					<col style="width:12%;" />
					<col style="width:20%;" />
					<col style="width:26%;" />
				</colgroup>
				<thead>
					<tr style="background:#f8fafc; border-top:2px solid #e2e8f0; border-bottom:2px solid #e2e8f0;">
						<th style="padding:9px 12px; text-align:left; font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">품목명</th>
						<th style="padding:9px 12px; text-align:center; font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">구분</th>
						<th style="padding:9px 12px; text-align:right; font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">수량</th>
						<th style="padding:9px 12px; text-align:right; font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">단가</th>
						<th style="padding:9px 12px; text-align:right; font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">금액</th>
					</tr>
				</thead>
				<tbody>
					{#each printLines as line, i (line.category + line.itemName)}
						<tr style="border-bottom:1px solid #f1f5f9; background:{i % 2 === 1 ? '#fafafa' : 'white'};">
							<td class="cell-name" style="padding:8px 12px; font-weight:500; color:#334155; word-break:keep-all;">{line.itemName}</td>
							<td style="padding:8px 12px; text-align:center; color:#64748b; white-space:nowrap;">{CATEGORY_LABELS[line.category]}</td>
							<td style="padding:8px 12px; text-align:right; color:#475569; white-space:nowrap;">{line.quantity.toLocaleString()}</td>
							<td style="padding:8px 12px; text-align:right; color:#64748b; white-space:nowrap;">{line.unitPrice > 0 ? formatMoney(line.unitPrice) : '—'}</td>
							<td style="padding:8px 12px; text-align:right; font-weight:700; color:#1e293b; white-space:nowrap;">{line.amount > 0 ? formatMoney(line.amount) : '—'}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr style="border-top:2px solid #c7d2fe; background:#eef2ff;">
						<td colspan="2" style="padding:11px 12px; font-weight:800; color:#334155; font-size:13px;">합 계</td>
						<td style="padding:11px 12px; text-align:right; font-weight:800; color:#334155; white-space:nowrap;">
							{printLines.reduce((s, l) => s + l.quantity, 0).toLocaleString()}
						</td>
						<td style="padding:11px 12px;"></td>
						<td style="padding:11px 12px; text-align:right; font-size:16px; font-weight:900; color:#4338ca; white-space:nowrap;">
							{formatMoney(printTotal)}
						</td>
					</tr>
				</tfoot>
			</table>

			<!-- 메모 -->
			{#if printMemo}
				<div style="border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:20px;">
					<p style="margin:0 0 6px; font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em;">비고</p>
					<p style="margin:0; font-size:12px; color:#475569; line-height:1.6;">{printMemo}</p>
				</div>
			{/if}

			<!-- 푸터 -->
			<div style="border-top:1px solid #e2e8f0; padding-top:16px; text-align:center;">
				<p style="margin:0; font-size:10px; color:#94a3b8;">본 청구서는 세탁 관리 시스템에서 자동 생성되었습니다.</p>
			</div>
		</div>
	</div>
{/if}


<!-- ══════════════════════════════════════════════════════════════ -->
<!-- 모달: 계약 기간 추가/수정                                       -->
<!-- ══════════════════════════════════════════════════════════════ -->
{#if showContractModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
		role="presentation"
		onmousedown={(e) => { if (e.target === e.currentTarget) showContractModal = false; }}
	>
		<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
			<div class="mb-5 flex items-center justify-between">
				<h3 class="text-base font-extrabold text-slate-800">{editingContractId ? '계약 기간 수정' : '계약 기간 추가'}</h3>
				<button class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" onclick={() => (showContractModal = false)} aria-label="닫기">✕</button>
			</div>
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="ct-from" class="mb-1 block text-xs font-bold text-slate-500">시작일 *</label>
						<input id="ct-from" type="date" bind:value={contractFrom}
							class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
					</div>
					<div>
						<label for="ct-to" class="mb-1 block text-xs font-bold text-slate-500">종료일 *</label>
						<input id="ct-to" type="date" bind:value={contractTo}
							class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
					</div>
				</div>
				<div>
					<label for="ct-memo" class="mb-1 block text-xs font-bold text-slate-500">메모 (선택)</label>
					<input id="ct-memo" type="text" bind:value={contractMemo} placeholder="예) 1차 계약, 갱신 계약..."
						class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
				</div>
				{#if contractFrom && contractTo}
					{@const days = Math.round((new Date(contractTo).getTime() - new Date(contractFrom).getTime()) / 86400000) + 1}
					<p class="text-xs font-semibold text-indigo-600">
						📅 {formatDate(contractFrom)} ~ {formatDate(contractTo)} ({days}일)
					</p>
				{/if}
			</div>
			<div class="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
				<button class="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200" onclick={() => (showContractModal = false)}>취소</button>
				<button class="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-600" onclick={saveContract}>{editingContractId ? '저장' : '추가'}</button>
			</div>
		</div>
	</div>
{/if}


<!-- ══════════════════════════════════════════════════════════════ -->
<!-- 모달: 청구서 저장 확인                                         -->
<!-- ══════════════════════════════════════════════════════════════ -->
{#if showSaveConfirm}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
		role="presentation"
		onmousedown={(e) => { if (e.target === e.currentTarget) showSaveConfirm = false; }}
	>
		<div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
			<h3 class="mb-2 text-base font-extrabold text-slate-800">청구서 저장</h3>
			<p class="mb-1 text-sm text-slate-600">
				<span class="font-bold text-indigo-700">{selectedClient?.name}</span> 거래처의 청구서를 저장하시겠습니까?
			</p>
			<p class="text-xs text-slate-400">
				기간: {formatDate(periodFrom)} ~ {formatDate(periodTo)}<br/>
				총액: {formatMoney(invoiceTotal)}
			</p>
			<div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
				<button class="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200" onclick={() => (showSaveConfirm = false)}>취소</button>
				<button class="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-600" onclick={doSaveInvoice}>저장</button>
			</div>
		</div>
	</div>
{/if}


<!-- ══════════════════════════════════════════════════════════════ -->
<!-- 모달: 저장된 청구서 조회                                        -->
<!-- ══════════════════════════════════════════════════════════════ -->
{#if viewingInvoice}
	{@const inv = viewingInvoice}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
		role="presentation"
		onmousedown={(e) => { if (e.target === e.currentTarget) viewingInvoiceId = null; }}
	>
		<div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
			<div class="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
				<div>
					<h3 class="text-base font-extrabold text-slate-800">청구서 조회</h3>
					<p class="text-xs text-slate-400">{formatDate(inv.periodFrom)} ~ {formatDate(inv.periodTo)}</p>
				</div>
				<div class="flex items-center gap-2">
					<button
						class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
						onclick={() => { viewingInvoiceId = null; window.print(); }}
					>🖨️ 인쇄</button>
					<button
						class="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
						onclick={() => { store.removeInvoice(inv.id); viewingInvoiceId = null; }}
					>삭제</button>
					<button
						class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
						onclick={() => (viewingInvoiceId = null)}
						aria-label="닫기"
					>✕</button>
				</div>
			</div>
			<div class="p-6">
				<div class="mb-5 grid grid-cols-3 gap-3">
					<div class="rounded-xl bg-slate-50 p-3 text-center">
						<p class="text-xs text-slate-400">청구 기간</p>
						<p class="mt-1 text-xs font-bold text-slate-700">{formatDate(inv.periodFrom)}</p>
						<p class="text-xs font-bold text-slate-700">~ {formatDate(inv.periodTo)}</p>
					</div>
					<div class="rounded-xl bg-slate-50 p-3 text-center">
						<p class="text-xs text-slate-400">품목 수</p>
						<p class="mt-1 text-lg font-black text-slate-800">{inv.lines.length}종</p>
					</div>
					<div class="rounded-xl bg-indigo-50 p-3 text-center">
						<p class="text-xs text-indigo-400">청구 총액</p>
						<p class="mt-1 text-lg font-black text-indigo-700">{formatMoney(inv.totalAmount)}</p>
					</div>
				</div>
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-100 bg-slate-50">
							<th class="px-4 py-2.5 text-left text-xs font-semibold text-slate-400">품목</th>
							<th class="w-20 px-4 py-2.5 text-left text-xs font-semibold text-slate-400">구분</th>
							<th class="w-16 px-4 py-2.5 text-right text-xs font-semibold text-slate-400">수량</th>
							<th class="w-28 px-4 py-2.5 text-right text-xs font-semibold text-slate-400">단가</th>
							<th class="w-28 px-4 py-2.5 text-right text-xs font-semibold text-slate-400">금액</th>
						</tr>
					</thead>
					<tbody>
						{#each inv.lines as line (line.category + line.itemName)}
							<tr class="border-b border-slate-50 hover:bg-slate-50">
								<td class="px-4 py-2.5 font-medium text-slate-700">{line.itemName}</td>
								<td class="w-20 px-4 py-2.5">
									<span class="rounded-full px-2 py-0.5 text-xs font-semibold {categoryBadge[line.category]}">{CATEGORY_LABELS[line.category]}</span>
								</td>
								<td class="w-16 whitespace-nowrap px-4 py-2.5 text-right text-slate-600">{line.quantity.toLocaleString()}</td>
								<td class="w-28 whitespace-nowrap px-4 py-2.5 text-right text-slate-500">{line.unitPrice > 0 ? formatMoney(line.unitPrice) : '—'}</td>
								<td class="w-28 whitespace-nowrap px-4 py-2.5 text-right font-bold text-slate-800">{line.amount > 0 ? formatMoney(line.amount) : '—'}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="border-t-2 border-slate-200 bg-indigo-50">
							<td colspan="2" class="px-4 py-3 font-extrabold text-slate-700">합계</td>
							<td class="w-16 whitespace-nowrap px-4 py-3 text-right font-extrabold text-slate-700">{inv.lines.reduce((s, l) => s + l.quantity, 0).toLocaleString()}</td>
							<td class="w-28 px-4 py-3"></td>
							<td class="w-28 whitespace-nowrap px-4 py-3 text-right text-base font-black text-indigo-700">{formatMoney(inv.totalAmount)}</td>
						</tr>
					</tfoot>
				</table>
				{#if inv.memo}
					<div class="mt-4 rounded-xl bg-slate-50 p-4">
						<p class="text-xs font-bold text-slate-400">메모</p>
						<p class="mt-1 text-sm text-slate-600">{inv.memo}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}