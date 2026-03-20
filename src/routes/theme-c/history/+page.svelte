<script lang="ts">
  import { goto } from '$app/navigation';
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import type { LaundryCategory, Shipment } from '$lib/data/types';


  // ── 날짜 유틸 ─────────────────────────────────────────────────
  function toLocalDateString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function toLocalDateTimeString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function startOfDay(dateStr: string): string {
    return `${dateStr}T00:00:00.000Z`;
  }

  function endOfDay(dateStr: string): string {
    return `${dateStr}T23:59:59.999Z`;
  }

  const today = new Date();
  const todayStr = toLocalDateString(today);

  function getWeekStart(): string {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    return toLocalDateString(d);
  }

  function getMonthStart(): string {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  }

  // ── 상태 ──────────────────────────────────────────────────────
  type QuickRange = 'today' | 'week' | 'month' | 'custom';

  let quickRange = $state<QuickRange>('month');
  let fromDate = $state(getMonthStart());
  let toDate = $state(todayStr);
  let showClientDropdown = $state(false);

  // 수정 모달 상태
  let editingShipment = $state<Shipment | null>(null);
  let editDriverId = $state('');
  let editShippedAt = $state('');
  let editMemo = $state('');
  let editQties = $state<Record<string, number>>({});
  let editQtyTarget = $state<string | null>(null);
  let editQtyValue = $state('');
  let showQtyNumpad = $state(false);
  let saveResult = $state<'idle' | 'success'>('idle');

  // ── 파생 상태 ─────────────────────────────────────────────────
  let fromIso = $derived(startOfDay(fromDate));
  let toIso = $derived(endOfDay(toDate));

  let filteredShipments = $derived(
    store
      .getShipmentsByDateRange(store.selectedClientId, fromIso, toIso)
      .sort((a, b) => new Date(b.shippedAt).getTime() - new Date(a.shippedAt).getTime())
  );

  let totalQty = $derived(
    filteredShipments.reduce(
      (sum, s) => sum + s.items.reduce((q, i) => q + i.quantity, 0),
      0
    )
  );

  // ── 빠른 기간 선택 버튼 데이터 ───────────────────────────────
  const quickButtons: { key: QuickRange; label: string }[] = [
    { key: 'today', label: '오늘' },
    { key: 'week',  label: '이번 주' },
    { key: 'month', label: '이번 달' },
  ];

  // ── 빠른 기간 선택 ────────────────────────────────────────────
  function applyQuickRange(range: QuickRange) {
    quickRange = range;
    if (range === 'today') {
      fromDate = todayStr;
      toDate = todayStr;
    } else if (range === 'week') {
      fromDate = getWeekStart();
      toDate = todayStr;
    } else if (range === 'month') {
      fromDate = getMonthStart();
      toDate = todayStr;
    }
    // custom: 직접 입력 유지
  }

  // ── 수정 모달 ─────────────────────────────────────────────────
  function openEdit(shipment: Shipment) {
    editingShipment = shipment;
    editDriverId = shipment.driverId;
    editShippedAt = toLocalDateTimeString(new Date(shipment.shippedAt));
    editMemo = shipment.memo ?? '';
    const qties: Record<string, number> = {};
    for (const item of shipment.items) {
      qties[item.laundryItemId] = item.quantity;
    }
    editQties = qties;
    saveResult = 'idle';
  }

  function closeEdit() {
    editingShipment = null;
    editDriverId = '';
    editShippedAt = '';
    editMemo = '';
    editQties = {};
    showQtyNumpad = false;
    editQtyTarget = null;
    editQtyValue = '';
    saveResult = 'idle';
  }

  function openQtyNumpad(laundryItemId: string) {
    editQtyTarget = laundryItemId;
    editQtyValue = String(editQties[laundryItemId] ?? 0);
    showQtyNumpad = true;
  }

  function closeQtyNumpad() {
    showQtyNumpad = false;
    editQtyTarget = null;
    editQtyValue = '';
  }

  function applyQtyNumpad() {
    if (!editQtyTarget) return;
    const num = parseInt(editQtyValue, 10);
    if (!isNaN(num) && num >= 0) {
      editQties = { ...editQties, [editQtyTarget]: num };
    }
    closeQtyNumpad();
  }

  function saveEdit() {
    if (!editingShipment) return;
    store.updateShipment(editingShipment.id, {
      driverId: editDriverId,
      shippedAt: new Date(editShippedAt).toISOString(),
      memo: editMemo.trim() || undefined,
      items: editingShipment.items.map((item) => ({
        ...item,
        quantity: editQties[item.laundryItemId] ?? item.quantity,
      })),
    });
    saveResult = 'success';
    setTimeout(() => {
      closeEdit();
    }, 1000);
  }

  function deleteShipment(id: string) {
    if (confirm('이 출고 기록을 삭제하시겠습니까?')) {
      store.removeShipment(id);
      closeEdit();
    }
  }

  // ── 포맷 헬퍼 ────────────────────────────────────────────────
  function formatDate(iso: string): string {
    const d = new Date(iso);
    const month  = String(d.getMonth() + 1).padStart(2, '0');
    const day    = String(d.getDate()).padStart(2, '0');
    const hour   = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hour}:${minute}`;
  }

  function formatDateFull(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function getCategoryLabel(cat: string): string {
    return CATEGORY_LABELS[cat as LaundryCategory] ?? cat;
  }

  function getShipmentTotal(shipment: Shipment): number {
    return shipment.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  const categoryChipColor: Record<string, string> = {
    towel:   'bg-sky-100 text-sky-700',
    sheet:   'bg-violet-100 text-violet-700',
    uniform: 'bg-orange-100 text-orange-700',
  };
</script>

<!-- 루트 컨테이너 -->
<div class="flex flex-col h-screen bg-gray-50 overflow-hidden">

  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <!-- 헤더 바                                                   -->
  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <header class="bg-white shadow-md h-16 flex items-center px-5 gap-4 shrink-0 z-20">
    <!-- 로고 + 타이틀 -->
    <div class="flex items-center gap-2 shrink-0">
      <div class="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow">
        <span class="text-lg">📋</span>
      </div>
      <div>
        <span class="text-lg font-extrabold text-slate-800 tracking-tight">출고 현황</span>
        <span class="ml-2 text-xs text-slate-400">Theme C</span>
      </div>
    </div>

    <!-- 거래처 드롭다운 -->
    <div class="relative flex-1 max-w-xs mx-auto">
      <button
        onclick={() => (showClientDropdown = !showClientDropdown)}
        class="w-full h-10 flex items-center justify-between gap-2 px-4 rounded-xl border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 transition"
      >
        <span class="font-bold text-slate-700 text-sm truncate">
          {store.selectedClient?.name ?? '전체 거래처'}
        </span>
        <svg
          class="w-4 h-4 text-amber-500 shrink-0 transition-transform {showClientDropdown ? 'rotate-180' : ''}"
          fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {#if showClientDropdown}
        <button
          class="fixed inset-0 z-30"
          onclick={() => (showClientDropdown = false)}
          aria-label="닫기"
        ></button>
        <div class="absolute top-12 left-0 right-0 bg-white rounded-2xl shadow-xl border border-slate-100 z-40 overflow-hidden">
          <button
            onclick={() => { store.selectClient(null); showClientDropdown = false; }}
            class="w-full px-4 py-3 text-left hover:bg-amber-50 transition flex items-center justify-between
              {store.selectedClientId === null ? 'bg-amber-50 text-amber-700 font-bold' : 'text-slate-700'}"
          >
            <span class="font-semibold">전체 거래처</span>
          </button>
          {#each store.clients as client (client.id)}
            <button
              onclick={() => { store.selectClient(client.id); showClientDropdown = false; }}
              class="w-full px-4 py-3 text-left hover:bg-amber-50 transition flex items-center justify-between
                {store.selectedClientId === client.id ? 'bg-amber-50 text-amber-700 font-bold' : 'text-slate-700'}"
            >
              <span class="font-semibold">{client.name}</span>
              <span class="text-xs text-slate-400">{client.type}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 네비 버튼들 -->
    <div class="flex items-center gap-2 shrink-0">
      <button
        onclick={() => void goto('/theme-c')}
        class="flex items-center gap-1.5 px-4 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        세탁물관리
      </button>
      <button
        onclick={() => void goto('/theme-c/shipout')}
        class="flex items-center gap-1.5 px-4 h-9 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition shadow"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        출고신청
      </button>
      <button
        onclick={() => void goto('/')}
        class="flex items-center gap-1.5 px-4 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        홈
      </button>
    </div>
  </header>

  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <!-- 필터 + 요약 바                                            -->
  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <div class="bg-amber-50 border-b border-amber-100 px-6 py-4 shrink-0">
    <div class="flex flex-wrap items-center gap-3">

      <!-- 빠른 선택 버튼들 -->
      <div class="flex items-center gap-2">
        {#each quickButtons as btn (btn.key)}
          <button
            onclick={() => applyQuickRange(btn.key)}
            class="px-4 py-2 rounded-xl font-bold text-sm transition
              {quickRange === btn.key
                ? 'bg-amber-500 text-white shadow'
                : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-100'}"
          >
            {btn.label}
          </button>
        {/each}
      </div>

      <!-- 구분선 -->
      <div class="w-px h-8 bg-amber-200"></div>

      <!-- 날짜 직접 입력 -->
      <div class="flex items-center gap-2">
        <input
          type="date"
          bind:value={fromDate}
          oninput={() => (quickRange = 'custom')}
          class="h-9 rounded-xl border-2 border-amber-200 bg-white px-3 text-sm font-semibold text-slate-700
            focus:outline-none focus:border-amber-400 transition"
        />
        <span class="text-slate-400 font-bold">~</span>
        <input
          type="date"
          bind:value={toDate}
          oninput={() => (quickRange = 'custom')}
          class="h-9 rounded-xl border-2 border-amber-200 bg-white px-3 text-sm font-semibold text-slate-700
            focus:outline-none focus:border-amber-400 transition"
        />
      </div>

      <div class="flex-1"></div>

      <!-- 요약 인라인 -->
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-1.5">
          <span class="text-sm font-medium text-slate-500">총</span>
          <span class="text-2xl font-black text-amber-600">{filteredShipments.length}</span>
          <span class="text-sm font-medium text-slate-500">건</span>
        </div>
        <div class="w-px h-6 bg-amber-200"></div>
        <div class="flex items-center gap-1.5">
          <span class="text-sm font-medium text-slate-500">총</span>
          <span class="text-2xl font-black text-amber-600">{totalQty.toLocaleString()}</span>
          <span class="text-sm font-medium text-slate-500">개</span>
        </div>
        {#if store.selectedClient}
          <div class="w-px h-6 bg-amber-200"></div>
          <span class="text-sm font-bold text-amber-700 bg-amber-200 px-3 py-1 rounded-full">
            {store.selectedClient.name}
          </span>
        {/if}
      </div>
    </div>
  </div>

  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <!-- 출고 기록 카드 그리드                                     -->
  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if filteredShipments.length === 0}
      <div class="flex flex-col items-center justify-center h-full py-20 text-slate-400">
        <div class="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center mb-6">
          <span class="text-4xl">📭</span>
        </div>
        <p class="text-xl font-bold text-slate-500 mb-2">출고 기록이 없습니다</p>
        <p class="text-sm text-slate-400">선택한 기간에 출고 기록이 없습니다.</p>
        <button
          onclick={() => void goto('/theme-c/shipout')}
          class="mt-6 px-6 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-base transition shadow"
        >
          출고 신청하기
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {#each filteredShipments as shipment (shipment.id)}
          {@const client    = store.getClientById(shipment.clientId)}
          {@const driver    = store.getDriverById(shipment.driverId)}
          {@const shipTotal = getShipmentTotal(shipment)}

          <div class="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition-shadow">

            <!-- 카드 상단: 날짜/시간 + 배송기사 + 수정 버튼 -->
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span class="text-sm font-bold text-slate-600">{formatDate(shipment.shippedAt)}</span>
                </div>
                {#if driver}
                  <div class="flex items-center gap-1.5">
                    <div class="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                      <span class="text-white text-xs font-black">{driver.name.charAt(0)}</span>
                    </div>
                    <span class="text-sm font-semibold text-slate-600">{driver.name}</span>
                    <span class="text-xs text-slate-400">{driver.phone}</span>
                  </div>
                {/if}
              </div>
              <button
                onclick={() => openEdit(shipment)}
                class="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-100 hover:border-amber-300 text-slate-500 hover:text-amber-600 font-semibold text-sm transition"
              >
                <span>✏️</span>
                수정
              </button>
            </div>

            <!-- 거래처명 -->
            {#if client}
              <p class="text-lg font-black text-slate-800 mb-3">{client.name}</p>
            {/if}

            <!-- 품목 chip 목록 -->
            <div class="flex flex-wrap gap-2 mb-3">
              {#each shipment.items as item (item.laundryItemId)}
                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold
                  {categoryChipColor[item.category] ?? 'bg-slate-100 text-slate-600'}">
                  {item.itemName}
                  <span class="font-black">{item.quantity.toLocaleString()}개</span>
                </span>
              {/each}
            </div>

            <!-- 메모 -->
            {#if shipment.memo}
              <p class="text-sm text-slate-500 bg-slate-50 rounded-xl px-3 py-2 mb-3">
                📝 {shipment.memo}
              </p>
            {/if}

            <!-- 카드 하단: 총 수량 강조 -->
            <div class="flex items-center justify-between pt-3 border-t border-slate-100">
              <span class="text-xs text-slate-400">
                등록: {formatDateFull(shipment.createdAt)}
              </span>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-medium text-slate-500">총</span>
                <span class="text-2xl font-black text-amber-600">{shipTotal.toLocaleString()}</span>
                <span class="text-xs font-medium text-slate-500">개</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
<!-- 수정 모달                                                   -->
<!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
{#if editingShipment}
  <!-- 배경 오버레이 -->
  <button
    class="fixed inset-0 bg-black/40 z-40"
    onclick={closeEdit}
    aria-label="모달 닫기"
  ></button>

  <!-- 수정 모달 패널 -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

      <!-- 모달 헤더 -->
      <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-amber-50 shrink-0">
        <div>
          <h3 class="text-xl font-black text-slate-800">출고 기록 수정</h3>
          <p class="text-sm text-amber-600 font-semibold mt-0.5">
            {formatDateFull(editingShipment.shippedAt)}
          </p>
        </div>
        <button
          onclick={closeEdit}
          class="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition"
        >
          ✕
        </button>
      </div>

      <!-- 모달 내용 (스크롤 가능) -->
      <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        <!-- 품목별 수량 수정 -->
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">품목별 수량</p>
          <div class="space-y-2">
            {#each editingShipment.items as item (item.laundryItemId)}
              <div class="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                <div class="flex-1">
                  <span class="font-bold text-slate-700">{item.itemName}</span>
                  <span class="ml-2 text-xs px-2 py-0.5 rounded-full font-semibold
                    {categoryChipColor[item.category] ?? 'bg-slate-100 text-slate-500'}">
                    {getCategoryLabel(item.category)}
                  </span>
                </div>
                <!-- 수량 조절 -->
                <div class="flex items-center gap-2">
                  <button
                    onclick={() => {
                      const cur = editQties[item.laundryItemId] ?? item.quantity;
                      if (cur > 0) editQties = { ...editQties, [item.laundryItemId]: cur - 1 };
                    }}
                    class="w-8 h-8 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 font-black text-lg flex items-center justify-center transition"
                  >
                    −
                  </button>
                  <button
                    onclick={() => openQtyNumpad(item.laundryItemId)}
                    class="w-16 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black text-base transition"
                  >
                    {editQties[item.laundryItemId] ?? item.quantity}
                  </button>
                  <button
                    onclick={() => {
                      const cur = editQties[item.laundryItemId] ?? item.quantity;
                      editQties = { ...editQties, [item.laundryItemId]: cur + 1 };
                    }}
                    class="w-8 h-8 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 font-black text-lg flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- 배송기사 변경 -->
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">배송기사</p>
          <div class="flex flex-col gap-2">
            {#each store.drivers as driver (driver.id)}
              <button
                onclick={() => (editDriverId = driver.id)}
                class="flex items-center justify-between px-4 py-3 rounded-xl border-2 transition font-semibold text-sm
                  {editDriverId === driver.id
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-slate-100 bg-slate-50 hover:border-amber-200 text-slate-600'}"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center font-black text-sm
                    {editDriverId === driver.id ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-500'}">
                    {driver.name.charAt(0)}
                  </div>
                  <span>{driver.name}</span>
                </div>
                <span class="text-xs text-slate-400">{driver.phone}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- 배송 시간 변경 -->
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">배송 시간</p>
          <input
            type="datetime-local"
            bind:value={editShippedAt}
            class="w-full h-11 rounded-xl border-2 border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-700
              focus:outline-none focus:border-amber-400 focus:bg-amber-50 transition"
          />
        </div>

        <!-- 메모 변경 -->
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">배송 메모</p>
          <textarea
            bind:value={editMemo}
            placeholder="메모를 입력하세요 (선택)"
            rows="3"
            class="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 resize-none
              focus:outline-none focus:border-amber-400 focus:bg-amber-50 transition placeholder:text-slate-300"
          ></textarea>
        </div>

        <!-- 삭제 버튼 -->
        <div class="pt-2 border-t border-slate-100">
          <button
            onclick={() => deleteShipment(editingShipment!.id)}
            class="w-full h-11 rounded-xl border-2 border-red-100 bg-red-50 hover:bg-red-100 text-red-500 font-bold text-sm transition flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            이 출고 기록 삭제
          </button>
        </div>
      </div>

      <!-- 모달 하단: 저장/취소 -->
      <div class="px-6 py-4 border-t border-slate-100 shrink-0 flex gap-3">
        <button
          onclick={closeEdit}
          class="flex-1 h-14 rounded-2xl font-bold text-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
        >
          취소
        </button>
        {#if saveResult === 'success'}
          <div class="flex-1 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center gap-2 text-white font-black text-lg shadow-lg">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            저장 완료!
          </div>
        {:else}
          <button
            onclick={saveEdit}
            class="flex-1 h-14 rounded-2xl font-black text-lg bg-amber-500 hover:bg-amber-600 text-white transition shadow-md"
          >
            저장
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- ── 품목 수량 키패드 (모달 위에 표시) ─────────────────── -->
  {#if showQtyNumpad}
    <button
      class="fixed inset-0 bg-black/30 z-60"
      onclick={closeQtyNumpad}
      aria-label="키패드 닫기"
    ></button>

    <div class="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-70 p-6 shadow-2xl">
      <div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5"></div>

      <h3 class="text-lg font-black text-slate-800 mb-1">수량 수정</h3>
      {#if editQtyTarget}
        {@const targetItem = editingShipment?.items.find(i => i.laundryItemId === editQtyTarget)}
        {#if targetItem}
          <p class="text-sm text-slate-400 mb-4">
            <span class="font-bold text-amber-600">{targetItem.itemName}</span> 출고 수량
          </p>
        {/if}
      {/if}

      <!-- 입력값 표시 -->
      <div class="h-16 bg-slate-50 rounded-2xl border-2 border-amber-300 flex items-center px-5 mb-4">
        <span class="text-4xl font-black text-slate-800 flex-1 text-right tracking-widest">
          {editQtyValue === '' ? '0' : editQtyValue}
        </span>
        <span class="text-base text-slate-400 ml-3">개</span>
      </div>

      <NumPad
        bind:value={editQtyValue}
        accentClass="bg-amber-500 hover:bg-amber-600 text-white"
      />

      <div class="flex gap-3 mt-4">
        <button
          onclick={closeQtyNumpad}
          class="flex-1 h-14 rounded-2xl font-bold text-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
        >
          취소
        </button>
        <button
          onclick={applyQtyNumpad}
          class="flex-1 h-14 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-600 text-white transition shadow-md"
        >
          적용
        </button>
      </div>
    </div>
  {/if}
{/if}