<script lang="ts">
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import { goto } from '$app/navigation';

  type QuickFilter = 'today' | 'week' | 'month' | 'all';

  let quickFilter = $state<QuickFilter>('month');

  function dateToYMD(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function todayYMD(): string {
    const now = new Date();
    return dateToYMD(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  function getWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const ms = now.getTime() - day * 86400000;
    const d = new Date(ms);
    return dateToYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  function getMonthStart(): string {
    const now = new Date();
    return dateToYMD(now.getFullYear(), now.getMonth() + 1, 1);
  }

  let fromDate = $state(getMonthStart());
  let toDate = $state(todayYMD());

  function applyQuick(key: QuickFilter) {
    quickFilter = key;
    if (key === 'today') {
      fromDate = todayYMD();
      toDate = todayYMD();
    } else if (key === 'week') {
      fromDate = getWeekStart();
      toDate = todayYMD();
    } else if (key === 'month') {
      fromDate = getMonthStart();
      toDate = todayYMD();
    } else {
      fromDate = '2000-01-01';
      toDate = '2099-12-31';
    }
  }

  let shipments = $derived(
    store
      .getShipmentsByDateRange(
        store.selectedClientId,
        fromDate + 'T00:00:00.000Z',
        toDate + 'T23:59:59.999Z'
      )
      .sort((a, b) => new Date(b.shippedAt).getTime() - new Date(a.shippedAt).getTime())
  );

  let totalShipmentCount = $derived(shipments.length);
  let totalItemCount = $derived(
    shipments.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.quantity, 0), 0)
  );
  let uniqueClientCount = $derived(new Set(shipments.map((s) => s.clientId)).size);


  // 수정 드로어 상태
  let editingShipmentId = $state<string | null>(null);
  let editItems = $state<{ laundryItemId: string; itemName: string; category: string; quantity: number }[]>([]);
  let editDriverId = $state('');
  let editMemo = $state('');
  let editShippedAt = $state('');
  let editPanelVisible = $state(false);

  function padNum(n: number): string {
    return String(n).padStart(2, '0');
  }

  function openEditPanel(shipmentId: string) {
    const s = store.shipments.find((sh) => sh.id === shipmentId);
    if (!s) return;
    editingShipmentId = shipmentId;
    editItems = s.items.map((i) => ({ ...i }));
    editDriverId = s.driverId;
    editMemo = s.memo ?? '';
    const d = new Date(s.shippedAt);
    editShippedAt = `${d.getFullYear()}-${padNum(d.getMonth() + 1)}-${padNum(d.getDate())}T${padNum(d.getHours())}:${padNum(d.getMinutes())}`;
    editPanelVisible = true;
  }

  function closeEditPanel() {
    editPanelVisible = false;
    setTimeout(() => {
      editingShipmentId = null;
    }, 250);
  }

  function saveEdit() {
    if (!editingShipmentId) return;
    store.updateShipment(editingShipmentId, {
      items: editItems as Parameters<typeof store.updateShipment>[1]['items'],
      driverId: editDriverId,
      memo: editMemo.trim() || undefined,
      shippedAt: new Date(editShippedAt).toISOString(),
    });
    closeEditPanel();
  }

  function adjustEditQty(idx: number, delta: number) {
    editItems = editItems.map((item, i) =>
      i === idx ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
    );
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${padNum(d.getMonth() + 1)}-${padNum(d.getDate())} ${padNum(d.getHours())}:${padNum(d.getMinutes())}`;
  }

  function formatDateShort(iso: string): string {
    const d = new Date(iso);
    return `${padNum(d.getMonth() + 1)}/${padNum(d.getDate())} ${padNum(d.getHours())}:${padNum(d.getMinutes())}`;
  }

  function catColor(cat: string): string {
    if (cat === 'towel') return 'bg-sky-100 text-sky-700';
    if (cat === 'sheet') return 'bg-violet-100 text-violet-700';
    if (cat === 'uniform') return 'bg-orange-100 text-orange-700';
    return 'bg-slate-100 text-slate-600';
  }

  const clientTypeIcon: Record<string, string> = {
    hotel: '🏨',
    pension: '🏡',
    resort: '🌴',
    etc: '🏢',
  };

  const clientTypeLabel: Record<string, string> = {
    hotel: '호텔',
    pension: '펜션',
    resort: '리조트',
    etc: '기타',
  };

  const clientTypeBadgeColor: Record<string, string> = {
    hotel: 'bg-sky-100 text-sky-700',
    pension: 'bg-emerald-100 text-emerald-700',
    resort: 'bg-amber-100 text-amber-700',
    etc: 'bg-slate-100 text-slate-600',
  };

  const quickFilters: { key: QuickFilter; label: string }[] = [
    { key: 'today', label: '오늘' },
    { key: 'week', label: '이번주' },
    { key: 'month', label: '이번달' },
    { key: 'all', label: '전체' },
  ];

  function navTo(path: string) {
    void goto(path);
  }
</script>

<div class="flex h-screen bg-slate-50 overflow-hidden">

  <!-- ① 아이콘 내비 (w-16) -->
  <nav class="w-16 bg-sky-700 flex flex-col items-center py-4 gap-1 shrink-0 shadow-lg z-10">
    <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-4 shrink-0">
      <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"/>
      </svg>
    </div>

    <button
      onclick={() => navTo('/')}
      aria-label="홈으로 이동"
      class="w-full h-14 flex flex-col items-center justify-center gap-0.5 text-sky-200 hover:text-white hover:bg-white/10 transition-colors rounded-lg mx-1"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
      </svg>
      <span class="text-[9px] font-bold">홈</span>
    </button>

    <button
      onclick={() => navTo('/theme-b')}
      aria-label="세탁물 관리"
      class="w-full h-14 flex flex-col items-center justify-center gap-0.5 text-sky-200 hover:text-white hover:bg-white/10 transition-colors rounded-lg mx-1"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
      </svg>
      <span class="text-[9px] font-bold">세탁물</span>
    </button>

    <button
      onclick={() => navTo('/theme-b/shipout')}
      aria-label="출고 신청"
      class="w-full h-14 flex flex-col items-center justify-center gap-0.5 text-sky-200 hover:text-white hover:bg-white/10 transition-colors rounded-lg mx-1"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
      </svg>
      <span class="text-[9px] font-bold">출고신청</span>
    </button>

    <!-- 출고현황 (현재) -->
    <button
      onclick={() => navTo('/theme-b/history')}
      aria-label="출고 현황 (현재 페이지)"
      class="w-full h-14 flex flex-col items-center justify-center gap-0.5 bg-sky-500 text-white rounded-lg mx-1 shadow-md"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
      <span class="text-[9px] font-bold">출고현황</span>
    </button>
  </nav>

  <!-- ② 거래처 패널 (w-56) -->
  <aside class="w-56 bg-white border-r border-sky-100 flex flex-col shrink-0 overflow-hidden">
    <div class="px-3 py-3 border-b border-sky-100 shrink-0">
      <h2 class="text-sm font-bold text-slate-500 tracking-wide">거래처 목록</h2>
      <p class="text-[10px] text-slate-400 mt-0.5">{store.clients.length}개 거래처</p>
    </div>
    <div class="flex-1 overflow-y-auto py-1">

      <!-- 전체 버튼 -->
      <button
        onclick={() => store.selectClient(null)}
        class="w-full h-12 px-3 text-left flex items-center gap-2 transition-all duration-150
          {store.selectedClientId === null
            ? 'bg-sky-50 border-l-4 border-sky-500'
            : 'border-l-4 border-transparent hover:bg-slate-50'}"
      >
        <span class="text-xl shrink-0">📋</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold {store.selectedClientId === null ? 'text-sky-700' : 'text-slate-700'}">전체 거래처</p>
        </div>
        {#if store.selectedClientId === null}
          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600 font-bold">{store.clients.length}</span>
        {/if}
      </button>

      {#each store.clients as client (client.id)}
        {@const isSelected = store.selectedClientId === client.id}
        <button
          onclick={() => store.selectClient(client.id)}
          class="w-full h-16 px-3 text-left flex items-center gap-2 transition-all duration-150
            {isSelected
              ? 'bg-sky-50 border-l-4 border-sky-500'
              : 'border-l-4 border-transparent hover:bg-slate-50'}"
        >
          <span class="text-xl shrink-0">{clientTypeIcon[client.type] ?? '🏢'}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold truncate {isSelected ? 'text-sky-700' : 'text-slate-800'}">{client.name}</p>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold {clientTypeBadgeColor[client.type] ?? 'bg-slate-100 text-slate-600'}">
              {clientTypeLabel[client.type] ?? client.type}
            </span>
          </div>
        </button>
      {/each}
    </div>
  </aside>

  <!-- ③ 메인 영역 (flex-1 flex-col) -->
  <div class="flex-1 flex flex-col overflow-hidden relative">

    <!-- 상단 필터 바 -->
    <div class="bg-white border-b border-sky-100 px-5 py-3 shrink-0 shadow-sm">
      <!-- 제목 + 필터 -->
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-extrabold text-slate-800">출고 현황</h1>
          {#if store.selectedClient}
            <span class="px-2.5 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-bold">
              {store.selectedClient.name}
            </span>
          {:else}
            <span class="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">
              전체 거래처
            </span>
          {/if}
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- 빠른 필터 버튼 -->
          <div class="flex gap-1 bg-slate-100 rounded-xl p-1">
            {#each quickFilters as { key, label } (key)}
              <button
                onclick={() => applyQuick(key)}
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150
                  {quickFilter === key
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-sky-600 hover:bg-white'}"
              >
                {label}
              </button>
            {/each}
          </div>

          <!-- 직접 날짜 입력 -->
          <div class="flex items-center gap-1.5">
            <input
              type="date"
              bind:value={fromDate}
              onchange={() => (quickFilter = 'all')}
              class="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
            />
            <span class="text-slate-400 text-xs font-bold">~</span>
            <input
              type="date"
              bind:value={toDate}
              onchange={() => (quickFilter = 'all')}
              class="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
            />
          </div>
        </div>
      </div>

      <!-- 요약 카드 4개 -->
      <div class="grid grid-cols-4 gap-3 mt-3">
        <div class="rounded-xl bg-sky-50 border border-sky-200 px-4 py-2.5">
          <p class="text-xs font-bold text-sky-600 mb-0.5">총 출고 건수</p>
          <p class="text-2xl font-extrabold text-sky-700">
            {totalShipmentCount}<span class="text-sm font-bold ml-1">건</span>
          </p>
        </div>
        <div class="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-2.5">
          <p class="text-xs font-bold text-indigo-600 mb-0.5">총 출고 수량</p>
          <p class="text-2xl font-extrabold text-indigo-700">
            {totalItemCount}<span class="text-sm font-bold ml-1">개</span>
          </p>
        </div>
        <div class="rounded-xl bg-teal-50 border border-teal-200 px-4 py-2.5">
          <p class="text-xs font-bold text-teal-600 mb-0.5">거래처 건수</p>
          <p class="text-2xl font-extrabold text-teal-700">
            {uniqueClientCount}<span class="text-sm font-bold ml-1">곳</span>
          </p>
        </div>
        <div class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
          <p class="text-xs font-bold text-amber-600 mb-0.5">기간</p>
          <p class="text-sm font-extrabold text-amber-700 leading-tight mt-0.5">
            {fromDate === '2000-01-01' ? '전체' : fromDate}
            {#if fromDate !== toDate && fromDate !== '2000-01-01'}
              <span class="text-amber-400 font-normal mx-0.5">~</span>
              {toDate}
            {/if}
          </p>
        </div>
      </div>
    </div>

    <!-- 테이블 헤더 -->
    {#if shipments.length > 0}
      <div class="bg-slate-100 border-b border-slate-200 px-4 shrink-0">
        <div class="flex items-center h-9">
          <div class="w-36 shrink-0">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wide">날짜/시간</span>
          </div>
          <div class="w-32 shrink-0">
            <span class="text-xs font-bold text-slate-500">거래처</span>
          </div>
          <div class="w-28 shrink-0">
            <span class="text-xs font-bold text-slate-500">배송기사</span>
          </div>
          <div class="flex-1 min-w-0">
            <span class="text-xs font-bold text-slate-500">품목</span>
          </div>
          <div class="w-20 text-center shrink-0">
            <span class="text-xs font-bold text-slate-500">총수량</span>
          </div>
          <div class="w-16 text-center shrink-0">
            <span class="text-xs font-bold text-slate-500">수정</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- 출고 기록 테이블 바디 -->
    <div class="flex-1 overflow-y-auto">
      {#if shipments.length === 0}
        <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
          <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg class="w-8 h-8 opacity-40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
            </svg>
          </div>
          <p class="text-base font-medium">출고 기록이 없습니다</p>
          <p class="text-sm text-slate-300">선택한 기간에 출고 내역이 없습니다</p>
          <button
            onclick={() => navTo('/theme-b/shipout')}
            class="mt-1 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold transition-colors"
          >
            출고 신청하기 →
          </button>
        </div>
      {:else}
        {#each shipments as shipment (shipment.id)}
          {@const driver = store.getDriverById(shipment.driverId)}
          {@const client = store.getClientById(shipment.clientId)}
          {@const shipTotal = shipment.items.reduce((a, i) => a + i.quantity, 0)}
          {@const isEditing = editingShipmentId === shipment.id && editPanelVisible}
          <div
            class="flex items-center px-4 h-14 border-b border-slate-100 transition-all duration-100
              {isEditing
                ? 'bg-sky-50 border-l-4 border-l-sky-500'
                : 'bg-white border-l-4 border-l-transparent hover:bg-sky-50'}"
          >
            <!-- 날짜/시간 -->
            <div class="w-36 shrink-0 py-2">
              <p class="text-sm font-bold text-slate-700">{formatDateShort(shipment.shippedAt)}</p>
              <p class="text-[10px] text-slate-400 mt-0.5">등록: {formatDateShort(shipment.createdAt)}</p>
            </div>

            <!-- 거래처 -->
            <div class="w-32 shrink-0 py-2">
              {#if client}
                <p class="text-sm font-bold text-slate-700 truncate">{client.name}</p>
                <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold
                  {clientTypeBadgeColor[client.type] ?? 'bg-slate-100 text-slate-500'}">
                  {clientTypeLabel[client.type] ?? client.type}
                </span>
              {:else}
                <p class="text-sm text-slate-400">알 수 없음</p>
              {/if}
            </div>

            <!-- 배송기사 -->
            <div class="w-28 shrink-0 py-2">
              {#if driver}
                <div class="flex items-center gap-1.5">
                  <div class="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                    <svg class="w-3 h-3 text-sky-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-bold text-slate-700">{driver.name}</p>
                    <p class="text-[10px] text-slate-400">{driver.phone}</p>
                  </div>
                </div>
              {:else}
                <p class="text-sm text-slate-400">미배정</p>
              {/if}
            </div>

            <!-- 품목 태그 -->
            <div class="flex-1 min-w-0 py-2 flex flex-wrap gap-1 overflow-hidden">
              {#each shipment.items as item (item.laundryItemId)}
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold {catColor(item.category)}">
                  {item.itemName}
                  <span class="font-extrabold">{item.quantity}</span>
                </span>
              {/each}
              {#if shipment.memo}
                <span class="text-xs text-slate-400 italic self-center truncate max-w-24">📝 {shipment.memo}</span>
              {/if}
            </div>

            <!-- 총 수량 -->
            <div class="w-20 text-center shrink-0 py-2">
              <span class="text-base font-extrabold text-sky-700">{shipTotal}</span>
              <span class="text-xs text-slate-400 ml-0.5">개</span>
            </div>

            <!-- 수정 버튼 -->
            <div class="w-16 flex justify-center shrink-0 py-2">
              <button
                onclick={() => openEditPanel(shipment.id)}
                aria-label="출고 기록 수정"
                class="w-8 h-8 rounded-lg transition-all duration-150 flex items-center justify-center
                  {isEditing
                    ? 'bg-sky-500 text-white shadow-md'
                    : 'bg-slate-100 hover:bg-sky-100 text-slate-500 hover:text-sky-600'}"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- 우측 수정 드로어 (슬라이드 인) -->
    {#if editingShipmentId !== null}
      <!-- 오버레이 (모바일/좁은 화면용) -->
      <button
        type="button"
        aria-label="수정 패널 닫기"
        class="absolute inset-0 bg-black/10 z-10 transition-opacity duration-250 cursor-default
          {editPanelVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
        onclick={closeEditPanel}
      ></button>

      <!-- 드로어 패널 -->
      <div
        class="absolute top-0 right-0 h-full w-80 bg-white border-l border-sky-100 shadow-2xl z-20 flex flex-col
          transition-transform duration-250
          {editPanelVisible ? 'translate-x-0' : 'translate-x-full'}"
      >
        <!-- 드로어 헤더 -->
        <div class="px-5 py-4 border-b border-sky-100 bg-sky-50 flex items-start justify-between shrink-0">
          <div>
            <h3 class="text-base font-extrabold text-sky-700">출고 수정</h3>
            <p class="text-xs text-sky-500 mt-0.5">
              {#if editingShipmentId}
                {store.shipments.find(s => s.id === editingShipmentId)
                  ? formatDate(store.shipments.find(s => s.id === editingShipmentId)!.shippedAt)
                  : ''}
              {/if}
            </p>
          </div>
          <button
            onclick={closeEditPanel}
            aria-label="닫기"
            class="w-8 h-8 rounded-full bg-sky-100 hover:bg-sky-200 flex items-center justify-center transition-colors shrink-0 ml-2"
          >
            <svg class="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- 드로어 바디 -->
        <div class="flex-1 overflow-y-auto">

          <!-- 품목 수량 수정 -->
          <div class="px-5 py-4 border-b border-slate-100">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">품목 수량</p>
            <div class="space-y-2">
              {#each editItems as item, idx (item.laundryItemId)}
                <div class="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-slate-800 truncate">{item.itemName}</p>
                    <span class="inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 font-bold {catColor(item.category)}">
                      {CATEGORY_LABELS[item.category as 'towel' | 'sheet' | 'uniform'] ?? item.category}
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button
                      onclick={() => adjustEditQty(idx, -1)}
                      class="w-7 h-7 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 font-bold flex items-center justify-center transition-colors"
                    >−</button>
                    <span class="w-10 text-center text-base font-extrabold text-sky-700">{item.quantity}</span>
                    <button
                      onclick={() => adjustEditQty(idx, 1)}
                      class="w-7 h-7 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 font-bold flex items-center justify-center transition-colors"
                    >+</button>
                  </div>
                </div>
              {/each}
            </div>
            <!-- 총계 -->
            <div class="mt-2 flex items-center justify-between px-3 py-2 bg-sky-50 rounded-xl border border-sky-200">
              <span class="text-xs font-bold text-slate-500">총 수량</span>
              <span class="text-base font-extrabold text-sky-700">
                {editItems.reduce((s, i) => s + i.quantity, 0)}개
              </span>
            </div>
          </div>

          <!-- 배송기사 선택 -->
          <div class="px-5 py-4 border-b border-slate-100">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">배송기사</p>
            <div class="space-y-1.5">
              {#each store.drivers as driver (driver.id)}
                <button
                  onclick={() => (editDriverId = driver.id)}
                  class="w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-all duration-150
                    {editDriverId === driver.id
                      ? 'bg-sky-50 border-sky-300 shadow-sm'
                      : 'bg-slate-50 border-slate-200 hover:bg-sky-50 hover:border-sky-200'}"
                >
                  <div class="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                    <svg class="w-3.5 h-3.5 text-sky-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0 text-left">
                    <p class="text-sm font-bold {editDriverId === driver.id ? 'text-sky-700' : 'text-slate-700'}">{driver.name}</p>
                    <p class="text-xs text-slate-400">{driver.phone}</p>
                  </div>
                  {#if editDriverId === driver.id}
                    <svg class="w-4 h-4 text-sky-500 shrink-0" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

          <!-- 배송 시간 -->
          <div class="px-5 py-4 border-b border-slate-100">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">배송 시간</p>
            <input
              type="datetime-local"
              bind:value={editShippedAt}
              class="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <!-- 메모 -->
          <div class="px-5 py-4 border-b border-slate-100">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">메모</p>
            <textarea
              bind:value={editMemo}
              placeholder="메모를 입력하세요..."
              rows="3"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 placeholder-slate-300"
            ></textarea>
          </div>
        </div>

        <!-- 드로어 푸터 -->
        <div class="px-5 py-4 border-t border-slate-100 space-y-2 shrink-0">
          <button
            onclick={saveEdit}
            class="w-full h-12 rounded-xl font-bold text-base bg-sky-500 hover:bg-sky-600 text-white shadow-md transition-all duration-150 active:scale-[0.98]"
          >
            저장
          </button>
          <button
            onclick={closeEditPanel}
            class="w-full h-10 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all duration-150"
          >
            닫기
          </button>
        </div>
      </div>
    {/if}

  </div>
</div>