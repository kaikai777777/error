<script lang="ts">
  interface Props {
    value: string;
    onchange?: (val: string) => void;
    onconfirm?: (val: string) => void;
    accentClass?: string;
    maxLength?: number;
  }

  let {
    value = $bindable(''),
    onchange,
    onconfirm,
    accentClass = 'bg-emerald-500 hover:bg-emerald-600 text-white',
    maxLength = 6,
  }: Props = $props();

  function press(key: string) {
    if (key === 'clear') {
      value = '';
    } else if (key === 'back') {
      value = value.slice(0, -1);
    } else {
      if (value.length >= maxLength) return;
      value = value + key;
    }
    onchange?.(value);
  }

  const keys: string[] = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', 'back', 'clear'];
</script>

<div class="grid grid-cols-3 gap-2 select-none">
  {#each keys as key}
    {#if key === 'clear'}
      <button
        type="button"
        class="h-14 rounded-xl font-bold text-base transition-all duration-150 active:scale-95
          bg-red-100 hover:bg-red-200 text-red-600 border border-red-200"
        onclick={() => press(key)}
      >
        전체삭제
      </button>
    {:else if key === 'back'}
      <button
        type="button"
        class="h-14 rounded-xl font-bold text-base transition-all duration-150 active:scale-95
          bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 flex items-center justify-center gap-1"
        onclick={() => press(key)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12H7M7 12l5-5M7 12l5 5"/>
        </svg>
        지우기
      </button>
    {:else}
      <button
        type="button"
        class="h-14 rounded-xl font-bold text-xl transition-all duration-150 active:scale-95
          bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm"
        onclick={() => press(key)}
      >
        {key}
      </button>
    {/if}
  {/each}

  {#if onconfirm}
    <button
      type="button"
      class="col-span-3 h-14 rounded-xl font-bold text-base transition-all duration-150 active:scale-95 mt-1 {accentClass} shadow-md"
      onclick={() => onconfirm?.(value)}
    >
      확인
    </button>
  {/if}
</div>