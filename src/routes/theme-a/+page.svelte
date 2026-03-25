<script lang="ts">
  import { goto } from '$app/navigation';
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { LaundryCategory, LaundryItem } from '$lib/data/types';

  let selectedCategory = $state<LaundryCategory>('all');
  let selectedItemIds = $state(new SvelteSet<string>());
  let activeField = $state<'completed' | 'defect'>('completed');
  let inputValue = $state('');

  let currentItems = $derived(
    store.selectedClientId
      ? store.getItemsByCategory(store.selectedClientId, selectedCategory)
      : []
  );

  let selectedItems = $derived(
    currentItems.filter(item => selectedItemIds.has(item.id))
  );

  const clientIcons: Record<string, string> = {
    hotel: '🏨',
    pension: '🏡',
    resort: '🌴',
    etc: '🏢'
  };

  const categoryOrder: LaundryCategory[] = ['all', 'towel', 'sheet', 'uniform'];

  function toggleItemSelection(item: LaundryItem) {
    if (selectedItemIds.has(item.id)) {
      selectedItemIds.delete(item.id);
    } else {
      selectedItemIds.add(item.id);
    }
    inputValue = '';
  }

  function selectClient(id: string) {
    store.selectClient(id);
    selectedItemIds = new SvelteSet();
    inputValue = '';
  }

  function applyValue() {
    const num = parseInt(inputValue, 10);
    if (isNaN(num) || num < 0 || !store.selectedClientId) return;
    for (const item of selectedItems) {
      store.updateLaundryItem(store.selectedClientId, item.id, activeField, num);
    }
    inputValue = '';
  }

  function getCardState(item: LaundryItem) {
    const isSelected = selectedItemIds.has(item.id);
    const hasDefect = item.counts.defect > 0;
    const isDone = item.counts.completed > 0 && item.counts.defect === 0;
    if (isSelected) return 'selected';
    if (hasDefect) return 'defect';
    if (isDone) return 'done';
    return 'normal';
  }

  function cardClass(item: LaundryItem) {
    const s = getCardState(item);
    const base = 'relative bg-white rounded-2xl shadow-md p-6 min-h-[160px] cursor-pointer transition-all duration-150 active:scale-[0.98] flex flex-col gap-4 select-none';
    if (s === 'selected') return base + ' ring-4 ring-indigo-400 bg-indigo-50 shadow-lg';
    if (s === 'defect')   return base + ' ring-2 ring-rose-200 bg-rose-50';
    if (s === 'done')     return base + ' ring-2 ring-emerald-300 bg-emerald-50';
    return base + ' hover:shadow-lg hover:ring-1 hover:ring-slate-200';
  }

  const categoryBadgeColors: Record<string, string> = {
    towel:   'bg-sky-100 text-sky-700',
    sheet:   'bg-violet-100 text-violet-700',
    uniform: 'bg-amber-100 text-amber-700'
  };

  const clientTypeBadge: Record<string, string> = {
    hotel:   'bg-indigo-100 text-indigo-600',
    pension: 'bg-teal-100 text-teal-600',
    resort:  'bg-purple-100 text-purple-600',
    etc:     'bg-slate-100 text-slate-600'
  };
</script>

<svelte:head>
  <title>세탁물 관리 — Pro Dashboard</title>
</svelte:head>

<div class="h-screen flex flex-col overflow-hidden bg-slate-50 select-none">

  <!-- ── 상단 헤더 ── -->
  <header class="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center px-5 gap-3 shrink-0 z-10">

    <!-- 로고 -->
    <div class="flex items-center gap-3 mr-3 shrink-0">
      <div class="w-10 h-10 bg-indigo-700 rounded-xl flex items-center justify-center shadow-md shrink-0">
        <span class="text-xl">🏭</span>
      </div>
      <span class="font-extrabold text-indigo-800 text-lg tracking-tight whitespace-nowrap">세탁물 관리</span>
    </div>

    <!-- 탭 네비게이션 -->
    <nav class="flex items-center gap-3 flex-1">
      <button
        class="px-6 py-3 rounded-full text-base font-bold transition-all bg-indigo-600 text-white shadow-sm"
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
        class="px-6 py-3 rounded-full text-base font-bold transition-all text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
        onclick={() => goto('/theme-a/history')}
      >출고현황</button>
    </nav>

    <!-- 홈 버튼 -->
    <button
      class="ml-auto px-4 py-2 rounded-full text-sm font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all border border-slate-200"
      onclick={() => goto('/')}
    >홈으로 /</button>
  </header>

  <!-- ── 메인 영역 ── -->
  <div class="flex flex-1 overflow-hidden">

    <!-- ── 거래처 사이드바 ── -->
    <aside class="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p class="text-xs font-bold text-indigo-700 tracking-widest uppercase">거래처 목록</p>
      </div>
      <div class="flex-1 overflow-y-auto">
        {#each store.clients as client}
          {@const isSelected = store.selectedClientId === client.id}
          {@const totalCompleted = store.getTotalCompleted(client.id)}
          <button
            class="w-full min-h-[72px] flex items-center gap-3 px-3 text-left transition-all duration-150
              {isSelected
                ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
                : 'border-l-4 border-l-transparent hover:bg-slate-50'}"
            onclick={() => selectClient(client.id)}
          >
            <span class="text-2xl shrink-0">{clientIcons[client.type] ?? '🏢'}</span>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-base text-slate-800 truncate leading-tight">{client.name}</p>
              <span class="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full
                {clientTypeBadge[client.type] ?? 'bg-slate-100 text-slate-600'}">
                {client.type}
              </span>
            </div>
            <div class="shrink-0 flex flex-col items-end gap-1">
              <span class="text-sm font-bold text-emerald-600 leading-none">{totalCompleted}</span>
            </div>
          </button>
        {/each}
      </div>
    </aside>

    <!-- ── 카드 그리드 영역 ── -->
    <main class="flex-1 flex flex-col overflow-hidden">

      <!-- 카테고리 탭 -->
      <div class="px-5 pt-4 pb-3 flex items-center gap-3 shrink-0 border-b border-slate-100 bg-white">
        {#each categoryOrder as cat}
          <button
            class="px-6 py-3 rounded-xl text-base font-bold transition-all duration-150
              {selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200'}"
            onclick={() => {
              selectedCategory = cat;
              selectedItemIds = new SvelteSet();
              inputValue = '';
            }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        {/each}

        {#if store.selectedClientId}
          <span class="ml-auto text-sm text-slate-400 font-semibold">{currentItems.length}개 품목</span>
        {/if}
      </div>

      <!-- 카드 그리드 -->
      <div class="flex-1 overflow-y-auto px-5 py-5">
        {#if !store.selectedClientId}
          <div class="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
            <span class="text-6xl">👈</span>
            <p class="text-lg font-bold text-slate-500">거래처를 선택하세요</p>
            <p class="text-sm text-slate-400">왼쪽 목록에서 거래처를 선택하면 품목이 표시됩니다</p>
          </div>
        {:else if currentItems.length === 0}
          <div class="h-full flex items-center justify-center text-slate-400">
            <p class="text-base font-semibold">해당 카테고리에 품목이 없습니다</p>
          </div>
        {:else}
          <div class="grid grid-cols-2 gap-4">
            {#each currentItems as item}
              {@const isSelected = selectedItemIds.has(item.id)}
              <button
                class={cardClass(item)}
                onclick={() => toggleItemSelection(item)}
              >
                <!-- 카드 헤더 -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex flex-col gap-1.5">
                    <span class="text-xl font-black text-slate-800 leading-tight text-left">{item.name}</span>
                    <span class="self-start text-xs font-bold px-2.5 py-1 rounded-full {categoryBadgeColors[item.category]}">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </div>
                  {#if isSelected}
                    <span class="shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-black shadow">✓</span>
                  {/if}
                </div>

                <!-- 수치 3개 -->
                <div class="flex items-center justify-center gap-2 mt-auto">
                  <div class="flex flex-col items-center gap-1 flex-1">
                    <span class="text-4xl font-black text-emerald-500 leading-none">{item.counts.completed}</span>
                    <span class="text-sm font-bold text-slate-400">세탁완료</span>
                  </div>
                  <div class="w-px h-10 bg-slate-150 bg-slate-200 shrink-0"></div>
                  <div class="flex flex-col items-center gap-1 flex-1">
                    <span class="text-4xl font-black text-rose-500 leading-none">{item.counts.defect}</span>
                    <span class="text-sm font-bold text-slate-400">불량</span>
                  </div>
                  <div class="w-px h-10 bg-slate-200 shrink-0"></div>
                  <div class="flex flex-col items-center gap-1 flex-1">
                    <span class="text-4xl font-black text-slate-500 leading-none">{item.counts.stock}</span>
                    <span class="text-sm font-bold text-slate-400">재고</span>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </main>

    <!-- ── 입력 패널 ── -->
    <aside class="w-80 bg-white border-l border-slate-200 shadow-xl flex flex-col shrink-0 overflow-hidden">

      <!-- 패널 헤더 -->
      <div class="h-16 bg-indigo-700 text-white flex items-center px-5 shrink-0">
        <span class="font-bold text-base tracking-wide">수량 입력</span>
        {#if selectedItems.length > 0}
          <span class="ml-auto text-sm bg-white/20 px-3 py-1 rounded-full font-bold">{selectedItems.length}개 선택</span>
        {/if}
      </div>

      <div class="flex-1 flex flex-col overflow-hidden px-4 py-4 gap-3">

        <!-- 선택된 품목 목록 -->
        <div class="max-h-28 overflow-y-auto flex flex-col gap-1.5 shrink-0">
          {#if selectedItems.length === 0}
            <p class="text-sm text-slate-400 text-center py-3 font-medium">카드를 클릭해 품목 선택</p>
          {:else}
            {#each selectedItems as item}
              <div class="flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-2">
                <span class="text-sm font-bold text-indigo-700 flex-1 truncate">{item.name}</span>
                <button
                  class="text-slate-400 hover:text-rose-500 text-sm font-black shrink-0 transition-colors"
                  onclick={() => selectedItemIds.delete(item.id)}
                >✕</button>
              </div>
            {/each}
          {/if}
        </div>

        <!-- 필드 선택 버튼 -->
        <div class="flex gap-2 shrink-0">
          <button
            class="flex-1 h-14 rounded-xl text-sm font-bold transition-all
              {activeField === 'completed'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-200'}"
            onclick={() => { activeField = 'completed'; inputValue = ''; }}
          >세탁완료</button>
          <button
            class="flex-1 h-14 rounded-xl text-sm font-bold transition-all
              {activeField === 'defect'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 border border-slate-200'}"
            onclick={() => { activeField = 'defect'; inputValue = ''; }}
          >불량</button>
        </div>

        <!-- 입력값 표시 박스 -->
        <div class="h-16 bg-indigo-50 border-2 border-indigo-200 rounded-xl flex items-center justify-center shrink-0">
          {#if inputValue}
            <span class="text-2xl font-black text-indigo-700">{inputValue}</span>
          {:else}
            <span class="text-sm text-indigo-300 font-semibold">숫자를 입력하세요</span>
          {/if}
        </div>

        <!-- 숫자 패드 -->
        <div class="shrink-0">
          <NumPad
            bind:value={inputValue}
            accentClass="bg-indigo-600 hover:bg-indigo-700 text-white"
          />
        </div>

        <!-- 적용 버튼 -->
        <button
          class="h-16 rounded-xl font-bold text-base transition-all duration-150 active:scale-[0.98] shrink-0
            {selectedItems.length > 0 && inputValue
              ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-md'
              : 'bg-slate-100 text-slate-300 cursor-not-allowed'}"
          onclick={applyValue}
          disabled={selectedItems.length === 0 || !inputValue}
        >
          수량 적용
        </button>

        <!-- 하단 이동 버튼들 -->
        <div class="flex flex-col gap-2 mt-auto shrink-0">
          <div class="grid grid-cols-2 gap-2">
            <button
              class="py-4 rounded-xl text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white transition-all active:scale-[0.98]"
              onclick={() => goto('/theme-a/shipout')}
            >📦 출고신청</button>
            <button
              class="py-4 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white transition-all active:scale-[0.98]"
              onclick={() => goto('/theme-a/defect')}
            >⚠️ 불량처리</button>
          </div>
          <button
            class="w-full py-4 rounded-xl text-sm font-bold bg-slate-600 hover:bg-slate-700 text-white transition-all active:scale-[0.98]"
            onclick={() => goto('/theme-a/history')}
          >📋 출고현황</button>
        </div>

      </div>
    </aside>

  </div>
</div>