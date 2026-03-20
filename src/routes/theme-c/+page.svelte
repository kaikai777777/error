<script lang="ts">
  import { goto } from '$app/navigation';
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import type { LaundryCategory, LaundryItemStatus, LaundryItem } from '$lib/data/types';
  import { SvelteSet } from 'svelte/reactivity';

  // ── 상태 ──────────────────────────────────────────────────────
  let activeTab = $state<LaundryCategory>('all');
  let selectedItemIds = new SvelteSet<string>();
  let showClientDropdown = $state(false);
  let showNumpadModal = $state(false);
  let inputValue = $state('');
  let selectedField = $state<LaundryItemStatus>('received');

  // ── 파생 상태 ─────────────────────────────────────────────────
  let filteredItems = $derived<LaundryItem[]>(
    store.selectedClientId
      ? store.getItemsByCategory(store.selectedClientId, activeTab)
      : []
  );

  let selectedItems = $derived<LaundryItem[]>(
    filteredItems.filter((item) => selectedItemIds.has(item.id))
  );

  let totalSummary = $derived(
    (() => {
      if (!store.selectedClientId) return { received: 0, washing: 0, completed: 0, defect: 0 };
      const items = store.getItemsByCategory(store.selectedClientId, 'all');
      return items.reduce(
        (acc, item) => ({
          received: acc.received + item.counts.received,
          washing: acc.washing + item.counts.washing,
          completed: acc.completed + item.counts.completed,
          defect: acc.defect + item.counts.defect,
        }),
        { received: 0, washing: 0, completed: 0, defect: 0 }
      );
    })()
  );

  function getCategoryCount(cat: LaundryCategory): number {
    if (!store.selectedClientId) return 0;
    const items = store.getItemsByCategory(store.selectedClientId, cat);
    return items.reduce((sum, item) => sum + item.counts.received, 0);
  }

  // ── 탭 정의 ───────────────────────────────────────────────────
  const tabs: { key: LaundryCategory; label: string; icon: string }[] = [
    { key: 'all', label: '전체', icon: '📋' },
    { key: 'towel', label: '타올', icon: '🧺' },
    { key: 'sheet', label: '시트', icon: '🛏' },
    { key: 'uniform', label: '유니폼', icon: '👔' },
  ];

  // ── 상태별 스타일 ─────────────────────────────────────────────
  const statusColors: Record<LaundryItemStatus, string> = {
    received: 'text-sky-600',
    washing: 'text-amber-500',
    completed: 'text-emerald-600',
    defect: 'text-red-500',
    stock: 'text-slate-500',
    shipped: 'text-purple-500',
  };

  const statusBg: Record<LaundryItemStatus, string> = {
    received: 'bg-sky-50',
    washing: 'bg-amber-50',
    completed: 'bg-emerald-50',
    defect: 'bg-red-50',
    stock: 'bg-slate-50',
    shipped: 'bg-purple-50',
  };

  const statusLabels: Record<LaundryItemStatus, string> = {
    received: '입고',
    washing: '세탁중',
    completed: '세탁완료',
    defect: '불량',
    stock: '재고',
    shipped: '출고',
  };

  const displayStatuses: LaundryItemStatus[] = ['received', 'washing', 'completed', 'defect', 'stock'];

  // ── 필드 버튼 ─────────────────────────────────────────────────
  const fieldButtons: { key: LaundryItemStatus; label: string; color: string; activeBg: string }[] = [
    { key: 'received',  label: '입고',    color: 'text-sky-600',     activeBg: 'bg-sky-500 text-white'     },
    { key: 'completed', label: '세탁완료', color: 'text-emerald-600', activeBg: 'bg-emerald-500 text-white' },
    { key: 'defect',    label: '불량',    color: 'text-red-500',     activeBg: 'bg-red-500 text-white'     },
    { key: 'stock',     label: '재고',    color: 'text-slate-500',   activeBg: 'bg-slate-500 text-white'   },
  ];

  // ── 핸들러 ───────────────────────────────────────────────────
  function toggleItem(id: string) {
    if (selectedItemIds.has(id)) selectedItemIds.delete(id);
    else selectedItemIds.add(id);
  }

  function applyInput() {
    const num = parseInt(inputValue, 10);
    if (isNaN(num) || selectedItems.length === 0) return;
    for (const item of selectedItems) {
      store.updateLaundryItem(item.clientId, item.id, selectedField, num);
    }
    inputValue = '';
    showNumpadModal = false;
  }

  function bulkComplete() {
    if (!store.selectedClientId) return;
    for (const item of selectedItems) {
      const washing = item.counts.washing;
      if (washing > 0) {
        store.updateLaundryItem(item.clientId, item.id, 'completed', item.counts.completed + washing);
        store.updateLaundryItem(item.clientId, item.id, 'washing', 0);
      }
    }
    selectedItemIds.clear();
  }

  function openNumpad() {
    inputValue = '';
    showNumpadModal = true;
  }

  function formatUpdatedAt(iso: string): string {
    const d = new Date(iso);
    const month  = String(d.getMonth() + 1).padStart(2, '0');
    const day    = String(d.getDate()).padStart(2, '0');
    const hour   = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hour}:${minute}`;
  }


</script>

<!-- 루트 컨테이너 -->
<div class="flex flex-col h-screen bg-gray-50 overflow-hidden">

  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <!-- 상단 헤더 바                                              -->
  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <header class="bg-white shadow-md h-16 flex items-center px-5 gap-4 shrink-0 z-20">
    <!-- 로고 -->
    <div class="flex items-center gap-2 shrink-0">
      <div class="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow">
        <span class="text-lg">🏭</span>
      </div>
      <span class="text-lg font-extrabold text-slate-800 tracking-tight">세탁물 관리</span>
    </div>

    <!-- 거래처 드롭다운 -->
    <div class="relative flex-1 max-w-xs mx-auto">
      <button
        onclick={() => (showClientDropdown = !showClientDropdown)}
        class="w-full h-10 flex items-center justify-between gap-2 px-4 rounded-xl border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 transition"
      >
        <span class="font-bold text-slate-700 text-sm truncate">
          {store.selectedClient?.name ?? '거래처 선택'}
        </span>
        <svg
          class="w-4 h-4 text-amber-500 shrink-0 transition-transform {showClientDropdown ? 'rotate-180' : ''}"
          fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {#if showClientDropdown}
        <button
          class="fixed inset-0 z-30"
          onclick={() => (showClientDropdown = false)}
          aria-label="닫기"
        ></button>
        <div class="absolute top-12 left-0 right-0 bg-white rounded-2xl shadow-xl border border-slate-100 z-40 overflow-hidden">
          {#each store.clients as client (client.id)}
            <button
              onclick={() => {
                store.selectClient(client.id);
                selectedItemIds.clear();
                showClientDropdown = false;
              }}
              class="w-full px-4 py-3 text-left hover:bg-amber-50 transition flex items-center justify-between
                {store.selectedClientId === client.id ? 'bg-amber-50 text-amber-700 font-bold' : 'text-slate-700'}"
            >
              <span class="font-semibold">{client.name}</span>
              <span class="text-xs text-slate-400">{client.type}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 네비 버튼들 -->
    <div class="flex items-center gap-2 shrink-0">
      <button
        onclick={() => void goto('/theme-c/shipout')}
        class="flex items-center gap-1.5 px-4 h-9 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition shadow"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        출고신청
      </button>
      <button
        onclick={() => void goto('/theme-c/history')}
        class="flex items-center gap-1.5 px-4 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        출고현황
      </button>
      <button
        onclick={() => void goto('/')}
        class="flex items-center gap-1.5 px-4 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        홈
      </button>
    </div>
  </header>

  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <!-- 거래처 요약 배너                                          -->
  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  {#if store.selectedClient}
    <div class="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center">
          <span class="text-white font-black text-sm">{store.selectedClient.name.charAt(0)}</span>
        </div>
        <h2 class="text-xl font-black text-slate-800">{store.selectedClient.name}</h2>
        <span class="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-semibold">
          {store.selectedClient.type}
        </span>
      </div>
      <div class="flex items-center gap-4 text-sm font-bold">
        <div class="flex items-center gap-1.5">
          <span class="text-slate-400 font-medium">입고</span>
          <span class="text-sky-600 text-lg font-black">{totalSummary.received.toLocaleString()}</span>
        </div>
        <div class="w-px h-4 bg-amber-200"></div>
        <div class="flex items-center gap-1.5">
          <span class="text-slate-400 font-medium">세탁중</span>
          <span class="text-amber-500 text-lg font-black">{totalSummary.washing.toLocaleString()}</span>
        </div>
        <div class="w-px h-4 bg-amber-200"></div>
        <div class="flex items-center gap-1.5">
          <span class="text-slate-400 font-medium">세탁완료</span>
          <span class="text-emerald-600 text-lg font-black">{totalSummary.completed.toLocaleString()}</span>
        </div>
        <div class="w-px h-4 bg-amber-200"></div>
        <div class="flex items-center gap-1.5">
          <span class="text-slate-400 font-medium">불량</span>
          <span class="text-red-500 text-lg font-black">{totalSummary.defect.toLocaleString()}</span>
        </div>
      </div>
    </div>
  {/if}

  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <!-- 카테고리 탭 바                                            -->
  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <div class="bg-white border-b border-slate-100 px-4 flex gap-1 shrink-0">
    {#each tabs as tab (tab.key)}
      <button
        onclick={() => { activeTab = tab.key; selectedItemIds.clear(); }}
        class="flex items-center gap-2 px-5 py-3.5 font-bold text-sm transition
          {activeTab === tab.key
            ? 'text-amber-600 border-b-4 border-amber-500'
            : 'text-slate-500 hover:text-slate-700 border-b-4 border-transparent'}"
      >
        <span>{tab.icon}</span>
        <span>{tab.label}</span>
        {#if store.selectedClientId}
          <span class="ml-1 text-xs px-1.5 py-0.5 rounded-full
            {activeTab === tab.key ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}">
            {getCategoryCount(tab.key).toLocaleString()}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <!-- 세탁물 카드 그리드                                        -->
  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <div class="flex-1 overflow-y-auto p-4 pb-24">
    {#if !store.selectedClientId}
      <div class="flex flex-col items-center justify-center h-full text-slate-400 py-20">
        <div class="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center mb-6">
          <span class="text-4xl">🏭</span>
        </div>
        <p class="text-xl font-bold text-slate-500 mb-2">거래처를 선택하세요</p>
        <p class="text-sm text-slate-400 text-center">
          상단 드롭다운에서 거래처를 선택하면<br />세탁물 현황을 확인할 수 있습니다.
        </p>
      </div>
    {:else if filteredItems.length === 0}
      <div class="flex flex-col items-center justify-center h-full text-slate-400 py-20">
        <span class="text-5xl mb-4">📭</span>
        <p class="text-lg font-bold">품목이 없습니다</p>
      </div>
    {:else}
      <div class="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {#each filteredItems as item (item.id)}
          {@const isSelected = selectedItemIds.has(item.id)}
          <button
            onclick={() => toggleItem(item.id)}
            class="bg-white rounded-2xl shadow-md p-5 text-left transition-all duration-200
              {isSelected
                ? 'ring-4 ring-amber-400 bg-amber-50 shadow-lg'
                : 'hover:shadow-lg hover:ring-2 hover:ring-amber-200'}"
          >
            <!-- 카드 상단: 품목명 + 선택 표시 -->
            <div class="flex items-start justify-between mb-4">
              <div>
                <p class="text-xl font-black text-slate-800 leading-tight">{item.name}</p>
                <span class="inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-semibold
                  {item.category === 'towel'   ? 'bg-sky-100 text-sky-700' :
                   item.category === 'sheet'   ? 'bg-violet-100 text-violet-700' :
                                                 'bg-orange-100 text-orange-700'}">
                  {CATEGORY_LABELS[item.category]}
                </span>
              </div>
              {#if isSelected}
                <div class="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shrink-0 shadow">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              {:else}
                <div class="w-7 h-7 rounded-full border-2 border-slate-200 shrink-0"></div>
              {/if}
            </div>

            <!-- 카드 중단: 상태별 수치 -->
            <div class="flex flex-wrap gap-2">
              {#each displayStatuses as status (status)}
                <div class="flex-1 min-w-0 rounded-xl px-2.5 py-2 text-center {statusBg[status]}">
                  <p class="text-xs font-semibold text-slate-500 leading-none mb-1">{statusLabels[status]}</p>
                  <p class="text-3xl font-black leading-none {statusColors[status]}">{item.counts[status]}</p>
                </div>
              {/each}
            </div>

            <!-- 카드 하단: 업데이트 시간 -->
            <p class="text-xs text-slate-400 mt-3 text-right">
              ⏱ {formatUpdatedAt(item.updatedAt)}
            </p>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <!-- 하단 고정 액션 바                                         -->
  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <div class="fixed bottom-0 left-0 right-0 bg-white shadow-2xl border-t border-slate-100 h-20 flex items-center gap-3 px-6 z-10">
    <!-- 선택 카운트 -->
    <div class="shrink-0">
      {#if selectedItemIds.size > 0}
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">
          <span class="w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-black">
            {selectedItemIds.size}
          </span>
          개 선택됨
        </span>
      {:else}
        <span class="text-sm text-slate-400 font-medium">품목을 선택하세요</span>
      {/if}
    </div>

    <div class="flex-1"></div>

    <!-- 수량 입력 -->
    <button
      onclick={openNumpad}
      disabled={selectedItemIds.size === 0}
      class="flex items-center gap-2 px-5 h-14 rounded-2xl font-bold text-lg transition
        {selectedItemIds.size > 0
          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          : 'bg-slate-50 text-slate-300 cursor-not-allowed'}"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z" />
      </svg>
      수량 입력
    </button>

    <!-- 세탁완료 일괄 -->
    <button
      onclick={bulkComplete}
      disabled={selectedItemIds.size === 0}
      class="flex items-center gap-2 px-5 h-14 rounded-2xl font-bold text-lg transition shadow-md
        {selectedItemIds.size > 0
          ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
          : 'bg-emerald-100 text-emerald-300 cursor-not-allowed'}"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      세탁완료 일괄
    </button>

    <!-- 출고 신청 -->
    <button
      onclick={() => void goto('/theme-c/shipout')}
      class="flex items-center gap-2 px-7 h-14 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-600 text-white transition shadow-lg"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7" />
      </svg>
      출고 신청
    </button>
  </div>
</div>

<!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
<!-- 키패드 모달                                                 -->
<!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
{#if showNumpadModal}
  <!-- 배경 오버레이 -->
  <button
    class="fixed inset-0 bg-black/40 z-40"
    onclick={() => (showNumpadModal = false)}
    aria-label="모달 닫기"
  ></button>

  <!-- 바텀 시트 패널 -->
  <div class="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-6 shadow-2xl">
    <div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5"></div>

    <h3 class="text-lg font-black text-slate-800 mb-1">수량 입력</h3>
    <p class="text-sm text-slate-400 mb-4">
      {selectedItemIds.size}개 품목에 적용됩니다
    </p>

    <!-- 수정할 상태 선택 -->
    <div class="flex gap-2 mb-5">
      {#each fieldButtons as btn (btn.key)}
        <button
          onclick={() => (selectedField = btn.key)}
          class="flex-1 py-2.5 rounded-xl font-bold text-sm transition
            {selectedField === btn.key ? btn.activeBg : `bg-slate-50 ${btn.color} border border-slate-100`}"
        >
          {btn.label}
        </button>
      {/each}
    </div>

    <!-- 현재 입력값 표시 -->
    <div class="h-16 bg-slate-50 rounded-2xl border-2 border-amber-300 flex items-center px-5 mb-4">
      <span class="text-4xl font-black text-slate-800 flex-1 text-right tracking-widest">
        {inputValue === '' ? '0' : inputValue}
      </span>
      <span class="text-base text-slate-400 ml-3">개</span>
    </div>

    <!-- NumPad -->
    <NumPad
      bind:value={inputValue}
      accentClass="bg-amber-500 hover:bg-amber-600 text-white"
    />

    <!-- 적용 / 취소 버튼 -->
    <div class="flex gap-3 mt-4">
      <button
        onclick={() => (showNumpadModal = false)}
        class="flex-1 h-14 rounded-2xl font-bold text-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
      >
        취소
      </button>
      <button
        onclick={applyInput}
        disabled={inputValue === ''}
        class="flex-1 h-14 rounded-2xl font-bold text-lg transition shadow-md
          {inputValue !== ''
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : 'bg-amber-100 text-amber-300 cursor-not-allowed'}"
      >
        적용
        {#if inputValue !== ''}
          <span class="text-sm font-normal opacity-80 ml-1">
            ({fieldButtons.find(b => b.key === selectedField)?.label} {inputValue}개)
          </span>
        {/if}
      </button>
    </div>
  </div>
{/if}