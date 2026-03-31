<script lang="ts">
  import { store } from '$lib/data/store.svelte';
  import type { AdminUser } from '$lib/data/types';

  // ── 필터 ──────────────────────────────────────────────────────
  let roleFilter = $state<'all' | 'admin' | 'manager'>('all');

  const filteredUsers = $derived(
    store.adminUsers.filter((u) =>
      roleFilter === 'all' ? true : u.role === roleFilter
    )
  );

  // ── 모달 상태 ──────────────────────────────────────────────────
  let showModal = $state(false);
  let editingUser = $state<AdminUser | null>(null);

  // 폼 필드
  let fName     = $state('');
  let fUsername = $state('');
  let fPassword = $state('');
  let fRole     = $state<'admin' | 'manager'>('manager');
  let fEmail    = $state('');
  let fPhone    = $state('');
  let fIsActive = $state(true);

  function openAddModal() {
    editingUser = null;
    fName     = '';
    fUsername = '';
    fPassword = '';
    fRole     = 'manager';
    fEmail    = '';
    fPhone    = '';
    fIsActive = true;
    showModal = true;
  }

  function openEditModal(user: AdminUser) {
    editingUser = user;
    fName     = user.name;
    fUsername = user.username;
    fPassword = '';
    fRole     = user.role;
    fEmail    = user.email ?? '';
    fPhone    = user.phone ?? '';
    fIsActive = user.isActive;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingUser = null;
  }

  function saveUser() {
    if (!fName.trim()) { alert('이름을 입력해주세요.'); return; }
    if (!editingUser && !fUsername.trim()) { alert('아이디를 입력해주세요.'); return; }
    if (!editingUser && !fPassword.trim()) { alert('비밀번호를 입력해주세요.'); return; }

    if (editingUser) {
      // 수정
      const updates: Partial<Omit<AdminUser, 'id' | 'createdAt'>> = {
        name:     fName.trim(),
        role:     fRole,
        email:    fEmail.trim() || undefined,
        phone:    fPhone.trim() || undefined,
        isActive: fIsActive,
      };
      if (fPassword.trim()) {
        updates.passwordHash = fPassword.trim();
      }
      store.updateAdminUser(editingUser.id, updates);
    } else {
      // 등록
      store.addAdminUser({
        username:     fUsername.trim(),
        passwordHash: fPassword.trim(),
        role:         fRole,
        name:         fName.trim(),
        email:        fEmail.trim() || undefined,
        phone:        fPhone.trim() || undefined,
        isActive:     fIsActive,
        lastLoginAt:  undefined,
      });
    }
    closeModal();
  }

  function deleteUser(user: AdminUser) {
    if (user.id === 'admin-001') {
      alert('최고 관리자는 삭제할 수 없습니다.');
      return;
    }
    if (!confirm(`"${user.name}" 사용자를 삭제하시겠습니까?`)) return;
    store.removeAdminUser(user.id);
  }

  function toggleActive(user: AdminUser) {
    store.updateAdminUser(user.id, { isActive: !user.isActive });
  }

  // ── 유틸 ──────────────────────────────────────────────────────
  function formatDate(iso: string) {
    return iso ? iso.slice(0, 10) : '-';
  }

  const roleBadge: Record<string, string> = {
    admin:   'bg-violet-100 text-violet-700',
    manager: 'bg-sky-100 text-sky-700',
  };
  const roleLabel: Record<string, string> = {
    admin:   '관리자',
    manager: '실무자',
  };
</script>

<!-- ───────────────────────────── 페이지 ───────────────────────────── -->
<div class="px-8 py-6 min-h-screen bg-slate-50">

  <!-- 상단 헤더 -->
  <div class="flex items-start justify-between mb-6">
    <div>
      <h2 class="text-xl font-extrabold text-slate-800">사용자 관리</h2>
      <p class="text-sm text-slate-500 mt-0.5">공장 실무자의 시스템 접근 계정을 관리합니다.</p>
    </div>
    <button
      class="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
      onclick={openAddModal}
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
      </svg>
      사용자 추가
    </button>
  </div>

  <!-- 필터 -->
  <div class="flex gap-2 mb-5">
    {#each ([
      { value: 'all',     label: '전체' },
      { value: 'admin',   label: '관리자' },
      { value: 'manager', label: '실무자' },
    ] as const) as f (f.value)}
      <button
        class="px-4 py-1.5 rounded-xl text-sm font-bold border transition-colors
          {roleFilter === f.value
            ? 'bg-sky-600 text-white border-sky-600'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}"
        onclick={() => roleFilter = f.value}
      >
        {f.label}
      </button>
    {/each}
  </div>

  <!-- 테이블 카드 -->
  <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-100 bg-slate-50 text-left">
          <th class="px-5 py-3 text-xs font-bold text-slate-500 whitespace-nowrap">이름</th>
          <th class="px-5 py-3 text-xs font-bold text-slate-500 whitespace-nowrap">아이디</th>
          <th class="px-5 py-3 text-xs font-bold text-slate-500 whitespace-nowrap">역할</th>
          <th class="px-5 py-3 text-xs font-bold text-slate-500 whitespace-nowrap">이메일</th>
          <th class="px-5 py-3 text-xs font-bold text-slate-500 whitespace-nowrap">연락처</th>
          <th class="px-5 py-3 text-xs font-bold text-slate-500 whitespace-nowrap">상태</th>
          <th class="px-5 py-3 text-xs font-bold text-slate-500 whitespace-nowrap">등록일</th>
          <th class="px-5 py-3 text-xs font-bold text-slate-500 whitespace-nowrap">액션</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredUsers as user (user.id)}
          <tr class="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
            <!-- 이름 -->
            <td class="px-5 py-3.5 font-semibold text-slate-800 whitespace-nowrap">
              {user.name}
              {#if user.id === 'admin-001'}
                <span class="ml-1.5 text-[11px] font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-md">최고관리자</span>
              {/if}
            </td>
            <!-- 아이디 -->
            <td class="px-5 py-3.5 text-slate-500 font-mono whitespace-nowrap">{user.username}</td>
            <!-- 역할 -->
            <td class="px-5 py-3.5 whitespace-nowrap">
              <span class="px-2.5 py-1 rounded-lg text-xs font-bold {roleBadge[user.role] ?? ''}">
                {roleLabel[user.role] ?? user.role}
              </span>
            </td>
            <!-- 이메일 -->
            <td class="px-5 py-3.5 text-slate-500 whitespace-nowrap">{user.email ?? '-'}</td>
            <!-- 연락처 -->
            <td class="px-5 py-3.5 text-slate-500 whitespace-nowrap">{user.phone ?? '-'}</td>
            <!-- 상태 + 토글 -->
            <td class="px-5 py-3.5 whitespace-nowrap">
              <div class="flex items-center gap-2">
                <span
                  class="px-2.5 py-1 rounded-lg text-xs font-bold
                    {user.isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'}"
                >
                  {user.isActive ? '활성' : '비활성'}
                </span>
                <!-- 토글 버튼 -->
                <button
                  title="{user.isActive ? '비활성화' : '활성화'}"
                  onclick={() => toggleActive(user)}
                  class="w-10 h-5 rounded-full transition-colors relative flex-shrink-0
                    {user.isActive ? 'bg-emerald-400' : 'bg-slate-300'}"
                >
                  <span
                    class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all
                      {user.isActive ? 'left-5' : 'left-0.5'}"
                  ></span>
                </button>
              </div>
            </td>
            <!-- 등록일 -->
            <td class="px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap">{formatDate(user.createdAt)}</td>
            <!-- 액션 -->
            <td class="px-5 py-3.5 whitespace-nowrap">
              <div class="flex items-center gap-1.5">
                <button
                  class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  onclick={() => openEditModal(user)}
                >수정</button>
                <button
                  class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                    {user.id === 'admin-001'
                      ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                      : 'bg-red-50 hover:bg-red-100 text-red-500'}"
                  disabled={user.id === 'admin-001'}
                  onclick={() => deleteUser(user)}
                >삭제</button>
              </div>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="8" class="px-5 py-12 text-center text-slate-400 text-sm">
              해당하는 사용자가 없습니다.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<!-- ───────────────────────────── 등록/수정 모달 ───────────────────────────── -->
{#if showModal}
  <!-- 백드롭 -->
  <div
    class="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-label="사용자 등록/수정 모달"
    tabindex="-1"
    onkeydown={(e) => { if (e.key === 'Escape') closeModal(); }}
    onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
  >
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md z-50" role="document">
      <!-- 모달 헤더 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 class="text-base font-extrabold text-slate-800">
          {editingUser ? '사용자 수정' : '새 사용자 등록'}
        </h3>
        <button
          class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          onclick={closeModal}
          aria-label="모달 닫기"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- 모달 바디 -->
      <div class="px-6 py-5 space-y-4">

        <!-- 이름 -->
        <div>
          <label for="f-name" class="block text-xs font-bold text-slate-500 mb-1">이름 <span class="text-red-400">*</span></label>
          <input
            id="f-name"
            type="text"
            bind:value={fName}
            placeholder="홍길동"
            class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none"
          />
        </div>

        <!-- 아이디 -->
        <div>
          <label for="f-username" class="block text-xs font-bold text-slate-500 mb-1">아이디 <span class="text-red-400">*</span></label>
          <input
            id="f-username"
            type="text"
            bind:value={fUsername}
            placeholder="user123"
            disabled={!!editingUser}
            class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none
              {editingUser ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}"
          />
        </div>

        <!-- 비밀번호 -->
        <div>
          <label for="f-password" class="block text-xs font-bold text-slate-500 mb-1">비밀번호{editingUser ? '' : ' *'}</label>
          <input
            id="f-password"
            type="password"
            bind:value={fPassword}
            placeholder={editingUser ? '변경 시에만 입력' : '필수'}
            class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none"
          />
        </div>

        <!-- 역할 -->
        <div>
          <p class="block text-xs font-bold text-slate-500 mb-1">역할</p>
          <div class="flex gap-2">
            {#each ([{ value: 'admin', label: '관리자' }, { value: 'manager', label: '실무자' }] as const) as r (r.value)}
              <button
                type="button"
                onclick={() => fRole = r.value}
                class="flex-1 py-2 rounded-xl text-sm font-bold border transition-colors
                  {fRole === r.value
                    ? (r.value === 'admin' ? 'bg-violet-600 text-white border-violet-600' : 'bg-sky-600 text-white border-sky-600')
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}"
              >{r.label}</button>
            {/each}
          </div>
        </div>

        <!-- 이메일 -->
        <div>
          <label for="f-email" class="block text-xs font-bold text-slate-500 mb-1">이메일</label>
          <input
            id="f-email"
            type="email"
            bind:value={fEmail}
            placeholder="example@email.com"
            class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none"
          />
        </div>

        <!-- 연락처 -->
        <div>
          <label for="f-phone" class="block text-xs font-bold text-slate-500 mb-1">연락처</label>
          <input
            id="f-phone"
            type="tel"
            bind:value={fPhone}
            placeholder="010-0000-0000"
            class="border border-slate-200 rounded-xl px-3 py-2.5 w-full text-sm focus:ring-2 focus:ring-sky-300 outline-none"
          />
        </div>

        <!-- 활성화 여부 -->
        <div class="flex items-center gap-3 pt-1">
          <input
            id="isActive"
            type="checkbox"
            bind:checked={fIsActive}
            class="w-4 h-4 rounded accent-sky-600"
          />
          <label for="isActive" class="text-sm font-semibold text-slate-700 cursor-pointer">계정 활성화</label>
        </div>
      </div>

      <!-- 모달 푸터 -->
      <div class="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
        <button
          class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
          onclick={closeModal}
        >취소</button>
        <button
          class="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
          onclick={saveUser}
        >{editingUser ? '저장' : '등록'}</button>
      </div>
    </div>
  </div>
{/if}