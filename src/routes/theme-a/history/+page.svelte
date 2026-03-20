<script lang="ts">
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import { goto } from '$app/navigation';
  import type { Shipment } from '$lib/data/types';

  // ── 기간 필터 상태 ────────────────────────────────────────────────
  type QuickFilter = 'today' | 'week' | 'month' | 'custom';
  let quickFilter = $state<QuickFilter>('month');

  function isoSlice(ms: number): string {
    return new Date(ms).toISOString().slice(0, 16);
  }
  function getTodayStart(): string {
    const now = Date.now();
    const d = new Date(now);
    return isoSlice(now - (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 1000 - d.getMilliseconds());
  }
  function getTodayEnd(): string {
    const now = Date.now();
    const d = new Date(now);
    const startOfDay = now - (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 1000 - d.getMilliseconds();
    return isoSlice(startOfDay + 86400000 - 1);
  }
  function getWeekStart(): string {
    const now = Date.now();
    const d = new Date(now);
    const dayMs = d.getDay() * 86400000;
    const startOfDay = now - (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 1000 - d.getMilliseconds();
    return isoSlice(startOfDay - dayMs);
  }
  function getMonthStart(): string {
    const now = Date.now();
    const d = new Date(now);
    const dayOfMonth = (d.getDate() - 1) * 86400000;
    const startOfDay = now - (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 1000 - d.getMilliseconds();
    return isoSlice(startOfDay - dayOfMonth);
  }

  let fromDate = $state(getMonthStart());
  let toDate = $state(getTodayEnd());

  // ── 빠른 필터 클릭 ────────────────────────────────────────────────
  function applyQuick(filter: QuickFilter) {
    quickFilter = filter;
    if (filter === 'today') {
      fromDate = getTodayStart();
      toDate = getTodayEnd();
    } else if (filter === 'week') {
      fromDate = getWeekStart();
      toDate = getTodayEnd();
    } else if (filter === 'month') {
      fromDate = getMonthStart();
      toDate = getTodayEnd();
    }
  }

  // ── 출고 기록 조회 ────────────────────────────────────────────────
  let shipments = $derived<Shipment[]>(
    store.selectedClientId
      ? store.getShipmentsByDateRange(
          store.selectedClientId,
          new Date(fromDate).toISOString(),
          new Date(toDate).toISOString()
        )
      : store.getShipmentsByDateRange(
          null,
          new Date(fromDate).toISOString(),
          new Date(toDate).toISOString()
        )
  );

  // ── 통계 요약 ─────────────────────────────────────────────────────
  let totalShipmentCount = $derived(shipments.length);
  let totalItemCount = $derived(
    shipments.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.quantity, 0), 0)
  );

  // ── 카테고리별 합계 ───────────────────────────────────────────────
  let categorySummary = $derived<Record<string, number>>(
    (() => {
      const map: Record<string, number> = { towel: 0, sheet: 0, uniform: 0 };
      for (const s of shipments) {
        for (const item of s.items) {
          map[item.category] = (map[item.category] ?? 0) + item.quantity;
        }
      }
      return map;
    })()
  );

  // ── 수정 모달 상태 ────────────────────────────────────────────────
  let editingShipment = $state<Shipment | null>(null);
  let editItems = $state<{ laundryItemId: string; itemName: string; category: string; quantity: number }[]>([]);
  let editDriverId = $state('');
  let editMemo = $state('');
  let editShippedAt = $state('');

  function openEditModal(shipment: Shipment) {
    editingShipment = shipment;
    editItems = shipment.items.map((i) => ({ ...i }));
    editDriverId = shipment.driverId;
    editMemo = shipment.memo ?? '';
    editShippedAt = isoSlice(Date.parse(shipment.shippedAt));
  }

  function closeEditModal() {
    editingShipment = null;
    editItems = [];
    editDriverId = '';
    editMemo = '';
    editShippedAt = '';
  }

  function saveEdit() {
    if (!editingShipment) return;
    store.updateShipment(editingShipment.id, {
      items: editItems as Shipment['items'],
      driverId: editDriverId,
      memo: editMemo.trim() || undefined,
      shippedAt: new Date(editShippedAt + ':00').toISOString(),
    });
    closeEditModal();
  }

  function adjustEditQty(idx: number, delta: number) {
    editItems = editItems.map((item, i) =>
      i === idx ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
    );
  }

  // ── 날짜 포맷 ─────────────────────────────────────────────────────
  function formatDate(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function formatDateShort(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ── 카테고리 색상 ─────────────────────────────────────────────────
  function catColor(cat: string): string {
    if (cat === 'towel') return 'bg-sky-100 text-sky-700';
    if (cat === 'sheet') return 'bg-violet-100 text-violet-700';
    if (cat === 'uniform') return 'bg-orange-100 text-orange-700';
    return 'bg-slate-100 text-slate-600';
  }

  // ── 빠른 필터 목록 ────────────────────────────────────────────────
  const quickFilters: { key: QuickFilter; label: string }[] = [
    { key: 'today', label: '오늘' },
    { key: 'week', label: '이번주' },
    { key: 'month', label: '이번달' },
    { key: 'custom', label: '직접입력' },
  ];
</script>

<!-- 수정 모달 (오버레이) -->
{#if editingShipment}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    role="presentation"
  >
    <!-- 백드롭 클릭 닫기용 버튼 -->
    <button
      type="button"
      aria-label="모달 닫기"
      class="absolute inset-0 w-full h-full cursor-default"
      onclick={closeEditModal}
    ></button>
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden relative z-10">

      <!-- 모달 헤더 -->
      <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100">
        <div>
          <h3 class="text-xl font-extrabold text-slate-800">출고 기록 수정</h3>
          <p class="text-sm text-slate-400 mt-0.5">{formatDate(editingShipment.shippedAt)}</p>
        </div>
        <button
          type="button"
          aria-label="모달 닫기"
          class="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all duration-150"
          onclick={closeEditModal}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- 모달 본문 -->
      <div class="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

        <!-- 품목 수량 수정 -->
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">품목 수량</p>
          <div class="space-y-3">
            {#each editItems as item, idx (item.laundryItemId)}
              <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-sm text-slate-800 truncate">{item.itemName}</p>
                  <span class="inline-block text-xs px-2 py-0.5 rounded-full mt-0.5 {catColor(item.category)}">
                    {CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] ?? item.category}
                  </span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    aria-label="{item.itemName} 수량 줄이기"
                    class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-lg flex items-center justify-center transition-all duration-150 active:scale-90"
                    onclick={() => adjustEditQty(idx, -1)}
                  >−</button>
                  <span class="w-12 text-center text-lg font-extrabold text-slate-800">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="{item.itemName} 수량 늘리기"
                    class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-lg flex items-center justify-center transition-all duration-150 active:scale-90"
                    onclick={() => adjustEditQty(idx, 1)}
                  >+</button>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- 배송기사 변경 -->
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">배송기사</p>
          <div class="grid grid-cols-1 gap-2">
            {#each store.drivers as driver (driver.id)}
              <button
                type="button"
                class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-150 active:scale-95
                  {editDriverId === driver.id
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                    : 'border-slate-100 bg-white text-slate-600 hover:border-emerald-200'}"
                onclick={() => { editDriverId = driver.id; }}
              >
                <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-sm">{driver.name}</p>
                  <p class="text-xs text-slate-400">{driver.phone}</p>
                </div>
                {#if editDriverId === driver.id}
                  <svg class="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- 배송 시간 -->
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">배송 시간</p>
          <input
            type="datetime-local"
            class="w-full h-12 rounded-xl border-2 border-slate-200 focus:border-emerald-400 outline-none px-4 text-slate-800 font-medium text-sm bg-white transition-all duration-150"
            bind:value={editShippedAt}
          />
        </div>

        <!-- 메모 -->
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">메모</p>
          <textarea
            class="w-full rounded-xl border-2 border-slate-200 focus:border-emerald-400 outline-none px-4 py-3 text-slate-800 text-sm bg-white resize-none transition-all duration-150"
            rows="2"
            placeholder="메모를 입력하세요..."
            bind:value={editMemo}
          ></textarea>
        </div>
      </div>

      <!-- 모달 하단 버튼 -->
      <div class="px-6 py-4 border-t border-slate-100 flex gap-3">
        <button
          type="button"
          class="flex-1 h-12 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all duration-150 active:scale-95"
          onclick={closeEditModal}
        >
          닫기
        </button>
        <button
          type="button"
          class="flex-1 h-12 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-600 text-white transition-all duration-150 active:scale-95 shadow-md shadow-emerald-200"
          onclick={saveEdit}
        >
          ✓ 저장
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ════════════════════════════════════════════════════════════════
     메인 레이아웃
════════════════════════════════════════════════════════════════ -->
<div class="flex h-screen bg-emerald-50 overflow-hidden">

  <!-- ════════════════════════════════════════════════════════════
       왼쪽 사이드바: 거래처 목록
  ════════════════════════════════════════════════════════════ -->
  <aside class="w-64 flex flex-col bg-white border-r border-emerald-100 shadow-sm shrink-0">

    <!-- 헤더 -->
    <div class="px-5 py-5 border-b border-emerald-100">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
        </div>
        <span class="text-base font-bold text-slate-800">거래처</span>
      </div>
    </div>

    <!-- 전체 보기 버튼 -->
    <div class="px-3 pt-3">
      <button
        type="button"
        class="w-full text-left px-4 py-3 rounded-xl font-medium text-sm transition-all duration-150 active:scale-95
          {store.selectedClientId === null
            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
            : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}"
        onclick={() => store.selectClient(null as unknown as string)}
      >
        <div class="font-bold text-base">전체 거래처</div>
        <div class="text-xs mt-0.5 {store.selectedClientId === null ? 'text-emerald-100' : 'text-slate-400'}">
          모든 거래처 출고 현황
        </div>
      </button>
    </div>

    <!-- 거래처 목록 -->
    <nav class="flex-1 overflow-y-auto py-2 px-3 space-y-1">
      {#each store.clients as client (client.id)}
        <button
          type="button"
          class="w-full text-left px-4 py-3 rounded-xl font-medium text-sm transition-all duration-150 active:scale-95
            {store.selectedClientId === client.id
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
              : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'}"
          onclick={() => store.selectClient(client.id)}
        >
          <div class="font-bold text-base">{client.name}</div>
          <div class="text-xs mt-0.5 {store.selectedClientId === client.id ? 'text-emerald-100' : 'text-slate-400'}">
            {client.type === 'hotel' ? '호텔' : client.type === 'pension' ? '펜션' : client.type === 'resort' ? '리조트' : '기타'}
          </div>
        </button>
      {/each}
    </nav>

    <!-- 하단 네비 -->
    <div class="p-3 border-t border-emerald-100 space-y-2">
      <button
        type="button"
        class="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-sm transition-all duration-150 active:scale-95"
        onclick={() => void goto('/theme-a')}
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        세탁물 관리
      </button>
      <button
        type="button"
        class="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-sm transition-all duration-150 active:scale-95"
        onclick={() => void goto('/theme-a/shipout')}
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
        </svg>
        출고 신청
      </button>
      <button
        type="button"
        class="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-sm transition-all duration-150 active:scale-95"
        onclick={() => void goto('/')}
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
        홈으로
      </button>
    </div>
  </aside>

  <!-- ════════════════════════════════════════════════════════════
       메인 콘텐츠
  ════════════════════════════════════════════════════════════ -->
  <main class="flex-1 flex flex-col overflow-hidden">

    <!-- 상단 헤더 -->
    <header class="bg-white border-b border-emerald-100 px-6 py-5 shadow-sm shrink-0">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <!-- 제목 -->
        <div>
          <h1 class="text-2xl font-extrabold text-slate-800">📋 출고 현황</h1>
          {#if store.selectedClient}
            <p class="text-sm text-slate-400 mt-0.5">{store.selectedClient.name}</p>
          {:else}
            <p class="text-sm text-slate-400 mt-0.5">전체 거래처</p>
          {/if}
        </div>

        <!-- 기간 필터 -->
        <div class="flex flex-col gap-3">
          <!-- 빠른 선택 버튼 -->
          <div class="flex gap-2">
            {#each quickFilters as { key, label } (key)}
              <button
                type="button"
                class="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150 active:scale-95
                  {quickFilter === key
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}"
                onclick={() => applyQuick(key)}
              >
                {label}
              </button>
            {/each}
          </div>
          <!-- 날짜 직접 입력 -->
          <div class="flex items-center gap-2">
            <input
              type="datetime-local"
              class="h-10 rounded-xl border-2 border-slate-200 focus:border-emerald-400 outline-none px-3 text-slate-700 text-sm bg-white transition-all duration-150"
              bind:value={fromDate}
              onchange={() => { quickFilter = 'custom'; }}
            />
            <span class="text-slate-400 font-bold text-sm">~</span>
            <input
              type="datetime-local"
              class="h-10 rounded-xl border-2 border-slate-200 focus:border-emerald-400 outline-none px-3 text-slate-700 text-sm bg-white transition-all duration-150"
              bind:value={toDate}
              onchange={() => { quickFilter = 'custom'; }}
            />
          </div>
        </div>
      </div>

      <!-- 요약 통계 카드 -->
      <div class="grid grid-cols-4 gap-3 mt-5">
        <div class="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <p class="text-xs font-bold text-emerald-600 mb-1">총 출고 건수</p>
          <p class="text-2xl font-extrabold text-emerald-700">{totalShipmentCount} <span class="text-sm font-bold">건</span></p>
        </div>
        <div class="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3">
          <p class="text-xs font-bold text-indigo-600 mb-1">총 출고 수량</p>
          <p class="text-2xl font-extrabold text-indigo-700">{totalItemCount} <span class="text-sm font-bold">개</span></p>
        </div>
        <div class="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3">
          <p class="text-xs font-bold text-sky-600 mb-1">타올 / 시트</p>
          <p class="text-2xl font-extrabold text-sky-700">
            {categorySummary['towel'] ?? 0}
            <span class="text-sm font-bold text-slate-400 mx-1">/</span>
            {categorySummary['sheet'] ?? 0}
            <span class="text-sm font-bold text-slate-400 ml-1">개</span>
          </p>
        </div>
        <div class="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3">
          <p class="text-xs font-bold text-orange-600 mb-1">유니폼</p>
          <p class="text-2xl font-extrabold text-orange-700">{categorySummary['uniform'] ?? 0} <span class="text-sm font-bold">개</span></p>
        </div>
      </div>
    </header>

    <!-- 출고 기록 목록 -->
    <div class="flex-1 overflow-y-auto p-6">
      {#if shipments.length === 0}
        <div class="flex flex-col items-center justify-center h-full text-slate-400">
          <svg class="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
          </svg>
          <p class="text-lg font-medium">해당 기간에 출고 기록이 없습니다</p>
          <p class="text-sm mt-1 text-slate-300">기간을 변경하거나 다른 거래처를 선택해 주세요</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each shipments as shipment (shipment.id)}
            {@const driver = store.getDriverById(shipment.driverId)}
            {@const client = store.getClientById(shipment.clientId)}
            {@const shipTotal = shipment.items.reduce((a, i) => a + i.quantity, 0)}
            <div
              class="bg-white rounded-2xl border-2 border-slate-100 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all duration-150 overflow-hidden cursor-pointer group"
              onclick={() => openEditModal(shipment)}
              role="button"
              tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEditModal(shipment); }}
            >
              <!-- 카드 헤더 -->
              <div class="flex items-start justify-between px-5 py-4 border-b border-slate-100 group-hover:bg-emerald-50 transition-colors duration-150">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3 flex-wrap">
                    <!-- 날짜 -->
                    <span class="text-base font-extrabold text-slate-800">
                      {formatDateShort(shipment.shippedAt)}
                    </span>
                    <!-- 거래처 (전체 보기일 때) -->
                    {#if !store.selectedClientId && client}
                      <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        {client.name}
                      </span>
                    {/if}
                    <!-- 기사 이름 -->
                    {#if driver}
                      <div class="flex items-center gap-1.5 text-sm text-slate-500">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        <span class="font-medium">{driver.name}</span>
                      </div>
                    {/if}
                    <!-- 메모 -->
                    {#if shipment.memo}
                      <span class="text-sm text-slate-400 italic truncate max-w-50">"{shipment.memo}"</span>
                    {/if}
                  </div>
                </div>
                <!-- 총 수량 + 수정 아이콘 -->
                <div class="flex items-center gap-3 shrink-0 ml-4">
                  <div class="text-right">
                    <p class="text-xs text-slate-400 font-medium">총 수량</p>
                    <p class="text-xl font-extrabold text-emerald-700">{shipTotal}<span class="text-sm font-bold text-slate-400 ml-1">개</span></p>
                  </div>
                  <div class="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-600 text-slate-400 flex items-center justify-center transition-all duration-150">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </div>
                </div>
              </div>

              <!-- 품목 목록 -->
              <div class="px-5 py-3">
                <div class="flex flex-wrap gap-2">
                  {#each shipment.items as item (item.laundryItemId)}
                    <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl {catColor(item.category)}">
                      <span class="text-sm font-bold">{item.itemName}</span>
                      <span class="text-base font-extrabold">{item.quantity}</span>
                      <span class="text-xs opacity-70">개</span>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </main>
</div>