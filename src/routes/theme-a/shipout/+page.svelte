<script lang="ts">
  import { goto } from '$app/navigation';
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import type { LaundryCategory, LaundryItem } from '$lib/data/types';

  // ── 상태 ──────────────────────────────────────────────────────────
  let selectedCategory = $state<LaundryCategory>('all');
  // itemId → 출고 수량
  let selectedQty = $state(new SvelteMap<string, number>());

  function nowDatetimeLocal(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  let shippedAt = $state(nowDatetimeLocal());

  const clientIcons: Record<string, string> = {
    hotel: '🏨', pension: '🏡', resort: '🌴', etc: '🏢'
  };

  const categoryOrder: LaundryCategory[] = ['all', 'towel', 'sheet', 'uniform'];

  const categoryBadgeColors: Record<string, string> = {
    towel: 'bg-sky-100 text-sky-700',
    sheet: 'bg-violet-100 text-violet-700',
    uniform: 'bg-amber-100 text-amber-700'
  };

  // ── 파생 ──────────────────────────────────────────────────────────
  let currentItems = $derived(
    store.selectedClientId
      ? store.getItemsByCategory(store.selectedClientId, selectedCategory)
      : []
  );

  let selectedItemsList = $derived(
    (() => {
      const result: Array<{ item: LaundryItem; qty: number }> = [];
      for (const [itemId, qty] of selectedQty.entries()) {
        if (qty > 0) {
          const item = currentItems.find(i => i.id === itemId)
            ?? (store.selectedClientId
              ? store.getItemsByCategory(store.selectedClientId, 'all').find(i => i.id === itemId)
              : undefined);
          if (item) result.push({ item, qty });
        }
      }
      return result;
    })()
  );

  let totalQty = $derived(selectedItemsList.reduce((s, x) => s + x.qty, 0));

  function selectClient(id: string) {
    store.selectClient(id);
    selectedQty = new SvelteMap();
  }

  function toggleCard(item: LaundryItem) {
    if (item.counts.completed === 0) return;
    if (selectedQty.has(item.id)) {
      selectedQty.delete(item.id);
    } else {
      selectedQty.set(item.id, item.counts.completed);
    }
  }

  function adjustQty(itemId: string, delta: number) {
    const item = currentItems.find(i => i.id === itemId)
      ?? (store.selectedClientId
        ? store.getItemsByCategory(store.selectedClientId, 'all').find(i => i.id === itemId)
        : undefined);
    if (!item) return;
    const current = selectedQty.get(itemId) ?? 0;
    const next = Math.max(1, Math.min(item.counts.completed, current + delta));
    selectedQty.set(itemId, next);
  }

  function removeSelected(itemId: string) {
    selectedQty.delete(itemId);
  }

  function canConfirm() {
    return store.selectedClientId && selectedItemsList.length > 0 && shippedAt;
  }

  function handleConfirm() {
    if (!canConfirm() || !store.selectedClientId) return;
    const items = selectedItemsList.map(({ item, qty }) => ({
      laundryItemId: item.id,
      itemName: item.name,
      category: item.category,
      quantity: qty
    }));
    store.addShipment({
      clientId: store.selectedClientId,
      items,
      driverId: 'system',
      memo: undefined,
      shippedAt: new Date(shippedAt).toISOString()
    });
    store.applyShipout(
      store.selectedClientId,
      selectedItemsList.map(({ item, qty }) => ({ itemId: item.id, quantity: qty }))
    );
    goto('/theme-a/history');
  }
</script>

<svelte:head>
  <title>출고 신청 — Pro Dashboard</title>
</svelte:head>

<div class="h-screen flex flex-col overflow-hidden bg-slate-50 select-none">

  <!-- ── 상단 헤더 ── -->
  <header class="h-16 bg-white border-b border-indigo-100 shadow-sm flex items-center px-5 gap-3 shrink-0 z-10">
    <div class="flex items-center gap-2.5 mr-3">
      <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
        <span class="text-lg">🏭</span>
      </div>
      <span class="font-extrabold text-indigo-700 text-base tracking-tight whitespace-nowrap">세탁물 관리</span>
    </div>

    <nav class="flex items-center gap-3 flex-1">
      <button
        class="px-6 py-3 rounded-full text-base font-bold transition-all text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
        onclick={() => goto('/theme-a')}
      >세탁물관리</button>
      <button
        class="px-6 py-3 rounded-full text-base font-bold transition-all bg-indigo-500 text-white shadow-sm"
        onclick={() => goto('/theme-a/shipout')}
      >출고신청</button>
      <button
        class="px-6 py-3 rounded-full text-base font-bold transition-all text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
        onclick={() => goto('/theme-a/defect')}
      >불량처리</button>
      <button
        class="px-6 py-3 rounded-full text-base font-bold transition-all text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
        onclick={() => goto('/theme-a/history')}
      >출고현황</button>
    </nav>

    <button
      class="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all border border-slate-200"
      onclick={() => goto('/')}
    >홈으로 /</button>
  </header>

  <!-- ── 하단 영역 ── -->
  <div class="flex flex-1 overflow-hidden">

    <!-- ── 거래처 패널 ── -->
    <aside class="w-56 bg-white border-r border-indigo-100 flex flex-col shrink-0 overflow-hidden">
      <div class="px-4 py-3 border-b border-indigo-50">
        <p class="text-xs font-bold text-indigo-700 tracking-wide uppercase">거래처 목록</p>
      </div>
      <div class="flex-1 overflow-y-auto">
        {#each store.clients as client}
          {@const isSelected = store.selectedClientId === client.id}
          {@const totalCompleted = store.getTotalCompleted(client.id)}
          <button
            class="w-full min-h-[72px] flex items-center gap-2.5 px-3 text-left transition-all duration-150
              {isSelected
                ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                : 'border-l-4 border-l-transparent hover:bg-indigo-50/50'}"
            onclick={() => selectClient(client.id)}
          >
            <span class="text-xl shrink-0">{clientIcons[client.type] ?? '🏢'}</span>
            <div class="flex-1 min-w-0">
              <p class="text-base font-bold text-slate-800 truncate">{client.name}</p>
              <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                {client.type === 'hotel' ? 'bg-blue-100 text-blue-600' :
                 client.type === 'pension' ? 'bg-green-100 text-green-600' :
                 client.type === 'resort' ? 'bg-purple-100 text-purple-600' :
                 'bg-slate-100 text-slate-600'}">
                {client.type}
              </span>
            </div>
            <span class="text-sm font-bold text-emerald-600 shrink-0">{totalCompleted}</span>
          </button>
        {/each}
      </div>
    </aside>

    <!-- ── 카드 그리드 영역 ── -->
    <main class="flex-1 flex flex-col overflow-hidden bg-indigo-50/30">
      <!-- 카테고리 탭 -->
      <div class="px-5 pt-4 pb-3 flex items-center gap-2 shrink-0">
        {#each categoryOrder as cat}
          <button
            class="px-5 py-2.5 rounded-full text-base font-semibold transition-all duration-150
              {selectedCategory === cat
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-indigo-100'}"
            onclick={() => { selectedCategory = cat; }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        {/each}
        {#if store.selectedClientId}
          <span class="ml-auto text-xs text-slate-400 font-medium">{currentItems.length}개 품목</span>
        {/if}
      </div>

      <!-- 카드 그리드 -->
      <div class="flex-1 overflow-y-auto px-5 pb-5">
        {#if !store.selectedClientId}
          <div class="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <span class="text-5xl">👈</span>
            <p class="text-base font-semibold">거래처를 선택하세요</p>
            <p class="text-sm">왼쪽 목록에서 거래처를 선택하면 품목이 표시됩니다</p>
          </div>
        {:else if currentItems.length === 0}
          <div class="h-full flex items-center justify-center text-slate-400">
            <p class="text-sm">해당 카테고리에 품목이 없습니다</p>
          </div>
        {:else}
          <div class="grid grid-cols-2 gap-4">
            {#each currentItems as item}
              {@const isSelected = selectedQty.has(item.id)}
              {@const qty = selectedQty.get(item.id) ?? 0}
              {@const disabled = item.counts.completed === 0}
              <div
                class="relative bg-white rounded-2xl shadow-md p-5 flex flex-col gap-3 text-left transition-all duration-150
                  {disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : isSelected
                      ? 'ring-4 ring-teal-500 bg-indigo-50 shadow-lg cursor-pointer active:scale-[0.98]'
                      : 'hover:shadow-lg cursor-pointer active:scale-[0.98]'}"
                onclick={() => { if (!disabled) toggleCard(item); }}
                role="button"
                tabindex={disabled ? -1 : 0}
                onkeydown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) toggleCard(item); }}
              >
                <!-- 상단: 품목명 + 뱃지 + 체크 -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-lg font-black text-slate-800">{item.name}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full {categoryBadgeColors[item.category]}">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </div>
                  {#if isSelected}
                    <span class="shrink-0 w-6 h-6 bg-teal-500 text-white rounded-full flex items-center justify-center text-xs font-black">✓</span>
                  {/if}
                </div>

                <!-- 세탁완료 수 크게 표시 -->
                <div class="flex flex-col items-center py-1">
                  <span class="text-4xl font-black text-emerald-600 leading-none">{item.counts.completed}</span>
                  <span class="text-sm font-bold text-slate-400 mt-1">세탁완료</span>
                </div>

                <!-- 선택 시 수량 조절 -->
                {#if isSelected}
                  <div
                    class="flex items-center justify-between bg-white border border-indigo-200 rounded-xl px-3 py-2 gap-2"
                    onclick={(e) => e.stopPropagation()}
                    onkeydown={(e) => e.stopPropagation()}
                    role="none"
                  >
                    <button
                      type="button"
                      class="w-10 h-10 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-black text-xl flex items-center justify-center transition-all active:scale-90"
                      onclick={(e) => { e.stopPropagation(); adjustQty(item.id, -1); }}
                      aria-label="수량 줄이기"
                    >−</button>
                    <span class="text-2xl font-black text-indigo-700 min-w-[2.5rem] text-center">{qty}</span>
                    <button
                      type="button"
                      class="w-10 h-10 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-black text-xl flex items-center justify-center transition-all active:scale-90"
                      onclick={(e) => { e.stopPropagation(); adjustQty(item.id, +1); }}
                      aria-label="수량 늘리기"
                    >+</button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </main>

    <!-- ── 출고정보 패널 ── -->
    <aside class="w-96 bg-white border-l border-indigo-100 shadow-xl flex flex-col shrink-0 overflow-hidden">
      <!-- 헤더 -->
      <div class="h-14 bg-indigo-700 text-white flex items-center px-5 shrink-0">
        <span class="font-bold text-base tracking-wide">출고 목록</span>
        {#if selectedItemsList.length > 0}
          <span class="ml-auto text-xs bg-white/20 px-2.5 py-1 rounded-full font-semibold">{selectedItemsList.length}개 품목</span>
        {/if}
      </div>

      <div class="flex-1 flex flex-col overflow-hidden p-4 gap-3">

        <!-- 선택 품목 리스트 -->
        <div class="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0">
          {#if selectedItemsList.length === 0}
            <div class="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <span class="text-3xl">📦</span>
              <p class="text-sm font-medium">출고할 품목을 선택하세요</p>
              <p class="text-xs text-center">카드를 클릭해 품목을 추가하면<br>여기에 표시됩니다</p>
            </div>
          {:else}
            {#each selectedItemsList as { item, qty }}
              <div class="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                <div class="flex-1 min-w-0">
                  <p class="text-base font-bold text-slate-800 truncate">{item.name}</p>
                  <p class="text-xs text-slate-400 mt-0.5">{CATEGORY_LABELS[item.category]}</p>
                </div>
                <span class="text-lg font-black text-indigo-600 shrink-0">{qty}개</span>
                <button
                  class="w-7 h-7 rounded-lg bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center text-xs font-bold transition-all shrink-0 border border-slate-100"
                  onclick={() => removeSelected(item.id)}
                >✕</button>
              </div>
            {/each}
          {/if}
        </div>

        <!-- 총 출고 수량 -->
        {#if selectedItemsList.length > 0}
          <div class="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3.5 flex items-center justify-between shrink-0">
            <span class="text-base font-bold text-teal-700">총 출고 수량</span>
            <span class="text-3xl font-black text-teal-600">{totalQty}개</span>
          </div>
        {/if}

        <!-- 출고 시간 -->
        <div class="shrink-0">
          <label for="shipped-at" class="block text-sm font-bold text-slate-500 mb-1.5">출고 시간</label>
          <input
            id="shipped-at"
            type="datetime-local"
            bind:value={shippedAt}
            class="w-full h-12 px-3 rounded-xl border border-indigo-200 text-base font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
          />
        </div>

        <!-- 출고 확정 버튼 -->
        <button
          class="h-16 rounded-xl text-base font-bold transition-all duration-150 active:scale-[0.98] shrink-0
            {canConfirm()
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
              : 'bg-slate-100 text-slate-300 cursor-not-allowed'}"
          onclick={handleConfirm}
          disabled={!canConfirm()}
        >
          📦 출고 확정
        </button>

        <!-- 취소 버튼 -->
        <button
          class="h-14 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all active:scale-[0.98] shrink-0"
          onclick={() => goto('/theme-a')}
        >취소</button>

      </div>
    </aside>

  </div>
</div>