<script lang="ts">
  import { store, CATEGORY_LABELS, STATUS_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import { goto } from '$app/navigation';
  import { SvelteSet } from 'svelte/reactivity';
  import type { LaundryCategory, LaundryItemStatus, LaundryItem } from '$lib/data/types';

  // ── 탭 상태 ──────────────────────────────────────────────────────
  let activeTab = $state<LaundryCategory>('all');

  // ── 카드 선택 상태 ────────────────────────────────────────────────
  let selectedItemIds = new SvelteSet<string>();

  // ── 오른쪽 패널 상태 ──────────────────────────────────────────────
  let selectedField = $state<LaundryItemStatus>('received');
  let inputValue = $state('');

  // ── 현재 거래처 + 탭에 해당하는 품목 목록 ─────────────────────────
  let filteredItems = $derived<LaundryItem[]>(
    store.selectedClientId
      ? store.getItemsByCategory(store.selectedClientId, activeTab)
      : []
  );

  // ── 선택된 품목 객체 목록 ─────────────────────────────────────────
  let selectedItems = $derived<LaundryItem[]>(
    filteredItems.filter((item) => selectedItemIds.has(item.id))
  );

  // ── 탭 변경 시 선택 초기화 ────────────────────────────────────────
  $effect(() => {
    void activeTab;
    selectedItemIds.clear();
  });

  // ── 거래처 변경 시 선택 초기화 ────────────────────────────────────
  $effect(() => {
    void store.selectedClientId;
    selectedItemIds.clear();
    inputValue = '';
  });

  // ── 카드 토글 ────────────────────────────────────────────────────
  function toggleItem(id: string) {
    if (selectedItemIds.has(id)) {
      selectedItemIds.delete(id);
    } else {
      selectedItemIds.add(id);
    }
  }

  // ── 입력 적용 ────────────────────────────────────────────────────
  function applyInput() {
    const num = parseInt(inputValue, 10);
    if (isNaN(num) || num < 0) return;
    if (!store.selectedClientId) return;
    for (const item of selectedItems) {
      store.updateLaundryItem(store.selectedClientId, item.id, selectedField, num);
    }
    inputValue = '';
  }

  // ── 세탁완료 일괄 처리 (washing → completed) ──────────────────────
  function bulkComplete() {
    if (!store.selectedClientId) return;
    for (const item of selectedItems) {
      const washing = item.counts.washing;
      if (washing <= 0) continue;
      store.updateLaundryItem(store.selectedClientId, item.id, 'completed', item.counts.completed + washing);
      store.updateLaundryItem(store.selectedClientId, item.id, 'washing', 0);
    }
  }

  // ── 필드 버튼 목록 ────────────────────────────────────────────────
  const fieldButtons: { key: LaundryItemStatus; label: string; color: string }[] = [
    { key: 'received',  label: '입고',     color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { key: 'washing',   label: '세탁중',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
    { key: 'completed', label: '세탁완료', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { key: 'defect',    label: '불량',     color: 'bg-red-100 text-red-700 border-red-200' },
    { key: 'stock',     label: '재고',     color: 'bg-purple-100 text-purple-700 border-purple-200' },
  ];

  const selectedFieldColor: Record<LaundryItemStatus, string> = {
    received:  'bg-blue-500 text-white border-blue-500',
    washing:   'bg-amber-500 text-white border-amber-500',
    completed: 'bg-emerald-500 text-white border-emerald-500',
    defect:    'bg-red-500 text-white border-red-500',
    stock:     'bg-purple-500 text-white border-purple-500',
    shipped:   'bg-slate-500 text-white border-slate-500',
  };

  // ── 카테고리 탭 배열 ──────────────────────────────────────────────
  const tabs: LaundryCategory[] = ['all', 'towel', 'sheet', 'uniform'];

  // ── 상태별 뱃지 색상 ──────────────────────────────────────────────
  const statusColors: Partial<Record<LaundryItemStatus, string>> = {
    received:  'bg-blue-50 text-blue-600',
    washing:   'bg-amber-50 text-amber-600',
    completed: 'bg-emerald-50 text-emerald-600',
    defect:    'bg-red-50 text-red-600',
    stock:     'bg-purple-50 text-purple-600',
  };

  const displayStatuses: LaundryItemStatus[] = ['received', 'washing', 'completed', 'defect', 'stock'];
</script>

<div class="flex h-screen bg-emerald-50 overflow-hidden">

  <!-- ══════════════════════════════════════════════════════════
       왼쪽 사이드바: 거래처 목록
  ══════════════════════════════════════════════════════════ -->
  <aside class="w-64 flex flex-col bg-white border-r border-emerald-100 shadow-sm shrink-0">

    <!-- 사이드바 헤더 -->
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

    <!-- 거래처 목록 (스크롤 가능) -->
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

    <!-- 홈으로 돌아가기 -->
    <div class="p-3 border-t border-emerald-100">
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

  <!-- ══════════════════════════════════════════════════════════
       중앙 메인 콘텐츠
  ══════════════════════════════════════════════════════════ -->
  <main class="flex-1 flex flex-col overflow-hidden">

    <!-- 상단: 거래처명 + 탭바 -->
    <header class="bg-white border-b border-emerald-100 px-6 pt-5 pb-0 shadow-sm shrink-0">

      <!-- 거래처명 -->
      <div class="flex items-center justify-between mb-4">
        <div>
          {#if store.selectedClient}
            <h1 class="text-2xl font-extrabold text-slate-800">{store.selectedClient.name}</h1>
            <p class="text-sm text-slate-400 mt-0.5">{store.selectedClient.address}</p>
          {:else}
            <h1 class="text-2xl font-extrabold text-slate-400">거래처를 선택하세요</h1>
          {/if}
        </div>
        {#if selectedItemIds.size > 0}
          <span class="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold">
            {selectedItemIds.size}개 선택됨
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
            onclick={() => { activeTab = tab; }}
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

    <!-- 카드 그리드 (스크롤 가능) -->
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
            {@const isSelected = selectedItemIds.has(item.id)}
            <button
              type="button"
              class="text-left bg-white rounded-2xl p-4 transition-all duration-150 border-2 shadow-sm
                {isSelected
                  ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300 ring-offset-1 shadow-md'
                  : 'border-slate-100 hover:border-emerald-200 hover:shadow-md'}"
              onclick={() => toggleItem(item.id)}
            >
              <!-- 품목명 + 카테고리 뱃지 -->
              <div class="flex items-start justify-between mb-3">
                <div>
                  <p class="text-lg font-bold text-slate-800">{item.name}</p>
                  <span class="inline-block text-xs px-2 py-0.5 rounded-full mt-1
                    {item.category === 'towel'
                      ? 'bg-sky-100 text-sky-600'
                      : item.category === 'sheet'
                        ? 'bg-violet-100 text-violet-600'
                        : 'bg-orange-100 text-orange-600'}">
                    {CATEGORY_LABELS[item.category]}
                  </span>
                </div>
                {#if isSelected}
                  <div class="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                {/if}
              </div>

              <!-- 상태별 수량 -->
              <div class="grid grid-cols-3 gap-1.5">
                {#each displayStatuses as status (status)}
                  <div class="rounded-lg px-2 py-1.5 text-center {statusColors[status] ?? 'bg-slate-50 text-slate-600'}">
                    <p class="text-xs font-medium opacity-75 leading-tight">{STATUS_LABELS[status]}</p>
                    <p class="text-xl font-extrabold leading-tight mt-0.5">{item.counts[status]}</p>
                  </div>
                {/each}
              </div>

              <!-- 마지막 업데이트 -->
              <p class="text-xs text-slate-300 mt-2.5 text-right">
                {new Date(item.updatedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </main>

  <!-- ══════════════════════════════════════════════════════════
       오른쪽 패널: 키패드 + 액션
  ══════════════════════════════════════════════════════════ -->
  <aside class="w-80 flex flex-col bg-white border-l border-emerald-100 shadow-sm shrink-0 overflow-y-auto">

    <div class="px-5 py-5 border-b border-emerald-100 shrink-0">
      <h2 class="text-base font-bold text-slate-700">입력 패널</h2>
    </div>

    <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">

      <!-- 선택된 품목 표시 -->
      <div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">선택된 품목</p>
        {#if selectedItems.length === 0}
          <div class="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-400 text-center">
            카드를 선택해 주세요
          </div>
        {:else}
          <div class="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 space-y-1 max-h-36 overflow-y-auto">
            {#each selectedItems as item (item.id)}
              <div class="flex items-center justify-between text-sm">
                <span class="font-bold text-slate-700">{item.name}</span>
                <span class="text-xs text-slate-400">{CATEGORY_LABELS[item.category]}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- 수정할 상태 선택 -->
      <div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">수정할 상태</p>
        <div class="grid grid-cols-2 gap-2">
          {#each fieldButtons as btn (btn.key)}
            <button
              type="button"
              class="h-11 rounded-xl text-sm font-bold border transition-all duration-150 active:scale-95
                {selectedField === btn.key ? selectedFieldColor[btn.key] : btn.color}"
              onclick={() => { selectedField = btn.key; }}
            >
              {btn.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- 현재 입력값 표시 -->
      <div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">입력값</p>
        <div class="h-14 rounded-xl bg-slate-50 border-2 border-emerald-200 flex items-center px-4">
          <span class="text-3xl font-extrabold text-slate-800 flex-1 text-right tracking-widest">
            {inputValue === '' ? '0' : inputValue}
          </span>
          <span class="text-sm text-slate-400 ml-2">개</span>
        </div>
      </div>

      <!-- 숫자 키패드 -->
      <div>
        <NumPad
          bind:value={inputValue}
          accentClass="bg-emerald-500 hover:bg-emerald-600 text-white"
          onconfirm={() => applyInput()}
        />
      </div>

      <!-- 입력 적용 버튼 -->
      <button
        type="button"
        class="w-full h-14 rounded-xl font-bold text-base transition-all duration-150 active:scale-95
          {selectedItems.length > 0 && inputValue !== ''
            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-200'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'}"
        onclick={applyInput}
        disabled={selectedItems.length === 0 || inputValue === ''}
      >
        ✓ 입력 적용
        {#if selectedItems.length > 0 && inputValue !== ''}
          <span class="text-sm font-normal opacity-80 ml-1">
            ({selectedItems.length}개 품목 · {STATUS_LABELS[selectedField]} {inputValue}개)
          </span>
        {/if}
      </button>

      <!-- 세탁완료 일괄 버튼 -->
      <button
        type="button"
        class="w-full h-12 rounded-xl font-bold text-sm transition-all duration-150 active:scale-95
          {selectedItems.length > 0
            ? 'bg-teal-500 hover:bg-teal-600 text-white'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'}"
        onclick={bulkComplete}
        disabled={selectedItems.length === 0}
      >
        ⟳ 세탁완료 일괄 처리 (세탁중 → 완료)
      </button>

      <!-- 구분선 -->
      <div class="border-t border-slate-100"></div>

      <!-- 네비게이션 버튼 -->
      <div class="space-y-2 pb-4">
        <button
          type="button"
          class="w-full h-12 rounded-xl font-bold text-sm transition-all duration-150 active:scale-95
            bg-indigo-500 hover:bg-indigo-600 text-white"
          onclick={() => void goto('/theme-a/shipout')}
        >
          🚚 출고 신청
        </button>
        <button
          type="button"
          class="w-full h-12 rounded-xl font-bold text-sm transition-all duration-150 active:scale-95
            bg-slate-600 hover:bg-slate-700 text-white"
          onclick={() => void goto('/theme-a/history')}
        >
          📋 출고 현황
        </button>
      </div>

    </div>
  </aside>

</div>