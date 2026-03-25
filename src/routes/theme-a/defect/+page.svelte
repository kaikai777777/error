<script lang="ts">
  import { goto } from '$app/navigation';
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { LaundryCategory, LaundryItem } from '$lib/data/types';

  // ── 상태 ──────────────────────────────────────────────────────────
  let selectedCategory = $state<LaundryCategory>('all');
  let selectedItemIds = $state(new SvelteSet<string>());
  let processMode = $state<'all' | 'partial'>('all');
  let defectType = $state<'dispose' | 'return' | 'other'>('dispose');
  let inputValue = $state('');
  let resultMessage = $state('');
  let resultSuccess = $state(false);
  let showResult = $state(false);

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

  let selectedItems = $derived(
    (() => {
      const allItems = store.selectedClientId
        ? store.getItemsByCategory(store.selectedClientId, 'all')
        : [];
      return allItems.filter(item => selectedItemIds.has(item.id));
    })()
  );

  let totalSelectedDefect = $derived(
    selectedItems.reduce((s, i) => s + i.counts.defect, 0)
  );

  function selectClient(id: string) {
    store.selectClient(id);
    selectedItemIds = new SvelteSet();
    inputValue = '';
    showResult = false;
  }

  function toggleItem(item: LaundryItem) {
    if (item.counts.defect === 0) return;
    if (selectedItemIds.has(item.id)) {
      selectedItemIds.delete(item.id);
    } else {
      selectedItemIds.add(item.id);
    }
    inputValue = '';
  }

  function handleProcess() {
    if (!store.selectedClientId || selectedItems.length === 0) return;

    const clientId = store.selectedClientId;

    if (processMode === 'all') {
      for (const item of selectedItems) {
        store.processDefectAll(clientId, item.id);
      }
      resultMessage = `${selectedItems.length}개 품목 불량 전체 처리 완료`;
    } else {
      const qty = parseInt(inputValue, 10);
      if (isNaN(qty) || qty <= 0) {
        resultMessage = '처리 수량을 입력하세요';
        resultSuccess = false;
        showResult = true;
        return;
      }
      for (const item of selectedItems) {
        const processQty = Math.min(qty, item.counts.defect);
        store.processDefect(clientId, item.id, processQty);
      }
      resultMessage = `${selectedItems.length}개 품목 불량 ${qty}개씩 처리 완료`;
    }

    resultSuccess = true;
    showResult = true;
    selectedItemIds = new SvelteSet();
    inputValue = '';

    setTimeout(() => { showResult = false; }, 3000);
  }

  const defectTypeConfig = {
    dispose: {
      label: '🗑️ 폐기',
      active: 'bg-slate-700 text-white shadow-sm',
      inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
    },
    return: {
      label: '↩️ 반환',
      active: 'bg-indigo-600 text-white shadow-sm',
      inactive: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'
    },
    other: {
      label: '📝 기타',
      active: 'bg-slate-500 text-white shadow-sm',
      inactive: 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
    }
  } as const;
</script>

<svelte:head>
  <title>불량 처리 — Pro Dashboard</title>
</svelte:head>

<div class="h-screen flex flex-col overflow-hidden bg-slate-50 select-none">

  <!-- ── 상단 헤더 ── -->
  <header class="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center px-5 gap-3 shrink-0 z-10">
    <!-- 로고 -->
    <div class="flex items-center gap-2.5 mr-3">
      <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
        <span class="text-lg">🏭</span>
      </div>
      <span class="font-extrabold text-indigo-700 text-base tracking-tight whitespace-nowrap">세탁물 관리</span>
    </div>

    <!-- 내비게이션 -->
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
        class="px-6 py-3 rounded-full text-base font-bold transition-all bg-indigo-600 text-white shadow-sm"
        onclick={() => goto('/theme-a/defect')}
      >불량처리</button>
      <button
        class="px-6 py-3 rounded-full text-base font-bold transition-all text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
        onclick={() => goto('/theme-a/history')}
      >출고현황</button>
    </nav>

    <button
      class="ml-auto px-4 py-2 rounded-full text-xs font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all border border-slate-200"
      onclick={() => goto('/')}
    >홈으로 /</button>
  </header>

  <!-- ── 하단 3-패널 영역 ── -->
  <div class="flex flex-1 overflow-hidden">

    <!-- ── 거래처 패널 (left) w-56 ── -->
    <aside class="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100">
        <p class="text-xs font-bold text-indigo-700 tracking-widest uppercase">거래처 목록</p>
      </div>
      <div class="flex-1 overflow-y-auto">
        {#each store.clients as client}
          {@const isSelected = store.selectedClientId === client.id}
          {@const totalDefect = store.getTotalDefect(client.id)}
          <button
            class="w-full min-h-[72px] flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-150
              {isSelected
                ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
                : 'border-l-4 border-l-transparent hover:bg-slate-50'}"
            onclick={() => selectClient(client.id)}
          >
            <span class="text-xl shrink-0">{clientIcons[client.type] ?? '🏢'}</span>
            <div class="flex-1 min-w-0">
              <p class="text-base font-bold text-slate-800 truncate leading-tight">{client.name}</p>
              <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block
                {client.type === 'hotel'   ? 'bg-blue-100 text-blue-600'   :
                 client.type === 'pension' ? 'bg-green-100 text-green-600' :
                 client.type === 'resort'  ? 'bg-purple-100 text-purple-600' :
                 'bg-slate-100 text-slate-600'}">
                {client.type}
              </span>
            </div>
            <div class="shrink-0">
              {#if totalDefect > 0}
                <span class="text-sm font-bold bg-rose-600 text-white px-2 py-0.5 rounded-full leading-none">
                  ✕{totalDefect}
                </span>
              {:else}
                <span class="text-xs text-slate-300 font-medium">없음</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </aside>

    <!-- ── 불량 카드 그리드 (center, flex-1 narrower) ── -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <!-- 카테고리 탭 -->
      <div class="px-5 pt-4 pb-3 flex items-center gap-3 shrink-0 border-b border-slate-100 bg-white">
        {#each categoryOrder as cat}
          <button
            class="px-5 py-2.5 rounded-full text-base font-semibold transition-all duration-150
              {selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200'}"
            onclick={() => { selectedCategory = cat; selectedItemIds = new SvelteSet(); inputValue = ''; }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        {/each}
        {#if store.selectedClientId}
          {@const defectItems = currentItems.filter(i => i.counts.defect > 0)}
          <span class="ml-auto text-xs text-rose-600 font-bold tracking-wide">
            불량 품목 {defectItems.length}개
          </span>
        {/if}
      </div>

      <!-- 카드 그리드 -->
      <div class="flex-1 overflow-y-auto px-5 py-5 bg-slate-50">
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
              {@const isSelected = selectedItemIds.has(item.id)}
              {@const hasDefect = item.counts.defect > 0}
              <button
                class="relative bg-white rounded-2xl shadow-sm p-6 min-h-[160px] flex flex-col gap-3 text-left transition-all duration-150
                  {!hasDefect
                    ? 'opacity-40 cursor-not-allowed'
                    : isSelected
                      ? 'ring-4 ring-rose-400 bg-rose-50 shadow-lg cursor-pointer active:scale-[0.98]'
                      : 'hover:shadow-md cursor-pointer hover:ring-2 hover:ring-rose-200 active:scale-[0.98] border border-slate-100'}"
                onclick={() => toggleItem(item)}
                disabled={!hasDefect}
              >
                <!-- 상단: 품목명 + 카테고리 뱃지 + 체크 -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex flex-col gap-1">
                    <span class="text-xl font-black text-slate-800 leading-tight">{item.name}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit {categoryBadgeColors[item.category]}">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </div>
                  {#if isSelected}
                    <span class="shrink-0 w-7 h-7 bg-rose-500 text-white rounded-full flex items-center justify-center text-sm font-black shadow-sm">✓</span>
                  {/if}
                </div>

                <!-- 불량 수 크게 (center) -->
                <div class="flex flex-col items-center py-1 flex-1 justify-center">
                  <span class="text-5xl font-black leading-none
                    {hasDefect ? 'text-rose-600' : 'text-slate-300'}">
                    {item.counts.defect}
                  </span>
                  <span class="text-sm font-bold mt-1
                    {hasDefect ? 'text-rose-400' : 'text-slate-300'}">불량</span>
                </div>

                <!-- 보조 수치 (completed / stock) -->
                <div class="flex items-center justify-around border-t border-slate-100 pt-2.5 gap-1">
                  <div class="flex flex-col items-center gap-0.5">
                    <span class="text-lg font-bold text-emerald-600">{item.counts.completed}</span>
                    <span class="text-xs font-bold text-slate-400">세탁완료</span>
                  </div>
                  <div class="w-px h-7 bg-slate-100"></div>
                  <div class="flex flex-col items-center gap-0.5">
                    <span class="text-lg font-bold text-slate-500">{item.counts.stock}</span>
                    <span class="text-xs font-bold text-slate-400">재고</span>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </main>

    <!-- ── 처리 패널 (right) w-96 ── -->
    <aside class="w-96 bg-white border-l border-slate-200 shadow-xl flex flex-col shrink-0 overflow-hidden">
      <!-- 헤더 -->
      <div class="bg-rose-700 px-5 py-5 flex items-center shrink-0">
        <span class="text-lg font-black text-white tracking-wide">불량 처리</span>
        {#if selectedItems.length > 0}
          <span class="ml-auto text-sm bg-white/20 text-white px-3 py-1 rounded-full font-bold">{selectedItems.length}개 선택</span>
        {/if}
      </div>

      <div class="flex-1 flex flex-col overflow-y-auto p-4 gap-4">

        <!-- 결과 메시지 -->
        {#if showResult}
          <div class="rounded-xl px-4 py-3 text-sm font-bold text-center shrink-0
            {resultSuccess ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-600 border border-rose-200'}">
            {resultMessage}
          </div>
        {/if}

        <!-- 선택 품목 목록 -->
        <div class="flex flex-col gap-2 shrink-0">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">선택된 품목</p>
          {#if selectedItems.length === 0}
            <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-5 text-center">
              <span class="text-3xl block mb-2">⚠️</span>
              <p class="text-xs text-slate-400 font-medium leading-relaxed">불량 있는 카드를 클릭해<br>품목을 선택하세요</p>
            </div>
          {:else}
            <div class="max-h-36 overflow-y-auto flex flex-col gap-1.5">
              {#each selectedItems as item}
                <div class="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5">
                  <div class="flex-1 min-w-0">
                    <p class="text-base font-bold text-slate-800 truncate">{item.name}</p>
                    <p class="text-xs text-slate-400 font-medium">{CATEGORY_LABELS[item.category]}</p>
                  </div>
                  <span class="text-xl font-black text-rose-600 shrink-0">✕{item.counts.defect}</span>
                  <button
                    class="w-6 h-6 rounded-lg bg-white hover:bg-rose-100 text-slate-300 hover:text-rose-400 flex items-center justify-center text-xs font-black transition-all shrink-0 border border-slate-200"
                    onclick={() => selectedItemIds.delete(item.id)}
                  >✕</button>
                </div>
              {/each}
            </div>
            <!-- 총 불량 수 -->
            <div class="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span class="text-sm font-bold text-rose-700">총 불량 수량</span>
              <span class="text-2xl font-black text-rose-700">{totalSelectedDefect}개</span>
            </div>
          {/if}
        </div>

        <!-- 처리 방식 토글 -->
        <div class="shrink-0">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">처리 방식</p>
          <div class="flex gap-2">
            <button
              class="flex-1 h-16 rounded-xl text-base font-bold transition-all duration-150
                {processMode === 'all'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'}"
              onclick={() => { processMode = 'all'; inputValue = ''; }}
            >전체처리</button>
            <button
              class="flex-1 h-16 rounded-xl text-base font-bold transition-all duration-150
                {processMode === 'partial'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'}"
              onclick={() => { processMode = 'partial'; inputValue = ''; }}
            >부분처리</button>
          </div>
        </div>

        <!-- 부분 처리 시 NumPad -->
        {#if processMode === 'partial'}
          <div class="shrink-0 flex flex-col gap-2">
            <!-- 입력값 표시 -->
            <div class="h-16 bg-amber-50 border-2 border-amber-200 rounded-xl flex items-center justify-center">
              {#if inputValue}
                <span class="text-2xl font-black text-amber-700">{inputValue}</span>
              {:else}
                <span class="text-sm text-amber-400 font-semibold">처리 수량 입력</span>
              {/if}
            </div>
            <NumPad
              bind:value={inputValue}
              accentClass="bg-amber-500 hover:bg-amber-600 text-white"
            />
          </div>
        {/if}

        <!-- 처리 유형 -->
        <div class="shrink-0">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">처리 유형</p>
          <div class="flex gap-2">
            {#each Object.entries(defectTypeConfig) as [type, cfg]}
              <button
                class="flex-1 h-14 rounded-xl text-sm font-bold transition-all duration-150
                  {defectType === type ? cfg.active : cfg.inactive}"
                onclick={() => defectType = type as typeof defectType}
              >{cfg.label}</button>
            {/each}
          </div>
        </div>

        <!-- 처리 완료 버튼 -->
        <button
          class="h-16 rounded-xl font-bold text-base transition-all duration-150 active:scale-[0.98] mt-auto shrink-0
            {selectedItems.length > 0 && (processMode === 'all' || inputValue)
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg'
              : 'bg-slate-100 text-slate-300 cursor-not-allowed'}"
          onclick={handleProcess}
          disabled={selectedItems.length === 0 || (processMode === 'partial' && !inputValue)}
        >
          ✅ 처리 완료
        </button>

      </div>
    </aside>

  </div>
</div>