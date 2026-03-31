<script lang="ts">
  import { store } from '$lib/data/store.svelte';
  import { goto } from '$app/navigation';
  import type { ShipmentItem } from '$lib/data/types';

  type QuickFilter = 'today' | 'week' | 'month' | 'custom';

  // ── 날짜 유틸 ─────────────────────────────────────────────────────
  function pad(n: number): string { return String(n).padStart(2, '0'); }

  function dateToYMD(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function todayYMD(): string { return dateToYMD(new Date()); }

  function getWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const ms = now.getTime() - day * 86400000;
    return dateToYMD(new Date(ms));
  }

  function getMonthStart(): string {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  }

  // ── 상태 ─────────────────────────────────────────────────────────
  let quickFilter = $state<QuickFilter>('today');
  let fromDate = $state(todayYMD());
  let toDate = $state(todayYMD());

  let editingShipmentId = $state<string | null>(null);
  let editPanelVisible = $state(false);
  let editItems = $state<ShipmentItem[]>([]);
  let editShippedAt = $state('');
  let deleteConfirming = $state(false);

  // ── 상수 ─────────────────────────────────────────────────────────
  const clientTypeIcon: Record<string, string> = {
    hotel: '🏨', pension: '🏡', resort: '🌴', etc: '🏢',
  };
  const clientTypeBadge: Record<string, string> = {
    hotel: 'bg-sky-100 text-sky-700',
    pension: 'bg-emerald-100 text-emerald-700',
    resort: 'bg-amber-100 text-amber-700',
    etc: 'bg-slate-100 text-slate-600',
  };
  const clientTypeLabel: Record<string, string> = {
    hotel: '호텔', pension: '펜션', resort: '리조트', etc: '기타',
  };

  const catColor: Record<string, string> = {
    towel:   'bg-sky-100 text-sky-700',
    sheet:   'bg-indigo-100 text-indigo-700',
    uniform: 'bg-amber-100 text-amber-700',
  };

  const quickFilters: { key: QuickFilter; label: string }[] = [
    { key: 'today', label: '오늘' },
    { key: 'week',  label: '이번주' },
    { key: 'month', label: '이번달' },
  ];

  const navItems = [
    { path: '/',                icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: '홈' },
    { path: '/theme-b',         icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4', label: '세탁물' },
    { path: '/theme-b/shipout', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', label: '출고' },
    { path: '/theme-b/history', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: '현황' },
  ];
  const currentPath = '/theme-b/history';

  // ── 빠른 선택 ────────────────────────────────────────────────────
  function applyQuick(key: QuickFilter) {
    quickFilter = key;
    const today = todayYMD();
    if (key === 'today') {
      fromDate = today; toDate = today;
    } else if (key === 'week') {
      fromDate = getWeekStart(); toDate = today;
    } else if (key === 'month') {
      fromDate = getMonthStart(); toDate = today;
    }
  }

  function onDateInput() { quickFilter = 'custom'; }

  // ── 파생값 ───────────────────────────────────────────────────────
  let shipments = $derived(
    store.getShipmentsByDateRange(
      store.selectedClientId,
      `${fromDate}T00:00:00.000Z`,
      `${toDate}T23:59:59.999Z`
    ).sort((a, b) => new Date(b.shippedAt).getTime() - new Date(a.shippedAt).getTime())
  );

  let totalItemCount = $derived(
    shipments.reduce((s, sh) => s + sh.items.reduce((a, i) => a + i.quantity, 0), 0)
  );

  let uniqueClientCount = $derived(
    new Set(shipments.map((s) => s.clientId)).size
  );

  // ── 편집 패널 ────────────────────────────────────────────────────
  function toLocalDatetimeValue(isoStr: string): string {
    const d = new Date(isoStr);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openEditPanel(shipment: { id: string; items: ShipmentItem[]; shippedAt: string }) {
    editingShipmentId = shipment.id;
    editItems = shipment.items.map((i) => ({ ...i }));
    editShippedAt = toLocalDatetimeValue(shipment.shippedAt);
    editPanelVisible = true;
    deleteConfirming = false;
  }

  function closeEditPanel() {
    editPanelVisible = false;
    editingShipmentId = null;
    deleteConfirming = false;
  }

  function adjustEditQty(idx: number, delta: number) {
    const item = editItems[idx];
    if (!item) return;
    const next = Math.max(0, item.quantity + delta);
    editItems = editItems.map((it, i) => i === idx ? { ...it, quantity: next } : it);
  }

  function saveEdit() {
    if (!editingShipmentId) return;
    store.updateShipment(editingShipmentId, {
      items: editItems.filter((i) => i.quantity > 0),
      shippedAt: new Date(editShippedAt).toISOString(),
    });
    closeEditPanel();
  }

  function deleteShipment() {
    if (!editingShipmentId) return;
    store.removeShipment(editingShipmentId);
    closeEditPanel();
  }

  function reprintSlip() {
    alert('전표 재출력 기능은 준비 중입니다.');
  }

  // ── 포맷 ─────────────────────────────────────────────────────────
  function formatDate(isoStr: string): string {
    const d = new Date(isoStr);
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  }

  function formatTime(isoStr: string): string {
    const d = new Date(isoStr);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }


</script>

<svelte:head><title>출고 현황</title></svelte:head>

<div class="flex h-screen bg-slate-50 overflow-hidden select-none">

  <!-- ── 아이콘 내비 ── -->
  <nav class="w-16 bg-sky-700 flex flex-col items-center py-3 gap-0.5 shrink-0 shadow-lg z-10">
    <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3 shrink-0">
      <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"/>
      </svg>
    </div>
    {#each navItems as nav (nav.path)}
      <button
        class="w-12 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150
          {currentPath === nav.path ? 'bg-sky-500 text-white' : 'text-sky-200 hover:bg-white/10'}"
        aria-label={nav.label}
        onclick={() => void goto(nav.path)}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={nav.icon}/>
        </svg>
        <span class="text-[9px] font-bold">{nav.label}</span>
      </button>
    {/each}
  </nav>

  <!-- ── 거래처 패널 (전체 포함) ── -->
  <aside class="w-52 bg-white border-r border-sky-100 flex flex-col shrink-0 overflow-hidden">
    <div class="px-3 py-3 border-b border-sky-100 shrink-0">
      <h2 class="text-sm font-extrabold text-slate-700 tracking-wide">거래처</h2>
      <p class="text-[10px] text-slate-400 mt-0.5">{store.clients.length}개 등록</p>
    </div>
    <div class="flex-1 overflow-y-auto">

      <!-- 전체 버튼 -->
      {#if true}
        {@const isAllSel = store.selectedClientId === null}
        <button
          class="w-full flex items-center gap-2 px-3 py-4 transition-all duration-150 border-b border-slate-100
            {isAllSel ? 'bg-sky-50 border-l-4 border-l-sky-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}"
          style="min-height:64px"
          onclick={() => store.selectClient(null)}
        >
          <span class="text-2xl shrink-0">📋</span>
          <div class="flex-1 min-w-0 text-left">
            <p class="text-base font-bold {isAllSel ? 'text-sky-700' : 'text-slate-700'}">전체</p>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-500">
              모든 거래처
            </span>
          </div>
          {#if isAllSel}
            <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600 font-bold shrink-0">선택</span>
          {/if}
        </button>
      {/if}

      {#each store.clients as client (client.id)}
        {@const isSel = store.selectedClientId === client.id}
        <button
          class="w-full flex items-center gap-2 px-3 py-4 transition-all duration-150 border-b border-slate-50
            {isSel ? 'bg-sky-50 border-l-4 border-l-sky-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}"
          style="min-height:64px"
          onclick={() => store.selectClient(client.id)}
        >
          <span class="text-2xl shrink-0">{clientTypeIcon[client.type] ?? '🏢'}</span>
          <div class="flex-1 min-w-0 text-left">
            <p class="text-base font-bold truncate {isSel ? 'text-sky-700' : 'text-slate-800'}">{client.name}</p>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold {clientTypeBadge[client.type] ?? 'bg-slate-100 text-slate-600'}">
              {clientTypeLabel[client.type] ?? client.type}
            </span>
          </div>
        </button>
      {/each}
    </div>
  </aside>

  <!-- ── 메인 영역 ── -->
  <div class="flex-1 flex flex-col overflow-hidden relative">

    <!-- 필터 바 -->
    <div class="bg-white border-b border-sky-100 px-5 py-3 shrink-0 shadow-sm">
      <div class="flex items-center justify-between gap-4 flex-wrap">

        <!-- 제목 + 거래처 -->
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-extrabold text-slate-800">출고 현황</h1>
          {#if store.selectedClient}
            <span class="px-2.5 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-bold">
              {store.selectedClient.name}
            </span>
          {:else}
            <span class="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">전체</span>
          {/if}
        </div>

        <!-- 빠른선택 + 날짜 범위 -->
        <div class="flex items-center gap-3 flex-wrap">
          <!-- 빠른 선택 버튼 (standalone, no wrapper bg) -->
          <div class="flex gap-3">
            {#each quickFilters as { key, label } (key)}
              <button
                class="px-6 py-3 text-base font-bold rounded-xl transition-all duration-150
                  {quickFilter === key
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-sky-50'}"
                onclick={() => applyQuick(key)}
              >{label}</button>
            {/each}
          </div>

          <!-- 날짜 범위 입력 -->
          <div class="flex items-center gap-1.5">
            <input
              type="date"
              bind:value={fromDate}
              oninput={onDateInput}
              class="h-11 px-3 rounded-xl border border-slate-200 text-base font-bold text-slate-700
                focus:outline-none focus:border-sky-400 transition-all"
            />
            <span class="text-slate-400 text-sm font-bold">~</span>
            <input
              type="date"
              bind:value={toDate}
              oninput={onDateInput}
              class="h-11 px-3 rounded-xl border border-slate-200 text-base font-bold text-slate-700
                focus:outline-none focus:border-sky-400 transition-all"
            />
          </div>

          <span class="text-xs text-slate-400 font-medium">
            총 <span class="font-extrabold text-slate-700">{shipments.length}</span>건 /
            <span class="font-extrabold text-slate-700">{totalItemCount}</span>개
          </span>
        </div>
      </div>

      <!-- 요약 카드 3개 -->
      <div class="grid grid-cols-3 gap-3 mt-3">
        <div class="rounded-xl bg-sky-50 border border-sky-200 px-6 py-4">
          <p class="text-xs font-bold text-sky-600 mb-0.5">총 출고 건수</p>
          <p class="text-3xl font-extrabold text-sky-700">
            {shipments.length}<span class="text-sm font-bold ml-1">건</span>
          </p>
        </div>
        <div class="rounded-xl bg-indigo-50 border border-indigo-200 px-6 py-4">
          <p class="text-xs font-bold text-indigo-600 mb-0.5">총 출고 수량</p>
          <p class="text-3xl font-extrabold text-indigo-700">
            {totalItemCount}<span class="text-sm font-bold ml-1">개</span>
          </p>
        </div>
        <div class="rounded-xl bg-teal-50 border border-teal-200 px-6 py-4">
          <p class="text-xs font-bold text-teal-600 mb-0.5">거래처 수</p>
          <p class="text-3xl font-extrabold text-teal-700">
            {uniqueClientCount}<span class="text-sm font-bold ml-1">개</span>
          </p>
        </div>
      </div>
    </div>

    <!-- 테이블 헤더 -->
    {#if shipments.length > 0}
      <div class="bg-slate-100 border-b border-slate-200 px-4 shrink-0">
        <div class="flex items-center h-10">
          <div class="w-36 shrink-0">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wide">날짜/시간</span>
          </div>
          <div class="w-36 shrink-0">
            <span class="text-xs font-bold text-slate-500">거래처</span>
          </div>
          <div class="flex-1 min-w-0">
            <span class="text-xs font-bold text-slate-500">품목</span>
          </div>
          <div class="w-24 text-center shrink-0">
            <span class="text-xs font-bold text-slate-500">총수량</span>
          </div>
          <div class="w-16 text-center shrink-0">
            <span class="text-xs font-bold text-slate-500">수정</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- 출고 기록 목록 -->
    <div class="flex-1 overflow-y-auto">
      {#if shipments.length === 0}
        <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
          <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg class="w-8 h-8 opacity-40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
            </svg>
          </div>
          <p class="text-base font-medium">해당 기간 출고 기록이 없습니다</p>
          <p class="text-sm text-slate-300">기간을 변경하거나 출고를 등록해보세요</p>
        </div>
      {:else}
        {#each shipments as shipment (shipment.id)}
          {@const client = store.getClientById(shipment.clientId)}
          {@const shipTotal = shipment.items.reduce((a, i) => a + i.quantity, 0)}
          {@const isEditing = editingShipmentId === shipment.id && editPanelVisible}
          <!-- 행 전체 클릭 가능 -->
          <div
            role="button"
            tabindex="0"
            class="flex items-center px-4 border-b border-slate-100 transition-all duration-150 cursor-pointer
              {isEditing
                ? 'bg-sky-50 border-l-4 border-l-sky-500'
                : 'hover:bg-slate-50 border-l-4 border-l-transparent'}"
            style="min-height:64px"
            onclick={() => openEditPanel(shipment)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEditPanel(shipment); }}
          >
            <!-- 날짜/시간 -->
            <div class="w-36 shrink-0 py-2">
              <p class="text-sm font-bold text-slate-700">{formatDate(shipment.shippedAt)}</p>
              <p class="text-xs text-slate-400 mt-0.5">{formatTime(shipment.shippedAt)}</p>
            </div>

            <!-- 거래처 -->
            <div class="w-36 shrink-0 py-2">
              {#if client}
                <p class="text-base font-bold text-slate-700 truncate">{client.name}</p>
                <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold {clientTypeBadge[client.type] ?? 'bg-slate-100 text-slate-600'}">
                  {clientTypeLabel[client.type] ?? client.type}
                </span>
              {:else}
                <p class="text-sm text-slate-400">알 수 없음</p>
              {/if}
            </div>

            <!-- 품목 chips -->
            <div class="flex-1 min-w-0 py-2 flex flex-wrap gap-1 overflow-hidden">
              {#each shipment.items as item (item.laundryItemId)}
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold
                  {catColor[item.category] ?? 'bg-slate-100 text-slate-600'}">
                  {item.itemName}
                  <span class="font-extrabold">{item.quantity}</span>
                </span>
              {/each}
              {#if shipment.memo}
                <span class="text-xs text-slate-400 italic self-center truncate max-w-24">{shipment.memo}</span>
              {/if}
            </div>

            <!-- 총수량 -->
            <div class="w-24 text-center shrink-0 py-2">
              <span class="text-2xl font-extrabold text-sky-700">{shipTotal}</span>
              <span class="text-xs text-slate-400 ml-0.5">개</span>
            </div>

            <!-- 수정 버튼 (행 클릭과 별도로도 동작) -->
            <div class="w-16 flex justify-center shrink-0 py-2">
              <button
                aria-label="출고 수정"
                class="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-150
                  {isEditing ? 'bg-sky-500 text-white' : 'bg-slate-100 hover:bg-sky-100 text-slate-500 hover:text-sky-600'}"
                onclick={(e) => { e.stopPropagation(); if (isEditing) { closeEditPanel(); } else { openEditPanel(shipment); } }}
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- ── 수정 드로어 ── -->
    {#if editingShipmentId !== null}
      <!-- 배경 오버레이 (클릭 시 패널 닫기) -->
      <button
        class="absolute inset-0 bg-black/10 z-10 cursor-default"
        onclick={closeEditPanel}
        aria-label="수정 패널 닫기"
      ></button>

      <!-- 드로어 패널 -->
      <div
        class="absolute right-0 top-0 bottom-0 w-[520px] bg-white shadow-2xl z-20 flex flex-col
          transition-transform duration-300
          {editPanelVisible ? 'translate-x-0' : 'translate-x-full'}"
      >
        <!-- 드로어 헤더 -->
        <div class="px-6 py-5 bg-sky-700 flex items-start justify-between shrink-0">
          <div>
            <h3 class="text-lg font-black text-white">출고 수정</h3>
            {#each store.shipments.filter(sh => sh.id === editingShipmentId) as s (s.id)}
              <p class="text-sm text-sky-200 mt-0.5">{formatDate(s.shippedAt)} {formatTime(s.shippedAt)}</p>
            {/each}
          </div>
          <button
            aria-label="닫기"
            class="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all shrink-0"
            onclick={closeEditPanel}
          >
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">

          <!-- 품목별 수량 수정 -->
          <div class="px-5 py-4 border-b border-slate-100">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">품목별 수량</p>
            <div class="space-y-2">
              {#each editItems as item, idx (item.laundryItemId)}
                <div class="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3" style="min-height:56px">
                  <div class="flex-1 min-w-0">
                    <p class="text-base font-bold text-slate-800 truncate">{item.itemName}</p>
                    <span class="inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 font-bold
                      {catColor[item.category] ?? 'bg-slate-100 text-slate-600'}">
                      {item.category}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      aria-label="수량 감소"
                      class="w-10 h-10 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold
                        flex items-center justify-center text-xl transition-all active:scale-95"
                      onclick={() => adjustEditQty(idx, -1)}
                    >−</button>
                    <span class="w-12 text-center text-xl font-extrabold text-sky-700">{item.quantity}</span>
                    <button
                      aria-label="수량 증가"
                      class="w-10 h-10 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold
                        flex items-center justify-center text-xl transition-all active:scale-95"
                      onclick={() => adjustEditQty(idx, 1)}
                    >+</button>
                  </div>
                </div>
              {/each}
            </div>
            <!-- 합계 -->
            <div class="mt-3 flex items-center justify-between px-4 py-3 bg-sky-50 rounded-xl border border-sky-200">
              <span class="text-sm font-bold text-slate-500">총 수량</span>
              <span class="text-lg font-extrabold text-sky-700">
                {editItems.reduce((s, i) => s + i.quantity, 0)}<span class="text-sm font-bold ml-1">개</span>
              </span>
            </div>
          </div>

          <!-- 출고 시간 수정 -->
          <div class="px-5 py-4 border-b border-slate-100">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">출고 시간</p>
            <input
              type="datetime-local"
              bind:value={editShippedAt}
              class="w-full h-11 px-3 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-700
                focus:outline-none focus:border-sky-400 transition-all"
            />
          </div>

          <!-- 삭제 확인 영역 -->
          {#if deleteConfirming}
            <div class="px-5 py-4 bg-red-50 border-b border-red-100">
              <p class="text-sm font-bold text-red-700 mb-3">정말 삭제하시겠습니까?</p>
              <div class="flex gap-2">
                <button
                  class="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm
                    transition-all active:scale-95"
                  onclick={deleteShipment}
                >삭제 확인</button>
                <button
                  class="flex-1 h-11 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm
                    transition-all"
                  onclick={() => (deleteConfirming = false)}
                >취소</button>
              </div>
            </div>
          {/if}

        </div>

        <!-- 드로어 푸터 버튼 -->
        <div class="px-5 py-4 border-t border-slate-100 space-y-2 shrink-0">
          <!-- 저장 -->
          <button
            class="w-full h-14 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-base font-bold
              transition-all duration-150 active:scale-[0.98] shadow-md shadow-sky-200"
            onclick={saveEdit}
          >저장</button>

          <!-- 전표 재출력 -->
          <button
            class="w-full h-12 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white
              transition-all duration-150 active:scale-[0.98]"
            onclick={reprintSlip}
          >🖨️ 전표 재출력</button>

          <!-- 삭제 토글 -->
          <button
            class="w-full h-12 rounded-xl font-bold text-sm transition-all duration-150 border
              {deleteConfirming
                ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
                : 'bg-white border-red-200 text-red-500 hover:bg-red-50'}"
            onclick={() => (deleteConfirming = !deleteConfirming)}
          >
            {deleteConfirming ? '▲ 삭제 취소' : '🗑 삭제'}
          </button>
        </div>
      </div>
    {/if}

  </div>

</div>