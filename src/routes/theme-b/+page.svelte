<script lang="ts">
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import { goto } from '$app/navigation';
  import type { LaundryCategory, LaundryItem, CompletedLogEntry } from '$lib/data/types';

  // ── 타입 ─────────────────────────────────────────────────────────
  type CategoryKey = LaundryCategory;
  type EditMode = 'add' | 'set';

  // ── 상태 ─────────────────────────────────────────────────────────
  let activeCategory = $state<CategoryKey>('all');
  let selectedItemId = $state<string | null>(null);
  let editMode = $state<EditMode>('add');
  let inputValue = $state('');

  // 품목 추가 모달
  let showAddModal = $state(false);
  let modalCategory = $state<'towel' | 'sheet' | 'uniform'>('towel');
  let modalItemName = $state('');
  let modalScope = $state<'this' | 'all'>('this');

  // 기록 드로어
  let showLogDrawer = $state(false);
  let logTargetItem = $state<LaundryItem | null>(null);

  // ── 상수 ─────────────────────────────────────────────────────────
  const categories: { key: CategoryKey; label: string; icon: string }[] = [
    { key: 'all',     label: '전체',   icon: '📋' },
    { key: 'towel',   label: '타올',   icon: '🛁' },
    { key: 'sheet',   label: '시트',   icon: '🛏' },
    { key: 'uniform', label: '유니폼', icon: '👔' },
  ];

  const navItems = [
    {
      path: '/',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      label: '홈',
    },
    {
      path: '/theme-b',
      icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
      label: '세탁물',
    },
    {
      path: '/theme-b/shipout',
      icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
      label: '출고',
    },
    {
      path: '/theme-b/history',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      label: '현황',
    },
  ];

  const currentPath = '/theme-b';

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

  // ── 파생값 ───────────────────────────────────────────────────────
  let filteredItems = $derived(
    store.selectedClientId
      ? store.getItemsByCategory(store.selectedClientId, activeCategory)
      : []
  );

  let selectedItem = $derived(
    selectedItemId
      ? (store.laundryItems.find((i) => i.id === selectedItemId) ?? null)
      : null
  );

  let currentCompleted = $derived(selectedItem?.counts.completed ?? 0);

  let inputNum = $derived(inputValue !== '' ? parseInt(inputValue, 10) : null);

  let previewResult = $derived(() => {
    if (inputNum === null || isNaN(inputNum)) return null;
    if (editMode === 'add') return currentCompleted + inputNum;
    return inputNum;
  });

  // 기록 드로어: 오늘 날짜 필터
  let todayStr = $derived(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  let logEntries = $derived((): CompletedLogEntry[] => {
    if (!logTargetItem) return [];
    return store
      .getCompletedLogsByClient(logTargetItem.clientId)
      .filter((e) => e.laundryItemId === logTargetItem!.id && e.date === todayStr());
  });

  // ── 조작 함수 ────────────────────────────────────────────────────
  function selectCategory(cat: CategoryKey) {
    activeCategory = cat;
    selectedItemId = null;
    inputValue = '';
  }

  function toggleItem(itemId: string) {
    if (selectedItemId === itemId) {
      selectedItemId = null;
      inputValue = '';
    } else {
      selectedItemId = itemId;
      inputValue = '';
    }
  }

  function setEditMode(mode: EditMode) {
    editMode = mode;
    inputValue = '';
  }

  function applyInput() {
    const num = inputNum;
    if (num === null || isNaN(num) || num < 0) return;
    if (!store.selectedClientId || !selectedItem) return;
    if (editMode === 'add') {
      store.addCompleted(store.selectedClientId, selectedItem.id, num);
    } else {
      store.setCompleted(store.selectedClientId, selectedItem.id, num);
    }
    inputValue = '';
  }

  function openLogDrawer(item: LaundryItem) {
    logTargetItem = item;
    showLogDrawer = true;
  }

  function closeLogDrawer() {
    showLogDrawer = false;
    logTargetItem = null;
  }

  function openAddModal() {
    modalCategory = 'towel';
    modalItemName = '';
    modalScope = 'this';
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  function submitAddItem() {
    const name = modalItemName.trim();
    if (!name) return;
    if (modalScope === 'this') {
      if (!store.selectedClientId) return;
      store.addLaundryItemType(store.selectedClientId, modalCategory, name);
    } else {
      store.addLaundryItemTypeToAll(modalCategory, name);
    }
    closeAddModal();
  }

  function navTo(path: string) { void goto(path); }

  function formatTime(isoStr: string): string {
    const d = new Date(isoStr);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
</script>

<svelte:head>
  <title>세탁물 관리</title>
</svelte:head>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- 메인 레이아웃                                                   -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="flex h-screen bg-slate-50 overflow-hidden select-none">

  <!-- ① 아이콘 사이드바 -->
  <nav class="w-16 bg-sky-700 flex flex-col items-center py-3 gap-0.5 shrink-0 shadow-lg z-10">
    <!-- 로고 -->
    <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3 shrink-0">
      <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"/>
      </svg>
    </div>

    {#each navItems as nav (nav.path)}
      {@const isActive = nav.path === currentPath}
      <button
        type="button"
        class="w-12 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150
          {isActive
            ? 'bg-white/25 text-white shadow-inner'
            : 'text-sky-200 hover:bg-white/10 hover:text-white'}"
        onclick={() => navTo(nav.path)}
        aria-label={nav.label}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={nav.icon}/>
        </svg>
        <span class="text-[9px] font-bold">{nav.label}</span>
      </button>
    {/each}
  </nav>

  <!-- ② 거래처 목록 패널 -->
  <aside class="w-60 bg-white border-r border-sky-100 flex flex-col shrink-0 overflow-hidden">
    <div class="px-3 py-3 border-b border-sky-100 shrink-0">
      <h2 class="text-base font-extrabold text-slate-700 tracking-wide">거래처</h2>
      <p class="text-[10px] text-slate-400 mt-0.5">{store.clients.length}개 등록됨</p>
    </div>

    <div class="flex-1 overflow-y-auto">
      {#each store.clients as client (client.id)}
        {@const isSel = store.selectedClientId === client.id}
        {@const completedCnt = store.getTotalCompleted(client.id)}
        <button
          type="button"
          class="w-full flex items-center gap-2.5 px-3 py-3 border-b border-slate-50 transition-all duration-150 text-left
            {isSel
              ? 'bg-sky-50 border-l-4 border-l-sky-500'
              : 'hover:bg-slate-50 border-l-4 border-l-transparent'}"
          onclick={() => { store.selectClient(client.id); selectedItemId = null; inputValue = ''; }}
        >
          <span class="text-2xl shrink-0">{clientTypeIcon[client.type] ?? '🏢'}</span>
          <div class="flex-1 min-w-0">
            <p class="text-base font-bold truncate {isSel ? 'text-sky-700' : 'text-slate-800'}">
              {client.name}
            </p>
            <div class="flex items-center gap-1 mt-0.5">
              <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap {clientTypeBadge[client.type] ?? 'bg-slate-100 text-slate-600'}">
                {clientTypeLabel[client.type] ?? '기타'}
              </span>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-base font-extrabold {isSel ? 'text-sky-600' : 'text-slate-500'}">
              {completedCnt}
            </p>
            <p class="text-[9px] text-slate-400">완료</p>
          </div>
        </button>
      {/each}
    </div>
  </aside>

  <!-- ③ 카테고리 탭 패널 -->
  <div class="w-24 bg-sky-50 border-r border-sky-100 flex flex-col shrink-0 py-3 gap-1.5 px-2">
    <p class="text-[10px] font-bold text-sky-400 uppercase tracking-widest text-center mb-1">카테고리</p>
    {#each categories as cat (cat.key)}
      {@const isActive = activeCategory === cat.key}
      <button
        type="button"
        class="w-full rounded-2xl py-3 flex flex-col items-center gap-1 transition-all duration-150
          {isActive
            ? 'bg-sky-600 text-white shadow-md'
            : 'bg-white text-slate-600 hover:bg-sky-100 border border-sky-100'}"
        onclick={() => selectCategory(cat.key)}
      >
        <span class="text-3xl">{cat.icon}</span>
        <span class="text-sm font-bold">{cat.label}</span>
      </button>
    {/each}
  </div>

  <!-- ④ 품목 목록 (메인 영역) -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- 상단 헤더 -->
    <div class="bg-white border-b border-sky-100 px-5 py-3 shrink-0 flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-3">
        {#if store.selectedClient}
          <h1 class="text-xl font-extrabold text-slate-800">{store.selectedClient.name}</h1>
          <span class="px-2.5 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-bold">
            {CATEGORY_LABELS[activeCategory]}
          </span>
          <span class="text-sm text-slate-400">
            {filteredItems.length}개 품목
          </span>
        {:else}
          <h1 class="text-xl font-extrabold text-slate-400">거래처를 선택하세요</h1>
        {/if}
      </div>
      {#if selectedItemId && selectedItem}
        <span class="px-3 py-1.5 bg-sky-100 text-sky-700 rounded-full text-sm font-bold">
          선택됨: {selectedItem.name}
        </span>
      {/if}
    </div>

    <!-- 컬럼 헤더 -->
    {#if store.selectedClientId && filteredItems.length > 0}
      <div class="bg-slate-100 border-b border-slate-200 px-4 shrink-0">
        <div class="flex items-center h-11">
          <div class="w-10 shrink-0"></div>
          <div class="flex-1 min-w-0 pl-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wide">품목명</span>
          </div>
          <div class="w-8 shrink-0"></div><!-- 기록보기 버튼 자리 -->
          <div class="w-32 text-center shrink-0">
            <span class="text-xs font-bold text-slate-500">세탁완료</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- 품목 리스트 -->
    <div class="flex-1 overflow-y-auto">
      {#if !store.selectedClientId}
        <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
          <div class="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
            <svg class="w-10 h-10 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"/>
            </svg>
          </div>
          <p class="text-lg font-semibold">거래처를 선택하세요</p>
        </div>

      {:else if filteredItems.length === 0}
        <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
          <p class="text-base font-medium">해당 카테고리의 품목이 없습니다.</p>
          <button
            type="button"
            class="px-4 py-2 bg-sky-100 text-sky-700 rounded-xl font-bold text-sm hover:bg-sky-200 transition-colors flex items-center gap-1.5"
            onclick={openAddModal}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            품목 추가
          </button>
        </div>

      {:else}
        {#each filteredItems as item (item.id)}
          {@const isSel = selectedItemId === item.id}
          <div
            class="w-full flex items-center gap-0 border-b border-slate-100 transition-all duration-150
              {isSel
                ? 'bg-sky-50 border-l-4 border-l-sky-500'
                : 'hover:bg-slate-50 border-l-4 border-l-transparent'}"
          >
            <!-- 선택 가능한 메인 영역 (클릭 시 선택) -->
            <button
              type="button"
              class="flex items-center flex-1 min-w-0 px-4 py-3.5 text-left"
              onclick={() => toggleItem(item.id)}
            >
              <!-- 선택 인디케이터 -->
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

              <!-- 품목명 + 카테고리 배지 -->
              <div class="flex-1 min-w-0 pl-2 flex items-center gap-2">
                <span class="text-lg font-bold {isSel ? 'text-sky-700' : 'text-slate-800'} truncate">
                  {item.name}
                </span>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0
                  {item.category === 'towel'   ? 'bg-blue-100 text-blue-700'
                  : item.category === 'sheet'  ? 'bg-violet-100 text-violet-700'
                                                : 'bg-amber-100 text-amber-700'}">
                  {CATEGORY_LABELS[item.category]}
                </span>
              </div>
            </button>

            <!-- 기록보기 버튼 (별도 영역) -->
            <div class="w-10 shrink-0 flex items-center justify-center">
              <button
                type="button"
                class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors
                  {isSel ? 'bg-sky-100 text-sky-600 hover:bg-sky-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}"
                title="기록보기"
                onclick={() => openLogDrawer(item)}
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </button>
            </div>

            <!-- 세탁완료 수치 -->
            <div class="w-32 flex justify-center shrink-0 py-3.5">
              <span class="px-3 py-1.5 rounded-xl text-xl font-extrabold min-w-12 text-center
                {item.counts.completed > 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-400'}">
                {item.counts.completed}
              </span>
            </div>


          </div>
        {/each}

        <!-- 품목 추가 버튼 -->
        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 py-4 text-sky-500 hover:bg-sky-50 transition-colors border-b border-slate-100"
          onclick={openAddModal}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          <span class="text-sm font-bold">품목 추가</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- ⑤ 오른쪽 패널 -->
  <aside class="w-80 bg-white border-l border-sky-100 flex flex-col shrink-0 overflow-hidden shadow-xl">
    <!-- 패널 헤더 -->
    <div class="px-5 py-4 border-b border-sky-100 bg-sky-700 shrink-0">
      <h2 class="text-lg font-extrabold text-white">수정 패널</h2>
      {#if selectedItem}
        <p class="text-xs text-sky-200 mt-0.5 truncate">
          {selectedItem.name}
          <span class="ml-1 opacity-75">({CATEGORY_LABELS[selectedItem.category]})</span>
        </p>
      {:else}
        <p class="text-xs text-sky-300 mt-0.5">품목을 선택하세요</p>
      {/if}
    </div>

    <div class="flex-1 overflow-y-auto flex flex-col">
      {#if selectedItem}

        <!-- 선택된 품목 표시 -->
        <div class="px-4 pt-3 pb-2 border-b border-slate-100 shrink-0">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">선택 품목</p>
          <div class="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <span class="text-sm font-bold text-slate-700 truncate block">{selectedItem.name}</span>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-[10px] text-slate-400">세탁완료</span>
                <span class="text-sm font-extrabold text-emerald-600">{selectedItem.counts.completed}</span>
              </div>
            </div>
            <button
              type="button"
              class="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0 ml-2"
              aria-label="선택 해제"
              onclick={() => { selectedItemId = null; inputValue = ''; }}
            >
              <svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 편집 모드 탭 -->
        <div class="px-4 py-3 border-b border-slate-100 shrink-0">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">수정 모드</p>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="py-2.5 rounded-xl font-bold text-sm border transition-all duration-150
                {editMode === 'add'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}"
              onclick={() => setEditMode('add')}
            >
              수량 추가
            </button>
            <button
              type="button"
              class="py-2.5 rounded-xl font-bold text-sm border transition-all duration-150
                {editMode === 'set'
                  ? 'bg-sky-500 text-white border-sky-500 shadow-md'
                  : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'}"
              onclick={() => setEditMode('set')}
            >
              수량 변경
            </button>
          </div>
        </div>

        <!-- 미리보기 -->
        <div class="px-4 pt-3 pb-1 shrink-0">
          <div class="h-16 rounded-xl bg-slate-50 border-2 {editMode === 'add' ? 'border-emerald-300' : 'border-sky-300'} flex items-center px-4">
            {#if inputNum !== null && !isNaN(inputNum)}
              {#if editMode === 'add'}
                <span class="text-xs font-bold text-emerald-500 mr-2 shrink-0">현재</span>
                <span class="text-lg font-extrabold text-slate-600">{currentCompleted}</span>
                <span class="text-sm text-slate-400 mx-2">+</span>
                <span class="text-lg font-extrabold text-emerald-600">{inputNum}</span>
                <span class="text-sm text-slate-400 mx-2">=</span>
                <span class="text-2xl font-extrabold text-emerald-700 ml-auto">{previewResult()}</span>
              {:else}
                <span class="text-xs font-bold text-sky-500 mr-2 shrink-0">현재</span>
                <span class="text-lg font-extrabold text-slate-600">{currentCompleted}</span>
                <span class="text-sm text-slate-400 mx-2">→</span>
                <span class="text-2xl font-extrabold text-sky-700 ml-auto">{inputNum}</span>
              {/if}
            {:else}
              <span class="text-[11px] font-bold text-slate-400 mr-2">입력</span>
              <span class="text-4xl font-extrabold text-slate-300 flex-1 text-right tracking-widest">
                {inputValue !== '' ? inputValue : '0'}
              </span>
              <span class="text-sm text-slate-300 ml-2">개</span>
            {/if}
          </div>
        </div>

        <!-- NumPad -->
        <div class="px-4 py-3 shrink-0">
          <NumPad
            bind:value={inputValue}
            accentClass="{editMode === 'add' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-sky-500 hover:bg-sky-600'} text-white"
          />
        </div>

        <!-- 적용 버튼 -->
        <div class="px-4 pb-3 shrink-0">
          <button
            type="button"
            class="w-full py-4 rounded-2xl font-extrabold text-base transition-all duration-150 shadow-md
              {editMode === 'add'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95'
                : 'bg-sky-500 hover:bg-sky-600 text-white active:scale-95'}
              {inputValue === '' ? 'opacity-50 cursor-not-allowed' : ''}"
            onclick={applyInput}
            disabled={inputValue === ''}
          >
            {editMode === 'add' ? '추가 적용' : '변경 적용'}
            {#if inputValue !== '' && inputNum !== null && !isNaN(inputNum)}
              <span class="text-xs font-normal opacity-80 ml-1">
                ({editMode === 'add' ? `+${inputNum} → ${previewResult()}` : `→ ${inputNum}`})
              </span>
            {/if}
          </button>
        </div>

      {:else}
        <!-- 선택 안 됨 빈 상태 -->
        <div class="flex flex-col items-center justify-center flex-1 text-slate-300 gap-3 px-6">
          <svg class="w-16 h-16 opacity-30" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/>
          </svg>
          <p class="text-sm font-semibold text-center">품목 목록에서<br/>항목을 선택하세요</p>
        </div>
      {/if}

      <!-- 하단 이동 버튼 -->
      <div class="px-4 py-3 border-t border-slate-100 space-y-2 mt-auto shrink-0">
        <button
          type="button"
          class="w-full py-3 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center justify-center gap-2"
          onclick={() => navTo('/theme-b/shipout')}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
          </svg>
          출고 페이지로
        </button>
        <button
          type="button"
          class="w-full py-3 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center justify-center gap-2"
          onclick={() => navTo('/theme-b/history')}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          현황 페이지로
        </button>
      </div>
    </div>
  </aside>
</div>


<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- 품목 추가 모달                                                  -->
<!-- ═══════════════════════════════════════════════════════════════ -->
{#if showAddModal}
  <!-- 오버레이 -->
  <div
    class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
    role="button"
    tabindex="-1"
    onclick={closeAddModal}
    onkeydown={(e) => e.key === 'Escape' && closeAddModal()}
    aria-label="모달 닫기"
  >
    <!-- 모달 패널 -->
    <div
      class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative z-50"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="품목 추가"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <!-- 헤더 -->
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-xl font-extrabold text-slate-800">품목 추가</h3>
        <button
          type="button"
          class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          aria-label="모달 닫기"
          onclick={closeAddModal}
        >
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- 카테고리 선택 -->
      <div class="mb-4">
        <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">카테고리</p>
        <div class="grid grid-cols-3 gap-2">
          {#each ([['towel', '🛁', '타올'], ['sheet', '🛏', '시트'], ['uniform', '👔', '유니폼']] as const) as [cat, icon, label] (cat)}
            <button
              type="button"
              class="py-3 rounded-xl font-bold text-sm border flex flex-col items-center gap-1 transition-all duration-150
                {modalCategory === cat
                  ? 'bg-sky-500 text-white border-sky-500 shadow-md'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-sky-50 hover:border-sky-300'}"
              onclick={() => { modalCategory = cat; }}
            >
              <span class="text-2xl">{icon}</span>
              <span>{label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- 품목명 입력 -->
      <div class="mb-4">
        <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">품목명</p>
        <input
          type="text"
          class="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-sky-400 focus:outline-none text-base font-bold text-slate-800 placeholder-slate-300 transition-colors"
          placeholder="품목명을 입력하세요"
          bind:value={modalItemName}
          onkeydown={(e) => e.key === 'Enter' && submitAddItem()}
        />
      </div>

      <!-- 적용 범위 -->
      <div class="mb-6">
        <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">적용 범위</p>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="py-3 rounded-xl font-bold text-sm border transition-all duration-150
              {modalScope === 'this'
                ? 'bg-sky-500 text-white border-sky-500 shadow-md'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-sky-50 hover:border-sky-300'}"
            onclick={() => { modalScope = 'this'; }}
          >
            🏢 이 거래처만
          </button>
          <button
            type="button"
            class="py-3 rounded-xl font-bold text-sm border transition-all duration-150
              {modalScope === 'all'
                ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'}"
            onclick={() => { modalScope = 'all'; }}
          >
            🌐 전체 거래처
          </button>
        </div>
        {#if modalScope === 'all'}
          <p class="text-[10px] text-amber-600 mt-1.5 font-bold">⚠ 모든 거래처에 해당 품목이 추가됩니다.</p>
        {/if}
      </div>

      <!-- 추가 버튼 -->
      <button
        type="button"
        class="w-full py-4 rounded-2xl font-extrabold text-base transition-all duration-150 active:scale-95
          {modalItemName.trim()
            ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-md'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'}"
        onclick={submitAddItem}
        disabled={!modalItemName.trim()}
      >
        추가하기
      </button>
    </div>
  </div>
{/if}


<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- 기록 드로어 (우측 슬라이드인)                                   -->
<!-- ═══════════════════════════════════════════════════════════════ -->
{#if showLogDrawer}
  <!-- 오버레이 -->
  <div
    class="fixed inset-0 bg-black/40 z-40"
    role="button"
    tabindex="-1"
    onclick={closeLogDrawer}
    onkeydown={(e) => e.key === 'Escape' && closeLogDrawer()}
    aria-label="드로어 닫기"
  ></div>

  <!-- 드로어 패널 -->
  <div class="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
    <!-- 드로어 헤더 -->
    <div class="px-5 py-4 bg-sky-700 shrink-0 flex items-start justify-between">
      <div class="flex-1 min-w-0 mr-3">
        <h3 class="text-base font-extrabold text-white truncate">
          {logTargetItem?.name ?? ''} 세탁완료 수정 이력
        </h3>
        <p class="text-xs text-sky-200 mt-0.5">오늘 날짜 기준 · {todayStr()}</p>
      </div>
      <button
        type="button"
        class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center shrink-0 transition-colors"
        aria-label="드로어 닫기"
        onclick={closeLogDrawer}
      >
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- 안내 텍스트 -->
    <div class="px-5 py-2.5 bg-amber-50 border-b border-amber-100 shrink-0">
      <p class="text-[10px] text-amber-700 font-bold">
        ℹ 출고 후 이력은 자동 삭제됩니다. 오늘의 수정 이력만 표시됩니다.
      </p>
    </div>

    <!-- 테이블 헤더 -->
    <div class="px-4 py-2.5 bg-slate-100 border-b border-slate-200 shrink-0">
      <div class="grid grid-cols-5 gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
        <div class="col-span-2">시각</div>
        <div class="text-center">유형</div>
        <div class="text-center">이전값</div>
        <div class="text-center">결과값</div>
      </div>
    </div>

    <!-- 기록 목록 -->
    <div class="flex-1 overflow-y-auto">
      {#if logEntries().length === 0}
        <div class="flex flex-col items-center justify-center h-full text-slate-300 gap-3">
          <svg class="w-14 h-14 opacity-40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-sm font-semibold">오늘의 이력이 없습니다.</p>
        </div>
      {:else}
        {#each logEntries() as entry (entry.id)}
          <div class="px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <div class="grid grid-cols-5 gap-1 items-center">
              <!-- 시각 -->
              <div class="col-span-2">
                <span class="text-xs font-bold text-slate-600">{formatTime(entry.createdAt)}</span>
              </div>
              <!-- 유형 -->
              <div class="text-center">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold
                  {entry.actionType === 'add'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-sky-100 text-sky-700'}">
                  {entry.actionType === 'add' ? '추가' : '변경'}
                </span>
              </div>
              <!-- 이전값 -->
              <div class="text-center">
                <span class="text-sm font-extrabold text-slate-500">{entry.before}</span>
              </div>
              <!-- 결과값 -->
              <div class="text-center">
                <span class="text-sm font-extrabold
                  {entry.actionType === 'add' ? 'text-emerald-600' : 'text-sky-600'}">
                  {entry.after}
                </span>
              </div>
            </div>
            <!-- 변경량 표시 -->
            {#if entry.actionType === 'add'}
              <p class="text-[10px] text-slate-400 mt-0.5 ml-0">
                {entry.before} + {entry.delta} = {entry.after}
              </p>
            {:else}
              <p class="text-[10px] text-slate-400 mt-0.5">
                {entry.before} → {entry.after}
                {#if entry.delta !== 0}
                  <span class="{entry.delta > 0 ? 'text-emerald-500' : 'text-red-500'}">
                    ({entry.delta > 0 ? '+' : ''}{entry.delta})
                  </span>
                {/if}
              </p>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <!-- 드로어 푸터 -->
    <div class="px-4 py-3 border-t border-slate-100 shrink-0">
      <button
        type="button"
        class="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors"
        onclick={closeLogDrawer}
      >
        닫기
      </button>
    </div>
  </div>
{/if}

<style>
  @keyframes slide-in {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  .animate-slide-in {
    animation: slide-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
</style>
