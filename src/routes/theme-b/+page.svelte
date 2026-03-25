<script lang="ts">
  import { store, CATEGORY_LABELS, DISPLAY_STATUS_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import { goto } from '$app/navigation';
  import type { LaundryCategory } from '$lib/data/types';

  type DisplayStatus = 'completed' | 'defect' | 'stock';
  type CategoryKey = LaundryCategory;

  let activeCategory = $state<CategoryKey>('all');
  let selectedItemId = $state<string | null>(null);
  let selectedField = $state<DisplayStatus>('completed');
  let inputValue = $state('');

  const categories: { key: CategoryKey; label: string; icon: string }[] = [
    { key: 'all',     label: '전체',   icon: '📋' },
    { key: 'towel',   label: '타올',   icon: '🛁' },
    { key: 'sheet',   label: '시트',   icon: '🛏' },
    { key: 'uniform', label: '유니폼', icon: '👔' },
  ];

  const displayStatuses: DisplayStatus[] = ['completed', 'defect', 'stock'];

  const statusBadge: Record<DisplayStatus, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    defect:    'bg-red-100 text-red-700',
    stock:     'bg-slate-100 text-slate-600',
  };

  const fieldButtons: { key: DisplayStatus; label: string; idle: string; active: string }[] = [
    { key: 'completed', label: '세탁완료', idle: 'bg-emerald-50 text-emerald-700 border-emerald-200', active: 'bg-emerald-500 text-white border-emerald-500' },
    { key: 'defect',    label: '불량',    idle: 'bg-red-50 text-red-700 border-red-200',             active: 'bg-red-500 text-white border-red-500' },
  ];

  const clientTypeIcon: Record<string, string> = {
    hotel: '🏨', pension: '🏡', resort: '🌴', etc: '🏢',
  };
  const clientTypeLabel: Record<string, string> = {
    hotel: '호텔', pension: '펜션', resort: '리조트', etc: '기타',
  };
  const clientTypeBadge: Record<string, string> = {
    hotel: 'bg-sky-100 text-sky-700',
    pension: 'bg-emerald-100 text-emerald-700',
    resort: 'bg-amber-100 text-amber-700',
    etc: 'bg-slate-100 text-slate-600',
  };

  // ── 파생값 ───────────────────────────────────────────────────────
  let filteredItems = $derived(
    store.selectedClientId
      ? store.getItemsByCategory(store.selectedClientId, activeCategory)
      : []
  );

  let selectedItem = $derived(
    selectedItemId ? (filteredItems.find((item) => item.id === selectedItemId) ?? null) : null
  );

  // 품목 완료 여부
  function isItemDone(item: { counts: { completed: number; stock: number; defect: number } }): boolean {
    return item.counts.completed > 0 && item.counts.stock === item.counts.completed && item.counts.defect === 0;
  }
  function isItemHasDefect(item: { counts: { defect: number } }): boolean {
    return item.counts.defect > 0;
  }

  // 거래처 요약
  function getClientCompleted(clientId: string): number {
    return store.getTotalCompleted(clientId);
  }
  function getClientDefect(clientId: string): number {
    return store.getTotalDefect(clientId);
  }

  // ── 조작 함수 ────────────────────────────────────────────────────
  function selectCategory(cat: CategoryKey) {
    activeCategory = cat;
    selectedItemId = null;
    inputValue = '';
  }

  function toggleItem(item: { id: string }) {
    if (selectedItemId === item.id) {
      selectedItemId = null;
    } else {
      selectedItemId = item.id;
    }
  }

  function applyInput() {
    const num = parseInt(inputValue, 10);
    if (isNaN(num) || num < 0 || !store.selectedClientId || !selectedItem) return;
    store.updateLaundryItem(store.selectedClientId, selectedItem.id, selectedField, num);
    inputValue = '';
    selectedItemId = null;
  }

  function navTo(path: string) { void goto(path); }
</script>

<svelte:head><title>세탁물 관리 — Side Panel</title></svelte:head>

<div class="flex h-screen bg-slate-50 overflow-hidden select-none">

  <!-- ① 아이콘 내비 w-16 -->
  <nav class="w-16 bg-sky-700 flex flex-col items-center py-3 gap-0.5 shrink-0 shadow-lg z-10">
    <!-- 로고 -->
    <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
      <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"/>
      </svg>
    </div>

    {#each [
      { path: '/',                  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: '홈',    active: false },
      { path: '/theme-b',           icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4', label: '세탁물', active: true },
      { path: '/theme-b/shipout',   icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', label: '출고',  active: false },
      { path: '/theme-b/defect',    icon: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', label: '불량',  active: false },
      { path: '/theme-b/history',   icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: '현황',  active: false },
    ] as nav}
      <button
        onclick={() => navTo(nav.path)}
        class="w-14 h-14 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-150
          {nav.active ? 'bg-sky-500 text-white shadow-md' : 'text-sky-200 hover:bg-white/10 hover:text-white'}"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={nav.icon}/>
        </svg>
        <span class="text-[9px] font-bold">{nav.label}</span>
      </button>
    {/each}
  </nav>

  <!-- ② 거래처 패널 w-60 -->
  <aside class="w-60 bg-white border-r border-sky-100 flex flex-col shrink-0 overflow-hidden">
    <div class="px-3 py-3 border-b border-sky-100 shrink-0">
      <h2 class="text-base font-extrabold text-slate-700 tracking-wide">거래처</h2>
      <p class="text-[10px] text-slate-400 mt-0.5">총 {store.clients.length}개</p>
    </div>
    <div class="flex-1 overflow-y-auto">
      {#each store.clients as client (client.id)}
        {@const isSel = store.selectedClientId === client.id}
        {@const defCnt = getClientDefect(client.id)}
        <button
          onclick={() => { store.selectClient(client.id); selectedItemId = null; inputValue = ''; }}
          class="w-full px-3 py-4 min-h-[68px] text-left flex items-center gap-2.5 border-b border-slate-50 transition-all duration-150
            {isSel ? 'bg-sky-50 border-l-4 border-l-sky-500' : 'border-l-4 border-l-transparent hover:bg-slate-50'}"
        >
          <span class="text-2xl shrink-0">{clientTypeIcon[client.type] ?? '🏢'}</span>
          <div class="flex-1 min-w-0">
            <p class="text-base font-bold truncate {isSel ? 'text-sky-700' : 'text-slate-800'}">{client.name}</p>
            <div class="flex items-center gap-1 mt-1">
              <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold {clientTypeBadge[client.type] ?? 'bg-slate-100 text-slate-600'}">
                {clientTypeLabel[client.type] ?? client.type}
              </span>
              {#if defCnt > 0}
                <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-red-100 text-red-600">불량 {defCnt}</span>
              {/if}
            </div>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-base font-extrabold {isSel ? 'text-sky-600' : 'text-slate-500'}">{getClientCompleted(client.id)}</p>
            <p class="text-[9px] text-slate-400">완료</p>
          </div>
        </button>
      {/each}
    </div>
  </aside>

  <!-- ③ 세로 카테고리 탭 w-24 -->
  <div class="w-24 bg-sky-50 border-r border-sky-100 flex flex-col shrink-0 py-3 gap-1.5 px-2">
    <p class="text-[10px] font-bold text-sky-400 uppercase tracking-widest text-center mb-1">구분</p>
    {#each categories as cat (cat.key)}
      <button
        onclick={() => selectCategory(cat.key)}
        class="h-[80px] rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-150 border
          {activeCategory === cat.key
            ? 'bg-sky-500 text-white border-sky-500 shadow-md'
            : 'bg-white text-sky-600 border-sky-100 hover:bg-sky-100'}"
      >
        <span class="text-3xl">{cat.icon}</span>
        <span class="text-sm font-bold">{cat.label}</span>
      </button>
    {/each}
  </div>

  <!-- ④ 세탁물 리스트 flex-1 -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- 헤더 -->
    <div class="bg-white border-b border-sky-100 px-5 py-3 shrink-0 flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-3">
        {#if store.selectedClient}
          <h1 class="text-xl font-extrabold text-slate-800">{store.selectedClient.name}</h1>
          <span class="px-2.5 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-bold">
            {CATEGORY_LABELS[activeCategory]}
          </span>
          <span class="text-sm text-slate-400">{filteredItems.length}개 품목</span>
        {:else}
          <h1 class="text-xl font-extrabold text-slate-400">거래처를 선택하세요</h1>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        {#if selectedItemId}
          <span class="px-3 py-1.5 bg-sky-100 text-sky-700 rounded-full text-sm font-bold">
            1개 선택됨
          </span>
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
          {#each displayStatuses as status}
            <div class="w-32 text-center shrink-0">
              <span class="text-sm font-bold text-slate-500">{DISPLAY_STATUS_LABELS[status]}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- 리스트 바디 -->
    <div class="flex-1 overflow-y-auto">
      {#if !store.selectedClientId}
        <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
          <div class="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
            <svg class="w-10 h-10 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"/>
            </svg>
          </div>
          <p class="text-lg font-semibold">왼쪽에서 거래처를 선택하세요</p>
        </div>
      {:else if filteredItems.length === 0}
        <div class="flex items-center justify-center h-full text-slate-400">
          <p class="text-base font-medium">해당 카테고리의 품목이 없습니다</p>
        </div>
      {:else}
        {#each filteredItems as item (item.id)}
          {@const isSel = selectedItemId === item.id}
          {@const done = isItemDone(item)}
          {@const hasDefect = isItemHasDefect(item)}
          <button
            onclick={() => toggleItem(item)}
            class="w-full flex items-center px-4 border-b transition-all duration-100 cursor-pointer
              {isSel
                ? 'bg-sky-50 border-l-4 border-l-sky-500 border-b-sky-100'
                : done
                  ? 'bg-emerald-50 border-l-4 border-l-emerald-400 border-b-emerald-100 hover:bg-emerald-100'
                  : hasDefect
                    ? 'bg-red-50 border-l-4 border-l-red-300 border-b-red-100 hover:bg-red-100'
                    : 'bg-white border-l-4 border-l-transparent border-b-slate-100 hover:bg-sky-50'}"
            style="min-height: 72px;"
          >
            <!-- 선택 체크 -->
            <div class="w-10 shrink-0 flex items-center justify-center">
              <div class="w-6 h-6 rounded-full border-2 transition-all duration-150 flex items-center justify-center
                {isSel ? 'bg-sky-500 border-sky-500 shadow-sm' : 'border-slate-300 bg-white'}">
                {#if isSel}
                  <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                {/if}
              </div>
            </div>

            <!-- 품목명 + 카테고리 뱃지 -->
            <div class="flex-1 min-w-0 pl-2 flex items-center gap-2.5">
              <span class="text-lg font-bold text-slate-800">{item.name}</span>
              <span class="text-xs px-2 py-0.5 rounded-full font-bold shrink-0
                {item.category === 'towel' ? 'bg-sky-100 text-sky-600'
                : item.category === 'sheet' ? 'bg-violet-100 text-violet-600'
                : 'bg-orange-100 text-orange-600'}">
                {CATEGORY_LABELS[item.category]}
              </span>
              {#if done}
                <span class="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700 shrink-0">✓ 완료</span>
              {/if}
            </div>

            <!-- 상태별 수치 -->
            {#each displayStatuses as status}
              <div class="w-32 flex justify-center shrink-0">
                <span class="px-3 py-1.5 rounded-xl text-xl font-extrabold min-w-[3rem] text-center
                  {isSel
                    ? status === 'completed' ? 'bg-emerald-500 text-white'
                    : status === 'defect' ? 'bg-red-500 text-white'
                    : 'bg-slate-600 text-white'
                  : statusBadge[status]}">
                  {item.counts[status]}
                </span>
              </div>
            {/each}
          </button>
        {/each}
      {/if}
    </div>
  </div>

  <!-- ⑤ 입력 패널 w-80 -->
  <aside class="w-80 bg-white border-l border-sky-100 flex flex-col shrink-0 overflow-hidden shadow-xl">
    <!-- 패널 헤더 -->
    <div class="px-5 py-4 border-b border-sky-100 bg-sky-700 shrink-0">
      <h2 class="text-lg font-extrabold text-white">수량 입력</h2>
      <p class="text-xs text-sky-200 mt-0.5">
        {#if selectedItem}
          {selectedItem.name}
        {:else}
          품목 행을 터치하여 선택
        {/if}
      </p>
    </div>

    <div class="flex-1 overflow-y-auto flex flex-col">
      <!-- 선택된 품목 표시 -->
      {#if selectedItem}
        <div class="px-4 pt-3 pb-2 border-b border-slate-100 shrink-0">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">선택된 품목</p>
          <div class="rounded-xl bg-sky-50 border border-sky-200 overflow-hidden">
            <div class="flex items-center justify-between px-3 py-2">
              <span class="text-sm font-bold text-slate-700 truncate flex-1">{selectedItem.name}</span>
              <button
                onclick={(e) => { e.stopPropagation(); selectedItemId = null; }}
                aria-label="선택 해제"
                class="w-5 h-5 rounded-full bg-sky-200 hover:bg-red-100 flex items-center justify-center ml-2 shrink-0"
              >
                <svg class="w-3 h-3 text-sky-600" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- 수정 상태 선택 -->
      <div class="px-4 py-3 border-b border-slate-100 shrink-0">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">수정할 항목</p>
        <div class="grid grid-cols-2 gap-2">
          {#each fieldButtons as btn}
            <button
              onclick={() => { selectedField = btn.key; inputValue = ''; }}
              class="h-14 rounded-xl text-sm font-bold border-2 transition-all duration-150
                {selectedField === btn.key ? btn.active : btn.idle + ' hover:opacity-80'}"
            >
              {btn.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- 입력값 표시 -->
      <div class="px-4 pt-3 pb-1 shrink-0">
        <div class="h-16 rounded-xl bg-slate-50 border-2 border-sky-300 flex items-center px-4">
          <span class="text-[11px] font-bold text-sky-500 mr-2">{DISPLAY_STATUS_LABELS[selectedField]}</span>
          <span class="text-4xl font-extrabold text-slate-800 flex-1 text-right tracking-widest">
            {inputValue || '0'}
          </span>
          <span class="text-sm text-slate-400 ml-2">개</span>
        </div>
      </div>

      <!-- 키패드 -->
      <div class="px-4 py-3 shrink-0">
        <NumPad bind:value={inputValue} accentClass="bg-sky-500 hover:bg-sky-600 text-white" />
      </div>

      <!-- 적용 버튼 -->
      <div class="px-4 pb-3 shrink-0">
        <button
          onclick={applyInput}
          disabled={!selectedItem || inputValue === ''}
          class="w-full h-16 rounded-xl font-bold text-base transition-all duration-150
            {selectedItem && inputValue !== ''
              ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-md active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'}"
        >
          수량 적용
          {#if selectedItem && inputValue !== ''}
            <span class="text-xs font-normal opacity-80 ml-1">({selectedItem.name} → {inputValue}개)</span>
          {/if}
        </button>
      </div>

      <!-- 하단 페이지 이동 버튼 -->
      <div class="px-4 py-3 border-t border-slate-100 space-y-2 mt-auto shrink-0">
        <button
          onclick={() => navTo('/theme-b/shipout')}
          class="w-full py-4 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
          </svg>
          출고 신청 →
        </button>
        <button
          onclick={() => navTo('/theme-b/defect')}
          class="w-full py-4 rounded-xl font-bold text-sm bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          불량 처리 →
        </button>
        <button
          onclick={() => navTo('/theme-b/history')}
          class="w-full py-4 rounded-xl font-bold text-sm bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
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