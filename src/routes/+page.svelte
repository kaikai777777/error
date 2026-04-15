<script lang="ts">
  import { goto } from '$app/navigation';

  const themes = [
    {
      id: 'a',
      path: '/theme-a',
      name: 'Warm Dashboard',
      subtitle: '대시보드형 UI',
      description: '따뜻한 베이지 & 오렌지 계열. 상단 헤더 네비와 카드 그리드로 한눈에 현황을 파악하는 대시보드 스타일.',
      features: ['상단 헤더 네비게이션', '카드 그리드 레이아웃', '대형 수치 강조', '따뜻한 색감'],
      accent: 'bg-orange-500',
      accentHover: 'hover:bg-orange-600',
      previewBg: 'bg-orange-50',
      previewBar: 'bg-orange-400',
      previewSub: 'bg-orange-200',
      previewLight: 'bg-orange-100',
      dot: 'bg-orange-400',
      icon: '🌅',
      tag: '대시보드',
      tagColor: 'bg-orange-100 text-orange-700',
    },
    {
      id: 'b',
      path: '/theme-b',
      name: 'Side Panel',
      subtitle: '사이드 패널형 UI',
      description: '안정적인 스카이블루 & 화이트 계열. 좌측 고정 패널 구조로 거래처 전환이 빠르고 업무 흐름이 명확한 스타일.',
      features: ['5단 고정 패널 구조', '아이콘 사이드 내비', '리스트 행 방식', '빠른 거래처 전환'],
      accent: 'bg-sky-500',
      accentHover: 'hover:bg-sky-600',
      previewBg: 'bg-sky-50',
      previewBar: 'bg-sky-500',
      previewSub: 'bg-sky-200',
      previewLight: 'bg-sky-100',
      dot: 'bg-sky-400',
      icon: '🗂️',
      tag: '패널형',
      tagColor: 'bg-sky-100 text-sky-700',
    },
  ];

  let hovered = $state<string | null>(null);
  let adminHovered = $state(false);
</script>

<svelte:head>
  <title>세탁물 관리 시스템</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 flex flex-col">

  <!-- 상단 헤더 -->
  <header class="bg-white border-b border-slate-200 shadow-sm">
    <div class="max-w-5xl mx-auto px-8 py-5 flex items-center gap-4">
      <div class="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center shadow-md shrink-0">
        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"/>
        </svg>
      </div>
      <div>
        <p class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Laundry Management System</p>
        <h1 class="text-xl font-extrabold text-slate-800 leading-tight">세탁물 관리 시스템</h1>
      </div>
      <div class="ml-auto flex items-center gap-3">
        <span class="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
          <span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
          터치 디스플레이 최적화
        </span>
        <!-- 관리자 페이지 바로가기 (헤더 우측) -->
        <button
          onclick={() => void goto('/admin/clients')}
          class="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 px-3 py-1.5 rounded-full transition-all duration-200 font-medium"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          관리자
        </button>
      </div>
    </div>
  </header>

  <!-- 메인 -->
  <main class="flex-1 flex flex-col items-center justify-center px-8 py-12">

    <!-- 타이틀 -->
    <div class="text-center mb-10">
      <h2 class="text-2xl font-extrabold text-slate-800 mb-2">UI 테마를 선택하세요</h2>
      <p class="text-slate-500 text-base">두 가지 화면 구성 중 편한 스타일을 고르세요. 기능은 동일합니다.</p>
    </div>

    <!-- 현장용 테마 카드 2개 -->
    <div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
      {#each themes as theme}
        <button
          class="group text-left rounded-3xl border-2 transition-all duration-300 overflow-hidden cursor-pointer
            {hovered === theme.id
              ? 'border-slate-300 shadow-2xl scale-[1.02] bg-white'
              : 'border-slate-200 bg-white shadow-md hover:shadow-xl'}"
          onmouseenter={() => hovered = theme.id}
          onmouseleave={() => hovered = null}
          onclick={() => void goto(theme.path)}
        >
          <!-- UI 미리보기 -->
          <div class="p-5 pb-3">
            <div class="rounded-2xl overflow-hidden h-44 {theme.previewBg} border border-slate-100 flex flex-col gap-1.5 p-2.5">
              <div class="flex gap-1.5 h-7 shrink-0">
                <div class="{theme.previewBar} rounded-lg w-8 opacity-80"></div>
                <div class="flex-1 {theme.previewSub} rounded-lg opacity-70 flex items-center gap-1 px-2">
                  {#each [0,1,2,3] as _, i (i)}
                    <div class="flex-1 {theme.previewBar} rounded opacity-50 h-2"></div>
                  {/each}
                </div>
              </div>
              <div class="flex-1 flex gap-1.5">
                <div class="{theme.previewBar} rounded-xl w-14 opacity-40 flex flex-col gap-1 p-1.5">
                  {#each [0,1,2,3,4] as _, i (i)}
                    <div class="h-1.5 bg-white rounded opacity-70"></div>
                  {/each}
                </div>
                <div class="flex-1 flex flex-col gap-1.5">
                  <div class="{theme.previewLight} rounded-xl flex-1 p-1.5 grid grid-cols-2 gap-1">
                    {#each [0,1,2,3,4,5] as i (i)}
                      <div class="rounded-lg {i < 2 ? theme.previewSub : 'bg-white'} opacity-80"></div>
                    {/each}
                  </div>
                  <div class="{theme.previewSub} rounded-xl h-8 flex gap-1 p-1.5 items-center">
                    {#each [0,1] as _, i (i)}
                      <div class="flex-1 {theme.previewBar} rounded-md h-4 opacity-60"></div>
                    {/each}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 카드 정보 -->
          <div class="px-5 pb-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl {theme.accent} flex items-center justify-center text-2xl shadow-md">
                  {theme.icon}
                </div>
                <div>
                  <p class="text-[11px] font-bold text-slate-400 tracking-widest uppercase">{theme.subtitle}</p>
                  <h3 class="text-lg font-extrabold text-slate-800">{theme.name}</h3>
                </div>
              </div>
              <span class="text-xs font-bold px-3 py-1.5 rounded-full {theme.tagColor}">
                {theme.tag}
              </span>
            </div>

            <p class="text-sm text-slate-500 leading-relaxed mb-4">{theme.description}</p>

            <ul class="grid grid-cols-2 gap-x-2 gap-y-1.5 mb-5">
              {#each theme.features as f (f)}
                <li class="flex items-center gap-1.5 text-sm text-slate-600">
                  <span class="w-1.5 h-1.5 rounded-full {theme.dot} shrink-0"></span>
                  {f}
                </li>
              {/each}
            </ul>

            <div class="w-full py-3.5 rounded-2xl {theme.accent} {theme.accentHover} text-white font-bold text-base text-center
              transition-all duration-200 shadow-md group-hover:shadow-lg group-hover:-translate-y-0.5">
              이 테마로 시작하기 →
            </div>
          </div>
        </button>
      {/each}
    </div>

    <!-- 관리자 페이지 진입 카드 -->
    <div class="w-full max-w-4xl mt-6">
      <button
        class="w-full group text-left rounded-3xl border-2 transition-all duration-300 overflow-hidden cursor-pointer
          {adminHovered
            ? 'border-slate-400 shadow-2xl scale-[1.005] bg-slate-900'
            : 'border-slate-700 bg-slate-800 shadow-md hover:shadow-xl'}"
        onmouseenter={() => adminHovered = true}
        onmouseleave={() => adminHovered = false}
        onclick={() => void goto('/admin/clients')}
      >
        <div class="px-8 py-6 flex items-center gap-6">
          <!-- 아이콘 -->
          <div class="w-14 h-14 rounded-2xl bg-slate-700 group-hover:bg-slate-600 flex items-center justify-center shrink-0 transition-colors duration-200 shadow-lg">
            <svg class="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>

          <!-- 텍스트 -->
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-1">
              <p class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Admin Console</p>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">관리자 전용</span>
            </div>
            <h3 class="text-lg font-extrabold text-white">관리자 페이지</h3>
            <p class="text-sm text-slate-400 mt-1">거래처 · 상품 · 사용자 관리 / 입출고 현황 / 통계</p>
          </div>

          <!-- 특징 목록 -->
          <div class="hidden md:grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-400 shrink-0">
            {#each ['거래처 등록·관리', '상품 관리', '사용자 계정 관리', '메모 확인', '입출고 현황', '통계·분석'] as f (f)}
              <span class="flex items-center gap-1.5">
                <span class="w-1 h-1 rounded-full bg-slate-500"></span>
                {f}
              </span>
            {/each}
          </div>

          <!-- 화살표 -->
          <div class="shrink-0 ml-4">
            <div class="w-10 h-10 rounded-xl bg-slate-700 group-hover:bg-slate-600 flex items-center justify-center transition-colors duration-200">
              <svg class="w-5 h-5 text-slate-300 group-hover:translate-x-0.5 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        </div>
      </button>
    </div>

    <!-- 하단 안내 -->
    <div class="mt-8 text-center">
      <p class="text-sm text-slate-400">거래처별 세탁물 재고 관리 · 출고 처리 · 출고 현황</p>
      <p class="text-xs text-slate-300 mt-1">언제든지 이 페이지로 돌아와 테마를 변경할 수 있습니다.</p>
    </div>

  </main>
</div>