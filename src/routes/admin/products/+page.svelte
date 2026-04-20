<script lang="ts">
  import { store } from '$lib/data/store.svelte';
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';

  // ── 카테고리 레이블 ────────────────────────────────────────────
  const CATEGORY_LABELS: Record<string, string> = {
    towel: '타월',
    sheet: '시트',
    uniform: '유니폼',
  };
  function catLabel(cat: string): string {
    return CATEGORY_LABELS[cat] ?? cat;
  }

  // ── 타입 배지 ─────────────────────────────────────────────────
  const typeBadge: Record<string, string> = {
    hotel:   'bg-sky-100 text-sky-700',
    pension: 'bg-emerald-100 text-emerald-700',
    resort:  'bg-amber-100 text-amber-700',
    etc:     'bg-slate-100 text-slate-600',
  };
  const typeLabel: Record<string, string> = {
    hotel: '호텔', pension: '펜션', resort: '리조트', etc: '기타',
  };

  // ── 거래처 ────────────────────────────────────────────────────
  const sortedClients = $derived(
    [...store.clients].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  );

  let selectedClientId = $state<string | null>(null);

  onMount(() => {
    const saved = localStorage.getItem('products_selectedClientId');
    if (saved && store.clients.find(c => c.id === saved)) {
      selectedClientId = saved;
    } else {
      selectedClientId = sortedClients[0]?.id ?? null;
    }
  });

  $effect(() => {
    if (selectedClientId) {
      localStorage.setItem('products_selectedClientId', selectedClientId);
    }
  });

  const selectedClient = $derived(
    store.clients.find(c => c.id === selectedClientId) ?? null
  );

  // ── 거래처 선택 모달 ───────────────────────────────────────────────
  let showClientModal = $state(false);
  let clientSearch    = $state('');

  const filteredClients = $derived(
    clientSearch.trim()
      ? sortedClients.filter(c =>
          c.name.toLowerCase().includes(clientSearch.trim().toLowerCase())
        )
      : sortedClients
  );

  function openClientModal() {
    clientSearch   = '';
    showClientModal = true;
  }

  function handleSelectClient(id: string) {
    selectedClientId = id;
    showClientModal  = false;
  }

  // ── 복사 모달 ──────────────────────────────────────────────────
  let showCopyModal = $state(false);
  let showCopyConfirmModal = $state(false);
  let copySourceClientId = $state<string | null>(null);
  let copySourceSearch = $state('');

  const filteredClientsForCopy = $derived(
    copySourceSearch.trim()
      ? sortedClients
          .filter(c => c.id !== selectedClientId)
          .filter(c =>
            c.name.toLowerCase().includes(copySourceSearch.trim().toLowerCase())
          )
      : sortedClients.filter(c => c.id !== selectedClientId)
  );

  function openCopyModal() {
    copySourceSearch = '';
    copySourceClientId = null;
    showCopyModal = true;
  }

  function selectSourceForCopy(id: string) {
    copySourceClientId = id;
    showCopyModal = false;
    showCopyConfirmModal = true;
  }

  function confirmCopy() {
    if (!selectedClientId || !copySourceClientId) return;

    const sourceItems = store.laundryItems.filter(i => i.clientId === copySourceClientId);
    const sourcePrices = store.getClientItemPrices(copySourceClientId);

    // 현재 거래처의 기존 항목들 삭제
    const currentItems = store.laundryItems.filter(i => i.clientId === selectedClientId);
    for (const item of currentItems) {
      store.removeLaundryItem(item.id);
    }

    // 소스 거래처의 모든 항목 복사
    for (const sourceItem of sourceItems) {
      store.addLaundryItemType(selectedClientId, sourceItem.category, sourceItem.name);
    }

    // 소스 거래처의 모든 가격 복사
    const newPrices = sourcePrices.map(p => ({
      category: p.category,
      itemName: p.itemName,
      unitPrice: p.unitPrice,
    }));
    store.saveClientItemPrices(selectedClientId, newPrices);

    showCopyConfirmModal = false;
    copySourceClientId = null;
  }

  function cancelCopy() {
    showCopyModal = false;
    showCopyConfirmModal = false;
    copySourceClientId = null;
  }

  // ── 카테고리 ──────────────────────────────────────────────────
  let selectedCategory = $state<string | null>(null);
  let localCats        = $state<string[]>([]);
  let newCatInput      = $state('');
  let newItemName      = $state('');
  let newItemPrice     = $state('');

  const storeCats = $derived.by(() => {
    if (!selectedClientId) return [] as string[];
    const seen   = new SvelteSet<string>();
    const result: string[] = [];
    for (const item of store.laundryItems) {
      if (item.clientId === selectedClientId && !seen.has(item.category)) {
        seen.add(item.category);
        result.push(item.category);
      }
    }
    return result;
  });

  const allCategories = $derived(
    [...storeCats, ...localCats.filter(c => !storeCats.includes(c))]
  );

  const effectiveCat = $derived(
    selectedCategory && allCategories.includes(selectedCategory)
      ? selectedCategory
      : (allCategories[0] ?? null)
  );

  // 거래처 바뀌면 카테고리/입력 초기화
  $effect(() => {
    void selectedClientId;
    selectedCategory = null;
    localCats        = [];
    newCatInput      = '';
    newItemName      = '';
    newItemPrice     = '';
  });

  // 카테고리 바뀌면 품목 입력 초기화
  $effect(() => {
    void effectiveCat;
    newItemName  = '';
    newItemPrice = '';
  });

  function addCategory() {
    const cat = newCatInput.trim();
    if (!cat) return;
    if (allCategories.includes(cat)) {
      newCatInput      = '';
      selectedCategory = cat;
      return;
    }
    localCats        = [...localCats, cat];
    selectedCategory = cat;
    newCatInput      = '';
  }

  function removeCategory(cat: string) {
    const wasSelected = effectiveCat === cat;
    if (selectedClientId) {
      store.removeLaundryItemsByCategory(selectedClientId, cat);
    }
    localCats = localCats.filter(c => c !== cat);
    if (wasSelected) {
      const remaining  = allCategories.filter(c => c !== cat);
      selectedCategory = remaining[0] ?? null;
    }
  }

  // ── 품목 ──────────────────────────────────────────────────────
  let editingItemId  = $state<string | null>(null);
  let editingPriceValue = $state('');

  const currentItems = $derived(
    selectedClientId && effectiveCat
      ? store.laundryItems.filter(
          i => i.clientId === selectedClientId && i.category === effectiveCat
        )
      : []
  );

  function addItem() {
    const name = newItemName.trim();
    if (!name || !selectedClientId || !effectiveCat) return;
    const price = parseInt(newItemPrice.replace(/[^0-9]/g, ''), 10) || 0;
    const added = store.addLaundryItemType(selectedClientId, effectiveCat, name);
    if (added && price > 0) {
      store.setClientItemPrice(selectedClientId, effectiveCat, name, price);
    }
    // localCats에서 제거 (storeCats로 편입됨)
    localCats    = localCats.filter(c => c !== effectiveCat);
    newItemName  = '';
    newItemPrice = '';
  }

  function removeItem(id: string, itemName: string) {
    if (!selectedClientId || !effectiveCat) return;
    store.removeLaundryItem(id);
    const prices = store
      .getClientItemPrices(selectedClientId)
      .filter(p => !(p.category === effectiveCat && p.itemName === itemName))
      .map(p => ({ category: p.category, itemName: p.itemName, unitPrice: p.unitPrice }));
    store.saveClientItemPrices(selectedClientId, prices);
  }

  function startEditPrice(itemId: string, itemName: string) {
    if (!selectedClientId || !effectiveCat) return;
    const price       = store.getUnitPrice(selectedClientId, effectiveCat, itemName);
    editingItemId     = itemId;
    editingPriceValue = price > 0 ? String(price) : '';
  }

  function commitPrice(itemName: string) {
    if (editingItemId === null) return;
    if (!selectedClientId || !effectiveCat) return;
    const price = parseInt(editingPriceValue.replace(/[^0-9]/g, ''), 10) || 0;
    store.setClientItemPrice(selectedClientId, effectiveCat, itemName, price);
    editingItemId     = null;
    editingPriceValue = '';
  }

  function handlePriceKeydown(e: KeyboardEvent, itemName: string) {
    if (e.key === 'Enter')  { e.preventDefault(); commitPrice(itemName); }
    if (e.key === 'Escape') { editingItemId = null; editingPriceValue = ''; }
  }

  function autoFocus(node: HTMLElement) {
    node.focus();
  }
</script>

<!-- ══════════════════════════════════════════════════════════════
  거래처 선택 모달
══════════════════════════════════════════════════════════════ -->
{#if showClientModal}
  <!-- 백드롭 -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    role="presentation"
    onclick={() => (showClientModal = false)}
    onkeydown={(e) => e.key === 'Escape' && (showClientModal = false)}
    tabindex="-1"
  >
    <!-- 모달 박스 -->
    <div
      class="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      style="max-height: 80vh"
      role="dialog"
      aria-modal="true"
      aria-label="거래처 선택"
      tabindex="0"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <!-- 헤더 -->
      <div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 class="text-base font-bold text-slate-800">거래처 선택</h3>
        <button
          onclick={() => (showClientModal = false)}
          aria-label="닫기"
          class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 검색바 -->
      <div class="shrink-0 px-4 py-3">
        <div class="relative">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path stroke-linecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="거래처명 검색..."
            bind:value={clientSearch}
            class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>
      </div>

      <!-- 거래처 목록 -->
      <ul class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {#if filteredClients.length === 0}
          <li class="py-10 text-center text-sm text-slate-400">검색 결과가 없습니다.</li>
        {:else}
          {#each filteredClients as client (client.id)}
            <li>
              <button
                class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors
                  {selectedClientId === client.id
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-700 hover:bg-slate-50'}"
                onclick={() => handleSelectClient(client.id)}
              >
                <span
                  class="shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold
                    {typeBadge[client.type] ?? 'bg-slate-100 text-slate-600'}"
                >
                  {typeLabel[client.type] ?? client.type}
                </span>
                <span class="min-w-0 flex-1 truncate text-sm font-medium">{client.name}</span>
                {#if selectedClientId === client.id}
                  <svg class="h-4 w-4 shrink-0 text-sky-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                {/if}
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    </div>
  </div>
{/if}

<!-- ══════════════════════════════════════════════════════════════
  복사 소스 선택 모달
══════════════════════════════════════════════════════════════ -->
{#if showCopyModal}
  <!-- 백드롭 -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    role="presentation"
    onclick={cancelCopy}
    onkeydown={(e) => e.key === 'Escape' && cancelCopy()}
    tabindex="-1"
  >
    <!-- 모달 박스 -->
    <div
      class="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      style="max-height: 80vh"
      role="dialog"
      aria-modal="true"
      aria-label="복사 원본 선택"
      tabindex="0"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <!-- 헤더 -->
      <div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 class="text-base font-bold text-slate-800">복사할 거래처 선택</h3>
        <button
          onclick={cancelCopy}
          aria-label="닫기"
          class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 검색바 -->
      <div class="shrink-0 px-4 py-3">
        <div class="relative">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path stroke-linecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="거래처명 검색..."
            bind:value={copySourceSearch}
            class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>
      </div>

      <!-- 거래처 목록 -->
      <ul class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {#if filteredClientsForCopy.length === 0}
          <li class="py-10 text-center text-sm text-slate-400">복사 가능한 거래처가 없습니다.</li>
        {:else}
          {#each filteredClientsForCopy as client (client.id)}
            <li>
              <button
                class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors text-slate-700 hover:bg-slate-50"
                onclick={() => selectSourceForCopy(client.id)}
              >
                <span
                  class="shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold
                    {typeBadge[client.type] ?? 'bg-slate-100 text-slate-600'}"
                >
                  {typeLabel[client.type] ?? client.type}
                </span>
                <span class="min-w-0 flex-1 truncate text-sm font-medium">{client.name}</span>
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    </div>
  </div>
{/if}

<!-- ══════════════════════════════════════════════════════════════
  복사 확인 모달
══════════════════════════════════════════════════════════════ -->
{#if showCopyConfirmModal && copySourceClientId && selectedClientId}
  {@const sourceClient = store.clients.find(c => c.id === copySourceClientId)}
  {@const currentClient = store.clients.find(c => c.id === selectedClientId)}
  
  <!-- 백드롭 -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    role="presentation"
    onclick={cancelCopy}
    onkeydown={(e) => e.key === 'Escape' && cancelCopy()}
    tabindex="-1"
  >
    <!-- 모달 박스 -->
    <div
      class="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="복사 확인"
      tabindex="0"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <!-- 헤더 -->
      <div class="flex shrink-0 items-center gap-3 border-b border-slate-100 px-6 py-4">
        <svg class="h-6 w-6 shrink-0 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4v2m0 4v2M8.228 7.228a2.5 2.5 0 10 3.536 0M8.228 15.228a2.5 2.5 0 10 3.536 0M4.228 11.228a2.5 2.5 0 10 3.536 0M15.772 11.228a2.5 2.5 0 10 3.536 0" />
        </svg>
        <h3 class="text-base font-bold text-slate-800">주의</h3>
      </div>

      <!-- 내용 -->
      <div class="px-6 py-4">
        <p class="mb-3 text-sm text-slate-700">
          <strong>{currentClient?.name}</strong>의 모든 카테고리와 품목이 <strong>{sourceClient?.name}</strong>의 데이터로 덮어씌워집니다.
        </p>
        <p class="text-sm text-slate-600">
          이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?
        </p>
      </div>

      <!-- 버튼 -->
      <div class="flex shrink-0 gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button
          onclick={cancelCopy}
          class="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          취소
        </button>
        <button
          onclick={confirmCopy}
          class="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600"
        >
          덮어씌우기
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ══════════════════════════════════════════════════════════════
  메인 페이지
══════════════════════════════════════════════════════════════ -->
<div class="h-full flex flex-col overflow-hidden bg-slate-50">

  <!-- ── 상단 헤더 ── -->
  <header class="shrink-0 border-b border-slate-200 bg-white px-8 py-4">
    <div class="flex items-center justify-between gap-4">
      <!-- 좌측: 거래처 선택 버튼 -->
      <button
        onclick={openClientModal}
        class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        {#if selectedClient}
          <span
            class="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold
              {typeBadge[selectedClient.type] ?? 'bg-slate-100 text-slate-600'}"
          >
            {typeLabel[selectedClient.type] ?? selectedClient.type}
          </span>
          <span>{selectedClient.name}</span>
        {:else}
          <span class="text-slate-400">거래처 선택</span>
        {/if}
        <svg class="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- 제목 -->
      <h2 class="flex-1 text-center text-xl font-bold text-slate-800">상품 관리</h2>

      <!-- 우측: 복사 버튼 -->
      <button
        onclick={openCopyModal}
        disabled={!selectedClientId}
        class="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-40"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        복사
      </button>
    </div>
  </header>

  <!-- ── 콘텐츠 영역 ── -->
  <div class="flex flex-1 min-h-0 gap-4 overflow-hidden px-8 py-6">

    <!-- ────────────────────────────────────────────────
      좌측: 카테고리 패널
    ──────────────────────────────────────────────── -->
    <aside class="w-56 shrink-0 flex flex-col min-h-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">

      <!-- 카테고리 추가 영역 -->
      <div class="shrink-0 border-b border-slate-100 px-4 py-3">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">카테고리</p>
        <div class="flex gap-1.5">
          <input
            type="text"
            placeholder="새 카테고리"
            bind:value={newCatInput}
            onkeydown={(e) => e.key === 'Enter' && addCategory()}
            class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
          <button
            onclick={addCategory}
            disabled={!newCatInput.trim()}
            aria-label="카테고리 추가"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white transition-colors hover:bg-sky-600 disabled:opacity-40"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 카테고리 목록 -->
      <ul class="flex-1 min-h-0 overflow-y-auto py-1">
        {#if allCategories.length === 0}
          <li class="px-4 py-8 text-center text-xs text-slate-400">
            카테고리가 없습니다.
          </li>
        {:else}
          {#each allCategories as cat (cat)}
            {@const isActive = effectiveCat === cat}
            <li class="group relative">
              <button
                onclick={() => (selectedCategory = cat)}
                class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors
                  {isActive
                    ? 'border-r-2 border-sky-500 bg-sky-50 font-semibold text-sky-700'
                    : 'text-slate-600 hover:bg-slate-50'}"
              >
                <span class="min-w-0 flex-1 truncate">{catLabel(cat)}</span>
              </button>
              <!-- 삭제 버튼 (group-hover) -->
              <button
                onclick={() => removeCategory(cat)}
                class="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                title="카테고리 삭제"
              >
                🗑
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    </aside>

    <!-- ────────────────────────────────────────────────
      우측: 품목 패널
    ──────────────────────────────────────────────── -->
    <section class="flex flex-1 min-w-0 flex-col min-h-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">

      <!-- 품목 추가 영역 -->
      <div class="shrink-0 border-b border-slate-100 px-6 py-4">
        <div class="mb-3 flex items-center gap-2">
          <span class="text-sm font-semibold text-slate-700">
            {effectiveCat ? catLabel(effectiveCat) : '—'}
          </span>
          <span class="text-xs text-slate-400">품목 추가</span>
        </div>
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="품목명"
            bind:value={newItemName}
            onkeydown={(e) => e.key === 'Enter' && addItem()}
            disabled={!effectiveCat || !selectedClientId}
            class="w-40 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-50"
          />
          <input
            type="text"
            placeholder="단가 (원)"
            bind:value={newItemPrice}
            onkeydown={(e) => e.key === 'Enter' && addItem()}
            disabled={!effectiveCat || !selectedClientId}
            class="w-32 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-50"
          />
          <button
            onclick={addItem}
            disabled={!newItemName.trim() || !effectiveCat || !selectedClientId}
            class="flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:opacity-40"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            추가
          </button>
        </div>
      </div>

      <!-- 품목 테이블 -->
      <div class="flex-1 min-h-0 overflow-y-auto">
        {#if !selectedClientId}
          <div class="flex h-full items-center justify-center">
            <p class="text-sm text-slate-400">거래처를 선택해주세요.</p>
          </div>
        {:else if !effectiveCat}
          <div class="flex h-full items-center justify-center">
            <p class="text-sm text-slate-400">카테고리를 추가해주세요.</p>
          </div>
        {:else if currentItems.length === 0}
          <div class="flex h-full items-center justify-center">
            <p class="text-sm text-slate-400">품목이 없습니다. 위에서 추가하세요.</p>
          </div>
        {:else}
          <table class="w-full border-collapse text-sm">
            <thead class="sticky top-0 bg-slate-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">품목명</th>
                <th class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">단가</th>
                <th class="w-16 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              {#each currentItems as item (item.id)}
                {@const price = selectedClientId && effectiveCat
                  ? store.getUnitPrice(selectedClientId, effectiveCat, item.name)
                  : 0}
                <tr class="group hover:bg-slate-50 transition-colors">
                  <!-- 품목명 -->
                  <td class="px-6 py-3 font-medium text-slate-700">{item.name}</td>

                  <!-- 단가 (인라인 편집) -->
                  <td class="px-6 py-3 text-right">
                    {#if editingItemId === item.id}
                      <input
                        type="text"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        bind:value={editingPriceValue}
                        onkeydown={(e) => handlePriceKeydown(e, item.name)}
                        onblur={() => commitPrice(item.name)}
                        use:autoFocus
                        class="w-28 rounded-lg border border-sky-400 bg-white px-2 py-1 text-right text-sm outline-none ring-2 ring-sky-100"
                      />
                    {:else}
                      <button
                        onclick={() => startEditPrice(item.id, item.name)}
                        class="rounded-lg px-2 py-1 text-right text-slate-600 transition-colors hover:bg-sky-50 hover:text-sky-700"
                        title="클릭하여 단가 편집"
                      >
                        {price > 0 ? price.toLocaleString() + '원' : '—'}
                      </button>
                    {/if}
                  </td>

                  <!-- 삭제 버튼 -->
                  <td class="px-4 py-3 text-center">
                    <button
                      onclick={() => removeItem(item.id, item.name)}
                      class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                      title="품목 삭제"
                    >
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </section>

  </div>
</div>