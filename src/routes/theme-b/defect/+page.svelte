<script lang="ts">
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import { goto } from '$app/navigation';
  import type { LaundryCategory } from '$lib/data/types';

  type CategoryKey = LaundryCategory;
  type ProcessMode = 'all' | 'partial';
  type ProcessType = 'discard' | 'return' | 'other';

  // ── 상태 ────────────────────────────────────────────────────────
  let activeCategory = $state<CategoryKey>('all');
  let selectedItemId = $state<string | null>(null);
  let processMode = $state<ProcessMode>('all');
  let processType = $state<ProcessType>('discard');
  let partialQty = $state('');
  let successMessage = $state('');
  let successTimer: ReturnType<typeof setTimeout> | null = null;

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

  const processTypeOptions: { key: ProcessType; label: string; icon: string; active: string; idle: string }[] = [
    { key: 'discard', label: '폐기', icon: '🗑️', active: 'bg-red-500 text-white border-red-500',     idle: 'bg-red-50 text-red-600 border-red-200' },
    { key: 'return',  label: '반환', icon: '↩️', active: 'bg-amber-500 text-white border-amber-500', idle: 'bg-amber-50 text-amber-600 border-amber-200' },
    { key: 'other',   label: '기타', icon: '📝', active: 'bg-slate-600 text-white border-slate-600', idle: 'bg-slate-100 text-slate-600 border-slate-200' },
  ];

  const navItems = [
    { path: '/',                icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: '홈' },
    { path: '/theme-b',         icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4', label: '세탁물' },
    { path: '/theme-b/shipout', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', label: '출고' },
    { path: '/theme-b/defect',  icon: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', label: '불량' },
    { path: '/theme-b/history', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: '현황' },
  ];
  const currentPath = '/theme-b/defect';

  // ── 파생값 ──────────────────────────────────────────────────────
  let filteredItems = $derived(
    store.selectedClientId
      ? store.getItemsByCategory(store.selectedClientId, activeCategory)
      : []
  );

  let totalDefect = $derived(
    store.selectedClientId ? store.getTotalDefect(store.selectedClientId) : 0
  );

  let selectedItem = $derived(
    selectedItemId !== null
      ? (filteredItems.find((item) => item.id === selectedItemId) ?? null)
      : null
  );

  let canProcess = $derived(
    selectedItem !== null &&
    processType !== null &&
    (processMode === 'all' ||
      (processMode === 'partial' && partialQty !== '' && parseInt(partialQty, 10) > 0))
  );

  // ── 조작 함수 ────────────────────────────────────────────────────
  function selectCategory(cat: CategoryKey) {
    activeCategory = cat;
    selectedItemId = null;
    partialQty = '';
  }

  function toggleItem(itemId: string, defectCount: number) {
    if (defectCount === 0) return;
    if (selectedItemId === itemId) {
      selectedItemId = null;
    } else {
      selectedItemId = itemId;
    }
  }

  function removeSelected() {
    selectedItemId = null;
  }

  function handleNumpadConfirm(val: string) {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) {
      partialQty = String(n);
    }
  }

  function showSuccess(msg: string) {
    successMessage = msg;
    if (successTimer) clearTimeout(successTimer);
    successTimer = setTimeout(() => { successMessage = ''; }, 2500);
  }

  function processDefects() {
    if (!store.selectedClientId || selectedItem === null) return;
    const clientId = store.selectedClientId;
    const item = selectedItem;

    if (processMode === 'all') {
      store.processDefectAll(clientId, item.id);
    } else {
      const qty = parseInt(partialQty, 10);
      if (!isNaN(qty) && qty > 0) {
        store.processDefect(clientId, item.id, Math.min(qty, item.counts.defect));
      }
    }

    const typeLabel = processTypeOptions.find((t) => t.key === processType)?.label ?? '처리';
    const modeLabel = processMode === 'all' ? '전체' : `${partialQty}개`;
    showSuccess(`${item.name} 불량 ${modeLabel} ${typeLabel} 완료`);

    selectedItemId = null;
    partialQty = '';
  }

  function navTo(path: string) { void goto(path); }
</script>

<svelte:head><title>불량 처리</title></svelte:head>

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
        aria-label={nav.label}
        onclick={() => navTo(nav.path)}
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
        {@const defCnt = store.getTotalDefect(client.id)}
        <button
          class="w-full flex items-center gap-2 px-3 py-4 transition-all duration-150 border-b border-slate-50
            {isSel ? 'bg-sky-50 border-l-4 border-l-sky-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}"
          style="min-height:68px"
          onclick={() => { store.selectClient(client.id); selectedItemId = null; }}
        >
          <span class="text-2xl shrink-0">{clientTypeIcon[client.type] ?? '🏢'}</span>
          <div class="flex-1 min-w-0 text-left">
            <p class="text-base font-bold truncate {isSel ? 'text-sky-700' : 'text-slate-800'}">{client.name}</p>
            <div class="flex items-center gap-1 mt-0.5">
              <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold {clientTypeBadge[client.type] ?? 'bg-slate-100 text-slate-600'}">
                {clientTypeLabel[client.type] ?? client.type}
              </span>
              {#if defCnt > 0}
                <span class="text-xs px-1.5 py-0.5 rounded-full font-bold bg-red-100 text-red-600">
                  불량 {defCnt}
                </span>
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>
  </aside>

  <!-- ── 불량 품목 리스트 ── -->
  <div class="flex-1 flex flex-col overflow-hidden">

    <!-- 헤더 -->
    <div class="bg-white border-b border-sky-100 px-5 py-3 shrink-0 shadow-sm flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-extrabold text-slate-800">불량 처리</h1>
        {#if store.selectedClient}
          <span class="px-2.5 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-bold">
            {store.selectedClient.name}
          </span>
        {:else}
          <span class="text-sm text-slate-400">거래처를 선택하세요</span>
        {/if}
      </div>
      {#if store.selectedClientId && totalDefect > 0}
        <span class="px-3 py-1.5 bg-red-500 text-white rounded-full text-sm font-extrabold">
          총 불량 {totalDefect}개
        </span>
      {:else if store.selectedClientId}
        <span class="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-full text-sm font-bold">
          불량 없음
        </span>
      {/if}
    </div>

    <!-- 카테고리 탭 -->
    <div class="bg-white border-b border-slate-200 px-4 flex gap-1 shrink-0">
      {#each categories as cat (cat.key)}
        <button
          class="px-4 py-3 text-sm font-bold transition-all duration-150
            {activeCategory === cat.key
              ? 'border-b-2 border-red-400 text-red-500'
              : 'text-slate-400 hover:text-slate-600'}"
          onclick={() => selectCategory(cat.key)}
        >
          {cat.label}
        </button>
      {/each}
    </div>

    <!-- 테이블 헤더 -->
    {#if store.selectedClientId && filteredItems.length > 0}
      <div class="bg-slate-100 border-b border-slate-200 px-4 shrink-0">
        <div class="flex items-center h-12">
          <div class="w-10 shrink-0"></div>
          <div class="flex-1 min-w-0 pl-2">
            <span class="text-sm font-bold text-slate-500 uppercase tracking-wide">품목명</span>
          </div>
          <div class="w-32 text-center shrink-0">
            <span class="text-sm font-bold text-slate-500">세탁완료</span>
          </div>
          <div class="w-32 text-center shrink-0">
            <span class="text-sm font-bold text-red-400">불량</span>
          </div>
          <div class="w-32 text-center shrink-0">
            <span class="text-sm font-bold text-slate-500">재고</span>
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
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
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
          {@const isSel = selectedItemId === item.id}
          {@const hasDefect = item.counts.defect > 0}
          <div
            role="button"
            tabindex={hasDefect ? 0 : -1}
            class="flex items-center px-4 border-b border-slate-100 transition-all duration-150
              {!hasDefect ? 'opacity-40 cursor-default' : 'cursor-pointer'}
              {isSel ? 'bg-red-50 border-l-4 border-l-red-400' : hasDefect ? 'hover:bg-slate-50 border-l-4 border-l-transparent' : 'border-l-4 border-l-transparent'}"
            style="min-height:72px"
            onclick={() => toggleItem(item.id, item.counts.defect)}
            onkeydown={(e) => e.key === 'Enter' && toggleItem(item.id, item.counts.defect)}
          >
            <!-- 체크 원 -->
            <div class="w-10 shrink-0 flex items-center justify-center">
              <div class="w-6 h-6 rounded-full border-2 transition-all duration-150 flex items-center justify-center
                {isSel ? 'bg-red-500 border-red-500' : hasDefect ? 'border-slate-300' : 'border-slate-200'}">
                {#if isSel}
                  <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                {/if}
              </div>
            </div>

            <!-- 품목명 -->
            <div class="flex-1 min-w-0 pl-2">
              <span class="text-lg font-bold {isSel ? 'text-red-700' : 'text-slate-800'}">{item.name}</span>
              <p class="text-[10px] text-slate-400 mt-0.5">{CATEGORY_LABELS[item.category]}</p>
            </div>

            <!-- 세탁완료 -->
            <div class="w-32 flex justify-center shrink-0">
              <span class="text-xl font-extrabold text-emerald-600">{item.counts.completed}</span>
            </div>

            <!-- 불량 -->
            <div class="w-32 flex justify-center shrink-0">
              <span class="text-2xl font-extrabold {hasDefect ? 'text-red-600' : 'text-slate-300'}">{item.counts.defect}</span>
            </div>

            <!-- 재고 -->
            <div class="w-32 flex justify-center shrink-0">
              <span class="text-xl font-extrabold text-slate-500">{item.counts.stock}</span>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- ── 처리 패널 ── -->
  <aside class="w-96 bg-white border-l border-sky-100 flex flex-col shrink-0 overflow-hidden shadow-xl">

    <!-- 패널 헤더 -->
    <div class="px-5 py-5 bg-red-600 shrink-0">
      <h2 class="text-lg font-black text-white">불량 처리</h2>
      <p class="text-xs text-red-200 mt-0.5">
        {#if selectedItem !== null}
          {selectedItem.name} 선택됨
        {:else}
          불량 품목을 선택하세요
        {/if}
      </p>
    </div>

    <div class="flex-1 overflow-y-auto flex flex-col">

      <!-- 성공 메시지 -->
      {#if successMessage}
        <div class="mx-4 mt-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 shrink-0">
          <svg class="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
          <p class="text-sm font-bold text-emerald-700">{successMessage}</p>
        </div>
      {/if}

      <!-- 선택된 품목 -->
      <div class="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
        {#if selectedItem !== null}
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">선택 품목</p>
          <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-red-50 border border-red-100">
            <div class="flex-1 min-w-0">
              <p class="text-base font-bold text-slate-700 truncate">{selectedItem.name}</p>
              <p class="text-[10px] text-slate-400">{CATEGORY_LABELS[selectedItem.category]}</p>
            </div>
            <span class="text-2xl font-black text-red-600 mx-3">{selectedItem.counts.defect}</span>
            <button
              aria-label="{selectedItem.name} 선택 해제"
              class="w-7 h-7 rounded-full bg-slate-200 hover:bg-red-100 flex items-center justify-center transition-all duration-150"
              onclick={() => removeSelected()}
            >
              <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center py-6 text-slate-300 gap-2">
            <svg class="w-10 h-10 opacity-40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <p class="text-sm font-medium">불량 품목을 선택하세요</p>
          </div>
        {/if}
      </div>

      <!-- 처리 방식 선택 -->
      <div class="px-4 py-4 border-b border-slate-100 shrink-0">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">처리 방식</p>
        <div class="flex gap-3">
          <button
            class="flex-1 h-16 rounded-xl font-bold text-base transition-all duration-150 active:scale-95
              {processMode === 'all'
                ? 'bg-red-600 text-white shadow-md shadow-red-200'
                : 'bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100'}"
            onclick={() => { processMode = 'all'; partialQty = ''; }}
          >
            전체처리
          </button>
          <button
            class="flex-1 h-16 rounded-xl font-bold text-base transition-all duration-150 active:scale-95
              {processMode === 'partial'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-200'
                : 'bg-amber-50 text-amber-600 border-2 border-amber-200 hover:bg-amber-100'}"
            onclick={() => (processMode = 'partial')}
          >
            부분처리
          </button>
        </div>

        <!-- 부분 처리 키패드 -->
        {#if processMode === 'partial'}
          <div class="mt-3">
            <div class="flex items-center justify-between mb-2">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">처리 수량 입력</p>
              {#if partialQty}
                <span class="text-xs font-extrabold text-amber-600">{partialQty}개</span>
              {/if}
            </div>
            <div class="h-14 rounded-xl bg-slate-50 border-2 border-amber-300 flex items-center px-4 mb-3">
              <span class="text-3xl font-extrabold text-slate-800 flex-1 text-right tracking-widest">
                {partialQty === '' ? '0' : partialQty}
              </span>
              <span class="text-sm text-slate-400 ml-2">개</span>
            </div>
            <NumPad
              bind:value={partialQty}
              accentClass="bg-amber-500 hover:bg-amber-600 text-white"
              onconfirm={handleNumpadConfirm}
            />
          </div>
        {/if}
      </div>

      <!-- 처리 유형 선택 -->
      <div class="px-4 py-4 border-b border-slate-100 shrink-0">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">처리 유형</p>
        <div class="flex gap-2">
          {#each processTypeOptions as opt (opt.key)}
            <button
              class="flex-1 h-14 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-1
                transition-all duration-150 active:scale-95
                {processType === opt.key ? opt.active : opt.idle}"
              onclick={() => (processType = opt.key)}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="mt-auto shrink-0"></div>
    </div>

    <!-- 버튼 영역 -->
    <div class="px-4 py-4 border-t border-slate-100 space-y-2 shrink-0">
      <button
        class="w-full h-16 rounded-xl font-bold text-base transition-all duration-150 active:scale-[0.98]
          {canProcess
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-200'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'}"
        disabled={!canProcess}
        onclick={processDefects}
      >
        {#if selectedItem !== null}
          처리 완료 ({selectedItem.name})
        {:else}
          처리 완료
        {/if}
      </button>
      <button
        class="w-full rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100
          transition-all duration-150 border border-slate-200 py-4"
        onclick={() => navTo('/theme-b')}
      >
        취소
      </button>
    </div>
  </aside>

</div>