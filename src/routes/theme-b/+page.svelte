<script lang="ts">
  import { store, CATEGORY_LABELS, STATUS_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import { goto } from '$app/navigation';
  import { SvelteSet } from 'svelte/reactivity';
  import type { LaundryCategory, LaundryItemStatus } from '$lib/data/types';

  type CategoryKey = LaundryCategory;

  let activeCategory = $state<CategoryKey>('all');
  let selectedItemIds = new SvelteSet<string>();
  let selectedField = $state<LaundryItemStatus>('received');
  let inputValue = $state('');

  const categories: { key: CategoryKey; label: string; icon: string }[] = [
    { key: 'all', label: '전체', icon: '📋' },
    { key: 'towel', label: '타올', icon: '🛁' },
    { key: 'sheet', label: '시트', icon: '🛏' },
    { key: 'uniform', label: '유니폼', icon: '👔' },
  ];

  const displayStatuses: LaundryItemStatus[] = ['received', 'washing', 'completed', 'defect', 'stock'];

  const statusBadge: Record<LaundryItemStatus, string> = {
    received: 'bg-sky-100 text-sky-700',
    washing: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
    defect: 'bg-red-100 text-red-700',
    stock: 'bg-slate-100 text-slate-600',
    shipped: 'bg-purple-100 text-purple-700',
  };

  const fieldButtons: { key: LaundryItemStatus; label: string; color: string }[] = [
    { key: 'received', label: '입고', color: 'bg-sky-100 text-sky-700 border-sky-200' },
    { key: 'completed', label: '세탁완료', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { key: 'defect', label: '불량', color: 'bg-red-100 text-red-700 border-red-200' },
    { key: 'stock', label: '재고', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  ];

  const selectedFieldActive: Record<LaundryItemStatus, string> = {
    received: 'bg-sky-500 text-white border-sky-500',
    washing: 'bg-amber-500 text-white border-amber-500',
    completed: 'bg-emerald-500 text-white border-emerald-500',
    defect: 'bg-red-500 text-white border-red-500',
    stock: 'bg-slate-600 text-white border-slate-600',
    shipped: 'bg-purple-500 text-white border-purple-500',
  };

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

  let filteredItems = $derived(
    store.selectedClientId
      ? store.getItemsByCategory(store.selectedClientId, activeCategory)
      : []
  );

  let selectedItems = $derived(
    filteredItems.filter((item) => selectedItemIds.has(item.id))
  );

  function getClientTotal(clientId: string): number {
    const items = store.getItemsByCategory(clientId, 'all');
    return items.reduce((sum, item) => sum + item.counts.received, 0);
  }

  function selectCategory(cat: CategoryKey) {
    activeCategory = cat;
    selectedItemIds.clear();
  }

  function toggleItem(itemId: string) {
    if (selectedItemIds.has(itemId)) {
      selectedItemIds.delete(itemId);
    } else {
      selectedItemIds.add(itemId);
    }
  }

  function removeSelectedItem(itemId: string) {
    selectedItemIds.delete(itemId);
  }

  function selectField(field: LaundryItemStatus) {
    selectedField = field;
    inputValue = '';
  }

  function applyInput() {
    const num = parseInt(inputValue, 10);
    if (isNaN(num) || num < 0) return;
    if (!store.selectedClientId) return;
    for (const item of selectedItems) {
      store.updateLaundryItem(store.selectedClientId, item.id, selectedField, num);
    }
    inputValue = '';
  }

  function bulkComplete() {
    if (!store.selectedClientId) return;
    const items = store.getItemsByCategory(store.selectedClientId, activeCategory);
    for (const item of items) {
      const washing = item.counts.washing;
      if (washing > 0) {
        store.updateLaundryItem(store.selectedClientId, item.id, 'completed', item.counts.completed + washing);
        store.updateLaundryItem(store.selectedClientId, item.id, 'washing', 0);
      }
    }
  }

  function selectAll() {
    if (selectedItemIds.size === filteredItems.length) {
      selectedItemIds.clear();
    } else {
      selectedItemIds.clear();
      filteredItems.forEach((i) => selectedItemIds.add(i.id));
    }
  }

  function navTo(path: string) {
    void goto(path);
  }
</script>

<div class="flex h-screen bg-slate-50 overflow-hidden">

  <!-- ① 아이콘 내비 (w-16) -->
  <nav class="w-16 bg-sky-700 flex flex-col items-center py-4 gap-1 shrink-0 shadow-lg z-10">
    <!-- 로고 -->
    <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-4 shrink-0">
      <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"/>
      </svg>
    </div>

    <!-- 홈 -->
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

    <!-- 세탁물관리 (현재) -->
    <button
      onclick={() => navTo('/theme-b')}
      aria-label="세탁물 관리"
      class="w-full h-14 flex flex-col items-center justify-center gap-0.5 bg-sky-500 text-white rounded-lg mx-1 shadow-md"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
      </svg>
      <span class="text-[9px] font-bold">세탁물</span>
    </button>

    <!-- 출고신청 -->
    <button
      onclick={() => navTo('/theme-b/shipout')}
      aria-label="출고 신청"
      class="w-full h-14 flex flex-col items-center justify-center gap-0.5 text-sky-200 hover:text-white hover:bg-white/10 transition-colors rounded-lg mx-1"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
      </svg>
      <span class="text-[9px] font-bold">출고</span>
    </button>

    <!-- 출고현황 -->
    <button
      onclick={() => navTo('/theme-b/history')}
      aria-label="출고 현황"
      class="w-full h-14 flex flex-col items-center justify-center gap-0.5 text-sky-200 hover:text-white hover:bg-white/10 transition-colors rounded-lg mx-1"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
      <span class="text-[9px] font-bold">현황</span>
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
          onclick={() => { store.selectClient(client.id); selectedItemIds.clear(); }}
          class="w-full h-16 px-3 text-left flex items-center gap-2 transition-all duration-150
            {isSelected
              ? 'bg-sky-50 border-l-4 border-sky-500'
              : 'border-l-4 border-transparent hover:bg-slate-50'}"
        >
          <span class="text-xl shrink-0">{clientTypeIcon[client.type] ?? '🏢'}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold truncate {isSelected ? 'text-sky-700' : 'text-slate-800'}">{client.name}</p>
            <div class="flex items-center gap-1 mt-0.5">
              <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold {clientTypeBadgeColor[client.type] ?? 'bg-slate-100 text-slate-600'}">
                {clientTypeLabel[client.type] ?? client.type}
              </span>
            </div>
          </div>
          <div class="text-right shrink-0">
            <p class="text-xs font-bold {isSelected ? 'text-sky-600' : 'text-slate-500'}">{getClientTotal(client.id)}</p>
            <p class="text-[9px] text-slate-400">입고</p>
          </div>
        </button>
      {/each}
    </div>
  </aside>

  <!-- ③ 세로 카테고리 탭 (w-20) -->
  <div class="w-20 bg-sky-50 border-r border-sky-100 flex flex-col shrink-0 pt-3 gap-1 px-2">
    <p class="text-[10px] font-bold text-sky-400 uppercase tracking-widest text-center mb-2">카테고리</p>
    {#each categories as cat (cat.key)}
      <button
        onclick={() => selectCategory(cat.key)}
        class="h-20 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-xs transition-all duration-150 border
          {activeCategory === cat.key
            ? 'bg-sky-500 text-white border-sky-500 shadow-md'
            : 'text-sky-600 border-sky-100 hover:bg-sky-100 bg-white'}"
      >
        <span class="text-xl">{cat.icon}</span>
        <span class="text-[11px]">{cat.label}</span>
      </button>
    {/each}
  </div>

  <!-- ④ 세탁물 리스트 (flex-1) -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- 헤더 -->
    <div class="bg-white border-b border-sky-100 px-5 py-3 shrink-0 flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-3">
        {#if store.selectedClient}
          <h1 class="text-lg font-extrabold text-slate-800">{store.selectedClient.name}</h1>
          <span class="px-2.5 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-bold">
            {CATEGORY_LABELS[activeCategory]}
          </span>
          <span class="text-xs text-slate-400">{filteredItems.length}개 품목</span>
        {:else}
          <h1 class="text-lg font-extrabold text-slate-400">거래처를 선택하세요</h1>
        {/if}
      </div>
      {#if selectedItemIds.size > 0}
        <span class="px-3 py-1.5 bg-sky-100 text-sky-700 rounded-full text-sm font-bold">
          {selectedItemIds.size}개 선택됨
        </span>
      {/if}
    </div>

    <!-- 테이블 헤더 -->
    {#if store.selectedClientId && filteredItems.length > 0}
      <div class="bg-slate-100 border-b border-slate-200 px-4 shrink-0">
        <div class="flex items-center h-9">
          <div class="w-8 shrink-0 flex items-center justify-center">
            <button
              onclick={selectAll}
              aria-label="전체 선택"
              class="w-4 h-4 rounded border-2 {selectedItemIds.size === filteredItems.length && filteredItems.length > 0 ? 'bg-sky-500 border-sky-500' : 'border-slate-300 bg-white'} flex items-center justify-center"
            >
              {#if selectedItemIds.size === filteredItems.length && filteredItems.length > 0}
                <svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              {/if}
            </button>
          </div>
          <div class="flex-1 min-w-0 pl-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wide">품목명</span>
          </div>
          {#each displayStatuses as status (status)}
            <div class="w-20 text-center shrink-0">
              <span class="text-xs font-bold text-slate-500">{STATUS_LABELS[status]}</span>
            </div>
          {/each}
          <div class="w-24 text-center shrink-0">
            <span class="text-xs font-bold text-slate-500">업데이트</span>
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
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"/>
            </svg>
          </div>
          <p class="text-base font-medium">왼쪽에서 거래처를 선택하세요</p>
        </div>
      {:else if filteredItems.length === 0}
        <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
          <p class="text-base font-medium">해당 카테고리의 품목이 없습니다</p>
        </div>
      {:else}
        {#each filteredItems as item (item.id)}
          {@const isSelected = selectedItemIds.has(item.id)}
          {@const updatedDate = new Date(item.updatedAt)}
          <button
            onclick={() => toggleItem(item.id)}
            class="w-full h-14 flex items-center px-4 border-b border-slate-100 transition-all duration-100 cursor-pointer
              {isSelected
                ? 'bg-sky-50 border-l-4 border-l-sky-500'
                : 'bg-white border-l-4 border-l-transparent hover:bg-sky-50'}"
          >
            <!-- 선택 체크 -->
            <div class="w-8 shrink-0 flex items-center justify-center">
              {#if isSelected}
                <div class="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center shadow-sm">
                  <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
              {:else}
                <div class="w-5 h-5 rounded-full border-2 border-slate-200"></div>
              {/if}
            </div>

            <!-- 품목명 -->
            <div class="flex-1 min-w-0 pl-2 flex items-center gap-2">
              <span class="text-sm font-semibold text-slate-800 truncate">{item.name}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0
                {item.category === 'towel' ? 'bg-sky-100 text-sky-600'
                : item.category === 'sheet' ? 'bg-violet-100 text-violet-600'
                : 'bg-orange-100 text-orange-600'}">
                {CATEGORY_LABELS[item.category]}
              </span>
            </div>

            <!-- 상태별 수치 -->
            {#each displayStatuses as status (status)}
              <div class="w-20 flex justify-center shrink-0">
                <span class="px-2 py-0.5 rounded-lg text-sm font-bold {statusBadge[status] ?? 'bg-slate-100 text-slate-600'}">
                  {item.counts[status]}
                </span>
              </div>
            {/each}

            <!-- 업데이트 시각 -->
            <div class="w-24 shrink-0 text-center">
              <span class="text-xs text-slate-400">
                {updatedDate.getMonth() + 1}/{updatedDate.getDate()}
                {String(updatedDate.getHours()).padStart(2, '0')}:{String(updatedDate.getMinutes()).padStart(2, '0')}
              </span>
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </div>

  <!-- ⑤ 입력 패널 (w-64) -->
  <aside class="w-64 bg-white border-l border-sky-100 flex flex-col shrink-0 overflow-hidden shadow-lg">
    <!-- 헤더 -->
    <div class="px-4 py-4 border-b border-sky-100 shrink-0 bg-sky-50">
      <h2 class="text-sm font-extrabold text-sky-700">수량 입력 패널</h2>
      <p class="text-xs text-sky-500 mt-0.5">
        {#if selectedItemIds.size > 0}
          {selectedItemIds.size}개 품목 선택됨
        {:else}
          품목을 선택하세요
        {/if}
      </p>
    </div>

    <div class="flex-1 overflow-y-auto flex flex-col">
      <!-- 선택 품목 목록 -->
      <div class="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">선택된 품목</p>
        {#if selectedItems.length === 0}
          <div class="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-center">
            <p class="text-xs text-slate-400">선택된 품목이 없습니다</p>
          </div>
        {:else}
          <div class="rounded-xl bg-sky-50 border border-sky-200 overflow-hidden max-h-28 overflow-y-auto">
            {#each selectedItems as item (item.id)}
              <div class="flex items-center justify-between px-3 py-1.5 border-b border-sky-100 last:border-b-0">
                <span class="text-xs font-bold text-slate-700 truncate flex-1">{item.name}</span>
                <button
                  onclick={(e) => { e.stopPropagation(); removeSelectedItem(item.id); }}
                  aria-label="{item.name} 선택 해제"
                  class="w-4 h-4 rounded-full bg-sky-200 hover:bg-red-100 flex items-center justify-center ml-2 shrink-0 transition-colors"
                >
                  <svg class="w-2.5 h-2.5 text-sky-600 hover:text-red-500" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- 수정 대상 상태 선택 -->
      <div class="px-4 py-3 border-b border-slate-100 shrink-0">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">수정 대상 상태</p>
        <div class="grid grid-cols-2 gap-1.5">
          {#each fieldButtons as btn (btn.key)}
            <button
              onclick={() => selectField(btn.key)}
              class="h-9 rounded-xl text-xs font-bold border transition-all duration-150
                {selectedField === btn.key
                  ? selectedFieldActive[btn.key]
                  : btn.color + ' hover:opacity-80'}"
            >
              {btn.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- 입력값 표시 -->
      <div class="px-4 pt-3 pb-2 shrink-0">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">입력값</p>
        <div class="h-12 rounded-xl bg-slate-50 border-2 border-sky-200 flex items-center px-4">
          <span class="text-2xl font-extrabold text-slate-800 flex-1 text-right tracking-widest">
            {inputValue || '0'}
          </span>
          <span class="text-sm text-slate-400 ml-2">개</span>
        </div>
      </div>

      <!-- 숫자 키패드 -->
      <div class="px-4 py-2 shrink-0">
        <NumPad
          bind:value={inputValue}
          accentClass="bg-sky-500 hover:bg-sky-600 text-white"
        />
      </div>

      <!-- 적용 버튼 -->
      <div class="px-4 py-3 shrink-0">
        <button
          onclick={applyInput}
          disabled={selectedItems.length === 0 || inputValue === ''}
          class="w-full h-12 rounded-xl font-bold text-sm transition-all duration-150
            {selectedItems.length > 0 && inputValue !== ''
              ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-md active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'}"
        >
          {#if selectedItems.length > 0 && inputValue !== ''}
            수량 적용
            <span class="text-xs font-normal opacity-80 ml-1">({STATUS_LABELS[selectedField]} → {inputValue})</span>
          {:else}
            수량 적용
          {/if}
        </button>
      </div>

      <!-- 하단 액션 버튼들 -->
      <div class="px-4 py-4 border-t border-slate-100 space-y-2 mt-auto shrink-0">
        <button
          onclick={bulkComplete}
          disabled={!store.selectedClientId}
          class="w-full h-11 rounded-xl font-bold text-sm transition-all duration-150
            {store.selectedClientId
              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 active:scale-[0.98]'
              : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'}"
        >
          ✅ 세탁완료 일괄 처리
        </button>
        <button
          onclick={() => navTo('/theme-b/shipout')}
          class="w-full h-11 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
          </svg>
          출고 신청 →
        </button>
        <button
          onclick={() => navTo('/theme-b/history')}
          class="w-full h-11 rounded-xl font-bold text-sm bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          출고 현황 →
        </button>
      </div>
    </div>
  </aside>

</div>