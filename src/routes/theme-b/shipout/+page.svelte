<script lang="ts">
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import { goto } from '$app/navigation';
  import { SvelteMap } from 'svelte/reactivity';
  import type { LaundryCategory, LaundryItemName, ShipmentItem } from '$lib/data/types';

  type CategoryKey = LaundryCategory;

  let activeCategory = $state<CategoryKey>('all');
  let selectedDriverId = $state('');
  let memo = $state('');

  const nowDate = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  let shippedAt = $state(
    `${nowDate.getFullYear()}-${pad(nowDate.getMonth() + 1)}-${pad(nowDate.getDate())}T${pad(nowDate.getHours())}:${pad(nowDate.getMinutes())}`
  );

  // 수량 맵: itemId -> quantity
  let selectedQuantities = new SvelteMap<string, number>();

  // 인라인 수량 편집용 numpad
  let editingItemId = $state<string | null>(null);
  let numpadValue = $state('');
  let confirmResult = $state<'idle' | 'success' | 'error'>('idle');

  const categories: { key: CategoryKey; label: string; icon: string }[] = [
    { key: 'all', label: '전체', icon: '📋' },
    { key: 'towel', label: '타올', icon: '🛁' },
    { key: 'sheet', label: '시트', icon: '🛏' },
    { key: 'uniform', label: '유니폼', icon: '👔' },
  ];

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

  const categoryBadge: Record<string, string> = {
    towel: 'bg-sky-100 text-sky-600',
    sheet: 'bg-violet-100 text-violet-600',
    uniform: 'bg-orange-100 text-orange-600',
  };

  let filteredItems = $derived(
    store.selectedClientId
      ? store.getItemsByCategory(store.selectedClientId, activeCategory)
      : []
  );

  type SelectedEntry = {
    itemId: string;
    itemName: string;
    category: string;
    completed: number;
    quantity: number;
  };

  let selectedEntries = $derived<SelectedEntry[]>(
    (() => {
      const entries: SelectedEntry[] = [];
      if (!store.selectedClientId) return entries;
      const allItems = store.getItemsByCategory(store.selectedClientId, 'all');
      selectedQuantities.forEach((qty, itemId) => {
        if (qty <= 0) return;
        const found = allItems.find((i) => i.id === itemId);
        if (!found) return;
        entries.push({
          itemId,
          itemName: found.name,
          category: found.category,
          completed: found.counts.completed,
          quantity: qty,
        });
      });
      return entries;
    })()
  );

  let totalQuantity = $derived(
    selectedEntries.reduce((sum, e) => sum + e.quantity, 0)
  );

  let canConfirm = $derived(
    selectedEntries.length > 0 && selectedDriverId !== ''
  );

  function selectCategory(cat: CategoryKey) {
    activeCategory = cat;
  }

  function toggleItem(itemId: string) {
    const item = filteredItems.find((i) => i.id === itemId);
    if (!item) return;
    if (selectedQuantities.has(itemId)) {
      selectedQuantities.delete(itemId);
    } else {
      selectedQuantities.set(itemId, item.counts.completed > 0 ? item.counts.completed : 0);
    }
  }

  function adjustQty(itemId: string, delta: number) {
    const item =
      filteredItems.find((i) => i.id === itemId) ??
      store.getItemsByCategory(store.selectedClientId ?? '', 'all').find((i) => i.id === itemId);
    if (!item) return;
    const current = selectedQuantities.get(itemId) ?? 0;
    const newVal = Math.max(0, Math.min(current + delta, item.counts.completed));
    selectedQuantities.set(itemId, newVal);
  }

  function openNumpad(itemId: string) {
    editingItemId = itemId;
    numpadValue = String(selectedQuantities.get(itemId) ?? '');
  }

  function confirmNumpad() {
    if (editingItemId === null) return;
    const num = parseInt(numpadValue, 10);
    if (!isNaN(num) && num >= 0) {
      const item = store
        .getItemsByCategory(store.selectedClientId ?? '', 'all')
        .find((i) => i.id === editingItemId);
      const max = item?.counts.completed ?? 9999;
      selectedQuantities.set(editingItemId, Math.min(num, max));
    }
    editingItemId = null;
    numpadValue = '';
  }

  function cancelNumpad() {
    editingItemId = null;
    numpadValue = '';
  }

  function removeEntry(itemId: string) {
    selectedQuantities.delete(itemId);
  }

  async function confirmShipout() {
    if (!canConfirm || !store.selectedClientId) return;
    const clientId = store.selectedClientId;

    const shipItems: ShipmentItem[] = selectedEntries.map((e) => ({
      laundryItemId: e.itemId,
      itemName: e.itemName as LaundryItemName,
      category: e.category as 'towel' | 'sheet' | 'uniform',
      quantity: e.quantity,
    }));

    store.addShipment({
      clientId,
      items: shipItems,
      driverId: selectedDriverId,
      memo: memo || undefined,
      shippedAt: new Date(shippedAt).toISOString(),
    });

    // 재고 반영: completed 감소, shipped 증가
    const allItems = store.getItemsByCategory(clientId, 'all');
    for (const entry of selectedEntries) {
      const found = allItems.find((i) => i.id === entry.itemId);
      if (!found) continue;
      const newCompleted = Math.max(0, found.counts.completed - entry.quantity);
      const newShipped = found.counts.shipped + entry.quantity;
      store.updateLaundryItem(clientId, entry.itemId, 'completed', newCompleted);
      store.updateLaundryItem(clientId, entry.itemId, 'shipped', newShipped);
    }

    confirmResult = 'success';
    await new Promise<void>((r) => setTimeout(r, 1200));
    void goto('/theme-b/history');
  }

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

    <!-- 출고신청 (현재) -->
    <button
      onclick={() => navTo('/theme-b/shipout')}
      aria-label="출고 신청 (현재 페이지)"
      class="w-full h-14 flex flex-col items-center justify-center gap-0.5 bg-sky-500 text-white rounded-lg mx-1 shadow-md"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
      </svg>
      <span class="text-[9px] font-bold">출고신청</span>
    </button>

    <button
      onclick={() => navTo('/theme-b/history')}
      aria-label="출고 현황"
      class="w-full h-14 flex flex-col items-center justify-center gap-0.5 text-sky-200 hover:text-white hover:bg-white/10 transition-colors rounded-lg mx-1"
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
      {#each store.clients as client (client.id)}
        {@const isSelected = store.selectedClientId === client.id}
        <button
          onclick={() => {
            store.selectClient(client.id);
            selectedQuantities.clear();
            editingItemId = null;
          }}
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

  <!-- ③ 품목 선택 영역 (flex-1) -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- 헤더 -->
    <div class="bg-white border-b border-sky-100 px-5 py-3 shrink-0 flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-extrabold text-slate-800">출고 신청</h1>
        {#if store.selectedClient}
          <span class="px-2.5 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-bold">
            {store.selectedClient.name}
          </span>
        {/if}
      </div>
      {#if totalQuantity > 0}
        <span class="px-3 py-1.5 bg-sky-100 text-sky-700 rounded-full text-sm font-bold">
          총 {totalQuantity}개 선택
        </span>
      {/if}
    </div>

    <!-- 카테고리 가로 탭 -->
    <div class="bg-white border-b border-sky-100 px-5 shrink-0 flex gap-1 pt-2">
      {#each categories as cat (cat.key)}
        <button
          onclick={() => selectCategory(cat.key)}
          class="px-4 py-2 rounded-t-xl text-sm font-bold border-b-2 transition-all duration-150
            {activeCategory === cat.key
              ? 'border-sky-500 text-sky-600 bg-sky-50'
              : 'border-transparent text-slate-500 hover:text-sky-500 hover:bg-sky-50'}"
        >
          <span class="mr-1">{cat.icon}</span>{cat.label}
        </button>
      {/each}
    </div>

    <!-- 테이블 헤더 -->
    {#if store.selectedClientId && filteredItems.length > 0}
      <div class="bg-slate-100 border-b border-slate-200 px-4 shrink-0">
        <div class="flex items-center h-9">
          <div class="w-8 shrink-0"></div>
          <div class="flex-1 min-w-0 pl-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wide">품목명</span>
          </div>
          <div class="w-28 text-center shrink-0">
            <span class="text-xs font-bold text-slate-500">세탁완료(잔여)</span>
          </div>
          <div class="w-40 text-center shrink-0">
            <span class="text-xs font-bold text-slate-500">출고 수량</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- 리스트 바디 -->
    <div class="flex-1 overflow-y-auto">
      {#if !store.selectedClientId}
        <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
          <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg class="w-8 h-8 opacity-40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
            </svg>
          </div>
          <p class="text-base font-medium">거래처를 선택하세요</p>
        </div>
      {:else if filteredItems.length === 0}
        <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
          <p class="text-base font-medium">해당 카테고리의 품목이 없습니다</p>
        </div>
      {:else}
        {#each filteredItems as item (item.id)}
          {@const isSelected = selectedQuantities.has(item.id)}
          {@const qty = selectedQuantities.get(item.id) ?? 0}
          {@const isEditing = editingItemId === item.id}
          <div
            class="flex items-center px-4 h-16 border-b border-slate-100 transition-all duration-100
              {isSelected
                ? 'bg-sky-50 border-l-4 border-l-sky-500'
                : 'bg-white border-l-4 border-l-transparent hover:bg-sky-50'}"
          >
            <!-- 체크 버튼 -->
            <button
              onclick={() => toggleItem(item.id)}
              class="w-8 shrink-0 flex items-center justify-center"
            >
              {#if isSelected}
                <div class="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center shadow-sm">
                  <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
              {:else}
                <div class="w-6 h-6 rounded-full border-2 border-slate-300 hover:border-sky-400 transition-colors"></div>
              {/if}
            </button>

            <!-- 품목명 -->
            <div class="flex-1 min-w-0 pl-2 flex items-center gap-2">
              <span class="text-sm font-semibold text-slate-800 truncate">{item.name}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0
                {categoryBadge[item.category] ?? 'bg-slate-100 text-slate-500'}">
                {CATEGORY_LABELS[item.category]}
              </span>
            </div>

            <!-- 세탁완료 수량 -->
            <div class="w-28 flex justify-center shrink-0">
              <span class="px-2.5 py-1 rounded-lg text-sm font-bold bg-emerald-100 text-emerald-700">
                {item.counts.completed}개
              </span>
            </div>

            <!-- 출고 수량 편집 -->
            <div class="w-40 flex items-center justify-center gap-1.5 shrink-0">
              {#if isSelected}
                {#if isEditing}
                  <!-- 인라인 numpad 모드: 확인/취소 버튼 -->
                  <button
                    onclick={cancelNumpad}
                    class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold"
                  >취소</button>
                  <span class="text-base font-extrabold text-sky-700 w-10 text-center">{numpadValue || '0'}</span>
                  <button
                    onclick={confirmNumpad}
                    class="px-2 py-1 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold"
                  >확인</button>
                {:else}
                  <button
                    onclick={() => adjustQty(item.id, -1)}
                    class="w-8 h-8 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 font-bold flex items-center justify-center transition-colors"
                  >−</button>
                  <button
                    onclick={() => openNumpad(item.id)}
                    class="w-14 h-8 rounded-lg bg-white border-2 border-sky-200 hover:border-sky-400 text-sky-700 font-extrabold text-base flex items-center justify-center transition-colors"
                  >{qty}</button>
                  <button
                    onclick={() => adjustQty(item.id, 1)}
                    class="w-8 h-8 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 font-bold flex items-center justify-center transition-colors"
                  >+</button>
                {/if}
              {:else}
                <button
                  onclick={() => toggleItem(item.id)}
                  aria-label="{item.name} 선택"
                  class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-500 hover:text-sky-600 text-xs font-bold transition-colors"
                >선택</button>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- ④ 출고 정보 패널 (w-80) -->
  <aside class="w-80 bg-white border-l border-sky-100 flex flex-col shrink-0 overflow-hidden shadow-lg">
    <!-- 헤더 -->
    <div class="px-4 py-4 border-b border-sky-100 shrink-0 bg-sky-50">
      <h2 class="text-sm font-extrabold text-sky-700">출고 정보</h2>
      <p class="text-xs text-sky-500 mt-0.5">출고할 품목과 배송 정보를 입력하세요</p>
    </div>

    <div class="flex-1 overflow-y-auto flex flex-col">

      <!-- 인라인 numpad 영역 (편집중일 때 표시) -->
      {#if editingItemId !== null}
        <div class="px-4 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">수량 직접 입력</p>
          <div class="h-11 rounded-xl bg-white border-2 border-sky-300 flex items-center px-4 mb-3">
            <span class="text-2xl font-extrabold text-slate-800 flex-1 text-right tracking-widest">
              {numpadValue || '0'}
            </span>
            <span class="text-sm text-slate-400 ml-2">개</span>
          </div>
          <NumPad
            bind:value={numpadValue}
            onconfirm={confirmNumpad}
            accentClass="bg-sky-500 hover:bg-sky-600 text-white"
          />
        </div>
      {/if}

      <!-- 선택된 품목 목록 -->
      <div class="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          출고 품목
          {#if selectedEntries.length > 0}
            <span class="ml-1 text-sky-500">({selectedEntries.length})</span>
          {/if}
        </p>
        {#if selectedEntries.length === 0}
          <div class="rounded-xl bg-slate-50 border border-slate-100 px-3 py-4 text-center">
            <p class="text-xs text-slate-400">선택된 품목이 없습니다</p>
            <p class="text-xs text-slate-300 mt-1">좌측 목록에서 품목을 선택하세요</p>
          </div>
        {:else}
          <div class="rounded-xl border border-sky-200 overflow-hidden max-h-48 overflow-y-auto">
            {#each selectedEntries as entry (entry.itemId)}
              <div class="flex items-center px-3 py-2.5 border-b border-sky-100 last:border-b-0 hover:bg-sky-50 transition-colors">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-slate-700 truncate">{entry.itemName}</p>
                  <p class="text-xs text-slate-400">
                    잔여 <span class="text-sky-600 font-bold">{entry.completed}개</span>
                  </p>
                </div>
                <div class="flex items-center gap-2 ml-2 shrink-0">
                  <span class="text-lg font-extrabold text-sky-700">{entry.quantity}</span>
                  <span class="text-xs text-slate-400">개</span>
                  <button
                    onclick={() => removeEntry(entry.itemId)}
                    aria-label="{entry.itemName} 제거"
                    class="w-5 h-5 rounded-full bg-slate-100 hover:bg-red-100 flex items-center justify-center transition-colors"
                  >
                    <svg class="w-3 h-3 text-slate-400 hover:text-red-500" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
            <!-- 총계 -->
            <div class="flex items-center justify-between px-3 py-2 bg-sky-50 border-t border-sky-200">
              <span class="text-xs font-bold text-slate-500">총 출고 수량</span>
              <span class="text-base font-extrabold text-sky-700">{totalQuantity}개</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- 배송기사 선택 -->
      <div class="px-4 py-3 border-b border-slate-100 shrink-0">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">배송기사</p>
        <div class="space-y-1.5">
          {#each store.drivers as driver (driver.id)}
            <button
              onclick={() => (selectedDriverId = driver.id)}
              class="w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-all duration-150
                {selectedDriverId === driver.id
                  ? 'bg-sky-50 border-sky-300 shadow-sm'
                  : 'bg-slate-50 border-slate-200 hover:bg-sky-50 hover:border-sky-200'}"
            >
              <div class="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0 text-left">
                <p class="text-sm font-bold {selectedDriverId === driver.id ? 'text-sky-700' : 'text-slate-700'}">{driver.name}</p>
                <p class="text-xs text-slate-400">{driver.phone}</p>
              </div>
              {#if selectedDriverId === driver.id}
                <svg class="w-4 h-4 text-sky-500 shrink-0" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- 배송 시간 -->
      <div class="px-4 py-3 border-b border-slate-100 shrink-0">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">배송 시간</p>
        <input
          type="datetime-local"
          bind:value={shippedAt}
          class="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
      </div>

      <!-- 배송 메모 -->
      <div class="px-4 py-3 border-b border-slate-100 shrink-0">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">배송 메모</p>
        <textarea
          bind:value={memo}
          placeholder="메모를 입력하세요..."
          rows="3"
          class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 placeholder-slate-300"
        ></textarea>
      </div>

      <!-- 확정 / 취소 버튼 -->
      <div class="px-4 py-4 space-y-2 mt-auto shrink-0">
        {#if confirmResult === 'success'}
          <div class="w-full h-14 rounded-xl flex items-center justify-center gap-2 bg-green-50 border border-green-200">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="text-sm font-bold text-green-700">출고가 완료되었습니다!</span>
          </div>
        {:else}
          <button
            onclick={confirmShipout}
            disabled={!canConfirm}
            class="w-full h-14 rounded-xl font-bold text-base transition-all duration-150
              {canConfirm
                ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-200 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'}"
          >
            {#if canConfirm}
              출고 확정 ({totalQuantity}개)
            {:else if selectedEntries.length === 0}
              <span class="text-sm">품목을 선택하세요</span>
            {:else if !selectedDriverId}
              <span class="text-sm">배송기사를 선택하세요</span>
            {:else}
              출고 확정
            {/if}
          </button>
        {/if}
        <button
          onclick={() => navTo('/theme-b')}
          class="w-full h-11 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all duration-150 active:scale-[0.98]"
        >
          ← 취소
        </button>
      </div>
    </div>
  </aside>

</div>