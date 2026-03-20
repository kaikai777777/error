<script lang="ts">
  import { goto } from '$app/navigation';

  const themes = [
    {
      id: 'a',
      path: '/theme-a',
      name: 'Clean Card',
      subtitle: '클린 카드형 UI',
      description: '카드 기반의 깔끔한 레이아웃. 민트 & 화이트 계열로 청결함을 강조한 직관적인 인터페이스.',
      features: ['카드 그리드 레이아웃', '탭 상단 배치', '상태 배지 강조', '터치 최적화 버튼'],
      color: {
        bg: 'bg-emerald-50',
        card: 'bg-white',
        accent: 'bg-emerald-500',
        accentHover: 'hover:bg-emerald-600',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-400',
        shadow: 'shadow-emerald-100',
        badge: 'bg-emerald-100 text-emerald-800',
        btnText: 'text-white',
        preview1: 'bg-emerald-400',
        preview2: 'bg-emerald-200',
        preview3: 'bg-emerald-100',
      },
      icon: '🧺',
      tag: '추천',
    },
    {
      id: 'b',
      path: '/theme-b',
      name: 'Side Panel',
      subtitle: '사이드 패널형 UI',
      description: '좌측 고정 사이드바와 우측 패널이 분리된 구조. 블루 & 화이트 계열의 안정적인 업무 환경.',
      features: ['고정 사이드바 내비게이션', '패널 분리형 구조', '아이콘 강조 디자인', '빠른 거래처 전환'],
      color: {
        bg: 'bg-sky-50',
        card: 'bg-white',
        accent: 'bg-sky-500',
        accentHover: 'hover:bg-sky-600',
        text: 'text-sky-700',
        border: 'border-sky-200',
        dot: 'bg-sky-400',
        shadow: 'shadow-sky-100',
        badge: 'bg-sky-100 text-sky-800',
        btnText: 'text-white',
        preview1: 'bg-sky-400',
        preview2: 'bg-sky-200',
        preview3: 'bg-sky-100',
      },
      icon: '📋',
      tag: '안정적',
    },
    {
      id: 'c',
      path: '/theme-c',
      name: 'Bold Accent',
      subtitle: '볼드 액센트형 UI',
      description: '크림 & 앰버 계열의 따뜻한 포인트. 수평 스텝 방식으로 작업 흐름을 시각화한 직관적인 UX.',
      features: ['수평 스텝 워크플로우', '대형 액션 버튼', '워크플로우 시각화', '선명한 상태 표시'],
      color: {
        bg: 'bg-amber-50',
        card: 'bg-white',
        accent: 'bg-amber-500',
        accentHover: 'hover:bg-amber-600',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-400',
        shadow: 'shadow-amber-100',
        badge: 'bg-amber-100 text-amber-800',
        btnText: 'text-white',
        preview1: 'bg-amber-400',
        preview2: 'bg-amber-200',
        preview3: 'bg-amber-100',
      },
      icon: '✨',
      tag: '직관적',
    },
  ];

  let hoveredTheme = $state<string | null>(null);
</script>

<svelte:head>
  <title>세탁물 관리 시스템 - 테마 선택</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 flex flex-col">
  <!-- 헤더 -->
  <header class="pt-12 pb-6 text-center px-6">
    <div class="inline-flex items-center gap-3 mb-4">
      <div class="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
        🏭
      </div>
      <div class="text-left">
        <p class="text-xs font-semibold tracking-widest text-slate-400 uppercase">Laundry Management</p>
        <h1 class="text-2xl font-bold text-slate-800 leading-tight">세탁물 관리 시스템</h1>
      </div>
    </div>
    <p class="text-slate-500 text-base mt-2 max-w-md mx-auto leading-relaxed">
      원하시는 UI 테마를 선택하세요.<br />
      <span class="text-slate-400 text-sm">기능은 동일하며, 화면 구성이 다르게 제공됩니다.</span>
    </p>
  </header>

  <!-- 테마 카드 그리드 -->
  <main class="flex-1 flex items-center justify-center px-6 py-8">
    <div class="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
      {#each themes as theme}
        <button
          class="group relative text-left rounded-3xl border-2 transition-all duration-300 cursor-pointer overflow-hidden
            {hoveredTheme === theme.id
              ? `${theme.color.border} ${theme.color.bg} shadow-2xl ${theme.color.shadow} scale-[1.02]`
              : 'border-slate-200 bg-white shadow-md hover:shadow-xl'}"
          onmouseenter={() => hoveredTheme = theme.id}
          onmouseleave={() => hoveredTheme = null}
          onclick={() => goto(theme.path)}
        >
          <!-- 상단 배지 -->
          <div class="absolute top-4 right-4">
            <span class="text-xs font-bold px-3 py-1 rounded-full {theme.color.badge}">
              {theme.tag}
            </span>
          </div>

          <!-- 미리보기 UI 스케치 -->
          <div class="p-5 pb-0">
            <div class="rounded-2xl overflow-hidden border {theme.color.border} h-36 relative {theme.color.bg} flex gap-1 p-2">
              <!-- 사이드바 미리보기 -->
              <div class="w-1/4 {theme.color.preview1} rounded-xl opacity-70 flex flex-col gap-1 p-1">
                {#each [0,1,2,3] as _}
                  <div class="h-2 bg-white rounded opacity-60"></div>
                {/each}
              </div>
              <!-- 메인 컨텐츠 미리보기 -->
              <div class="flex-1 flex flex-col gap-1">
                <div class="{theme.color.preview2} rounded-lg h-6 flex gap-1 p-1">
                  {#each [0,1,2,3] as _}
                    <div class="flex-1 {theme.color.preview1} rounded opacity-60"></div>
                  {/each}
                </div>
                <div class="flex-1 {theme.color.preview3} rounded-lg p-1 grid grid-cols-2 gap-1">
                  {#each [0,1,2,3,4,5] as _}
                    <div class="bg-white rounded opacity-70"></div>
                  {/each}
                </div>
                <div class="{theme.color.preview2} rounded-lg h-7 flex gap-1 p-1 items-center">
                  {#each [0,1,2] as _}
                    <div class="flex-1 {theme.color.preview1} rounded-md h-4 opacity-70"></div>
                  {/each}
                </div>
              </div>
            </div>
          </div>

          <!-- 카드 내용 -->
          <div class="p-5">
            <!-- 아이콘 & 제목 -->
            <div class="flex items-center gap-3 mb-3">
              <div class="w-11 h-11 rounded-2xl {theme.color.accent} flex items-center justify-center text-xl shadow-md">
                {theme.icon}
              </div>
              <div>
                <p class="text-xs font-semibold text-slate-400 tracking-wide uppercase">{theme.subtitle}</p>
                <h2 class="text-lg font-bold text-slate-800">{theme.name}</h2>
              </div>
            </div>

            <!-- 설명 -->
            <p class="text-sm text-slate-500 leading-relaxed mb-4">{theme.description}</p>

            <!-- 특징 목록 -->
            <ul class="space-y-1.5 mb-5">
              {#each theme.features as feature}
                <li class="flex items-center gap-2 text-sm text-slate-600">
                  <span class="w-1.5 h-1.5 rounded-full {theme.color.dot} shrink-0"></span>
                  {feature}
                </li>
              {/each}
            </ul>

            <!-- 선택 버튼 -->
            <div
              class="w-full py-3 rounded-2xl {theme.color.accent} {theme.color.accentHover} {theme.color.btnText}
                font-bold text-base text-center transition-all duration-200 shadow-md
                group-hover:shadow-lg group-hover:translate-y-[-1px]"
            >
              이 테마로 시작하기 →
            </div>
          </div>
        </button>
      {/each}
    </div>
  </main>

  <!-- 하단 안내 -->
  <footer class="text-center pb-8 px-6">
    <div class="inline-flex items-center gap-6 text-xs text-slate-400">
      <span class="flex items-center gap-1.5">
        <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
        터치 디스플레이 최적화
      </span>
      <span>|</span>
      <span>입고 · 세탁 · 출고 통합 관리</span>
      <span>|</span>
      <span>거래처별 재고 현황</span>
    </div>
    <p class="text-slate-300 text-xs mt-2">언제든지 다시 이 페이지로 돌아와 테마를 변경할 수 있습니다.</p>
  </footer>
</div>