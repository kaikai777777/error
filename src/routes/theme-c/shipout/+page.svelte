<script lang="ts">
  import { goto } from '$app/navigation';
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import NumPad from '$lib/components/NumPad.svelte';
  import type { LaundryCategory, LaundryItem, LaundryItemName } from '$lib/data/types';

  // ── 날짜 초기값 유틸 ─────────────────────────────────────────
  function getInitialDateTime(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  // ── 상태 ──────────────────────────────────────────────────────
  let activeTab = $state<LaundryCategory>('all');
  let showClientDropdown = $state(false);
  let showNumpadModal = $state(false);
  let numpadTargetId = $state<string | null>(null);
  let numpadValue = $state('');

  // 출고 수량: itemId → quantity
  let shipQty = $state<Record<string, number>>({});

  let selectedDriverId = $state<string>(store.drivers[0]?.id ?? '');
  let shippedAt = $state<string>(getInitialDateTime());
  let memo = $state('');
  let submitResult = $state<'idle' | 'success' | 'error'>('idle');

  // ── 파생 상태 ─────────────────────────────────────────────────
  let filteredItems = $derived<LaundryItem[]>(
    store.selectedClientId
      ? store.getItemsByCategory(store.selectedClientId, activeTab)
      : []
  );

  // 출고 목록: 수량 > 0 인 항목들
  let shipList = $derived(
    filteredItems
      .filter((item) => (shipQty[item.id] ?? 0) > 0)
      .map((item) => ({ item, qty: shipQty[item.id] }))
  );

  // 전체 출고 수량 합산
  let totalQty = $derived(
    Object.values(shipQty).reduce((sum, q) => sum + q, 0)
  );

  // 탭 정의
  const tabs: { key: LaundryCategory; label: string; icon: string }[] = [
    { key: 'all',     label: '전체',    icon: '📋' },
    { key: 'towel',   label: '타올',    icon: '🧺' },
    { key: 'sheet',   label: '시트',    icon: '🛏' },
    { key: 'uniform', label: '유니폼',  icon: '👔' },
  ];

  // ── 수량 핸들러 ───────────────────────────────────────────────
  function increment(itemId: string, max: number) {
    const cur = shipQty[itemId] ?? 0;
    if (cur < max) shipQty = { ...shipQty, [itemId]: cur + 1 };
  }

  function decrement(itemId: string) {
    const cur = shipQty[itemId] ?? 0;
    if (cur > 0) shipQty = { ...shipQty, [itemId]: cur - 1 };
  }

  function openNumpad(itemId: string) {
    numpadTargetId = itemId;
    numpadValue = String(shipQty[itemId] ?? '');
    showNumpadModal = true;
  }

  function applyNumpad() {
    if (!numpadTargetId) return;
    const num = parseInt(numpadValue, 10);
    if (!isNaN(num) && num >= 0) {
      shipQty = { ...shipQty, [numpadTargetId]: num };
    }
    showNumpadModal = false;
    numpadTargetId = null;
    numpadValue = '';
  }

  function closeNumpad() {
    showNumpadModal = false;
    numpadTargetId = null;
    numpadValue = '';
  }

  function removeShipItem(itemId: string) {
    shipQty = { ...shipQty, [itemId]: 0 };
  }

  async function confirmShipout() {
    if (!store.selectedClientId || shipList.length === 0 || !selectedDriverId) {
      submitResult = 'error';
      setTimeout(() => (submitResult = 'idle'), 2500);
      return;
    }

    store.addShipment({
      clientId: store.selectedClientId,
      driverId: selectedDriverId,
      memo: memo.trim() || undefined,
      shippedAt: new Date(shippedAt).toISOString(),
      items: shipList.map(({ item, qty }) => ({
        laundryItemId: item.id,
        itemName: item.name as LaundryItemName,
        category: item.category,
        quantity: qty,
      })),
    });

    submitResult = 'success';
    shipQty = {};
    memo = '';
    setTimeout(() => {
      submitResult = 'idle';
      void goto('/theme-c/history');
    }, 1200);
    // (void 패턴 유지)
  }

  function formatCategory(cat: string): string {
    return CATEGORY_LABELS[cat as LaundryCategory] ?? cat;
  }
</script>

<!-- 루트 컨테이너 -->
<div class="flex flex-col h-screen bg-gray-50 overflow-hidden">

  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <!-- 헤더 바                                                   -->
  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <header class="bg-white shadow-md h-16 flex items-center px-5 gap-4 shrink-0 z-20">
    <!-- 로고 + 타이틀 -->
    <div class="flex items-center gap-2 shrink-0">
      <div class="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow">
        <span class="text-lg">🚚</span>
      </div>
      <div>
        <span class="text-lg font-extrabold text-slate-800 tracking-tight">출고 신청</span>
        <span class="ml-2 text-xs text-slate-400">Theme C</span>
      </div>
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
                shipQty = {};
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
        onclick={() => void goto('/theme-c')}
        class="flex items-center gap-1.5 px-4 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        세탁물관리
      </button>
      <button
        onclick={() => void goto('/theme-c/history')}
        class="flex items-center gap-1.5 px-4 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
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
  <!-- 2단 레이아웃: 좌(품목선택) + 우(출고정보)                -->
  <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
  <div class="flex flex-1 overflow-hidden">

    <!-- ── 좌측: 품목 선택 ───────────────────────────────────── -->
    <div class="flex-1 flex flex-col overflow-hidden">

      <!-- 카테고리 탭 -->
      <div class="bg-white border-b border-slate-100 px-4 flex gap-1 shrink-0">
        {#each tabs as tab (tab.key)}
          <button
            onclick={() => { activeTab = tab.key; }}
            class="flex items-center gap-2 px-5 py-3.5 font-bold text-sm transition
              {activeTab === tab.key
                ? 'text-amber-600 border-b-4 border-amber-500'
                : 'text-slate-500 hover:text-slate-700 border-b-4 border-transparent'}"
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        {/each}
      </div>

      <!-- 품목 카드 그리드 -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if !store.selectedClientId}
          <div class="flex flex-col items-center justify-center h-full text-slate-400 py-20">
            <div class="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <span class="text-3xl">🏭</span>
            </div>
            <p class="text-lg font-bold text-slate-500">거래처를 선택하세요</p>
          </div>
        {:else if filteredItems.length === 0}
          <div class="flex flex-col items-center justify-center h-full text-slate-400 py-20">
            <span class="text-5xl mb-4">📭</span>
            <p class="text-lg font-bold">품목이 없습니다</p>
          </div>
        {:else}
          <div class="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {#each filteredItems as item (item.id)}
              {@const qty = shipQty[item.id] ?? 0}
              {@const completed = item.counts.completed}
              {@const isSelected = qty > 0}
              <div
                class="bg-white rounded-2xl shadow-md p-5 transition-all duration-200
                  {isSelected ? 'ring-4 ring-amber-400 bg-amber-50 shadow-lg' : 'hover:shadow-lg'}"
              >
                <!-- 품목명 + 카테고리 -->
                <div class="flex items-start justify-between mb-3">
                  <div>
                    <p class="text-xl font-black text-slate-800 leading-tight">{item.name}</p>
                    <span class="inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-semibold
                      {item.category === 'towel'   ? 'bg-sky-100 text-sky-700' :
                       item.category === 'sheet'   ? 'bg-violet-100 text-violet-700' :
                                                     'bg-orange-100 text-orange-700'}">
                      {formatCategory(item.category)}
                    </span>
                  </div>
                  {#if isSelected}
                    <div class="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shrink-0 shadow">
                      <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  {/if}
                </div>

                <!-- 세탁완료 수량 크게 표시 -->
                <div class="bg-emerald-50 rounded-xl px-3 py-2 mb-3 flex items-center justify-between">
                  <span class="text-xs font-bold text-emerald-600">세탁완료</span>
                  <span class="text-3xl font-black text-emerald-600">{completed}</span>
                </div>

                <!-- 출고 수량 + ± 버튼 -->
                <div class="flex items-center gap-2">
                  <button
                    onclick={() => decrement(item.id)}
                    disabled={qty === 0}
                    class="w-10 h-10 rounded-xl font-black text-xl transition flex items-center justify-center
                      {qty > 0
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
                        : 'bg-slate-50 text-slate-300 cursor-not-allowed'}"
                  >
                    −
                  </button>

                  <!-- 출고 수량: 클릭 시 키패드 -->
                  <button
                    onclick={() => openNumpad(item.id)}
                    class="flex-1 h-10 rounded-xl font-black text-xl transition text-center
                      {isSelected
                        ? 'bg-amber-500 text-white shadow'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}"
                  >
                    {qty}<span class="text-xs font-semibold ml-0.5 opacity-70">개</span>
                  </button>

                  <button
                    onclick={() => increment(item.id, completed)}
                    disabled={qty >= completed}
                    class="w-10 h-10 rounded-xl font-black text-xl transition flex items-center justify-center
                      {qty < completed
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
                        : 'bg-slate-50 text-slate-300 cursor-not-allowed'}"
                  >
                    +
                  </button>
                </div>

                {#if completed === 0}
                  <p class="text-xs text-slate-400 mt-2 text-center">세탁완료 재고 없음</p>
                {:else if qty >= completed}
                  <p class="text-xs text-amber-500 mt-2 text-center font-semibold">최대 수량</p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- ── 우측: 출고 정보 패널 ──────────────────────────────── -->
    <div class="w-80 shrink-0 bg-white border-l border-slate-100 shadow-sm flex flex-col overflow-hidden">

      <!-- 패널 헤더 -->
      <div class="px-5 py-4 border-b border-slate-100 bg-amber-50 shrink-0">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black text-slate-800">출고 목록</h2>
          {#if totalQty > 0}
            <span class="px-3 py-1 bg-amber-500 text-white rounded-full text-sm font-bold shadow">
              총 {totalQty.toLocaleString()}개
            </span>
          {/if}
        </div>
        {#if store.selectedClient}
          <p class="text-sm text-amber-700 font-semibold mt-1">{store.selectedClient.name}</p>
        {/if}
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        <!-- 선택된 출고 품목 목록 -->
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">선택된 품목</p>
          {#if shipList.length === 0}
            <div class="rounded-xl bg-slate-50 border border-slate-100 px-4 py-4 text-sm text-slate-400 text-center">
              <span class="text-2xl block mb-1">📦</span>
              품목을 선택하세요
            </div>
          {:else}
            <div class="rounded-xl bg-amber-50 border border-amber-200 divide-y divide-amber-100 overflow-hidden">
              {#each shipList as { item, qty } (item.id)}
                <div class="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <span class="font-bold text-slate-700 text-sm">{item.name}</span>
                    <span class="ml-1.5 text-xs text-slate-400">{formatCategory(item.category)}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-black text-amber-600 text-base">{qty}개</span>
                    <button
                      onclick={() => removeShipItem(item.id)}
                      class="w-5 h-5 rounded-full bg-slate-200 hover:bg-red-100 hover:text-red-500 text-slate-500 flex items-center justify-center transition text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- 배송기사 선택 -->
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">배송기사</p>
          <div class="flex flex-col gap-2">
            {#each store.drivers as driver (driver.id)}
              <button
                onclick={() => (selectedDriverId = driver.id)}
                class="flex items-center justify-between px-4 py-3 rounded-xl border-2 transition font-semibold text-sm
                  {selectedDriverId === driver.id
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-slate-100 bg-slate-50 hover:border-amber-200 text-slate-600'}"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center font-black text-sm
                    {selectedDriverId === driver.id ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-500'}">
                    {driver.name.charAt(0)}
                  </div>
                  <span>{driver.name}</span>
                </div>
                <span class="text-xs text-slate-400">{driver.phone}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- 배송 시간 -->
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">배송 시간</p>
          <input
            type="datetime-local"
            bind:value={shippedAt}
            class="w-full h-11 rounded-xl border-2 border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-700
              focus:outline-none focus:border-amber-400 focus:bg-amber-50 transition"
          />
        </div>

        <!-- 배송 메모 -->
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">배송 메모</p>
          <textarea
            bind:value={memo}
            placeholder="메모를 입력하세요 (선택)"
            rows="3"
            class="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 resize-none
              focus:outline-none focus:border-amber-400 focus:bg-amber-50 transition placeholder:text-slate-300"
          ></textarea>
        </div>
      </div>

      <!-- 출고 확정 버튼 -->
      <div class="px-5 py-4 border-t border-slate-100 shrink-0">
        {#if submitResult === 'success'}
          <div class="h-14 rounded-2xl bg-emerald-500 flex items-center justify-center gap-2 text-white font-black text-lg shadow-lg">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            출고 완료!
          </div>
        {:else if submitResult === 'error'}
          <div class="h-14 rounded-2xl bg-red-50 border-2 border-red-200 flex items-center justify-center text-red-500 font-bold text-sm px-3 text-center">
            거래처, 품목, 배송기사를 확인해주세요
          </div>
        {:else}
          <button
            onclick={confirmShipout}
            disabled={shipList.length === 0 || !selectedDriverId || !store.selectedClientId}
            class="w-full h-14 rounded-2xl font-black text-lg transition shadow-md
              {shipList.length > 0 && selectedDriverId && store.selectedClientId
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-amber-100 text-amber-300 cursor-not-allowed'}"
          >
            {#if shipList.length > 0}
              출고 확정 ({totalQty.toLocaleString()}개)
            {:else}
              출고 확정
            {/if}
          </button>
        {/if}

        <button
          onclick={() => void goto('/theme-c')}
          class="w-full mt-2 h-10 rounded-xl font-semibold text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition"
        >
          ← 세탁물 관리로 돌아가기
        </button>
      </div>
    </div>
  </div>
</div>

<!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
<!-- 수량 입력 키패드 모달                                       -->
<!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
{#if showNumpadModal}
  <button
    class="fixed inset-0 bg-black/40 z-40"
    onclick={closeNumpad}
    aria-label="모달 닫기"
  ></button>

  <div class="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-6 shadow-2xl">
    <div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5"></div>

    <h3 class="text-lg font-black text-slate-800 mb-1">출고 수량 입력</h3>
    {#if numpadTargetId}
      {@const targetItem = filteredItems.find(i => i.id === numpadTargetId)}
      {#if targetItem}
        <p class="text-sm text-slate-400 mb-4">
          <span class="font-bold text-amber-600">{targetItem.name}</span>
          · 세탁완료 재고
          <span class="font-black text-emerald-600">{targetItem.counts.completed}개</span>
        </p>
      {/if}
    {/if}

    <!-- 입력값 표시 -->
    <div class="h-16 bg-slate-50 rounded-2xl border-2 border-amber-300 flex items-center px-5 mb-4">
      <span class="text-4xl font-black text-slate-800 flex-1 text-right tracking-widest">
        {numpadValue === '' ? '0' : numpadValue}
      </span>
      <span class="text-base text-slate-400 ml-3">개</span>
    </div>

    <NumPad
      bind:value={numpadValue}
      accentClass="bg-amber-500 hover:bg-amber-600 text-white"
    />

    <div class="flex gap-3 mt-4">
      <button
        onclick={closeNumpad}
        class="flex-1 h-14 rounded-2xl font-bold text-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
      >
        취소
      </button>
      <button
        onclick={applyNumpad}
        class="flex-1 h-14 rounded-2xl font-bold text-lg bg-amber-500 hover:bg-amber-600 text-white transition shadow-md"
      >
        적용
      </button>
    </div>
  </div>
{/if}