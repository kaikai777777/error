<script lang="ts">
  import { store } from '$lib/data/store.svelte';
  import type { Client } from '$lib/data/types';

  let searchQuery = $state('');
  let typeFilter = $state('all');

  const typeFilters = [
    { value: 'all',     label: '전체'   },
    { value: 'hotel',   label: '호텔'   },
    { value: 'pension', label: '펜션'   },
    { value: 'resort',  label: '리조트' },
    { value: 'etc',     label: '기타'   },
  ];

  const filteredClients = $derived(
    store.clients.filter((c) => {
      const matchType   = typeFilter === 'all' || c.type === typeFilter;
      const q           = searchQuery.trim().toLowerCase();
      const matchSearch = !q
        || c.name.toLowerCase().includes(q)
        || (c.ownerName   ?? '').toLowerCase().includes(q)
        || (c.managerName ?? '').toLowerCase().includes(q)
        || (c.businessNo  ?? '').toLowerCase().includes(q)
        || (c.phone       ?? '').toLowerCase().includes(q);
      return matchType && matchSearch;
    })
  );

  const typeLabel = {
    hotel:   '호텔',
    pension: '펜션',
    resort:  '리조트',
    etc:     '기타',
  };

  const typeBadge = {
    hotel:   'bg-sky-100 text-sky-700',
    pension: 'bg-emerald-100 text-emerald-700',
    resort:  'bg-amber-100 text-amber-700',
    etc:     'bg-slate-100 text-slate-600',
  };

  function formatDate(iso) {
    return iso.slice(0, 10);
  }

  let showModal     = $state(false);
  let editingClient = $state<Client | null>(null);
  let formName         = $state('');
  let formType         = $state('hotel');
  let formAddress      = $state('');
  let formPhone        = $state('');
  let formBusinessNo   = $state('');
  let formOwnerName    = $state('');
  let formEmail        = $state('');
  let formManagerName  = $state('');
  let formManagerPhone = $state('');
  let formManagerEmail = $state('');
  let formMemo         = $state('');

  function openAdd() {
    editingClient    = null;
    formName         = '';
    formType         = 'hotel';
    formAddress      = '';
    formPhone        = '';
    formBusinessNo   = '';
    formOwnerName    = '';
    formEmail        = '';
    formManagerName  = '';
    formManagerPhone = '';
    formManagerEmail = '';
    formMemo         = '';
    showModal        = true;
  }

  function openEdit(client) {
    editingClient    = client;
    formName         = client.name;
    formType         = client.type;
    formAddress      = client.address      ?? '';
    formPhone        = client.phone        ?? '';
    formBusinessNo   = client.businessNo   ?? '';
    formOwnerName    = client.ownerName    ?? '';
    formEmail        = client.email        ?? '';
    formManagerName  = client.managerName  ?? '';
    formManagerPhone = client.managerPhone ?? '';
    formManagerEmail = client.managerEmail ?? '';
    formMemo         = client.memo         ?? '';
    showModal        = true;
  }

  function closeModal() { showModal = false; }

  function handleSave() {
    if (!formName.trim()) return;
    const payload = {
      name:         formName.trim(),
      type:         formType,
      address:      formAddress.trim(),
      phone:        formPhone.trim()        || undefined,
      businessNo:   formBusinessNo.trim()   || undefined,
      ownerName:    formOwnerName.trim()    || undefined,
      email:        formEmail.trim()        || undefined,
      managerName:  formManagerName.trim()  || undefined,
      managerPhone: formManagerPhone.trim() || undefined,
      managerEmail: formManagerEmail.trim() || undefined,
      memo:         formMemo.trim()         || undefined,
    };
    if (editingClient) {
      store.updateClient(editingClient.id, payload);
    } else {
      store.addClient(payload);
    }
    closeModal();
  }

  let deleteTargetId = $state(null);
  function openDelete(id) { deleteTargetId = id; }
  function confirmDelete() {
    if (deleteTargetId) store.removeClient(deleteTargetId);
    deleteTargetId = null;
  }
  function cancelDelete() { deleteTargetId = null; }
</script>

<div class="min-h-screen bg-slate-50 px-8 py-6">
  <div class="flex items-center justify-between mb-5">
    <h2 class="text-2xl font-extrabold text-slate-800">거래처 관리</h2>
    <div class="flex items-center gap-3">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" placeholder="거래처명, 담당자, 사업자번호..." bind:value={searchQuery}
          class="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-sky-300 outline-none w-64 shadow-sm" />
      </div>
      <button onclick={openAdd}
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold shadow-sm transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" d="M12 4v16m8-8H4"/>
        </svg>
        거래처 등록
      </button>
    </div>
  </div>

  <div class="flex items-center gap-2 mb-5">
    {#each typeFilters as f (f.value)}
      <button onclick={() => typeFilter = f.value}
        class="px-4 py-2 rounded-xl text-sm font-semibold border transition-colors {typeFilter === f.value ? 'bg-sky-100 text-sky-700 border-sky-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}">
        {f.label}
        {#if f.value !== 'all'}
          <span class="ml-1 text-xs opacity-70">({store.clients.filter(c => c.type === f.value).length})</span>
        {:else}
          <span class="ml-1 text-xs opacity-70">({store.clients.length})</span>
        {/if}
      </button>
    {/each}
  </div>

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <table class="w-full text-sm">
      <thead class="bg-slate-50 border-b border-slate-200">
        <tr>
          <th class="px-4 py-3 text-left text-xs font-bold text-slate-500 w-20">유형</th>
          <th class="px-4 py-3 text-left text-xs font-bold text-slate-500">거래처명</th>
          <th class="px-4 py-3 text-left text-xs font-bold text-slate-500 w-32">사업자번호</th>
          <th class="px-4 py-3 text-left text-xs font-bold text-slate-500 w-24">대표자</th>
          <th class="px-4 py-3 text-left text-xs font-bold text-slate-500 w-24">담당자</th>
          <th class="px-4 py-3 text-left text-xs font-bold text-slate-500 w-36">담당자 연락처</th>
          <th class="px-4 py-3 text-left text-xs font-bold text-slate-500 w-28">등록일</th>
          <th class="px-4 py-3 text-center text-xs font-bold text-slate-500 w-24">액션</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#if filteredClients.length === 0}
          <tr>
            <td colspan="8" class="px-4 py-16 text-center text-slate-400 text-sm">검색 결과가 없습니다.</td>
          </tr>
        {:else}
          {#each filteredClients as client (client.id)}
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3.5">
                <span class="px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap {typeBadge[client.type] ?? ''}">
                  {typeLabel[client.type] ?? client.type}
                </span>
              </td>
              <td class="px-4 py-3.5 font-semibold text-slate-800">{client.name}</td>
              <td class="px-4 py-3.5 text-slate-600">{client.businessNo ?? '—'}</td>
              <td class="px-4 py-3.5 text-slate-600">{client.ownerName ?? '—'}</td>
              <td class="px-4 py-3.5 text-slate-600">{client.managerName ?? '—'}</td>
              <td class="px-4 py-3.5 text-slate-600">{client.managerPhone ?? '—'}</td>
              <td class="px-4 py-3.5 text-slate-500 text-xs">{formatDate(client.createdAt)}</td>
              <td class="px-4 py-3.5">
                <div class="flex items-center justify-center gap-3">
                  <button onclick={() => openEdit(client)} class="text-sky-600 hover:text-sky-800 text-xs font-semibold">수정</button>
                  <span class="text-slate-200">|</span>
                  <button onclick={() => openDelete(client.id)} class="text-red-500 hover:text-red-700 text-xs font-semibold">삭제</button>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>

{#if showModal}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
    role="presentation" onmousedown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto p-6 mt-8 mb-8">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-extrabold text-slate-800">{editingClient ? '거래처 수정' : '거래처 등록'}</h3>
        <button onclick={closeModal} aria-label="닫기" class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" d="M6 18 18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <form onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div class="grid grid-cols-2 gap-x-4 gap-y-4">
          <div class="col-span-2">
            <label for="cName" class="block text-xs font-bold text-slate-500 mb-1">거래처명 *</label>
            <input id="cName" type="text" bind:value={formName} placeholder="예) 그랜드 호텔"
              class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none" />
          </div>
          <div class="col-span-2">
            <p class="text-xs font-bold text-slate-500 mb-1">유형</p>
            <div class="flex gap-2 flex-wrap">
              {#each typeFilters.filter(f => f.value !== 'all') as f (f.value)}
                <button type="button" onclick={() => formType = f.value}
                  class="px-4 py-1.5 rounded-xl text-sm font-bold whitespace-nowrap border transition-colors {formType === f.value ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">
                  {f.label}
                </button>
              {/each}
            </div>
          </div>
          <div class="col-span-2">
            <label for="cAddr" class="block text-xs font-bold text-slate-500 mb-1">주소</label>
            <input id="cAddr" type="text" bind:value={formAddress} placeholder="주소를 입력하세요"
              class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none" />
          </div>
          <div>
            <label for="cPhone" class="block text-xs font-bold text-slate-500 mb-1">전화번호</label>
            <input id="cPhone" type="text" bind:value={formPhone} placeholder="02-0000-0000"
              class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none" />
          </div>
          <div>
            <label for="cBizNo" class="block text-xs font-bold text-slate-500 mb-1">사업자번호</label>
            <input id="cBizNo" type="text" bind:value={formBusinessNo} placeholder="000-00-00000"
              class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none" />
          </div>
          <div>
            <label for="cOwner" class="block text-xs font-bold text-slate-500 mb-1">대표자명</label>
            <input id="cOwner" type="text" bind:value={formOwnerName} placeholder="홍길동"
              class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none" />
          </div>
          <div>
            <label for="cEmail" class="block text-xs font-bold text-slate-500 mb-1">거래처 이메일</label>
            <input id="cEmail" type="email" bind:value={formEmail} placeholder="info@hotel.com"
              class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none" />
          </div>
          <div>
            <label for="cMgrName" class="block text-xs font-bold text-slate-500 mb-1">담당자명</label>
            <input id="cMgrName" type="text" bind:value={formManagerName} placeholder="김담당"
              class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none" />
          </div>
          <div>
            <label for="cMgrPhone" class="block text-xs font-bold text-slate-500 mb-1">담당자 연락처</label>
            <input id="cMgrPhone" type="text" bind:value={formManagerPhone} placeholder="010-0000-0000"
              class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none" />
          </div>
          <div>
            <label for="cMgrEmail" class="block text-xs font-bold text-slate-500 mb-1">담당자 이메일</label>
            <input id="cMgrEmail" type="email" bind:value={formManagerEmail} placeholder="manager@hotel.com"
              class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none" />
          </div>
          <div class="col-span-2">
            <label for="cMemo" class="block text-xs font-bold text-slate-500 mb-1">메모</label>
            <textarea id="cMemo" bind:value={formMemo} rows="3" placeholder="특이사항을 입력하세요"
              class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none resize-none"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
          <button type="button" onclick={closeModal}
            class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold">취소</button>
          <button type="submit"
            class="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-bold">
            {editingClient ? '저장' : '등록'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if deleteTargetId}
  {@const target = store.clients.find(c => c.id === deleteTargetId)}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
    role="presentation" onmousedown={(e) => { if (e.target === e.currentTarget) cancelDelete(); }}>
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
      <h3 class="text-base font-extrabold text-slate-800 mb-2">거래처 삭제</h3>
      <p class="text-sm text-slate-600 mb-6">
        <span class="font-bold text-red-600">{target?.name}</span> 거래처를 삭제하시겠습니까?<br/>
        <span class="text-xs text-slate-400">관련 세탁물 데이터가 모두 삭제됩니다.</span>
      </p>
      <div class="flex justify-end gap-2">
        <button onclick={cancelDelete}
          class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold">취소</button>
        <button onclick={confirmDelete}
          class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold">삭제</button>
      </div>
    </div>
  </div>
{/if}
