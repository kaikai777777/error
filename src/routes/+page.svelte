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
      badge: 'bg-orange-100 text-orange-700',
      dot: 'bg-orange-400',
      ring: 'ring-orange-200',
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
      badge: 'bg-sky-100 text-sky-700',
      dot: 'bg-sky-400',
      ring: 'ring-sky-200',
      icon: '🗂️',
      tag: '패널형',
      tagColor: 'bg-sky-100 text-sky-700',
    },
  ];

  let hovered = $state<string | null>(null);
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
      <div class="ml-auto flex items-center gap-2">
        <span class="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
          <span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
          터치 디스플레이 최적화
        </span>
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

    <!-- 카드 2개 가로 배치 -->
    <div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
      {#each themes as theme}
        <button
          class="group text-left rounded-3xl border-2 transition-all duration-300 overflow-hidden cursor-pointer
            {hovered === theme.id
              ? 'border-slate-300 shadow-2xl scale-[1.02] bg-white'
              : 'border-slate-200 bg-white shadow-md hover:shadow-xl'}"
          onmouseenter={() => hovered = theme.id}
          onmouseleave={() => hovered = null}
          onclick={() => goto(theme.path)}
        >
          <!-- UI 미리보기 -->
          <div class="p-5 pb-3">
            <div class="rounded-2xl overflow-hidden h-44 {theme.previewBg} border border-slate-100 flex flex-col gap-1.5 p-2.5">
              <!-- 상단 바 (헤더 or 내비) -->
              <div class="flex gap-1.5 h-7 shrink-0">
                <div class="{theme.previewBar} rounded-lg w-8 opacity-80"></div>
                <div class="flex-1 {theme.previewSub} rounded-lg opacity-70 flex items-center gap-1 px-2">
                  {#each [0,1,2,3] as _}
                    <div class="flex-1 {theme.previewBar} rounded opacity-50 h-2"></div>
                  {/each}
                </div>
              </div>
              <!-- 중앙 영역 -->
              <div class="flex-1 flex gap-1.5">
                <!-- 사이드 패널 -->
                <div class="{theme.previewBar} rounded-xl w-14 opacity-40 flex flex-col gap-1 p-1.5">
                  {#each [0,1,2,3,4] as _}
                    <div class="h-1.5 bg-white rounded opacity-70"></div>
                  {/each}
                </div>
                <!-- 컨텐츠 -->
                <div class="flex-1 flex flex-col gap-1.5">
                  <div class="{theme.previewLight} rounded-xl flex-1 p-1.5 grid grid-cols-2 gap-1">
                    {#each [0,1,2,3,4,5] as i}
                      <div class="rounded-lg {i < 2 ? theme.previewSub : 'bg-white'} opacity-80"></div>
                    {/each}
                  </div>
                  <div class="{theme.previewSub} rounded-xl h-8 flex gap-1 p-1.5 items-center">
                    {#each [0,1] as _}
                      <div class="flex-1 {theme.previewBar} rounded-md h-4 opacity-60"></div>
                    {/each}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 카드 정보 -->
          <div class="px-5 pb-5">
            <!-- 태그 + 아이콘 -->
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

            <!-- 설명 -->
            <p class="text-sm text-slate-500 leading-relaxed mb-4">{theme.description}</p>

            <!-- 특징 -->
            <ul class="grid grid-cols-2 gap-x-2 gap-y-1.5 mb-5">
              {#each theme.features as f}
                <li class="flex items-center gap-1.5 text-sm text-slate-600">
                  <span class="w-1.5 h-1.5 rounded-full {theme.dot} shrink-0"></span>
                  {f}
                </li>
              {/each}
            </ul>

            <!-- 버튼 -->
            <div class="w-full py-3.5 rounded-2xl {theme.accent} {theme.accentHover} text-white font-bold text-base text-center
              transition-all duration-200 shadow-md group-hover:shadow-lg group-hover:-translate-y-0.5">
              이 테마로 시작하기 →
            </div>
          </div>
        </button>
      {/each}
    </div>

    <!-- 하단 안내 -->
    <div class="mt-10 text-center">
      <p class="text-sm text-slate-400">거래처별 세탁물 재고 관리 · 출고 신청 · 불량 처리 · 출고 현황</p>
      <p class="text-xs text-slate-300 mt-1">언제든지 이 페이지로 돌아와 테마를 변경할 수 있습니다.</p>
    </div>

  </main>
</div>