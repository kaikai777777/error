<script lang="ts">
  import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
  import type { LaundryCategory } from '$lib/data/types';

  // ── 탭 & 필터 ────────────────────────────────────────────────
  type Cat = Exclude<LaundryCategory, 'all'>;

  const categories: Cat[] = ['towel', 'sheet', 'uniform'];

  let selectedCategory = $state<Cat>('towel');

  // 선택된 카테고리의 unique 품목명 목록
  const categoryItems = $derived(store.getCategoryItems(selectedCategory));

  // ── 새 품목 추가 폼 ──────────────────────────────────────────
  let addCat = $state<Cat>('towel');
  let addName = $state('');
  let addMode = $state<'all' | 'specific'>('all');
  let selectedClientIds = $state<string[]>([]);
  let successMsg = $state('');
  let errorMsg = $state('');

  function toggleClient(id: string) {
    if (selectedClientIds.includes(id)) {
      selectedClientIds = selectedClientIds.filter((x) => x !== id);
    } else {
      selectedClientIds = [...selectedClientIds, id];
    }
  }

  function showToast(msg: string, isError = false) {
    if (isError) {
      errorMsg = msg;
      setTimeout(() => (errorMsg = ''), 3000);
    } else {
      successMsg = msg;
      setTimeout(() => (successMsg = ''), 3000);
    }
  }

  function handleAdd() {
    const name = addName.trim();
    if (!name) {
      showToast('품목명을 입력해주세요.', true);
      return;
    }

    if (addMode === 'all') {
      const added = store.addLaundryItemTypeToAll(addCat, name);
      if (added.length === 0) {
        showToast(`'${name}' 품목은 이미 전체 거래처에 등록되어 있습니다.`, true);
      } else {
        showToast(`'${name}' 품목을 ${added.length}개 거래처에 추가했습니다.`);
        addName = '';
      }
    } else {
      if (selectedClientIds.length === 0) {
        showToast('거래처를 1개 이상 선택해주세요.', true);
        return;
      }
      let addedCount = 0;
      let skippedCount = 0;
      for (const cid of selectedClientIds) {
        const result = store.addLaundryItemType(cid, addCat, name);
        if (result) addedCount++;
        else skippedCount++;
      }
      if (addedCount === 0) {
        showToast(`'${name}' 품목은 선택한 거래처 모두에 이미 등록되어 있습니다.`, true);
      } else {
        const msg =
          skippedCount > 0
            ? `'${name}' 품목을 ${addedCount}개 거래처에 추가했습니다. (${skippedCount}개 거래처는 이미 존재)`
            : `'${name}' 품목을 ${addedCount}개 거래처에 추가했습니다.`;
        showToast(msg);
        addName = '';
        selectedClientIds = [];
      }
    }
  }
</script>

<div class="min-h-screen bg-slate-50 px-8 py-6">
  <!-- 헤더 -->
  <div class="mb-6">
    <h2 class="text-2xl font-extrabold text-slate-800">상품 관리</h2>
    <p class="mt-1 text-sm text-slate-500">카테고리별 세탁 품목을 관리하고 거래처에 추가합니다.</p>
  </div>

  <!-- 메인 그리드: 왼쪽(품목 현황) + 오른쪽(추가 폼) -->
  <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">

    <!-- ── 왼쪽: 품목 현황 + 거래처별 표 ────────────────────── -->
    <div class="flex flex-col gap-6 xl:col-span-2">

      <!-- 섹션 1: 품목 현황 -->
      <div class="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div class="border-b border-slate-100 px-6 py-4">
          <h3 class="text-base font-bold text-slate-700">📦 품목 현황</h3>
        </div>

        <!-- 카테고리 탭 -->
        <div class="flex gap-2 border-b border-slate-100 px-6 pt-4 pb-0">
          {#each categories as cat (cat)}
            <button
              class="rounded-t-lg px-4 py-2 text-sm font-bold transition-colors duration-150
                {selectedCategory === cat
                  ? 'border-b-2 border-sky-600 text-sky-600'
                  : 'text-slate-400 hover:text-slate-600'}"
              onclick={() => (selectedCategory = cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          {/each}
        </div>

        <!-- 품목 테이블 -->
        <div class="p-6">
          {#if categoryItems.length === 0}
            <div class="py-10 text-center text-sm text-slate-400">
              등록된 품목이 없습니다.
            </div>
          {:else}
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-100 text-left">
                  <th class="pb-3 text-xs font-bold text-slate-500">품목명</th>
                  <th class="pb-3 text-xs font-bold text-slate-500">등록 거래처 수</th>
                  <th class="pb-3 text-xs font-bold text-slate-500">비고</th>
                </tr>
              </thead>
              <tbody>
                {#each categoryItems as itemName (itemName)}
                  {@const count = store.laundryItems.filter(
                    (i) => i.name === itemName && i.category === selectedCategory
                  ).length}
                  {@const totalClients = store.clients.length}
                  <tr class="border-b border-slate-50 hover:bg-slate-50">
                    <td class="py-3 font-medium text-slate-700">{itemName}</td>
                    <td class="py-3">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-slate-800">{count}</span>
                        <span class="text-slate-400">/ {totalClients}개</span>
                        <div class="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div
                            class="h-full rounded-full bg-sky-400 transition-all"
                            style="width: {totalClients > 0 ? (count / totalClients) * 100 : 0}%"
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3">
                      {#if count === totalClients}
                        <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">전체 등록</span>
                      {:else if count === 0}
                        <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-500">미등록</span>
                      {:else}
                        <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-600">일부 등록</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      </div>

      <!-- 섹션 3: 거래처별 품목 현황 표 -->
      <div class="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div class="border-b border-slate-100 px-6 py-4">
          <h3 class="text-base font-bold text-slate-700">🏢 거래처별 등록 품목 수</h3>
        </div>
        <div class="overflow-x-auto p-6">
          {#if store.clients.length === 0}
            <div class="py-10 text-center text-sm text-slate-400">거래처가 없습니다.</div>
          {:else}
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-100 text-left">
                  <th class="pb-3 text-xs font-bold text-slate-500">거래처명</th>
                  <th class="pb-3 text-center text-xs font-bold text-slate-500">타올</th>
                  <th class="pb-3 text-center text-xs font-bold text-slate-500">시트</th>
                  <th class="pb-3 text-center text-xs font-bold text-slate-500">유니폼</th>
                  <th class="pb-3 text-center text-xs font-bold text-slate-500">합계</th>
                </tr>
              </thead>
              <tbody>
                {#each store.clients as client (client.id)}
                  {@const towelCount = store.laundryItems.filter(
                    (i) => i.clientId === client.id && i.category === 'towel'
                  ).length}
                  {@const sheetCount = store.laundryItems.filter(
                    (i) => i.clientId === client.id && i.category === 'sheet'
                  ).length}
                  {@const uniformCount = store.laundryItems.filter(
                    (i) => i.clientId === client.id && i.category === 'uniform'
                  ).length}
                  {@const total = towelCount + sheetCount + uniformCount}
                  <tr class="border-b border-slate-50 hover:bg-slate-50">
                    <td class="py-3 font-medium text-slate-700">{client.name}</td>
                    <td class="py-3 text-center">
                      <span class="font-bold text-slate-700">{towelCount}</span>
                    </td>
                    <td class="py-3 text-center">
                      <span class="font-bold text-slate-700">{sheetCount}</span>
                    </td>
                    <td class="py-3 text-center">
                      <span class="font-bold text-slate-700">{uniformCount}</span>
                    </td>
                    <td class="py-3 text-center">
                      <span class="inline-flex items-center justify-center rounded-lg bg-sky-50 px-3 py-0.5 font-extrabold text-sky-700">
                        {total}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr class="border-t-2 border-slate-200 bg-slate-50">
                  <td class="py-3 text-xs font-bold text-slate-500">합계</td>
                  {#each (['towel', 'sheet', 'uniform'] as Cat[]) as cat (cat)}
                    {@const sum = store.clients.reduce(
                      (acc, c) =>
                        acc +
                        store.laundryItems.filter(
                          (i) => i.clientId === c.id && i.category === cat
                        ).length,
                      0
                    )}
                    <td class="py-3 text-center text-xs font-bold text-slate-600">{sum}</td>
                  {/each}
                  <td class="py-3 text-center text-xs font-extrabold text-sky-700">{store.clients.reduce((acc, c) => acc + store.laundryItems.filter((i) => i.clientId === c.id).length, 0)}</td>
                </tr>
              </tfoot>
            </table>
          {/if}
        </div>
      </div>
    </div>

    <!-- ── 오른쪽: 새 품목 추가 카드 ────────────────────────── -->
    <div class="xl:col-span-1">
      <div class="sticky top-6 rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div class="border-b border-slate-100 px-6 py-4">
          <h3 class="text-base font-bold text-slate-700">➕ 새 품목 추가</h3>
        </div>
        <div class="p-6">

          <!-- 토스트 메시지 -->
          {#if successMsg}
            <div class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              ✅ {successMsg}
            </div>
          {/if}
          {#if errorMsg}
            <div class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              ⚠️ {errorMsg}
            </div>
          {/if}

          <!-- 카테고리 선택 -->
          <div class="mb-4">
            <p class="mb-1 text-xs font-bold text-slate-500">카테고리</p>
            <div class="flex gap-2">
              {#each categories as cat (cat)}
                <button
                  class="flex-1 rounded-xl py-2 text-sm font-bold transition-colors
                    {addCat === cat
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                  onclick={() => (addCat = cat)}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              {/each}
            </div>
          </div>

          <!-- 품목명 입력 -->
          <div class="mb-4">
            <label for="addName" class="mb-1 block text-xs font-bold text-slate-500">
              품목명 <span class="text-red-400">*</span>
            </label>
            <input
              id="addName"
              type="text"
              bind:value={addName}
              placeholder="예) 목욕타올, 베개커버 등"
              class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-300"
              onkeydown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>

          <!-- 추가 방식 선택 -->
          <div class="mb-4">
            <p class="mb-2 text-xs font-bold text-slate-500">추가 방식</p>
            <div class="flex gap-2">
              <button
                class="flex-1 rounded-xl py-2 text-sm font-bold transition-colors
                  {addMode === 'all'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                onclick={() => (addMode = 'all')}
              >
                전체 거래처
              </button>
              <button
                class="flex-1 rounded-xl py-2 text-sm font-bold transition-colors
                  {addMode === 'specific'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                onclick={() => (addMode = 'specific')}
              >
                특정 거래처
              </button>
            </div>
          </div>

          <!-- 특정 거래처 선택 목록 -->
          {#if addMode === 'specific'}
            <div class="mb-4 max-h-52 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
              {#if store.clients.length === 0}
                <p class="text-center text-xs text-slate-400">등록된 거래처가 없습니다.</p>
              {:else}
                <div class="mb-2 flex items-center gap-2">
                  <button
                    class="text-xs font-bold text-sky-600 hover:underline"
                    onclick={() => (selectedClientIds = store.clients.map((c) => c.id))}
                  >
                    전체 선택
                  </button>
                  <span class="text-slate-300">|</span>
                  <button
                    class="text-xs font-bold text-slate-500 hover:underline"
                    onclick={() => (selectedClientIds = [])}
                  >
                    전체 해제
                  </button>
                  <span class="ml-auto text-xs text-slate-400">
                    {selectedClientIds.length}/{store.clients.length} 선택
                  </span>
                </div>
                {#each store.clients as client (client.id)}
                  <label
                    class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClientIds.includes(client.id)}
                      onchange={() => toggleClient(client.id)}
                      class="h-4 w-4 rounded accent-sky-500"
                    />
                    <span class="font-medium text-slate-700">{client.name}</span>
                  </label>
                {/each}
              {/if}
            </div>
          {/if}

          <!-- 추가 버튼 -->
          <button
            class="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            onclick={handleAdd}
            disabled={!addName.trim() || (addMode === 'specific' && selectedClientIds.length === 0)}
          >
            품목 추가
          </button>

          <!-- 안내 문구 -->
          <p class="mt-3 text-xs leading-relaxed text-slate-400">
            {#if addMode === 'all'}
              ℹ️ 현재 등록된 모든 거래처에 해당 품목이 추가됩니다.
            {:else}
              ℹ️ 선택한 거래처에만 해당 품목이 추가됩니다.
            {/if}
          </p>
        </div>
      </div>
    </div>
  </div>
</div>