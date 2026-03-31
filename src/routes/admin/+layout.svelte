<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { store } from '$lib/data/store.svelte';

	let { children } = $props();

	const navItems = [
		{ emoji: '📊', label: '대시보드', path: '/admin', exact: true },
		{ emoji: '🏢', label: '거래처 관리', path: '/admin/clients', exact: false },
		{ emoji: '📦', label: '상품 관리', path: '/admin/products', exact: false },
		{ emoji: '👥', label: '사용자 관리', path: '/admin/users', exact: false },
		{ emoji: '💬', label: '메모 확인', path: '/admin/memos', exact: false, badge: true },
		{ emoji: '📋', label: '입출고 관리', path: '/admin/inout', exact: false },
		{ emoji: '📈', label: '통계', path: '/admin/stats', exact: false },
		{ emoji: '🧾', label: '청구서 관리', path: '/admin/billing', exact: false },
	];

	function isActive(nav: { path: string; exact: boolean }): boolean {
		const pathname = page.url.pathname;
		if (nav.exact) {
			return pathname === nav.path;
		}
		return pathname === nav.path || pathname.startsWith(nav.path + '/');
	}
</script>

<div class="flex h-screen overflow-hidden">
	<!-- 사이드바 -->
	<aside class="flex w-56 shrink-0 flex-col bg-slate-900">
		<!-- 로고 -->
		<div class="px-4 py-5 border-b border-slate-700">
			<div class="flex items-center gap-2">
				<span class="text-2xl">🧺</span>
				<div>
					<p class="text-xs font-bold text-slate-400 leading-none tracking-wide">ADMIN</p>
					<p class="text-sm font-extrabold text-white leading-tight">세탁 관리자<br />시스템</p>
				</div>
			</div>
		</div>

		<!-- 네비게이션 메뉴 -->
		<nav class="flex-1 overflow-y-auto py-2">
			{#each navItems as nav (nav.path)}
				<button
					class="flex min-h-[48px] w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm font-medium transition-colors duration-150
						{isActive(nav)
							? 'bg-slate-700 text-white'
							: 'text-slate-400 hover:bg-slate-800 hover:text-white'}"
					onclick={() => void goto(nav.path)}
				>
					<span class="text-base">{nav.emoji}</span>
					<span class="flex-1">{nav.label}</span>
					{#if nav.badge && store.unreadMemoCount > 0}
						<span
							class="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white"
						>
							{store.unreadMemoCount}
						</span>
					{/if}
				</button>
			{/each}
		</nav>

		<!-- 하단 현장 화면 버튼 -->
		<div class="mt-auto border-t border-slate-700 p-3">
			<button
				class="flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors duration-150 hover:bg-slate-800 hover:text-white"
				onclick={() => void goto('/theme-b')}
			>
				<svg
					class="h-4 w-4 shrink-0"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M10 19l-7-7m0 0l7-7m-7 7h18"
					/>
				</svg>
				<span>현장 화면으로</span>
			</button>
		</div>
	</aside>

	<!-- 우측 콘텐츠 -->
	<main class="flex-1 overflow-y-auto bg-slate-50">
		{@render children()}
	</main>
</div>