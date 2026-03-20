<script lang="ts">
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import { goto } from '$app/navigation';
  import { SvelteMap } from 'svelte/reactivity';
  import type { LaundryCategory, LaundryItem } from '$lib/data/types';

  // ── 탭 상태 ──────────────────────────────────────────────────────
  let activeTab = $state<LaundryCategory>('all');

  // ── 선택된 출고 품목: itemId → 출고 수량 ─────────────────────────
  let selectedQuantities = new SvelteMap<string, number>();

  // ── 우측 패널 상태 ────────────────────────────────────────────────
  let selectedDriverId = $state<string>('');
  let memo = $state('');
  let shippedAt = $state(new Date().toISOString().slice(0, 16));

  // ── 수량 편집용 NumPad 표시 대상 ──────────────────────────────────
  let editingItemId = $state<string | null>(null);
  let numpadValue = $state('');

  // ── 현재 거래처 + 탭 필터 품목 ───────────────────────────────────
  let filteredItems = $derived<LaundryItem[]>(
    store.selectedClientId
      ? store.getItemsByCategory(store.selectedClientId, activeTab)
      : []
  );

  // ── 선택된 품목 목록 (Map에 있는 것만) ───────────────────────────
  let selectedItemEntries = $derived<{ item: LaundryItem; quantity: number }[]>(
    (() => {
      if (!store.selectedClientId) return [];
      const allItems = store.getItemsByCategory(store.selectedClientId, 'all');
      const result: { item: LaundryItem; quantity: number }[] = [];
      for (const [id, qty] of selectedQuantities.entries()) {
        const found = allItems.find((i) => i.id === id);
        if (found && qty > 0) result.push({ item: found, quantity: qty });
      }
      return result;
    })()
  );

  // ── 총 출고 수량 ──────────────────────────────────────────────────
  let totalQuantity = $derived(
    selectedItemEntries.reduce((sum, e) => sum + e.quantity, 0)
  );

  // ── 기본 기사 초기화 ──────────────────────────────────────────────
  $effect(() => {
    if (store.drivers.length > 0 && selectedDriverId === '') {
      selectedDriverId = store.drivers[0].id;
    }
  });

  // ── 거래처 변경 시 선택 초기화 ────────────────────────────────────
  $effect(() => {
    void store.selectedClientId;
    selectedQuantities.clear();
    editingItemId = null;
    numpadValue = '';
  });

  // ── 탭 변경 ───────────────────────────────────────────────────────
  function changeTab(tab: LaundryCategory) {
    activeTab = tab;
    editingItemId = null;
    numpadValue = '';
  }

  // ── 품목 선택 토글 ────────────────────────────────────────────────
  function toggleItem(item: LaundryItem) {
    if (selectedQuantities.has(item.id)) {
      selectedQuantities.delete(item.id);
      if (editingItemId === item.id) {
        editingItemId = null;
        numpadValue = '';
      }
    } else {
      const defaultQty = item.counts.completed;
      selectedQuantities.set(item.id, defaultQty > 0 ? defaultQty : 0);
    }
  }

  // ── 수량 직접 조정 (+1 / -1) ──────────────────────────────────────
  function adjustQuantity(itemId: string, delta: number) {
    const current = selectedQuantities.get(itemId) ?? 0;
    const newVal = Math.max(0, current + delta);
    selectedQuantities.set(itemId, newVal);
  }

  // ── NumPad 수정 시작 ──────────────────────────────────────────────
  function startEdit(itemId: string) {
    editingItemId = itemId;
    numpadValue = String(selectedQuantities.get(itemId) ?? 0);
  }

  // ── NumPad 확인 ───────────────────────────────────────────────────
  function confirmNumpad(val: string) {
    if (editingItemId === null) return;
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      selectedQuantities.set(editingItemId, num);
    }
    editingItemId = null;
    numpadValue = '';
  }

  // ── 출고 확정 ────────────────────────────────────────────────────
  async function confirmShipout() {
    if (!store.selectedClientId) return;
    if (selectedItemEntries.length === 0) return;
    if (!selectedDriverId) return;

    const clientId = store.selectedClientId;

    // 출고 품목 배열 구성
    const shipItems = selectedItemEntries.map(({ item, quantity }) => ({
      laundryItemId: item.id,
      itemName: item.name,
      category: item.category,
      quantity,
    }));

    // addShipment 호출
    store.addShipment({
      clientId,
      items: shipItems,
      driverId: selectedDriverId,
      memo: memo.trim() || undefined,
      shippedAt: new Date(shippedAt).toISOString(),
    });

    // 각 품목 completed -= quantity, shipped += quantity
    for (const { item, quantity } of selectedItemEntries) {
      const newCompleted = Math.max(0, item.counts.completed - quantity);
      const newShipped = item.counts.shipped + quantity;
      store.updateLaundryItem(clientId, item.id, 'completed', newCompleted);
      store.updateLaundryItem(clientId, item.id, 'shipped', newShipped);
    }

    void goto('/theme-a/history');
  }

  // ── 카테고리 탭 배열 ──────────────────────────────────────────────
  const tabs: LaundryCategory[] = ['all', 'towel', 'sheet', 'uniform'];
</script>

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

    <!-- 거래처 목록 -->
    <nav class="flex-1 overflow-y-auto py-3 px-3 space-y-1">
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
       중앙: 품목 선택
  ════════════════════════════════════════════════════════════ -->
  <main class="flex-1 flex flex-col overflow-hidden">

    <!-- 상단 헤더 + 탭 -->
    <header class="bg-white border-b border-emerald-100 px-6 pt-5 pb-0 shadow-sm shrink-0">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-extrabold text-slate-800">
            🚚 출고 신청
          </h1>
          {#if store.selectedClient}
            <p class="text-sm text-slate-400 mt-0.5">{store.selectedClient.name} · {store.selectedClient.address}</p>
          {:else}
            <p class="text-sm text-slate-400 mt-0.5">거래처를 선택하세요</p>
          {/if}
        </div>
        {#if selectedQuantities.size > 0}
          <span class="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-bold">
            {selectedQuantities.size}개 품목 선택 · 총 {totalQuantity}개
          </span>
        {/if}
      </div>

      <!-- 카테고리 탭 -->
      <div class="flex gap-1">
        {#each tabs as tab (tab)}
          <button
            type="button"
            class="px-5 py-3 text-sm font-bold rounded-t-xl transition-all duration-150 border-b-2
              {activeTab === tab
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 border-transparent'}"
            onclick={() => changeTab(tab)}
          >
            {CATEGORY_LABELS[tab]}
            {#if store.selectedClientId}
              <span class="ml-1.5 text-xs opacity-75">
                ({store.getItemsByCategory(store.selectedClientId, tab).length})
              </span>
            {/if}
          </button>
        {/each}
      </div>
    </header>

    <!-- 품목 카드 그리드 -->
    <div class="flex-1 overflow-y-auto p-6">
      {#if !store.selectedClientId}
        <div class="flex flex-col items-center justify-center h-full text-slate-400">
          <svg class="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"/>
          </svg>
          <p class="text-lg font-medium">왼쪽에서 거래처를 선택해 주세요</p>
        </div>
      {:else if filteredItems.length === 0}
        <div class="flex flex-col items-center justify-center h-full text-slate-400">
          <p class="text-lg font-medium">해당 카테고리 품목이 없습니다</p>
        </div>
      {:else}
        <div class="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {#each filteredItems as item (item.id)}
            {@const isSelected = selectedQuantities.has(item.id)}
            {@const qty = selectedQuantities.get(item.id) ?? 0}
            {@const isEditing = editingItemId === item.id}
            <div
              class="bg-white rounded-2xl p-4 border-2 shadow-sm transition-all duration-150
                {isSelected
                  ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-300 ring-offset-1 shadow-md'
                  : 'border-slate-100 hover:border-emerald-200 hover:shadow-md'}"
            >
              <!-- 품목명 + 선택 버튼 -->
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1 min-w-0">
                  <p class="text-lg font-bold text-slate-800 truncate">{item.name}</p>
                  <span class="inline-block text-xs px-2 py-0.5 rounded-full mt-1
                    {item.category === 'towel' ? 'bg-sky-100 text-sky-600' :
                     item.category === 'sheet' ? 'bg-violet-100 text-violet-600' :
                     'bg-orange-100 text-orange-600'}">
                    {CATEGORY_LABELS[item.category]}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={isSelected ? `${item.name} 선택 해제` : `${item.name} 선택`}
                  class="ml-2 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 active:scale-90
                    {isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'}"
                  onclick={() => toggleItem(item)}
                >
                  {#if isSelected}
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  {:else}
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                  {/if}
                </button>
              </div>

              <!-- 수량 정보 요약 -->
              <div class="flex gap-2 mb-3">
                <div class="flex-1 rounded-lg bg-emerald-50 px-3 py-2 text-center">
                  <p class="text-xs text-emerald-600 font-medium">세탁완료</p>
                  <p class="text-xl font-extrabold text-emerald-700">{item.counts.completed}</p>
                </div>
                <div class="flex-1 rounded-lg bg-slate-50 px-3 py-2 text-center">
                  <p class="text-xs text-slate-500 font-medium">재고</p>
                  <p class="text-xl font-extrabold text-slate-600">{item.counts.stock}</p>
                </div>
              </div>

              <!-- 선택 시: 수량 편집 -->
              {#if isSelected}
                <div class="mt-2">
                  {#if isEditing}
                    <!-- NumPad 인라인 -->
                    <div class="bg-white rounded-xl border border-indigo-200 p-3">
                      <div class="h-12 rounded-lg bg-slate-50 border-2 border-indigo-200 flex items-center px-3 mb-3">
                        <span class="text-2xl font-extrabold text-slate-800 flex-1 text-right tracking-widest">
                          {numpadValue === '' ? '0' : numpadValue}
                        </span>
                        <span class="text-sm text-slate-400 ml-2">개</span>
                      </div>
                      <NumPad
                        bind:value={numpadValue}
                        accentClass="bg-indigo-500 hover:bg-indigo-600 text-white"
                        onconfirm={(v) => confirmNumpad(v)}
                      />
                      <button
                        type="button"
                        class="w-full mt-2 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-sm font-medium transition-all duration-150"
                        onclick={() => { editingItemId = null; numpadValue = ''; }}
                      >
                        취소
                      </button>
                    </div>
                  {:else}
                    <!-- 수량 표시 + 조정 버튼 -->
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="{item.name} 수량 줄이기"
                        class="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xl flex items-center justify-center transition-all duration-150 active:scale-90"
                        onclick={() => adjustQuantity(item.id, -1)}
                      >−</button>
                      <button
                        type="button"
                        aria-label="{item.name} 수량 직접 입력"
                        class="flex-1 h-10 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-extrabold text-xl text-center transition-all duration-150 hover:bg-indigo-100"
                        onclick={() => startEdit(item.id)}
                      >
                        {qty}<span class="text-sm font-normal text-indigo-400 ml-1">개</span>
                      </button>
                      <button
                        type="button"
                        aria-label="{item.name} 수량 늘리기"
                        class="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xl flex items-center justify-center transition-all duration-150 active:scale-90"
                        onclick={() => adjustQuantity(item.id, 1)}
                      >+</button>
                    </div>
                    <p class="text-xs text-slate-400 text-center mt-1">숫자 탭 → 키패드 입력</p>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </main>

  <!-- ════════════════════════════════════════════════════════════
       오른쪽 패널: 출고 정보 입력
  ════════════════════════════════════════════════════════════ -->
  <aside class="w-80 flex flex-col bg-white border-l border-emerald-100 shadow-sm shrink-0 overflow-y-auto">

    <div class="px-5 py-5 border-b border-emerald-100 shrink-0">
      <h2 class="text-base font-bold text-slate-700">출고 정보</h2>
    </div>

    <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">

      <!-- 선택된 품목 목록 -->
      <div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">출고 품목 목록</p>
        {#if selectedItemEntries.length === 0}
          <div class="rounded-xl bg-slate-50 border border-slate-100 px-4 py-4 text-sm text-slate-400 text-center">
            <p>품목을 선택해 주세요</p>
            <p class="text-xs mt-1 text-slate-300">카드의 + 버튼을 눌러 추가</p>
          </div>
        {:else}
          <div class="rounded-xl border border-indigo-200 overflow-hidden">
            {#each selectedItemEntries as { item, quantity }, idx (item.id)}
              <div class="flex items-center justify-between px-4 py-3 {idx !== 0 ? 'border-t border-indigo-100' : ''} hover:bg-indigo-50 transition-colors">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-slate-700 truncate">{item.name}</p>
                  <p class="text-xs text-slate-400">{CATEGORY_LABELS[item.category]}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-lg font-extrabold text-indigo-700">{quantity}</span>
                  <span class="text-sm text-slate-400">개</span>
                  <button
                    type="button"
                    aria-label="{item.name} 출고 목록에서 제거"
                    class="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center transition-all duration-150 active:scale-90"
                    onclick={() => {
                      selectedQuantities.delete(item.id);
                    }}
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
            <!-- 합계 -->
            <div class="flex items-center justify-between px-4 py-3 bg-indigo-50 border-t border-indigo-200">
              <span class="text-sm font-bold text-slate-600">총 출고</span>
              <span class="text-lg font-extrabold text-indigo-700">{totalQuantity} 개</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- 배송기사 선택 -->
      <div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">배송기사</p>
        <div class="space-y-2">
          {#each store.drivers as driver (driver.id)}
            <button
              type="button"
              class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-150 active:scale-95
                {selectedDriverId === driver.id
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                  : 'border-slate-100 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50'}"
              onclick={() => { selectedDriverId = driver.id; }}
            >
              <div class="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-bold text-sm">{driver.name}</p>
                <p class="text-xs text-slate-400">{driver.phone}</p>
              </div>
              {#if selectedDriverId === driver.id}
                <svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
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
          bind:value={shippedAt}
        />
      </div>

      <!-- 메모 -->
      <div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">메모 (선택)</p>
        <textarea
          class="w-full rounded-xl border-2 border-slate-200 focus:border-emerald-400 outline-none px-4 py-3 text-slate-800 text-sm bg-white resize-none transition-all duration-150"
          rows="3"
          placeholder="배송 관련 메모를 입력하세요..."
          bind:value={memo}
        ></textarea>
      </div>

      <!-- 구분선 -->
      <div class="border-t border-slate-100"></div>

      <!-- 출고 확정 버튼 -->
      <button
        type="button"
        class="w-full h-14 rounded-xl font-bold text-base transition-all duration-150 active:scale-95
          {selectedItemEntries.length > 0 && selectedDriverId
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'}"
        onclick={confirmShipout}
        disabled={selectedItemEntries.length === 0 || !selectedDriverId}
      >
        🚚 출고 확정
        {#if selectedItemEntries.length > 0}
          <span class="text-sm font-normal opacity-80 ml-1">
            ({selectedItemEntries.length}종 · {totalQuantity}개)
          </span>
        {/if}
      </button>

      <!-- 취소 버튼 -->
      <button
        type="button"
        class="w-full h-12 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all duration-150 active:scale-95 mb-4"
        onclick={() => void goto('/theme-a')}
      >
        취소 → 세탁물 관리로
      </button>
    </div>
  </aside>
</div>