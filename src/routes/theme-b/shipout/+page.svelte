<script lang="ts">
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import { goto } from '$app/navigation';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import type { LaundryCategory } from '$lib/data/types';

  type CategoryKey = LaundryCategory;

  // ── 상태 ────────────────────────────────────────────────────────
  let activeCategory = $state<CategoryKey>('all');
  let selectedItemIds = new SvelteSet<string>();
  let quantities = new SvelteMap<string, number>();
  let editingItemId = $state<string | null>(null);
  let numpadValue = $state('');

  function toLocalDatetimeValue(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  let shippedAtLocal = $state(toLocalDatetimeValue(new Date()));

  // ── 상수 ────────────────────────────────────────────────────────
  const categories: { key: CategoryKey; label: string }[] = [
    { key: 'all',     label: '전체' },
    { key: 'towel',   label: '타올' },
    { key: 'sheet',   label: '시트' },
    { key: 'uniform', label: '유니폼' },
  ];

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

  const navItems = [
    { path: '/',                  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: '홈' },
    { path: '/theme-b',           icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4', label: '세탁물' },
    { path: '/theme-b/shipout',   icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', label: '출고' },
    { path: '/theme-b/history',   icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: '현황' },
  ];
  const currentPath = '/theme-b/shipout';

  // ── 파생값 ──────────────────────────────────────────────────────
  let filteredItems = $derived(
    store.selectedClientId
      ? store.getItemsByCategory(store.selectedClientId, activeCategory)
      : []
  );

  let isAllSelected = $derived(
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedItemIds.has(item.id))
  );

  let selectedEntries = $derived(
    [...selectedItemIds].flatMap((itemId) => {
      const item =
        filteredItems.find((i) => i.id === itemId) ??
        store.laundryItems.find((i) => i.id === itemId);
      if (!item) return [];
      const qty = quantities.get(itemId) ?? item.counts.completed;
      return [{ itemId, itemName: item.name, category: item.category, quantity: qty }];
    })
  );

  let totalSelectedQty = $derived(
    selectedEntries.reduce((s, e) => s + e.quantity, 0)
  );

  // ── 조작 함수 ────────────────────────────────────────────────────
  function selectCategory(cat: CategoryKey) {
    activeCategory = cat;
    selectedItemIds.clear();
    quantities.clear();
    editingItemId = null;
    numpadValue = '';
  }

  function toggleItem(itemId: string, completed: number) {
    if (selectedItemIds.has(itemId)) {
      selectedItemIds.delete(itemId);
      quantities.delete(itemId);
      if (editingItemId === itemId) {
        editingItemId = null;
        numpadValue = '';
      }
    } else {
      selectedItemIds.add(itemId);
      quantities.set(itemId, completed);
    }
  }

  function toggleSelectAll() {
    if (isAllSelected) {
      selectedItemIds.clear();
      quantities.clear();
      editingItemId = null;
      numpadValue = '';
    } else {
      for (const item of filteredItems) {
        selectedItemIds.add(item.id);
        quantities.set(item.id, item.counts.completed);
      }
    }
  }

  function removeEntry(itemId: string) {
    selectedItemIds.delete(itemId);
    quantities.delete(itemId);
    if (editingItemId === itemId) {
      editingItemId = null;
      numpadValue = '';
    }
  }

  function adjustQty(itemId: string, delta: number) {
    const item = store.laundryItems.find((i) => i.id === itemId);
    if (!item) return;
    const max = item.counts.completed;
    const cur = quantities.get(itemId) ?? item.counts.completed;
    const next = Math.max(0, Math.min(max, cur + delta));
    if (next === 0) {
      selectedItemIds.delete(itemId);
      quantities.delete(itemId);
      if (editingItemId === itemId) { editingItemId = null; numpadValue = ''; }
    } else {
      quantities.set(itemId, next);
    }
  }

  function openNumpad(itemId: string) {
    editingItemId = itemId;
    numpadValue = String(quantities.get(itemId) ?? 0);
  }

  function handleNumpadConfirm(val: string) {
    if (!editingItemId) return;
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) { editingItemId = null; numpadValue = ''; return; }
    const item = store.laundryItems.find((i) => i.id === editingItemId);
    const clamped = Math.min(n, item?.counts.completed ?? 0);
    if (clamped === 0) {
      selectedItemIds.delete(editingItemId);
      quantities.delete(editingItemId);
    } else {
      quantities.set(editingItemId, clamped);
    }
    editingItemId = null;
    numpadValue = '';
  }

  function confirmShipout() {
    if (!store.selectedClientId || selectedEntries.length === 0) return;
    const clientId = store.selectedClientId;
    const shippedAt = new Date(shippedAtLocal).toISOString();
    const shipItems = selectedEntries.map((e) => ({
      laundryItemId: e.itemId,
      itemName: e.itemName,
      category: e.category,
      quantity: e.quantity,
    }));
    store.addShipment({ clientId, items: shipItems, driverId: 'system', memo: undefined, shippedAt });
    store.applyShipout(clientId, selectedEntries.map((e) => ({ itemId: e.itemId, quantity: e.quantity })));
  }
</script>

<svelte:head><title>출고 신청</title></svelte:head>

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
        onclick={() => void goto(nav.path)}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={nav.icon}/>
        </svg>
        <span class="text-[9px] font-bold">{nav.label}</span>
      </button>
    {/each}
  </nav>

  <!-- ── 거래처 패널 ── -->
  <aside class="w-60 bg-white border-r border-sky-100 flex flex-col shrink-0 overflow-hidden">
    <div class="px-3 py-3 border-b border-sky-100 shrink-0">
      <h2 class="text-base font-extrabold text-slate-700 tracking-wide">거래처</h2>
      <p class="text-[10px] text-slate-400 mt-0.5">{store.clients.length}개 등록</p>
    </div>
    <div class="flex-1 overflow-y-auto">
      {#each store.clients as client (client.id)}
        {@const isSel = store.selectedClientId === client.id}
        <button
          class="w-full flex items-center gap-2 px-3 py-4 min-h-[68px] transition-all duration-150 border-b border-slate-50
            {isSel ? 'bg-sky-50 border-l-4 border-l-sky-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}"
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

  <!-- ── 품목 선택 영역 ── -->
  <div class="flex-1 flex flex-col overflow-hidden">

    <!-- 헤더 -->
    <div class="bg-white border-b border-sky-100 px-5 py-3 shrink-0 shadow-sm flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-extrabold text-slate-800">출고 신청</h1>
        {#if store.selectedClient}
          <span class="px-2.5 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-bold">
            {store.selectedClient.name}
          </span>
        {:else}
          <span class="text-sm text-slate-400">거래처를 선택하세요</span>
        {/if}
      </div>
      {#if totalSelectedQty > 0}
        <span class="px-3 py-1.5 bg-sky-500 text-white rounded-full text-sm font-extrabold">
          총 {totalSelectedQty}개 선택
        </span>
      {/if}
    </div>

    <!-- 카테고리 탭 + 전체 선택 버튼 -->
    <div class="bg-white border-b border-slate-200 px-4 flex items-center gap-1 shrink-0">
      {#each categories as cat (cat.key)}
        <button
          class="px-4 py-3 text-sm font-bold transition-all duration-150
            {activeCategory === cat.key
              ? 'border-b-2 border-sky-500 text-sky-600'
              : 'text-slate-400 hover:text-slate-600'}"
          onclick={() => selectCategory(cat.key)}
        >
          {cat.label}
        </button>
      {/each}
      <div class="ml-auto">
        {#if store.selectedClientId && filteredItems.length > 0}
          <button
            class="px-4 py-2 rounded-lg bg-sky-100 text-sky-700 text-sm font-bold
              hover:bg-sky-200 transition-all duration-150 active:scale-95"
            onclick={toggleSelectAll}
          >
            {isAllSelected ? '전체 해제' : '전체 선택'}
          </button>
        {/if}
      </div>
    </div>

    <!-- 테이블 헤더 -->
    {#if store.selectedClientId && filteredItems.length > 0}
      <div class="bg-slate-100 border-b border-slate-200 px-4 shrink-0">
        <div class="flex items-center h-12">
          <div class="w-10 shrink-0"></div>
          <div class="flex-1 min-w-0 pl-2">
            <span class="text-sm font-bold text-slate-500 uppercase tracking-wide">품목명</span>
          </div>
          <div class="w-36 text-center shrink-0">
            <span class="text-sm font-bold text-slate-500">세탁완료</span>
          </div>
          <div class="w-44 text-center shrink-0">
            <span class="text-sm font-bold text-slate-500">출고수량</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- 품목 목록 -->
    <div class="flex-1 overflow-y-auto">
      {#if !store.selectedClientId}
        <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
          <div class="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
            <svg class="w-10 h-10 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
            </svg>
          </div>
          <p class="text-lg font-semibold">거래처를 선택하세요</p>
        </div>
      {:else if filteredItems.length === 0}
        <div class="flex items-center justify-center h-full text-slate-400">
          <p class="text-base font-medium">해당 카테고리에 품목이 없습니다</p>
        </div>
      {:else}
        {#each filteredItems as item (item.id)}
          {@const isSel = selectedItemIds.has(item.id)}
          {@const qty = quantities.get(item.id) ?? item.counts.completed}
          <div
            role="button"
            tabindex="0"
            class="flex items-center px-4 border-b border-slate-100 cursor-pointer transition-all duration-150
              {isSel ? 'bg-sky-50 border-l-4 border-l-sky-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}"
            style="min-height:72px"
            onclick={() => toggleItem(item.id, item.counts.completed)}
            onkeydown={(e) => e.key === 'Enter' && toggleItem(item.id, item.counts.completed)}
          >
            <!-- 체크 원 -->
            <div class="w-10 shrink-0 flex items-center justify-center">
              <div class="w-6 h-6 rounded-full border-2 transition-all duration-150 flex items-center justify-center
                {isSel ? 'bg-sky-500 border-sky-500' : 'border-slate-300'}">
                {#if isSel}
                  <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                {/if}
              </div>
            </div>

            <!-- 품목명 -->
            <div class="flex-1 min-w-0 pl-2">
              <span class="text-lg font-bold {isSel ? 'text-sky-700' : 'text-slate-800'}">{item.name}</span>
              <p class="text-[10px] text-slate-400 mt-0.5">{CATEGORY_LABELS[item.category]}</p>
            </div>

            <!-- 세탁완료 수량 -->
            <div class="w-36 flex justify-center shrink-0">
              <span class="text-2xl font-extrabold text-emerald-600">{item.counts.completed}</span>
            </div>

            <!-- 출고수량 컨트롤 -->
            <div class="w-44 flex items-center justify-center gap-2 shrink-0">
              {#if isSel}
                <button
                  aria-label="수량 감소"
                  class="w-12 h-12 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xl
                    flex items-center justify-center transition-all duration-150 active:scale-95"
                  onclick={(e) => { e.stopPropagation(); adjustQty(item.id, -1); }}
                >−</button>
                <button
                  aria-label="수량 직접 입력"
                  class="min-w-12 px-2 h-12 rounded-xl bg-white border-2 border-sky-300 text-sky-700
                    font-black text-2xl text-center transition-all duration-150 hover:bg-sky-50"
                  onclick={(e) => { e.stopPropagation(); openNumpad(item.id); }}
                >{qty}</button>
                <button
                  aria-label="수량 증가"
                  class="w-12 h-12 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xl
                    flex items-center justify-center transition-all duration-150 active:scale-95"
                  onclick={(e) => { e.stopPropagation(); adjustQty(item.id, 1); }}
                >+</button>
              {:else}
                <span class="text-sm text-slate-300">—</span>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- ── 출고 확정 패널 ── -->
  <aside class="w-96 bg-white border-l border-sky-100 flex flex-col shrink-0 overflow-hidden shadow-xl">

    <!-- 패널 헤더 -->
    <div class="px-5 py-5 bg-sky-700 shrink-0">
      <h2 class="text-lg font-black text-white">출고 신청</h2>
      <p class="text-xs text-sky-200 mt-0.5">
        {#if selectedEntries.length > 0}
          {selectedEntries.length}개 품목 선택됨
        {:else}
          품목을 선택하세요
        {/if}
      </p>
    </div>

    <div class="flex-1 overflow-y-auto flex flex-col">

      <!-- 선택된 품목 목록 -->
      {#if selectedEntries.length > 0}
        <div class="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">선택 품목</p>
          <div class="space-y-1.5">
            {#each selectedEntries as entry (entry.itemId)}
              <div class="flex items-center justify-between px-3 py-3 rounded-xl bg-sky-50 border border-sky-100">
                <div class="flex-1 min-w-0">
                  <p class="text-base font-bold text-slate-700 truncate">{entry.itemName}</p>
                  <p class="text-[10px] text-slate-400">{CATEGORY_LABELS[entry.category as LaundryCategory]}</p>
                </div>
                <span class="text-xl font-extrabold text-sky-700 mx-3">{entry.quantity}</span>
                <button
                  aria-label="품목 제거"
                  class="w-6 h-6 rounded-full bg-slate-200 hover:bg-red-100 flex items-center justify-center transition-all duration-150"
                  onclick={() => removeEntry(entry.itemId)}
                >
                  <svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
          <div class="flex items-center justify-between mt-3 px-3 py-2 bg-sky-100 rounded-xl">
            <span class="text-xs font-bold text-sky-600">총 출고 수량</span>
            <span class="text-2xl font-extrabold text-sky-700">{totalSelectedQty}<span class="text-sm font-bold ml-1">개</span></span>
          </div>
        </div>
      {/if}

      <!-- 출고 시간 -->
      <div class="px-4 py-4 border-b border-slate-100 shrink-0">
        <p class="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">출고 시간</p>
        <input
          type="datetime-local"
          bind:value={shippedAtLocal}
          class="w-full h-11 px-3 rounded-xl border-2 border-slate-200 text-base font-bold text-slate-700
            focus:outline-none focus:border-sky-400 transition-all"
        />
      </div>

      <!-- 키패드 영역 -->
      {#if editingItemId !== null}
        {@const editItem = store.laundryItems.find((i) => i.id === editingItemId)}
        <div class="px-4 py-3 border-b border-slate-100 shrink-0">
          <div class="flex items-center justify-between mb-2">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              수량 입력 — <span class="text-sky-600">{editItem?.name}</span>
            </p>
            <span class="text-[10px] text-slate-400">최대 {editItem?.counts.completed ?? 0}개</span>
          </div>
          <div class="h-14 rounded-xl bg-slate-50 border-2 border-sky-300 flex items-center px-4 mb-3">
            <span class="text-4xl font-extrabold text-slate-800 flex-1 text-right tracking-widest">
              {numpadValue === '' ? '0' : numpadValue}
            </span>
            <span class="text-sm text-slate-400 ml-2">개</span>
          </div>
          <NumPad
            bind:value={numpadValue}
            accentClass="bg-sky-500 hover:bg-sky-600 text-white"
            onconfirm={handleNumpadConfirm}
          />
        </div>
      {/if}

      <div class="mt-auto shrink-0"></div>
    </div>

    <!-- 버튼 영역 -->
    <div class="px-4 py-4 border-t border-slate-100 space-y-2 shrink-0">
      <button
        class="w-full h-16 rounded-xl font-bold text-base transition-all duration-150 active:scale-[0.98]
          {selectedEntries.length > 0
            ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-200'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'}"
        disabled={selectedEntries.length === 0}
        onclick={() => { confirmShipout(); void goto('/theme-b/history'); }}
      >
        {#if selectedEntries.length > 0}
          출고 확정 ({totalSelectedQty}개)
        {:else}
          출고 확정
        {/if}
      </button>
      <button
        class="w-full h-14 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100
          transition-all duration-150 border border-slate-200"
        onclick={() => void goto('/theme-b')}
      >
        취소
      </button>
    </div>
  </aside>

</div>