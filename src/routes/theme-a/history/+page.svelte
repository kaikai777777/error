<script lang="ts">
  import { goto } from '$app/navigation';
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import type { Shipment } from '$lib/data/types';

  // ── 날짜 유틸 ──────────────────────────────────────────────────────
  function toLocalDatetimeStr(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  function startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return startOfDay(d);
  }

  function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  function formatDateTime(isoStr: string): string {
    const d = new Date(isoStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const now = new Date();

  // ── 상태 ──────────────────────────────────────────────────────────
  type FilterPreset = 'today' | 'week' | 'month' | 'all' | 'custom';
  let filterPreset = $state<FilterPreset>('week');
  let filterClientId = $state<string | null>(null);

  let customFrom = $state(toLocalDatetimeStr(startOfDay(now)));
  let customTo = $state(toLocalDatetimeStr(endOfDay(now)));

  // 모달 상태
  let editingShipment = $state<Shipment | null>(null);
  let editShippedAt = $state('');
  let editItems = $state<Array<{ laundryItemId: string; itemName: string; category: string; quantity: number }>>([]);
  let showDeleteConfirm = $state(false);

  const clientIcons: Record<string, string> = {
    hotel: '🏨', pension: '🏡', resort: '🌴', etc: '🏢'
  };

  // ── 파생: 날짜 범위 계산 ──────────────────────────────────────────
  let dateRangeFrom = $derived((): string => {
    const n = new Date();
    if (filterPreset === 'today') return startOfDay(n).toISOString();
    if (filterPreset === 'week') return startOfWeek(n).toISOString();
    if (filterPreset === 'month') return startOfMonth(n).toISOString();
    if (filterPreset === 'all') return new Date(0).toISOString();
    return new Date(customFrom).toISOString();
  });

  let dateRangeTo = $derived((): string => {
    const n = new Date();
    if (filterPreset === 'today') return endOfDay(n).toISOString();
    if (filterPreset === 'week') return endOfDay(n).toISOString();
    if (filterPreset === 'month') return endOfDay(n).toISOString();
    if (filterPreset === 'all') return endOfDay(n).toISOString();
    return new Date(customTo).toISOString();
  });

  let filteredShipments = $derived(
    store.getShipmentsByDateRange(filterClientId, dateRangeFrom(), dateRangeTo())
      .slice()
      .sort((a, b) => new Date(b.shippedAt).getTime() - new Date(a.shippedAt).getTime())
  );

  let totalCount = $derived(filteredShipments.length);
  let totalQty = $derived(
    filteredShipments.reduce((s, sh) => s + sh.items.reduce((q, it) => q + it.quantity, 0), 0)
  );
  let uniqueClients = $derived(
    new Set(filteredShipments.map(s => s.clientId)).size
  );

  // ── 모달 열기/닫기 ────────────────────────────────────────────────
  function openEdit(shipment: Shipment) {
    editingShipment = shipment;
    editShippedAt = toLocalDatetimeStr(new Date(shipment.shippedAt));
    editItems = shipment.items.map(it => ({ ...it }));
    showDeleteConfirm = false;
  }

  function closeEdit() {
    editingShipment = null;
    showDeleteConfirm = false;
  }

  function saveEdit() {
    if (!editingShipment) return;
    store.updateShipment(editingShipment.id, {
      shippedAt: new Date(editShippedAt).toISOString(),
      items: editItems.filter(it => it.quantity > 0).map(it => ({
        laundryItemId: it.laundryItemId,
        itemName: it.itemName as any,
        category: it.category as any,
        quantity: it.quantity
      }))
    });
    closeEdit();
  }

  function deleteShipment() {
    if (!editingShipment) return;
    store.removeShipment(editingShipment.id);
    closeEdit();
  }

  function adjustEditQty(idx: number, delta: number) {
    editItems = editItems.map((it, i) =>
      i === idx ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it
    );
  }

  function reprintSlip() {
    alert('전표 재출력');
  }

  const categoryChipColors: Record<string, string> = {
    towel: 'bg-sky-100 text-sky-700',
    sheet: 'bg-violet-100 text-violet-700',
    uniform: 'bg-amber-100 text-amber-700'
  };

  const presetLabels: { key: FilterPreset; label: string }[] = [
    { key: 'today', label: '오늘' },
    { key: 'week', label: '이번주' },
    { key: 'month', label: '이번달' },
    { key: 'all', label: '전체' },
  ];
</script>

<svelte:head>
  <title>출고 현황 — Indigo Dashboard</title>
</svelte:head>

<div class="h-screen flex flex-col overflow-hidden bg-slate-50 select-none">

  <!-- ── 상단 헤더 ── -->
  <header class="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center px-5 gap-3 shrink-0 z-10">
    <div class="flex items-center gap-2.5 mr-3">
      <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
        <span class="text-lg">🏭</span>
      </div>
      <span class="font-extrabold text-indigo-600 text-base tracking-tight whitespace-nowrap">세탁물 관리</span>
    </div>

    <nav class="flex items-center gap-3 flex-1">
      <button
        class="px-6 py-3 rounded-full text-base font-bold transition-all text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
        onclick={() => goto('/theme-a')}
      >세탁물관리</button>
      <button
        class="px-6 py-3 rounded-full text-base font-bold transition-all text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
        onclick={() => goto('/theme-a/shipout')}
      >출고신청</button>
      <button
        class="px-6 py-3 rounded-full text-base font-bold transition-all text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
        onclick={() => goto('/theme-a/defect')}
      >불량처리</button>
      <button
        class="px-6 py-3 rounded-full text-base font-bold transition-all bg-indigo-600 text-white shadow-md"
        onclick={() => goto('/theme-a/history')}
      >출고현황</button>
    </nav>

    <button
      class="ml-auto px-4 py-2 rounded-full text-sm font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all border border-slate-200"
      onclick={() => goto('/')}
    >홈으로 /</button>
  </header>

  <!-- ── 하단 영역 ── -->
  <div class="flex flex-1 overflow-hidden">

    <!-- ── 거래처 패널 ── -->
    <aside class="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100">
        <p class="text-xs font-bold text-indigo-600 tracking-wide uppercase">거래처 필터</p>
      </div>
      <div class="flex-1 overflow-y-auto">
        <!-- 전체 -->
        <button
          class="w-full min-h-[72px] flex items-center gap-3 px-4 text-left transition-all duration-150
            {filterClientId === null
              ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
              : 'border-l-4 border-l-transparent hover:bg-indigo-50/50'}"
          onclick={() => filterClientId = null}
        >
          <span class="text-2xl shrink-0">🏭</span>
          <div class="flex-1 min-w-0">
            <p class="font-bold text-base text-slate-800">전체 거래처</p>
          </div>
          <span class="text-sm font-bold text-indigo-500 shrink-0 bg-indigo-50 px-2 py-0.5 rounded-full">
            {store.shipments.length}
          </span>
        </button>

        {#each store.clients as client (client.id)}
          {@const isSelected = filterClientId === client.id}
          {@const clientShipCount = store.shipments.filter(s => s.clientId === client.id).length}
          <button
            class="w-full min-h-[72px] flex items-center gap-3 px-4 text-left transition-all duration-150
              {isSelected
                ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
                : 'border-l-4 border-l-transparent hover:bg-indigo-50/50'}"
            onclick={() => filterClientId = client.id}
          >
            <span class="text-2xl shrink-0">{clientIcons[client.type] ?? '🏢'}</span>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-base text-slate-800 truncate">{client.name}</p>
              <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full
                {client.type === 'hotel' ? 'bg-blue-100 text-blue-600' :
                 client.type === 'pension' ? 'bg-green-100 text-green-600' :
                 client.type === 'resort' ? 'bg-purple-100 text-purple-600' :
                 'bg-slate-100 text-slate-600'}">
                {client.type}
              </span>
            </div>
            <span class="text-sm font-bold text-indigo-500 shrink-0 bg-indigo-50 px-2 py-0.5 rounded-full">{clientShipCount}</span>
          </button>
        {/each}
      </div>
    </aside>

    <!-- ── 메인 영역 ── -->
    <main class="flex-1 flex flex-col overflow-hidden">

      <!-- 필터 바 -->
      <div class="px-6 pt-4 pb-4 flex items-center gap-3 flex-wrap shrink-0 bg-indigo-50 border-b border-slate-200">
        <!-- 프리셋 버튼들 -->
        <div class="flex items-center gap-3">
          {#each presetLabels as preset (preset.key)}
            <button
              class="px-6 py-3 rounded-full text-base font-bold transition-all duration-150
                {filterPreset === preset.key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600'}"
              onclick={() => filterPreset = preset.key}
            >{preset.label}</button>
          {/each}
          <button
            class="px-6 py-3 rounded-full text-base font-bold transition-all duration-150
              {filterPreset === 'custom'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600'}"
            onclick={() => filterPreset = 'custom'}
          >직접입력</button>
        </div>

        <!-- 직접입력 시 날짜 인풋 -->
        {#if filterPreset === 'custom'}
          <div class="flex items-center gap-3 ml-2">
            <input
              type="datetime-local"
              bind:value={customFrom}
              class="h-11 px-3 rounded-xl border border-slate-200 text-base font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
            />
            <span class="text-slate-400 text-base font-bold">~</span>
            <input
              type="datetime-local"
              bind:value={customTo}
              class="h-11 px-3 rounded-xl border border-slate-200 text-base font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
            />
          </div>
        {/if}

        <span class="ml-auto text-sm text-slate-500 font-bold">{filteredShipments.length}건</span>
      </div>

      <!-- 요약 카드 3개 -->
      <div class="px-6 py-4 grid grid-cols-3 gap-4 shrink-0">
        <!-- 총 건수 -->
        <div class="bg-white rounded-2xl shadow-md px-5 py-4 flex items-center gap-4 border border-slate-100">
          <div class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
            <span class="text-xl">📦</span>
          </div>
          <div>
            <p class="text-xs font-bold text-slate-400 mb-0.5">총 건수</p>
            <p class="text-3xl font-black text-indigo-700 leading-none">{totalCount}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">건</p>
          </div>
        </div>

        <!-- 총 수량 -->
        <div class="bg-white rounded-2xl shadow-md px-5 py-4 flex items-center gap-4 border border-slate-100">
          <div class="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
            <span class="text-xl">🧺</span>
          </div>
          <div>
            <p class="text-xs font-bold text-slate-400 mb-0.5">총 수량</p>
            <p class="text-3xl font-black text-teal-600 leading-none">{totalQty}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">개</p>
          </div>
        </div>

        <!-- 거래처 수 -->
        <div class="bg-white rounded-2xl shadow-md px-5 py-4 flex items-center gap-4 border border-slate-100">
          <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <span class="text-xl">🏨</span>
          </div>
          <div>
            <p class="text-xs font-bold text-slate-400 mb-0.5">거래처 수</p>
            <p class="text-3xl font-black text-emerald-600 leading-none">{uniqueClients}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">곳</p>
          </div>
        </div>
      </div>

      <!-- 출고 기록 목록 -->
      <div class="flex-1 overflow-y-auto px-6 pb-6">
        {#if filteredShipments.length === 0}
          <div class="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <span class="text-5xl">📋</span>
            <p class="text-base font-semibold">출고 기록이 없습니다</p>
            <p class="text-sm">선택한 기간에 출고 내역이 없습니다</p>
          </div>
        {:else}
          <div class="flex flex-col gap-2">
            {#each filteredShipments as shipment (shipment.id)}
              {@const client = store.getClientById(shipment.clientId)}
              {@const shipTotalQty = shipment.items.reduce((s, it) => s + it.quantity, 0)}
              <!-- 클릭 가능한 행 -->
              <div
                class="bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[64px] flex items-center gap-4 px-5 hover:shadow-md hover:border-indigo-200 transition-all duration-150 cursor-pointer group"
                onclick={() => openEdit(shipment)}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && openEdit(shipment)}
                aria-label="출고 수정 열기"
              >
                <!-- 날짜/시간 -->
                <div class="shrink-0 w-36">
                  <p class="text-sm font-bold text-slate-700">{formatDateTime(shipment.shippedAt)}</p>
                  <p class="text-xs text-slate-400 mt-0.5">등록: {formatDateTime(shipment.createdAt)}</p>
                </div>

                <!-- 구분선 -->
                <div class="w-px h-10 bg-slate-100 shrink-0"></div>

                <!-- 거래처명 -->
                <div class="flex items-center gap-2 w-44 shrink-0">
                  <span class="text-xl shrink-0">{clientIcons[client?.type ?? 'etc'] ?? '🏢'}</span>
                  <div class="min-w-0">
                    <p class="text-base font-bold text-slate-800 truncate">{client?.name ?? '알 수 없음'}</p>
                    {#if client}
                      <span class="text-[11px] font-semibold px-1.5 py-0.5 rounded-full
                        {client.type === 'hotel' ? 'bg-blue-100 text-blue-600' :
                         client.type === 'pension' ? 'bg-green-100 text-green-600' :
                         client.type === 'resort' ? 'bg-purple-100 text-purple-600' :
                         'bg-slate-100 text-slate-600'}">
                        {client.type}
                      </span>
                    {/if}
                  </div>
                </div>

                <!-- 구분선 -->
                <div class="w-px h-10 bg-slate-100 shrink-0"></div>

                <!-- 품목 chip들 -->
                <div class="flex-1 flex flex-wrap gap-2 py-2">
                  {#each shipment.items as it (it.laundryItemId)}
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold
                      {categoryChipColors[it.category] ?? 'bg-slate-100 text-slate-600'}">
                      {it.itemName}
                      <span class="font-black">{it.quantity}</span>
                    </span>
                  {/each}
                  {#if shipment.memo}
                    <span class="text-xs text-slate-400 font-medium self-center">📝 {shipment.memo}</span>
                  {/if}
                </div>

                <!-- 총 수량 -->
                <div class="shrink-0 text-right w-20">
                  <span class="text-2xl font-black text-indigo-700">{shipTotalQty}</span>
                  <span class="text-sm font-bold text-indigo-400 ml-1">개</span>
                </div>

                <!-- 수정 버튼 -->
                <button
                  class="w-12 h-12 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-500 flex items-center justify-center text-lg transition-all active:scale-90 shrink-0 group-hover:bg-indigo-100 group-hover:shadow-sm"
                  onclick={(e) => { e.stopPropagation(); openEdit(shipment); }}
                  aria-label="수정"
                >✏️</button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </main>
  </div>
</div>

<!-- ── 수정 슬라이드 패널 오버레이 ── -->
{#if editingShipment}
  {@const client = store.getClientById(editingShipment.clientId)}
  <!-- 배경 오버레이 — 클릭으로 닫기 -->
  <div
    class="fixed inset-0 bg-black/40 z-40 flex items-stretch justify-end"
    onclick={closeEdit}
    onkeydown={(e) => { if (e.key === 'Escape') closeEdit(); }}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label="출고 수정"
  >
    <!-- 슬라이드 패널 -->
    <div
      class="bg-white w-[480px] max-h-full flex flex-col overflow-hidden shadow-2xl"
      onclick={(e) => e.stopPropagation()}
      role="none"
    >
      <!-- 패널 헤더 -->
      <div class="bg-indigo-700 text-white px-6 py-5 flex items-center shrink-0">
        <div class="flex-1 min-w-0">
          <p class="text-lg font-black tracking-wide">출고 수정</p>
          <p class="text-indigo-200 text-sm font-medium mt-0.5">{client?.name ?? ''}</p>
        </div>
        <button
          class="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white font-bold transition-all text-lg shrink-0"
          onclick={closeEdit}
        >✕</button>
      </div>

      <!-- 패널 내용 -->
      <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

        <!-- 출고 시간 수정 -->
        <div>
          <label for="edit-shipped-at" class="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">출고 시간</label>
          <input
            id="edit-shipped-at"
            type="datetime-local"
            bind:value={editShippedAt}
            class="w-full h-12 px-4 rounded-xl border border-slate-200 text-base font-medium text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
          />
        </div>

        <!-- 품목 수량 수정 -->
        <div>
          <p class="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wide">품목 수량</p>
          <div class="flex flex-col gap-2.5">
            {#each editItems as it, idx (it.laundryItemId)}
              <div class="flex items-center gap-4 bg-indigo-50 border border-indigo-100 rounded-xl px-4 min-h-[56px]">
                <div class="flex-1 min-w-0">
                  <p class="text-base font-bold text-slate-800">{it.itemName}</p>
                  <span class="text-[11px] font-bold px-2 py-0.5 rounded-full
                    {categoryChipColors[it.category] ?? 'bg-slate-100 text-slate-600'}">
                    {CATEGORY_LABELS[it.category as keyof typeof CATEGORY_LABELS] ?? it.category}
                  </span>
                </div>
                <!-- 수량 조절 -->
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    class="w-10 h-10 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-black flex items-center justify-center transition-all active:scale-90 text-xl"
                    onclick={() => adjustEditQty(idx, -1)}
                  >−</button>
                  <span class="w-12 text-center text-xl font-black text-indigo-700">{it.quantity}</span>
                  <button
                    class="w-10 h-10 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-black flex items-center justify-center transition-all active:scale-90 text-xl"
                    onclick={() => adjustEditQty(idx, +1)}
                  >+</button>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- 삭제 확인 영역 -->
        {#if showDeleteConfirm}
          <div class="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-3">
            <p class="text-sm font-bold text-red-700 text-center">정말 삭제하시겠습니까?</p>
            <p class="text-xs text-red-500 text-center">이 작업은 되돌릴 수 없습니다</p>
            <div class="flex gap-2">
              <button
                class="flex-1 h-11 rounded-xl font-bold text-sm bg-red-500 hover:bg-red-600 text-white transition-all active:scale-[0.98]"
                onclick={deleteShipment}
              >삭제 확인</button>
              <button
                class="flex-1 h-11 rounded-xl font-bold text-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all active:scale-[0.98]"
                onclick={() => showDeleteConfirm = false}
              >취소</button>
            </div>
          </div>
        {/if}

      </div>

      <!-- 패널 하단 버튼 -->
      <div class="px-6 pb-6 pt-4 flex flex-col gap-2.5 shrink-0 border-t border-slate-100 bg-white">
        <!-- 저장/취소 -->
        <div class="flex gap-2">
          <button
            class="flex-1 h-14 rounded-xl font-bold text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all active:scale-[0.98]"
            onclick={saveEdit}
          >저장</button>
          <button
            class="flex-1 h-14 rounded-xl font-bold text-base bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all active:scale-[0.98]"
            onclick={closeEdit}
          >취소</button>
        </div>
        <!-- 재출력 버튼 -->
        <button
          class="w-full h-12 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-700 text-white transition-all active:scale-[0.98] shadow-sm"
          onclick={reprintSlip}
        >🖨️ 전표 재출력</button>
        <!-- 삭제 -->
        {#if !showDeleteConfirm}
          <button
            class="w-full h-12 rounded-xl font-bold text-sm bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 transition-all active:scale-[0.98]"
            onclick={() => showDeleteConfirm = true}
          >🗑️ 이 출고 기록 삭제</button>
        {/if}
      </div>
    </div>
  </div>
{/if}