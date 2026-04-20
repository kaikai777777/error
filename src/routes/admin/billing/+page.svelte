<script lang="ts">
	import { store, CATEGORY_LABELS } from '$lib/data/store.svelte';
	import type {
		InvoiceLine
	} from '$lib/data/types.js';
	import { downloadXlsx } from '$lib/utils/excel.js';
	import type { Cell, Sheet, MergeRegion, ColumnDef } from '$lib/utils/excel.js';

	// ── 탭 ──────────────────────────────────────────────────────────
	type BillingTab = 'invoice' | 'statement';
	const tabState = $state({ active: 'invoice' as BillingTab });
	function switchTab(t: BillingTab) { tabState.active = t; }

	// ── 거래처 선택 ─────────────────────────────────────────────────
	let selectedClientId = $state<string>(store.clients[0]?.id ?? '');
	const selectedClient = $derived(store.clients.find((c) => c.id === selectedClientId) ?? null);

	// ── 기간 설정 (공통) ─────────────────────────────────────────────
	let periodFrom = $state('');
	let periodTo   = $state('');

	$effect(() => {
		// 초기 기간: 이번달
		if (!periodFrom || !periodTo) setThisMonth();
	});

	function setThisMonth() {
		const d   = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const y   = d.getFullYear();
		const m   = d.getMonth() + 1;
		const last = new Date(y, m, 0).getDate();
		periodFrom = `${y}-${pad(m)}-01`;
		periodTo   = `${y}-${pad(m)}-${pad(last)}`;
	}
	function setLastMonth() {
		const d   = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		let y = d.getFullYear();
		let m = d.getMonth();
		if (m === 0) { m = 12; y--; }
		const last = new Date(y, m, 0).getDate();
		periodFrom = `${y}-${pad(m)}-01`;
		periodTo   = `${y}-${pad(m)}-${pad(last)}`;
	}

	// ── 청구서 미리보기 데이터 ────────────────────────────────────────
	const invoiceLines = $derived.by((): InvoiceLine[] => {
		if (!selectedClientId || !periodFrom || !periodTo) return [];
		return store.buildInvoiceLines(selectedClientId, periodFrom, periodTo);
	});

	const invoiceTotal    = $derived(invoiceLines.reduce((s, l) => s + l.amount,   0));
	const invoiceTotalQty = $derived(invoiceLines.reduce((s, l) => s + l.quantity, 0));

	const invoiceByCategory = $derived.by(() => {
		const cats: Record<string, { qty: number; amount: number }> = {};
		for (const line of invoiceLines) {
			if (!cats[line.category]) cats[line.category] = { qty: 0, amount: 0 };
			cats[line.category].qty    += line.quantity;
			cats[line.category].amount += line.amount;
		}
		return cats;
	});

	const unpricedCount = $derived(invoiceLines.filter((l) => l.unitPrice === 0).length);

	// ── 거래내역서 뷰 모드 ────────────────────────────────────────────
	type StmtViewMode = 'pivot' | 'daily';
	let stmtViewMode = $state<StmtViewMode>('pivot');

	// ── 거래내역서 데이터 ─────────────────────────────────────────────
	type StmtColumn = { category: string; itemName: string; key: string };
	type StmtRow    = { date: string; quantities: number[]; total: number };
	// 카테고리 그룹 정보 (피벗 헤더용)
	type StmtCatGroup = { category: string; label: string; startIdx: number; count: number };
	// 일별 상세 뷰용 품목 row
	type StmtDailyItem = { category: string; itemName: string; quantity: number };
	type StmtDailyRow  = { date: string; items: StmtDailyItem[]; total: number };
	type StmtData   = {
		columns: StmtColumn[];
		catGroups: StmtCatGroup[];
		rows: StmtRow[];
		dailyRows: StmtDailyRow[];
		colTotals: number[];
		catTotals: Record<string, number>;   // 카테고리별 총합
		grandTotal: number;
	};

	const statementData = $derived.by((): StmtData | null => {
		if (!selectedClientId || !periodFrom || !periodTo) return null;

		const fromTs = new Date(periodFrom + 'T00:00:00').getTime();
		const toTs   = new Date(periodTo   + 'T23:59:59').getTime();

		const ships = store.shipments.filter((s) => {
			if (s.clientId !== selectedClientId) return false;
			const ts = new Date(s.shippedAt).getTime();
			return ts >= fromTs && ts <= toTs;
		});

		if (ships.length === 0) return null;

		// 고유 품목 수집 (Record 사용)
		const itemSet: Record<string, { category: string; itemName: string }> = {};
		for (const s of ships) {
			for (const item of s.items) {
				const key = `${item.category}__${item.itemName}`;
				if (!itemSet[key]) itemSet[key] = { category: item.category, itemName: item.itemName };
			}
		}

		// 카테고리 → 품목명 정렬
		const catOrder: Record<string, number> = { towel: 0, sheet: 1, uniform: 2 };
		const columns: StmtColumn[] = Object.entries(itemSet)
			.map(([key, v]) => ({ key, ...v }))
			.sort((a, b) => {
				const co = (catOrder[a.category] ?? 99) - (catOrder[b.category] ?? 99);
				return co !== 0 ? co : a.itemName.localeCompare(b.itemName);
			});

		// 카테고리 그룹 계산 (피벗 헤더용)
		const catGroups: StmtCatGroup[] = [];
		let lastCat = '';
		for (let i = 0; i < columns.length; i++) {
			const cat = columns[i].category;
			if (cat !== lastCat) {
				catGroups.push({ category: cat, label: CATEGORY_LABELS[cat as 'towel'|'sheet'|'uniform'] ?? cat, startIdx: i, count: 1 });
				lastCat = cat;
			} else {
				catGroups[catGroups.length - 1].count++;
			}
		}

		// 날짜별 집계 (중첩 Record 사용)
		const byDate: Record<string, Record<string, number>> = {};
		for (const s of ships) {
			const date = s.shippedAt.slice(0, 10);
			if (!byDate[date]) byDate[date] = {};
			const dm = byDate[date];
			for (const item of s.items) {
				const key = `${item.category}__${item.itemName}`;
				dm[key] = (dm[key] ?? 0) + item.quantity;
			}
		}

		const dates = Object.keys(byDate).sort();

		// 피벗 rows
		const rows: StmtRow[] = dates.map((date) => {
			const dm = byDate[date];
			const quantities = columns.map((col) => dm[col.key] ?? 0);
			return { date, quantities, total: quantities.reduce((s, n) => s + n, 0) };
		});

		// 일별 상세 rows (당일 출고된 품목만)
		const dailyRows: StmtDailyRow[] = dates.map((date) => {
			const dm = byDate[date];
			const items: StmtDailyItem[] = [];
			for (const col of columns) {
				const qty = dm[col.key] ?? 0;
				if (qty > 0) items.push({ category: col.category, itemName: col.itemName, quantity: qty });
			}
			const total = items.reduce((s, it) => s + it.quantity, 0);
			return { date, items, total };
		});

		const colTotals  = columns.map((_, i) => rows.reduce((s, r) => s + r.quantities[i], 0));
		const grandTotal = colTotals.reduce((s, n) => s + n, 0);

		// 카테고리별 총합
		const catTotals: Record<string, number> = {};
		for (let i = 0; i < columns.length; i++) {
			const cat = columns[i].category;
			catTotals[cat] = (catTotals[cat] ?? 0) + colTotals[i];
		}

		return { columns, catGroups, rows, dailyRows, colTotals, catTotals, grandTotal };
	});


	// ── 인쇄 / PDF ──────────────────────────────────────────────────
	let invoiceMemo = $state('');

	function printInvoice() {
		document.body.classList.remove('print-statement');
		document.body.classList.add('print-invoice');
		window.addEventListener('afterprint', () => {
			document.body.classList.remove('print-invoice');
		}, { once: true });
		window.print();
	}



	// ── 거래내역서 엑셀 내보내기 ─────────────────────────────────────
	function exportStatementExcel() {
		const sd = statementData;
		if (!sd || !selectedClient) return;

		const clientName = selectedClient.name;
		const period = `${periodFrom}~${periodTo}`;
		const filename = `거래내역서_${clientName}_${period}.xlsx`;

		// ── 스타일 정의 ──────────────────────────────
		const S_TITLE:    Cell['style'] = { bold: true, fontSize: 16, align: 'center', fontColor: '0F172A' };
		const S_META:     Cell['style'] = { fontSize: 10, align: 'center', fontColor: '64748B' };
		const S_CAT_HEAD: Record<string, Cell['style']> = {
			towel:   { bold: true, fontSize: 10, align: 'center', bgColor: 'E0F2FE', fontColor: '0369A1', border: true },
			sheet:   { bold: true, fontSize: 10, align: 'center', bgColor: 'E0E7FF', fontColor: '4338CA', border: true },
			uniform: { bold: true, fontSize: 10, align: 'center', bgColor: 'FEF3C7', fontColor: '92400E', border: true },
		};
		const S_ITEM_HEAD: Record<string, Cell['style']> = {
			towel:   { bold: true, fontSize: 9,  align: 'center', bgColor: 'F0F9FF', fontColor: '075985', border: true, wrapText: true },
			sheet:   { bold: true, fontSize: 9,  align: 'center', bgColor: 'EEF2FF', fontColor: '3730A3', border: true, wrapText: true },
			uniform: { bold: true, fontSize: 9,  align: 'center', bgColor: 'FFFBEB', fontColor: '78350F', border: true, wrapText: true },
		};
		const S_DATE:     Cell['style'] = { bold: true, fontSize: 10, align: 'center', bgColor: 'F8FAFC', fontColor: '334155', border: true };
		const S_SUBTOTAL_HEAD: Cell['style'] = { bold: true, fontSize: 10, align: 'center', bgColor: 'F1F5F9', fontColor: '475569', border: true };
		const S_CELL_TOWEL:   Cell['style'] = { fontSize: 10, align: 'center', fontColor: '0369A1', border: true, numFmt: '#,##0' };
		const S_CELL_SHEET:   Cell['style'] = { fontSize: 10, align: 'center', fontColor: '4338CA', border: true, numFmt: '#,##0' };
		const S_CELL_UNIFORM: Cell['style'] = { fontSize: 10, align: 'center', fontColor: '92400E', border: true, numFmt: '#,##0' };
		const S_CELL_EMPTY:   Cell['style'] = { fontSize: 10, align: 'center', fontColor: 'CBD5E1', border: true };
		const S_SUBTOTAL_VAL: Cell['style'] = { bold: true, fontSize: 10, align: 'center', bgColor: 'F1F5F9', fontColor: '334155', border: true, numFmt: '#,##0' };
		const S_FOOT_LABEL:   Cell['style'] = { bold: true, fontSize: 10, align: 'center', bgColor: 'EEF2FF', fontColor: '334155', border: true };
		const S_FOOT_TOWEL:   Cell['style'] = { bold: true, fontSize: 11, align: 'center', bgColor: 'E0F2FE', fontColor: '0369A1', border: true, borderThick: true, numFmt: '#,##0' };
		const S_FOOT_SHEET:   Cell['style'] = { bold: true, fontSize: 11, align: 'center', bgColor: 'E0E7FF', fontColor: '4338CA', border: true, borderThick: true, numFmt: '#,##0' };
		const S_FOOT_UNIFORM: Cell['style'] = { bold: true, fontSize: 11, align: 'center', bgColor: 'FEF3C7', fontColor: '92400E', border: true, borderThick: true, numFmt: '#,##0' };
		const S_FOOT_GRAND:   Cell['style'] = { bold: true, fontSize: 13, align: 'center', bgColor: 'EEF2FF', fontColor: '4338CA', border: true, borderThick: true, numFmt: '#,##0' };
		const S_SUMMARY_LABEL: Cell['style'] = { bold: true, fontSize: 10, align: 'left',   bgColor: 'F8FAFC', fontColor: '475569', border: true };

		// ── 레이아웃 상수 ─────────────────────────────
		const nCols = sd.columns.length;  // 품목 수
		const COL_SUBTOTAL = 1 + nCols + 1; // 소계 열
		const totalCols = COL_SUBTOTAL;

		// ── 열 너비 계산 ──────────────────────────────
		const columns: ColumnDef[] = [
			{ width: 10 },   // 날짜
			...sd.columns.map((col) => ({
				width: Math.max(6, Math.min(12, col.itemName.length * 1.8))
			})),
			{ width: 10 },   // 소계
		];

		// ── 병합 영역 ─────────────────────────────────
		const merges: MergeRegion[] = [];

		// 행 번호 추적
		let R = 1;

		// ── 행 데이터 ─────────────────────────────────
		const sheetRows: Sheet['rows'] = [];

		// 행1: 제목
		const titleRow: Cell[] = [
			{ value: `세 탁 거 래 내 역 서`, style: S_TITLE },
			...Array(totalCols - 1).fill({ value: '', style: S_TITLE }),
		];
		sheetRows.push({ cells: titleRow, height: 30 });
		merges.push({ r1: R, c1: 1, r2: R, c2: totalCols });
		R++;

		// 행2: 거래처 & 기간
		const metaRow1: Cell[] = [
			{ value: `거래처: ${clientName}    |    기간: ${periodFrom} ~ ${periodTo}    |    발행일: ${new Date().toISOString().slice(0,10)}`, style: S_META },
			...Array(totalCols - 1).fill({ value: '', style: S_META }),
		];
		sheetRows.push({ cells: metaRow1, height: 18 });
		merges.push({ r1: R, c1: 1, r2: R, c2: totalCols });
		R++;

		// 행3: 품목수 & 출고일수 & 총수량
		const metaRow2: Cell[] = [
			{ value: `품목 ${nCols}종  |  출고 ${sd.rows.length}일  |  총 출고: ${sd.grandTotal.toLocaleString()}개`, style: S_META },
			...Array(totalCols - 1).fill({ value: '', style: S_META }),
		];
		sheetRows.push({ cells: metaRow2, height: 16 });
		merges.push({ r1: R, c1: 1, r2: R, c2: totalCols });
		R++;

		// 행4: 빈 행 (구분)
		sheetRows.push({ cells: [{ value: '', style: {} }], height: 8 });
		R++;

		// 행5: 카테고리 그룹 헤더
		const catHeadRow: Cell[] = [{ value: '날짜', style: S_DATE }];
		for (const cg of sd.catGroups) {
			const s = S_CAT_HEAD[cg.category] ?? S_CAT_HEAD['towel'];
			catHeadRow.push({ value: `${cg.label} (${cg.count}종)`, style: s });
			for (let i = 1; i < cg.count; i++) catHeadRow.push({ value: '', style: s });
			// 카테고리 그룹 병합
			const startCol = catHeadRow.length - cg.count + 1;
			if (cg.count > 1) {
				merges.push({ r1: R, c1: startCol, r2: R, c2: startCol + cg.count - 1 });
			}
		}
		catHeadRow.push({ value: '소계', style: S_SUBTOTAL_HEAD });
		sheetRows.push({ cells: catHeadRow, height: 20 });
		R++;

		// 행6: 품목명 헤더
		const itemHeadRow: Cell[] = [{ value: '', style: S_DATE }];
		for (const col of sd.columns) {
			itemHeadRow.push({ value: col.itemName, style: S_ITEM_HEAD[col.category] ?? S_ITEM_HEAD['towel'] });
		}
		itemHeadRow.push({ value: '', style: S_SUBTOTAL_HEAD });
		sheetRows.push({ cells: itemHeadRow, height: 36 });
		R++;

		// 행7~N: 날짜별 데이터
		for (let ri = 0; ri < sd.rows.length; ri++) {
			const row = sd.rows[ri];
			const altBg = ri % 2 === 1;
			const dateCell: Cell = {
				value: row.date.slice(5), // MM-DD
				style: { ...S_DATE, bgColor: altBg ? 'F1F5F9' : 'F8FAFC' }
			};
			const dataCells: Cell[] = [dateCell];
			for (let ci = 0; ci < sd.columns.length; ci++) {
				const col = sd.columns[ci];
				const qty = row.quantities[ci];
				const cellStyleMap: Record<string, Cell['style']> = {
					towel:   qty > 0 ? { ...S_CELL_TOWEL,   bgColor: altBg ? 'F0F9FF' : 'FFFFFF' } : { ...S_CELL_EMPTY, bgColor: altBg ? 'F8FAFC' : 'FFFFFF' },
					sheet:   qty > 0 ? { ...S_CELL_SHEET,   bgColor: altBg ? 'EEF2FF' : 'FFFFFF' } : { ...S_CELL_EMPTY, bgColor: altBg ? 'F8FAFC' : 'FFFFFF' },
					uniform: qty > 0 ? { ...S_CELL_UNIFORM, bgColor: altBg ? 'FFFBEB' : 'FFFFFF' } : { ...S_CELL_EMPTY, bgColor: altBg ? 'F8FAFC' : 'FFFFFF' },
				};
				dataCells.push({
					value: qty > 0 ? qty : null,
					style: cellStyleMap[col.category] ?? S_CELL_EMPTY,
				});
			}
			dataCells.push({ value: row.total, style: { ...S_SUBTOTAL_VAL, bgColor: altBg ? 'F1F5F9' : 'F8FAFC' } });
			sheetRows.push({ cells: dataCells, height: 17 });
			R++;
		}

		// 품목별 합계 행
		const colTotalRow: Cell[] = [{ value: '품목 합계', style: S_FOOT_LABEL }];
		for (let ci = 0; ci < sd.columns.length; ci++) {
			const col = sd.columns[ci];
			const total = sd.colTotals[ci];
			const styleMap: Record<string, Cell['style']> = {
				towel:   { ...S_FOOT_TOWEL,   fontSize: 10 },
				sheet:   { ...S_FOOT_SHEET,   fontSize: 10 },
				uniform: { ...S_FOOT_UNIFORM, fontSize: 10 },
			};
			colTotalRow.push({ value: total > 0 ? total : null, style: styleMap[col.category] ?? S_FOOT_GRAND });
		}
		colTotalRow.push({ value: sd.grandTotal, style: S_FOOT_GRAND });
		sheetRows.push({ cells: colTotalRow, height: 20 });
		R++;

		// 카테고리별 합계 행 (병합)
		const catTotalRow: Cell[] = [{ value: '카테고리 합계', style: S_FOOT_LABEL }];
		for (const cg of sd.catGroups) {
			const styleMap: Record<string, Cell['style']> = {
				towel:   S_FOOT_TOWEL,
				sheet:   S_FOOT_SHEET,
				uniform: S_FOOT_UNIFORM,
			};
			const s = styleMap[cg.category] ?? S_FOOT_GRAND;
			const val = sd.catTotals[cg.category] ?? 0;
			catTotalRow.push({ value: val, style: s });
			for (let i = 1; i < cg.count; i++) catTotalRow.push({ value: '', style: s });
			const startCol = catTotalRow.length - cg.count + 1;
			if (cg.count > 1) {
				merges.push({ r1: R, c1: startCol, r2: R, c2: startCol + cg.count - 1 });
			}
		}
		catTotalRow.push({ value: sd.grandTotal, style: S_FOOT_GRAND });
		sheetRows.push({ cells: catTotalRow, height: 24 });
		R++;

		// 빈 행
		sheetRows.push({ cells: [{ value: '' }], height: 10 });
		R++;

		// ── 요약 섹션 ─────────────────────────────────
		sheetRows.push({ cells: [
			{ value: '[ 카테고리별 요약 ]', style: { bold: true, fontSize: 11, fontColor: '334155' } }
		], height: 20 });
		merges.push({ r1: R, c1: 1, r2: R, c2: 4 });
		R++;

		for (const cg of sd.catGroups) {
			const labelStyle: Cell['style'] = {
				bold: true, fontSize: 10, align: 'left',
				bgColor: cg.category === 'towel' ? 'F0F9FF' : cg.category === 'sheet' ? 'EEF2FF' : 'FFFBEB',
				fontColor: cg.category === 'towel' ? '0369A1' : cg.category === 'sheet' ? '4338CA' : '92400E',
				border: true,
			};
			const valStyle: Cell['style'] = {
				bold: true, fontSize: 11, align: 'center',
				bgColor: cg.category === 'towel' ? 'E0F2FE' : cg.category === 'sheet' ? 'E0E7FF' : 'FEF3C7',
				fontColor: cg.category === 'towel' ? '0369A1' : cg.category === 'sheet' ? '4338CA' : '92400E',
				border: true, numFmt: '#,##0',
			};
			sheetRows.push({ cells: [
				{ value: `${cg.label} (${cg.count}종)`, style: labelStyle },
				{ value: sd.catTotals[cg.category] ?? 0, style: valStyle },
				{ value: '', style: valStyle },
				{ value: '개', style: { fontSize: 10, fontColor: '64748B' } },
			], height: 20 });
			merges.push({ r1: R, c1: 2, r2: R, c2: 3 });
			R++;
		}

		sheetRows.push({ cells: [
			{ value: '총 합계', style: { ...S_SUMMARY_LABEL, bgColor: 'EEF2FF', fontColor: '4338CA', bold: true } },
			{ value: sd.grandTotal, style: S_FOOT_GRAND },
			{ value: '', style: S_FOOT_GRAND },
			{ value: '개', style: { fontSize: 10, fontColor: '64748B' } },
		], height: 22 });
		merges.push({ r1: R, c1: 2, r2: R, c2: 3 });
		R++;

		// ── 시트 조립 ─────────────────────────────────
		const sheet: Sheet = {
			name: `거래내역서_${periodFrom.slice(0,7)}`,
			rows: sheetRows,
			merges,
			columns,
			freezeRow: 6,   // 헤더 6행 고정
			freezeCol: 1,   // 날짜 1열 고정
		};

		downloadXlsx([sheet], filename);
	}

	// ── 청구서 엑셀 내보내기 ─────────────────────────────────────────
	function exportInvoiceExcel() {
		if (!selectedClient || invoiceLines.length === 0) return;

		const clientName = selectedClient.name;
		const period = `${periodFrom}~${periodTo}`;
		const filename = `청구서_${clientName}_${period}.xlsx`;

		const S_TITLE:  Cell['style'] = { bold: true, fontSize: 16, align: 'center', fontColor: '0F172A' };
		const S_META:   Cell['style'] = { fontSize: 10, align: 'center', fontColor: '64748B' };
		const S_HEAD:   Cell['style'] = { bold: true, fontSize: 10, align: 'center', bgColor: 'F8FAFC', fontColor: '475569', border: true };
		const S_LABEL:  Cell['style'] = { bold: true, fontSize: 10, align: 'left',   bgColor: 'F8FAFC', fontColor: '475569', border: true };
		const S_NUM:    Cell['style'] = { fontSize: 10, align: 'right', border: true, numFmt: '#,##0', fontColor: '334155' };
		const S_PRICE:  Cell['style'] = { fontSize: 10, align: 'right', border: true, numFmt: '#,##0', fontColor: '64748B' };
		const S_AMOUNT: Cell['style'] = { bold: true, fontSize: 10, align: 'right', border: true, numFmt: '#,##0', fontColor: '1E293B' };
		const S_CAT: Record<string, Cell['style']> = {
			towel:   { bold: true, fontSize: 10, align: 'center', bgColor: 'E0F2FE', fontColor: '0369A1', border: true },
			sheet:   { bold: true, fontSize: 10, align: 'center', bgColor: 'E0E7FF', fontColor: '4338CA', border: true },
			uniform: { bold: true, fontSize: 10, align: 'center', bgColor: 'FEF3C7', fontColor: '92400E', border: true },
		};
		const S_TOTAL: Cell['style'] = { bold: true, fontSize: 12, align: 'right', bgColor: 'EEF2FF', fontColor: '4338CA', border: true, borderThick: true, numFmt: '#,##0' };
		const S_TOTAL_LABEL: Cell['style'] = { bold: true, fontSize: 12, align: 'left', bgColor: 'EEF2FF', fontColor: '4338CA', border: true, borderThick: true };

		const merges: MergeRegion[] = [];
		const sheetRows: Sheet['rows'] = [];
		let R = 1;

		// 제목
		sheetRows.push({ cells: [{ value: '세 탁 청 구 서', style: S_TITLE }, ...Array(4).fill({ value: '', style: S_TITLE })], height: 30 });
		merges.push({ r1: R, c1: 1, r2: R, c2: 5 }); R++;

		// 메타
		sheetRows.push({ cells: [{ value: `거래처: ${clientName}    |    기간: ${periodFrom} ~ ${periodTo}    |    발행일: ${new Date().toISOString().slice(0,10)}`, style: S_META }, ...Array(4).fill({ value: '', style: S_META })], height: 18 });
		merges.push({ r1: R, c1: 1, r2: R, c2: 5 }); R++;

		// 거래처 정보
		sheetRows.push({ cells: [{ value: '' }], height: 8 }); R++;
		if (selectedClient.businessNo) {
			sheetRows.push({ cells: [{ value: '사업자번호', style: S_LABEL }, { value: selectedClient.businessNo, style: { fontSize: 10, border: true } }, { value: '' }, { value: '' }, { value: '' }], height: 17 }); R++;
		}
		if (selectedClient.ownerName) {
			sheetRows.push({ cells: [{ value: '대표자', style: S_LABEL }, { value: selectedClient.ownerName, style: { fontSize: 10, border: true } }, { value: '' }, { value: '' }, { value: '' }], height: 17 }); R++;
		}
		sheetRows.push({ cells: [{ value: '' }], height: 8 }); R++;

		// 헤더
		sheetRows.push({ cells: [
			{ value: '품목명',  style: S_HEAD },
			{ value: '카테고리', style: S_HEAD },
			{ value: '수량',   style: S_HEAD },
			{ value: '단가(원)', style: S_HEAD },
			{ value: '금액(원)', style: S_HEAD },
		], height: 20 }); R++;

		// 데이터
		for (const line of invoiceLines) {
			sheetRows.push({ cells: [
				{ value: line.itemName, style: { fontSize: 10, align: 'left', border: true, fontColor: '334155' } },
				{ value: CATEGORY_LABELS[line.category], style: S_CAT[line.category] ?? S_HEAD },
				{ value: line.quantity, style: S_NUM },
				{ value: line.unitPrice > 0 ? line.unitPrice : null, style: S_PRICE },
				{ value: line.amount, style: S_AMOUNT },
			], height: 17 }); R++;
		}

		// 합계
		sheetRows.push({ cells: [
			{ value: '합  계', style: S_TOTAL_LABEL },
			{ value: '', style: S_TOTAL_LABEL },
			{ value: invoiceTotalQty, style: { ...S_TOTAL, fontSize: 10 } },
			{ value: '', style: S_TOTAL },
			{ value: invoiceTotal, style: { ...S_TOTAL, fontSize: 14 } },
		], height: 26 }); R++;

		const sheet: Sheet = {
			name: `청구서_${periodFrom.slice(0,7)}`,
			rows: sheetRows,
			merges,
			columns: [{ width: 22 }, { width: 10 }, { width: 8 }, { width: 12 }, { width: 14 }],
		};

		downloadXlsx([sheet], filename);
	}

	// ── 저장된 청구서 ─────────────────────────────────────────────────
	const savedInvoices = $derived(
		selectedClientId ? store.getInvoicesByClient(selectedClientId) : []
	);

	let showSaveConfirm = $state(false);
	let savedMsg        = $state(false);

	function doSaveInvoice() {
		if (!selectedClientId || invoiceLines.length === 0) return;
		store.saveInvoice({
			clientId: selectedClientId,
			periodFrom, periodTo,
			lines: invoiceLines,
			totalAmount: invoiceTotal,
			memo: invoiceMemo || undefined,
			status: 'issued'
		});
		showSaveConfirm = false;
		savedMsg = true;
		setTimeout(() => (savedMsg = false), 2500);
	}

	let viewingInvoiceId = $state<string | null>(null);
	const viewingInvoice = $derived(
		viewingInvoiceId ? store.invoices.find((i) => i.id === viewingInvoiceId) ?? null : null
	);


	// ── 헬퍼 ────────────────────────────────────────────────────────
	const categoryBadge: Record<string, string> = {
		towel:   'bg-sky-100 text-sky-700',
		sheet:   'bg-indigo-100 text-indigo-700',
		uniform: 'bg-amber-100 text-amber-700'
	};
	const categoryColor: Record<string, string> = {
		towel:   'bg-sky-400',
		sheet:   'bg-indigo-400',
		uniform: 'bg-amber-400'
	};

	function formatDate(d: string) { return d.replace(/-/g, '.').slice(0, 10); }
	function formatMoney(n: number) { return n.toLocaleString('ko-KR') + '원'; }

	function formatDateShort(d: string) {
		// YYYY-MM-DD → M/D
		const [, m, day] = d.split('-');
		return `${parseInt(m)}/${parseInt(day)}`;
	}
</script>

<svelte:head>
	<title>청구서 관리 — 세탁 관리자</title>
</svelte:head>

<!-- ═══════════════ 화면 UI ═══════════════ -->
<div class="min-h-screen bg-slate-50 px-8 py-6" id="billing-screen-ui">

	<!-- 헤더 + 탭 -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<h2 class="text-2xl font-extrabold text-slate-800">청구 관리</h2>
		<div class="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm flex-wrap">
			<button
				type="button"
				style="pointer-events: auto; cursor: pointer;"
				class="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all {tabState.active === 'invoice'
					? 'bg-indigo-500 text-white shadow-sm'
					: 'text-slate-500 hover:bg-slate-100'}"
				onclick={() => switchTab('invoice')}
			>📄 청구서</button>
			<button
				type="button"
				style="pointer-events: auto; cursor: pointer;"
				class="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all {tabState.active === 'statement'
					? 'bg-indigo-500 text-white shadow-sm'
					: 'text-slate-500 hover:bg-slate-100'}"
				onclick={() => switchTab('statement')}
			>📋 거래내역서</button>
		</div>
	</div>

	<!-- 거래처 선택 (드롭다운) -->
	<div class="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-3 shadow-sm">
		<span class="shrink-0 text-[11px] font-bold uppercase tracking-widest text-slate-400">거래처</span>
		<div class="relative">
			<select
				class="appearance-none cursor-pointer rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100
					{selectedClientId ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : ''}"
				bind:value={selectedClientId}
			>
				{#each store.clients as c (c.id)}
					<option value={c.id}>{c.name}</option>
				{/each}
			</select>
			<span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
				<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/>
				</svg>
			</span>
		</div>
		{#if selectedClient}
			<span class="flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
				{selectedClient.type === 'hotel' ? '🏨' : selectedClient.type === 'pension' ? '🏡' : selectedClient.type === 'resort' ? '🌴' : '🏢'}
				{selectedClient.name}
			</span>
			{#if selectedClient.managerName}
				<span class="text-xs text-slate-400">담당: {selectedClient.managerName}</span>
			{/if}
			{#if selectedClient.phone}
				<span class="text-xs text-slate-400">☎ {selectedClient.phone}</span>
			{/if}
		{/if}
	</div>

	<!-- ── 청구서 탭 ── -->
	{#if tabState.active === 'invoice'}
		<div class="grid grid-cols-12 gap-5">
			<!-- 왼쪽: 기간 + 품목표 -->
			<div class="col-span-8 space-y-5">
				<!-- 기간 설정 -->
				<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<h3 class="mb-4 text-sm font-bold text-slate-700">📅 청구 기간 설정</h3>
					<div class="flex flex-wrap items-end gap-3">
						<div class="flex flex-col gap-1">
							<label for="inv-from" class="text-xs font-semibold text-slate-500">시작일</label>
							<input id="inv-from" type="date" bind:value={periodFrom}
								class="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
						</div>
						<span class="mb-2.5 text-slate-400">~</span>
						<div class="flex flex-col gap-1">
							<label for="inv-to" class="text-xs font-semibold text-slate-500">종료일</label>
							<input id="inv-to" type="date" bind:value={periodTo}
								class="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
						</div>
						<div class="flex gap-2">
							<button type="button" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100" onclick={setThisMonth}>이번달</button>
							<button type="button" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100" onclick={setLastMonth}>지난달</button>
						</div>
					</div>
				</div>

				<!-- 품목 청구 표 -->
				<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
						<div>
							<h3 class="text-base font-bold text-slate-800">품목별 청구 내역</h3>
							<p class="mt-0.5 text-xs text-slate-400">{formatDate(periodFrom)} ~ {formatDate(periodTo)}</p>
						</div>
						{#if unpricedCount > 0}
							<span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
								단가 미설정 {unpricedCount}건
							</span>
						{/if}
					</div>
					{#if invoiceLines.length === 0}
						<div class="py-16 text-center">
							<p class="text-slate-400">해당 기간에 출고 내역이 없습니다.</p>
							<p class="mt-1 text-xs text-slate-300">거래처와 기간을 확인해 주세요.</p>
						</div>
					{:else}
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-slate-100 bg-slate-50">
									<th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">품목명</th>
									<th class="w-20 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">카테고리</th>
									<th class="w-20 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">수량</th>
									<th class="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">단가</th>
									<th class="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">금액</th>
								</tr>
							</thead>
							<tbody>
								{#each (['towel', 'sheet', 'uniform'] as const) as cat (cat)}
									{@const catLines = invoiceLines.filter((l) => l.category === cat)}
									{#if catLines.length > 0}
										<tr class="bg-slate-50/50">
											<td colspan="5" class="px-5 py-2">
												<span class="rounded-full px-2.5 py-0.5 text-xs font-bold {categoryBadge[cat]}">
													{CATEGORY_LABELS[cat]}
												</span>
											</td>
										</tr>
										{#each catLines as line (line.category + line.itemName)}
											<tr class="border-b border-slate-50 hover:bg-slate-50/70">
												<td class="px-5 py-3 pl-8 font-medium text-slate-700">{line.itemName}</td>
												<td class="w-20 px-4 py-3">
													<span class="rounded-full px-2 py-0.5 text-xs font-semibold {categoryBadge[line.category]}">
														{CATEGORY_LABELS[line.category as 'towel'|'sheet'|'uniform']}
													</span>
												</td>
												<td class="w-20 px-4 py-3 text-right text-slate-700">{line.quantity.toLocaleString()}</td>
												<td class="w-28 whitespace-nowrap px-4 py-3 text-right {line.unitPrice === 0 ? 'font-semibold text-amber-500' : 'text-slate-600'}">
													{line.unitPrice === 0 ? '미설정' : formatMoney(line.unitPrice)}
												</td>
												<td class="w-28 whitespace-nowrap px-4 py-3 text-right font-bold {line.amount === 0 ? 'text-slate-300' : 'text-slate-800'}">
													{formatMoney(line.amount)}
												</td>
											</tr>
										{/each}
										{#if catLines.length > 1}
											<tr class="bg-slate-50">
												<td colspan="2" class="px-5 py-2 pl-8 text-xs font-semibold text-slate-400">소계</td>
												<td class="w-20 px-4 py-2 text-right text-xs font-bold text-slate-600">
													{catLines.reduce((s, l) => s + l.quantity, 0).toLocaleString()}
												</td>
												<td class="w-28 px-4 py-2"></td>
												<td class="w-28 whitespace-nowrap px-4 py-2 text-right text-xs font-bold text-slate-700">
													{formatMoney(catLines.reduce((s, l) => s + l.amount, 0))}
												</td>
											</tr>
										{/if}
									{/if}
								{/each}
							</tbody>
							<tfoot>
								<tr class="border-t-2 border-slate-200 bg-indigo-50">
									<td colspan="2" class="px-5 py-4 text-sm font-extrabold text-slate-700">합계</td>
									<td class="w-20 px-4 py-4 text-right text-sm font-extrabold text-slate-700">{invoiceTotalQty.toLocaleString()}</td>
									<td class="w-28 px-4 py-4"></td>
									<td class="w-28 whitespace-nowrap px-4 py-4 text-right text-lg font-black text-indigo-700">{formatMoney(invoiceTotal)}</td>
								</tr>
							</tfoot>
						</table>
					{/if}
				</div>

				{#if invoiceLines.length > 0}
					<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<label for="inv-memo" class="mb-2 block text-sm font-bold text-slate-600">메모 (선택)</label>
						<textarea id="inv-memo" bind:value={invoiceMemo} rows="2"
							class="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
							placeholder="청구서에 표시할 메모를 입력하세요..."></textarea>
					</div>
				{/if}
			</div>

			<!-- 오른쪽: 요약 + 액션 -->
			<div class="col-span-4 space-y-5">
				{#if selectedClient}
					<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p class="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">거래처 정보</p>
						<p class="text-lg font-extrabold text-slate-800">{selectedClient.name}</p>
						{#if selectedClient.businessNo}<p class="mt-1 text-xs text-slate-500">사업자 {selectedClient.businessNo}</p>{/if}
						{#if selectedClient.ownerName}<p class="text-xs text-slate-500">대표 {selectedClient.ownerName}</p>{/if}
						{#if selectedClient.managerName}<p class="text-xs text-slate-500">담당 {selectedClient.managerName}</p>{/if}
						{#if selectedClient.phone}<p class="text-xs text-slate-500">연락처 {selectedClient.phone}</p>{/if}
					</div>
				{/if}

				<div class="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
					<p class="mb-3 text-xs font-bold uppercase tracking-wide text-indigo-400">청구 요약</p>
					<div class="space-y-2">
						<div class="flex justify-between text-sm">
							<span class="text-slate-500">기간</span>
							<span class="text-right text-xs font-semibold text-slate-700">
								{formatDate(periodFrom)}<br/>~ {formatDate(periodTo)}
							</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-slate-500">총 수량</span>
							<span class="font-bold text-slate-800">{invoiceTotalQty.toLocaleString()}개</span>
						</div>
						{#if unpricedCount > 0}
							<div class="flex justify-between text-sm">
								<span class="text-amber-600">단가 미설정</span>
								<span class="font-bold text-amber-600">{unpricedCount}건</span>
							</div>
						{/if}
						<div class="mt-3 border-t border-indigo-200 pt-3">
							<div class="flex justify-between">
								<span class="font-bold text-slate-700">청구 금액</span>
								<span class="text-xl font-black text-indigo-700">{formatMoney(invoiceTotal)}</span>
							</div>
						</div>
					</div>
				</div>

				{#if invoiceLines.length > 0}
					<!-- 카테고리별 요약 -->
					<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<p class="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">카테고리별</p>
						<div class="space-y-2">
							{#each (['towel', 'sheet', 'uniform'] as const) as cat (cat)}
								{#if invoiceByCategory[cat]}
									<div class="flex items-center gap-2">
										<div class="h-2.5 w-2.5 shrink-0 rounded-full {categoryColor[cat]}"></div>
										<span class="flex-1 text-xs font-medium text-slate-600">{CATEGORY_LABELS[cat]}</span>
										<span class="text-xs text-slate-500">{invoiceByCategory[cat].qty.toLocaleString()}개</span>
										<span class="w-24 shrink-0 text-right text-xs font-bold text-slate-700">{formatMoney(invoiceByCategory[cat].amount)}</span>
									</div>
								{/if}
							{/each}
						</div>
					</div>

					<!-- 액션 버튼 -->
					<div class="space-y-2">
						<button type="button"
							class="w-full rounded-xl bg-indigo-500 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-600 active:bg-indigo-700"
							onclick={printInvoice}>
							🖨️ 청구서 PDF 저장
						</button>
						<button type="button"
							class="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800"
							onclick={exportInvoiceExcel}>
							<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
							청구서 엑셀 저장
						</button>
						<button type="button"
							class="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
							onclick={() => (showSaveConfirm = true)}>
							💾 청구서 저장
						</button>
						{#if savedMsg}
							<p class="text-center text-xs font-semibold text-emerald-600">✅ 저장되었습니다.</p>
						{/if}
					</div>
				{/if}

				<!-- 저장된 청구서 목록 -->
				{#if savedInvoices.length > 0}
					<div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
						<div class="border-b border-slate-100 px-4 py-3">
							<p class="text-xs font-bold text-slate-600">저장된 청구서</p>
						</div>
						<div class="divide-y divide-slate-50">
							{#each savedInvoices.slice(0, 5) as inv (inv.id)}
								<button
									type="button"
									class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
									onclick={() => (viewingInvoiceId = inv.id)}
								>
									<span class="mt-0.5 text-base">📄</span>
									<div class="min-w-0 flex-1">
										<p class="text-xs font-semibold text-slate-700">{formatDate(inv.periodFrom)} ~ {formatDate(inv.periodTo)}</p>
										<p class="text-xs font-bold text-indigo-600">{formatMoney(inv.totalAmount)}</p>
										<p class="text-[11px] text-slate-400">{inv.lines.length}개 품목</p>
									</div>
									<span class="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">발행</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

	<!-- ── 거래내역서 탭 ── -->
	{:else if tabState.active === 'statement'}
		<div class="space-y-4">
			<!-- ▶ 거래내역서 배너 -->
			<div class="flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-white shadow">
				<div>
					<h3 class="text-lg font-extrabold tracking-tight">📋 거래내역서</h3>
					<p class="mt-0.5 text-sm text-emerald-100">
						{selectedClient ? selectedClient.name : '거래처를 선택하세요'} · 일별 출고 수량 집계표
					</p>
				</div>
				{#if statementData}
					<div class="flex items-center gap-4">
						<!-- 카테고리별 소계 뱃지 -->
						<div class="hidden sm:flex gap-2">
							{#each statementData.catGroups as cg (cg.category)}
								{@const color = cg.category === 'towel' ? 'bg-sky-500/30 text-sky-100' : cg.category === 'sheet' ? 'bg-indigo-500/30 text-indigo-100' : 'bg-amber-500/30 text-amber-100'}
								<div class="rounded-lg {color} px-3 py-1 text-center">
									<p class="text-[9px] font-semibold uppercase tracking-wide opacity-80">{cg.label}</p>
									<p class="text-base font-black">{(statementData.catTotals[cg.category] ?? 0).toLocaleString()}</p>
								</div>
							{/each}
						</div>
						<div class="rounded-xl bg-white/20 px-4 py-2 text-right backdrop-blur-sm">
							<p class="text-[10px] font-semibold uppercase tracking-wide text-emerald-100">기간 총 출고</p>
							<p class="text-2xl font-black">{statementData.grandTotal.toLocaleString()}<span class="ml-1 text-sm font-semibold text-emerald-200">개</span></p>
						</div>
					</div>
				{:else}
					<div class="rounded-xl bg-white/10 px-4 py-2 text-right">
						<p class="text-xs text-emerald-200">기간을 선택하면</p>
						<p class="text-sm font-bold text-white">데이터가 표시됩니다</p>
					</div>
				{/if}
			</div>

			<!-- 조회 기간 + 뷰 모드 + 액션 버튼 -->
			<div class="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
				<div class="flex flex-wrap items-end gap-3">
					<div class="flex flex-col gap-1">
						<label for="stmt-from" class="text-xs font-semibold text-slate-500">시작일</label>
						<input id="stmt-from" type="date" bind:value={periodFrom}
							class="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
					</div>
					<span class="mb-2.5 text-slate-400">~</span>
					<div class="flex flex-col gap-1">
						<label for="stmt-to" class="text-xs font-semibold text-slate-500">종료일</label>
						<input id="stmt-to" type="date" bind:value={periodTo}
							class="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
					</div>
					<div class="flex gap-2">
						<button type="button" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100" onclick={setThisMonth}>이번달</button>
						<button type="button" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100" onclick={setLastMonth}>지난달</button>
					</div>
					{#if statementData}
						<!-- 뷰 모드 전환 -->
						<div class="flex rounded-lg border border-slate-200 overflow-hidden">
							<button type="button"
								class="px-3 py-2 text-xs font-semibold transition-colors {stmtViewMode === 'pivot' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}"
								onclick={() => stmtViewMode = 'pivot'}>
								📊 피벗표
							</button>
							<button type="button"
								class="px-3 py-2 text-xs font-semibold transition-colors border-l border-slate-200 {stmtViewMode === 'daily' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}"
								onclick={() => stmtViewMode = 'daily'}>
								📅 일별상세
							</button>
						</div>
						<div class="ml-auto flex gap-2">
							<button type="button"
								class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 flex items-center gap-1.5"
								onclick={exportStatementExcel}>
								<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
								엑셀 저장
							</button>
						</div>
					{/if}
				</div>
			</div>

			{#if !statementData}
				<div class="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-16 text-center shadow-sm">
					<p class="text-4xl">📋</p>
					<p class="mt-3 text-lg font-bold text-emerald-700">거래내역이 없습니다</p>
					<p class="mt-1 text-sm text-emerald-600">선택한 기간에 출고 기록이 없거나, 거래처를 확인해 주세요.</p>
					<p class="mt-3 rounded-lg bg-emerald-100 px-4 py-2 text-xs text-emerald-700 inline-block">
						💡 "지난달" 버튼을 눌러 이전 달 데이터를 조회해보세요
					</p>
				</div>
			{:else}
				<!-- 요약 카드 -->
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
					<div class="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
						<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">출고일 수</p>
						<p class="mt-1 text-2xl font-black text-slate-800">{statementData.rows.length}<span class="ml-1 text-sm font-semibold text-slate-400">일</span></p>
					</div>
					<div class="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
						<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">품목 종류</p>
						<p class="mt-1 text-2xl font-black text-slate-800">{statementData.columns.length}<span class="ml-1 text-sm font-semibold text-slate-400">종</span></p>
					</div>
					<div class="col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center shadow-sm">
						<p class="text-xs font-semibold uppercase tracking-wide text-emerald-500">총 출고 수량</p>
						<p class="mt-1 text-2xl font-black text-emerald-700">{statementData.grandTotal.toLocaleString()}<span class="ml-1 text-sm font-semibold text-emerald-400">개</span></p>
					</div>
				</div>

				<!-- ━━ 피벗 뷰 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
				{#if stmtViewMode === 'pivot'}
					<!-- 품목이 많을 때 안내 -->
					{#if statementData.columns.length > 15}
						<div class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
							<span class="text-base">💡</span>
							<span>품목이 <strong>{statementData.columns.length}종</strong>으로 많습니다. 가로 스크롤로 전체 확인하거나 <button type="button" class="underline font-semibold" onclick={() => stmtViewMode = 'daily'}>일별 상세 뷰</button>로 전환해 보세요.</span>
						</div>
					{/if}

					<!-- 피벗 테이블 — 세로 최대높이 내부 스크롤 + 가로 스크롤 -->
					<div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
						<!-- 카테고리 색상 범례 -->
						<div class="flex items-center gap-4 border-b border-slate-100 px-4 py-2.5 bg-slate-50/50">
							{#each statementData.catGroups as cg (cg.category)}
								{@const dot = cg.category === 'towel' ? 'bg-sky-400' : cg.category === 'sheet' ? 'bg-indigo-400' : 'bg-amber-400'}
								{@const txt = cg.category === 'towel' ? 'text-sky-700' : cg.category === 'sheet' ? 'text-indigo-700' : 'text-amber-700'}
								<div class="flex items-center gap-1.5">
									<span class="h-2.5 w-2.5 rounded-full {dot}"></span>
									<span class="text-xs font-semibold {txt}">{cg.label} ({cg.count}종)</span>
								</div>
							{/each}
							<span class="ml-auto text-[10px] text-slate-400">← 가로 스크롤 가능</span>
						</div>

						<div class="overflow-x-auto" style="max-height: 70vh; overflow-y: auto;">
							<table class="border-collapse text-sm" style="min-width: max-content; width: 100%;">
								<thead class="sticky top-0 z-20">
									<!-- 카테고리 그룹 헤더 행 -->
									<tr class="border-b border-slate-200">
										<th class="sticky left-0 z-30 bg-slate-100 px-4 py-2 text-left text-xs font-bold text-slate-500 min-w-[96px] border-r border-slate-200" rowspan="1">
											날짜
										</th>
										{#each statementData.catGroups as cg (cg.category)}
											{@const bg = cg.category === 'towel' ? 'bg-sky-50 text-sky-700 border-sky-200' : cg.category === 'sheet' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'}
											<th colspan={cg.count}
												class="px-3 py-2 text-center text-xs font-bold border-x {bg}">
												{cg.label}
												<span class="ml-1 font-normal opacity-70">({cg.count}종)</span>
											</th>
										{/each}
										<th class="bg-slate-100 px-4 py-2 text-right text-xs font-bold text-slate-500 min-w-[72px] border-l border-slate-200">
											소계
										</th>
									</tr>
									<!-- 품목명 헤더 행 -->
									<tr class="border-b-2 border-slate-300">
										<th class="sticky left-0 z-30 bg-slate-100 px-4 py-2.5 text-left text-xs font-bold text-slate-400 border-r border-slate-200"></th>
										{#each statementData.columns as col, ci (col.key)}
											{@const isLastInGroup = ci === statementData.columns.length - 1 || statementData.columns[ci + 1]?.category !== col.category}
											{@const bg = col.category === 'towel' ? 'bg-sky-50/60' : col.category === 'sheet' ? 'bg-indigo-50/60' : 'bg-amber-50/60'}
											{@const txt = col.category === 'towel' ? 'text-sky-800' : col.category === 'sheet' ? 'text-indigo-800' : 'text-amber-800'}
											<th class="px-2 py-2.5 text-center text-xs font-bold min-w-[64px] whitespace-nowrap {bg} {txt} {isLastInGroup ? 'border-r border-slate-200' : ''}">
												{col.itemName}
											</th>
										{/each}
										<th class="bg-slate-100 px-4 py-2.5 text-right text-xs font-bold text-slate-400 border-l border-slate-200"></th>
									</tr>
								</thead>
								<tbody>
									{#each statementData.rows as row, ri (row.date)}
										<tr class="border-b border-slate-100 {ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-emerald-50/30 transition-colors">
											<td class="sticky left-0 z-10 {ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-r border-slate-100 px-4 py-2 font-semibold text-slate-700 whitespace-nowrap hover:bg-emerald-50/40">
												<span class="text-sm">{formatDateShort(row.date)}</span>
												<span class="ml-1 block text-[10px] font-normal text-slate-400">{['일','월','화','수','목','금','토'][new Date(row.date).getDay()]}</span>
											</td>
											{#each row.quantities as qty, ci (ci)}
												{@const col = statementData.columns[ci]}
												{@const isLastInGroup = ci === statementData.columns.length - 1 || statementData.columns[ci + 1]?.category !== col.category}
												{@const activeBg = col.category === 'towel' ? 'bg-sky-50 text-sky-800 font-semibold' : col.category === 'sheet' ? 'bg-indigo-50 text-indigo-800 font-semibold' : 'bg-amber-50 text-amber-800 font-semibold'}
												<td class="px-2 py-2 text-center text-sm {qty > 0 ? activeBg : ''} {isLastInGroup ? 'border-r border-slate-100' : ''}">
													{qty > 0 ? qty.toLocaleString() : ''}
												</td>
											{/each}
											<td class="border-l border-slate-100 px-4 py-2 text-right font-bold text-slate-800">
												{row.total.toLocaleString()}
											</td>
										</tr>
									{/each}
								</tbody>
								<tfoot class="sticky bottom-0 z-20">
									<!-- 카테고리별 소계 행 -->
									<tr class="border-t border-slate-300 bg-slate-100">
										<td class="sticky left-0 z-30 bg-slate-100 border-r border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 whitespace-nowrap">카테고리 계</td>
										{#each statementData.columns as col, ci (col.key)}
											{@const isLastInGroup = ci === statementData.columns.length - 1 || statementData.columns[ci + 1]?.category !== col.category}
											{@const txt = col.category === 'towel' ? 'text-sky-700' : col.category === 'sheet' ? 'text-indigo-700' : 'text-amber-700'}
											<td class="px-2 py-2 text-center text-xs font-bold {txt} {isLastInGroup ? 'border-r border-slate-200' : ''}">
												{statementData.colTotals[ci] > 0 ? statementData.colTotals[ci].toLocaleString() : ''}
											</td>
										{/each}
										<td class="border-l border-slate-200 px-4 py-2 text-right text-xs font-bold text-slate-600">{statementData.grandTotal.toLocaleString()}</td>
									</tr>
									<!-- 총합 행 -->
									<tr class="border-t border-indigo-300 bg-indigo-50">
										<td class="sticky left-0 z-30 bg-indigo-50 border-r border-indigo-200 px-4 py-3 font-extrabold text-indigo-700 whitespace-nowrap">합 계</td>
										{#each statementData.catGroups as cg (cg.category)}
											{@const txt = cg.category === 'towel' ? 'text-sky-700' : cg.category === 'sheet' ? 'text-indigo-700' : 'text-amber-700'}
											{@const bg = cg.category === 'towel' ? 'bg-sky-50' : cg.category === 'sheet' ? 'bg-indigo-50' : 'bg-amber-50'}
											<td colspan={cg.count} class="px-3 py-3 text-center font-extrabold {txt} {bg} border-x border-indigo-200">
												{(statementData.catTotals[cg.category] ?? 0).toLocaleString()}
												<span class="ml-0.5 text-[10px] font-normal opacity-60">개</span>
											</td>
										{/each}
										<td class="border-l border-indigo-200 px-4 py-3 text-right font-black text-indigo-700 text-base">{statementData.grandTotal.toLocaleString()}</td>
									</tr>
								</tfoot>
							</table>
						</div>
					</div>

				<!-- ━━ 일별 상세 뷰 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
				{:else}
					<div class="space-y-3">
						{#each statementData.dailyRows as drow (drow.date)}
							{@const dow = ['일','월','화','수','목','금','토'][new Date(drow.date).getDay()]}
							{@const isWeekend = new Date(drow.date).getDay() === 0 || new Date(drow.date).getDay() === 6}
							<div class="overflow-hidden rounded-2xl border {isWeekend ? 'border-slate-300' : 'border-slate-200'} bg-white shadow-sm">
								<!-- 날짜 헤더 -->
								<div class="flex items-center justify-between border-b border-slate-100 px-4 py-3 {isWeekend ? 'bg-slate-100' : 'bg-slate-50'}">
									<div class="flex items-center gap-2.5">
										<span class="flex h-8 w-8 items-center justify-center rounded-full {isWeekend ? 'bg-slate-300 text-slate-700' : 'bg-emerald-100 text-emerald-700'} text-sm font-black">
											{new Date(drow.date).getDate()}
										</span>
										<div>
											<span class="text-sm font-bold text-slate-700">{drow.date.slice(0,7).replace('-','년 ')}월 {new Date(drow.date).getDate()}일</span>
											<span class="ml-1.5 text-xs font-semibold {isWeekend ? 'text-slate-500' : 'text-emerald-600'}">({dow})</span>
										</div>
										<span class="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
											{drow.items.length}종 출고
										</span>
									</div>
									<div class="text-right">
										<span class="text-xs text-slate-400">출고 합계</span>
										<span class="ml-2 text-base font-black text-slate-800">{drow.total.toLocaleString()}<span class="ml-0.5 text-xs font-normal text-slate-400">개</span></span>
									</div>
								</div>
								<!-- 품목 목록 — 카테고리별로 묶어 표시 -->
								<div class="p-3">
									{#each (['towel','sheet','uniform'] as const) as cat (cat)}
										{@const catItems = drow.items.filter(it => it.category === cat)}
										{#if catItems.length > 0}
											{@const catColor = cat === 'towel' ? 'text-sky-600 border-sky-200 bg-sky-50' : cat === 'sheet' ? 'text-indigo-600 border-indigo-200 bg-indigo-50' : 'text-amber-600 border-amber-200 bg-amber-50'}
											{@const dotColor = cat === 'towel' ? 'bg-sky-400' : cat === 'sheet' ? 'bg-indigo-400' : 'bg-amber-400'}

											<div class="mb-2 last:mb-0">
												<div class="mb-1.5 flex items-center gap-1.5">
													<span class="h-2 w-2 rounded-full {dotColor}"></span>
													<span class="text-[10px] font-bold uppercase tracking-wide {cat === 'towel' ? 'text-sky-600' : cat === 'sheet' ? 'text-indigo-600' : 'text-amber-600'}">
														{CATEGORY_LABELS[cat]}
													</span>
													<span class="text-[10px] text-slate-400">({catItems.length}종)</span>
												</div>
												<div class="flex flex-wrap gap-1.5">
													{#each catItems as it (it.itemName)}
														<div class="flex items-center gap-1.5 rounded-lg border {catColor} px-2.5 py-1.5">
															<span class="text-xs font-medium">{it.itemName}</span>
															<span class="rounded-md bg-white/70 px-1.5 py-0.5 text-xs font-black">{it.quantity.toLocaleString()}</span>
														</div>
													{/each}
												</div>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<!-- ═══════════════ 청구서 인쇄 영역 ═══════════════ -->
{#if true}
	{@const inv         = viewingInvoice}
	{@const printLines  = inv ? inv.lines     : invoiceLines}
	{@const printFrom   = inv ? inv.periodFrom : periodFrom}
	{@const printTo     = inv ? inv.periodTo   : periodTo}
	{@const printTotal  = inv ? inv.totalAmount : invoiceTotal}
	{@const printMemo   = inv ? inv.memo        : invoiceMemo}
	{@const printClient = selectedClient}

	<div id="billing-invoice-print" style="display:none;">
		<div style="max-width:700px; margin:0 auto; font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif; color:#1e293b;">

			<!-- 제목 -->
			<div style="text-align:center; margin-bottom:28px; padding-bottom:16px; border-bottom:2px solid #e2e8f0;">
				<h1 style="margin:0; font-size:28px; font-weight:900; letter-spacing:0.15em; color:#0f172a;">세 탁 청 구 서</h1>
				<p style="margin:6px 0 0; font-size:13px; color:#64748b;">청구 기간: {printFrom} ~ {printTo}</p>
			</div>

			<!-- 거래처 + 청구 정보 -->
			<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
				<div style="border:1px solid #e2e8f0; border-radius:8px; padding:16px;">
					<p style="margin:0 0 8px; font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em;">공급받는 자 (거래처)</p>
					<p style="margin:0 0 4px; font-size:16px; font-weight:800; color:#0f172a;">{printClient?.name ?? '—'}</p>
					{#if printClient?.businessNo}
						<p style="margin:2px 0; font-size:11px; color:#475569;">사업자번호: {printClient.businessNo}</p>
					{/if}
					{#if printClient?.ownerName}
						<p style="margin:2px 0; font-size:11px; color:#475569;">대표자: {printClient.ownerName}</p>
					{/if}
					{#if printClient?.address}
						<p style="margin:2px 0; font-size:11px; color:#475569;">주소: {printClient.address}</p>
					{/if}
					{#if printClient?.phone}
						<p style="margin:2px 0; font-size:11px; color:#475569;">연락처: {printClient.phone}</p>
					{/if}
				</div>

				<div style="border:1px solid #e2e8f0; border-radius:8px; padding:16px;">
					<p style="margin:0 0 8px; font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em;">청구 정보</p>
					<table style="width:100%; border-collapse:collapse; font-size:12px;">
						<tbody>
							<tr>
								<td style="padding:3px 0; color:#64748b; width:70px;">청구 기간</td>
								<td style="padding:3px 0; font-weight:600; color:#334155; text-align:right;">{printFrom} ~ {printTo}</td>
							</tr>
							<tr>
								<td style="padding:3px 0; color:#64748b;">총 수량</td>
								<td style="padding:3px 0; font-weight:600; color:#334155; text-align:right;">{printLines.reduce((s,l)=>s+l.quantity,0).toLocaleString()}개</td>
							</tr>
							<tr>
								<td style="padding:3px 0; color:#64748b;">발행일</td>
								<td style="padding:3px 0; font-weight:600; color:#334155; text-align:right;">{new Date().toISOString().slice(0,10)}</td>
							</tr>
							<tr style="border-top:1px solid #e2e8f0;">
								<td style="padding:8px 0 3px; font-weight:800; color:#334155; font-size:13px;">청구 금액</td>
								<td style="padding:8px 0 3px; font-weight:900; color:#4338ca; text-align:right; font-size:18px; white-space:nowrap;">{printTotal.toLocaleString()}원</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- 품목 테이블 -->
			<table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:20px;">
				<colgroup>
					<col style="width:30%;"/>
					<col style="width:12%;"/>
					<col style="width:12%;"/>
					<col style="width:20%;"/>
					<col style="width:26%;"/>
				</colgroup>
				<thead>
					<tr style="background:#f8fafc; border-top:2px solid #e2e8f0; border-bottom:2px solid #e2e8f0;">
						<th style="padding:9px 12px; text-align:left; font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">품목명</th>
						<th style="padding:9px 12px; text-align:center; font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">카테고리</th>
						<th style="padding:9px 12px; text-align:right; font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">수량</th>
						<th style="padding:9px 12px; text-align:right; font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">단가</th>
						<th style="padding:9px 12px; text-align:right; font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">금액</th>
					</tr>
				</thead>
				<tbody>
					{#each printLines as line, i (line.category + line.itemName)}
						<tr style="border-bottom:1px solid #f1f5f9; background:{i % 2 === 1 ? '#fafafa' : 'white'};">
							<td style="padding:8px 12px; font-weight:500; color:#334155; word-break:keep-all;">{line.itemName}</td>
							<td style="padding:8px 12px; text-align:center; color:#64748b; white-space:nowrap;">{CATEGORY_LABELS[line.category]}</td>
							<td style="padding:8px 12px; text-align:right; color:#475569; white-space:nowrap;">{line.quantity.toLocaleString()}</td>
							<td style="padding:8px 12px; text-align:right; color:#64748b; white-space:nowrap;">{line.unitPrice > 0 ? line.unitPrice.toLocaleString()+'원' : '—'}</td>
							<td style="padding:8px 12px; text-align:right; font-weight:700; color:#1e293b; white-space:nowrap;">{line.amount.toLocaleString()}원</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr style="border-top:2px solid #c7d2fe; background:#eef2ff;">
						<td colspan="2" style="padding:11px 12px; font-weight:800; color:#334155; font-size:13px;">합계</td>
						<td style="padding:11px 12px; text-align:right; font-weight:800; color:#334155; white-space:nowrap;">{printLines.reduce((s,l)=>s+l.quantity,0).toLocaleString()}</td>
						<td style="padding:11px 12px;"></td>
						<td style="padding:11px 12px; text-align:right; font-size:16px; font-weight:900; color:#4338ca; white-space:nowrap;">{printTotal.toLocaleString()}원</td>
					</tr>
				</tfoot>
			</table>

			{#if printMemo}
				<div style="border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:20px;">
					<p style="margin:0 0 6px; font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em;">메모</p>
					<p style="margin:0; font-size:12px; color:#475569; line-height:1.6;">{printMemo}</p>
				</div>
			{/if}

			<div style="border-top:1px solid #e2e8f0; padding-top:16px; text-align:center;">
				<p style="margin:0; font-size:10px; color:#94a3b8;">본 청구서는 세탁 관리 시스템에서 자동 생성되었습니다.</p>
			</div>
		</div>
	</div>
{/if}

<!-- ═══════════════ 거래내역서 인쇄 영역 ═══════════════ -->
{#if statementData}
	{@const sd = statementData}
	<div id="billing-statement-print" style="display:none;">
		<div style="font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif; color:#1e293b;">

			<!-- 제목 -->
			<div style="text-align:center; margin-bottom:20px; padding-bottom:12px; border-bottom:2px solid #e2e8f0;">
				<h1 style="margin:0; font-size:24px; font-weight:900; letter-spacing:0.15em; color:#0f172a;">세 탁 거 래 내 역 서</h1>
				<p style="margin:6px 0 0; font-size:12px; color:#64748b;">
					거래처: {selectedClient?.name ?? '—'} &nbsp;|&nbsp; 기간: {periodFrom} ~ {periodTo}
				</p>
				<p style="margin:4px 0 0; font-size:11px; color:#94a3b8;">발행일: {new Date().toISOString().slice(0,10)} &nbsp;|&nbsp; 총 출고 수량: {sd.grandTotal.toLocaleString()}개 &nbsp;|&nbsp; 품목 {sd.columns.length}종 / {sd.rows.length}일</p>
			</div>

			<!-- 카테고리별 소계 요약 -->
			<div style="display:flex; gap:12px; margin-bottom:16px;">
				{#each sd.catGroups as cg (cg.category)}
					{@const bg = cg.category === 'towel' ? '#f0f9ff' : cg.category === 'sheet' ? '#eef2ff' : '#fffbeb'}
					{@const border = cg.category === 'towel' ? '#bae6fd' : cg.category === 'sheet' ? '#c7d2fe' : '#fde68a'}
					{@const color = cg.category === 'towel' ? '#0369a1' : cg.category === 'sheet' ? '#4338ca' : '#92400e'}
					<div style="flex:1; border:1px solid {border}; border-radius:8px; padding:10px 14px; background:{bg}; text-align:center;">
						<p style="margin:0 0 4px; font-size:10px; font-weight:700; color:{color}; text-transform:uppercase; letter-spacing:0.06em;">{cg.label} ({cg.count}종)</p>
						<p style="margin:0; font-size:18px; font-weight:900; color:{color};">{(sd.catTotals[cg.category] ?? 0).toLocaleString()}<span style="font-size:11px; font-weight:500; margin-left:2px;">개</span></p>
					</div>
				{/each}
				<div style="flex:1.2; border:2px solid #c7d2fe; border-radius:8px; padding:10px 14px; background:#eef2ff; text-align:center;">
					<p style="margin:0 0 4px; font-size:10px; font-weight:700; color:#4338ca; text-transform:uppercase; letter-spacing:0.06em;">총 합계</p>
					<p style="margin:0; font-size:20px; font-weight:900; color:#4338ca;">{sd.grandTotal.toLocaleString()}<span style="font-size:11px; font-weight:500; margin-left:2px;">개</span></p>
				</div>
			</div>

			<!-- 피벗 테이블 -->
			<table style="width:100%; border-collapse:collapse; font-size:10px;">
				<thead>
					<!-- 카테고리 그룹 헤더 -->
					<tr style="border-top:2px solid #e2e8f0;">
						<th style="padding:6px 10px; text-align:left; font-size:9px; color:#64748b; font-weight:700; background:#f8fafc; white-space:nowrap; min-width:68px; border-bottom:1px solid #e2e8f0;">날짜</th>
						{#each sd.catGroups as cg (cg.category)}
							{@const bg = cg.category === 'towel' ? '#f0f9ff' : cg.category === 'sheet' ? '#eef2ff' : '#fffbeb'}
							{@const color = cg.category === 'towel' ? '#0369a1' : cg.category === 'sheet' ? '#4338ca' : '#92400e'}
							{@const border = cg.category === 'towel' ? '#bae6fd' : cg.category === 'sheet' ? '#c7d2fe' : '#fde68a'}
							<th colspan={cg.count}
								style="padding:6px 4px; text-align:center; font-size:10px; font-weight:700; background:{bg}; color:{color}; border-left:2px solid {border}; border-right:2px solid {border}; border-bottom:1px solid {border};">
								{cg.label} ({cg.count}종)
							</th>
						{/each}
						<th style="padding:6px 10px; text-align:right; font-size:9px; color:#64748b; font-weight:700; background:#f8fafc; white-space:nowrap; border-bottom:1px solid #e2e8f0;">소계</th>
					</tr>
					<!-- 품목명 헤더 -->
					<tr style="border-bottom:2px solid #e2e8f0;">
						<th style="padding:5px 10px; background:#f8fafc;"></th>
						{#each sd.columns as col, ci (col.key)}
							{@const isLast = ci === sd.columns.length - 1 || sd.columns[ci + 1]?.category !== col.category}
							{@const bg = col.category === 'towel' ? '#f0f9ff' : col.category === 'sheet' ? '#eef2ff' : '#fffbeb'}
							{@const color = col.category === 'towel' ? '#075985' : col.category === 'sheet' ? '#3730a3' : '#78350f'}
							{@const borderR = isLast ? (col.category === 'towel' ? '2px solid #bae6fd' : col.category === 'sheet' ? '2px solid #c7d2fe' : '2px solid #fde68a') : '1px solid #f1f5f9'}
							<th style="padding:5px 4px; text-align:center; font-size:9px; font-weight:700; background:{bg}; color:{color}; white-space:nowrap; border-right:{borderR};">
								{col.itemName}
							</th>
						{/each}
						<th style="padding:5px 10px; background:#f8fafc;"></th>
					</tr>
				</thead>
				<tbody>
					{#each sd.rows as row, ri (row.date)}
						<tr style="border-bottom:1px solid #f1f5f9; background:{ri % 2 === 1 ? '#fafafa' : 'white'};">
							<td style="padding:5px 10px; font-weight:600; color:#334155; white-space:nowrap; font-size:10px;">{row.date.slice(5)}</td>
							{#each row.quantities as qty, ci (ci)}
								{@const col = sd.columns[ci]}
								{@const isLast = ci === sd.columns.length - 1 || sd.columns[ci + 1]?.category !== col.category}
								{@const borderR = isLast ? (col.category === 'towel' ? '1px solid #bae6fd' : col.category === 'sheet' ? '1px solid #c7d2fe' : '1px solid #fde68a') : 'none'}
								{@const activeColor = col.category === 'towel' ? '#0369a1' : col.category === 'sheet' ? '#4338ca' : '#92400e'}
								<td style="padding:5px 4px; text-align:center; color:{qty > 0 ? activeColor : 'transparent'}; font-weight:{qty > 0 ? '600' : '400'}; border-right:{borderR};">
									{qty > 0 ? qty.toLocaleString() : ''}
								</td>
							{/each}
							<td style="padding:5px 10px; text-align:right; font-weight:700; color:#1e293b;">{row.total.toLocaleString()}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<!-- 품목별 합계 -->
					<tr style="border-top:1px solid #cbd5e1; background:#f8fafc;">
						<td style="padding:6px 10px; font-size:9px; font-weight:700; color:#64748b; white-space:nowrap;">품목 계</td>
						{#each sd.colTotals as total, ci (ci)}
							{@const col = sd.columns[ci]}
							{@const isLast = ci === sd.columns.length - 1 || sd.columns[ci + 1]?.category !== col.category}
							{@const color = col.category === 'towel' ? '#0369a1' : col.category === 'sheet' ? '#4338ca' : '#92400e'}
							{@const borderR = isLast ? (col.category === 'towel' ? '2px solid #bae6fd' : col.category === 'sheet' ? '2px solid #c7d2fe' : '2px solid #fde68a') : 'none'}
							<td style="padding:6px 4px; text-align:center; font-weight:700; color:{color}; font-size:10px; border-right:{borderR};">
								{total > 0 ? total.toLocaleString() : ''}
							</td>
						{/each}
						<td style="padding:6px 10px; text-align:right; font-weight:700; color:#475569; font-size:10px;">{sd.grandTotal.toLocaleString()}</td>
					</tr>
					<!-- 카테고리 합계 -->
					<tr style="border-top:2px solid #c7d2fe; background:#eef2ff;">
						<td style="padding:8px 10px; font-weight:800; color:#334155;">카테고리 계</td>
						{#each sd.catGroups as cg (cg.category)}
							{@const color = cg.category === 'towel' ? '#0369a1' : cg.category === 'sheet' ? '#4338ca' : '#92400e'}
							{@const bg = cg.category === 'towel' ? '#e0f2fe' : cg.category === 'sheet' ? '#e0e7ff' : '#fef3c7'}
							{@const border = cg.category === 'towel' ? '2px solid #bae6fd' : cg.category === 'sheet' ? '2px solid #c7d2fe' : '2px solid #fde68a'}
							<td colspan={cg.count} style="padding:8px 6px; text-align:center; font-weight:800; color:{color}; background:{bg}; font-size:12px; border-left:{border}; border-right:{border};">
								{(sd.catTotals[cg.category] ?? 0).toLocaleString()}
							</td>
						{/each}
						<td style="padding:8px 10px; text-align:right; font-weight:900; color:#4338ca; font-size:13px;">{sd.grandTotal.toLocaleString()}</td>
					</tr>
				</tfoot>
			</table>

			<div style="border-top:1px solid #e2e8f0; padding-top:12px; margin-top:20px; text-align:center;">
				<p style="margin:0; font-size:10px; color:#94a3b8;">본 거래내역서는 세탁 관리 시스템에서 자동 생성되었습니다.</p>
			</div>
		</div>
	</div>
{/if}


<!-- ═══════════════ 청구서 저장 확인 모달 ═══════════════ -->
{#if showSaveConfirm}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
		role="dialog" aria-modal="true">
		<div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
			<h3 class="mb-2 text-base font-extrabold text-slate-800">청구서 저장</h3>
			<p class="mb-1 text-sm text-slate-600">
				<span class="font-bold text-indigo-700">{selectedClient?.name}</span>의
				{formatDate(periodFrom)} ~ {formatDate(periodTo)} 청구서를 저장하시겠습니까?
			</p>
			<p class="text-xs text-slate-400">
				저장된 청구서는 왼쪽 패널에서 다시 열람하거나 인쇄할 수 있습니다.<br/>
				같은 기간의 청구서도 중복 저장됩니다.
			</p>
			<div class="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
				<button type="button" class="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200" onclick={() => (showSaveConfirm = false)}>취소</button>
				<button type="button" class="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-600" onclick={doSaveInvoice}>저장</button>
			</div>
		</div>
	</div>
{/if}

<!-- ═══════════════ 저장된 청구서 열람 모달 ═══════════════ -->
{#if viewingInvoice}
	{@const inv = viewingInvoice}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
		role="dialog" aria-modal="true"
		onclick={(e) => { if (e.target === e.currentTarget) viewingInvoiceId = null; }}>
		<div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
			<div class="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
				<div>
					<h3 class="text-base font-extrabold text-slate-800">저장된 청구서</h3>
					<p class="text-xs text-slate-400">{formatDate(inv.periodFrom)} ~ {formatDate(inv.periodTo)}</p>
				</div>
				<div class="flex items-center gap-2">
					<button type="button"
						class="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100"
						onclick={printInvoice}>🖨️ 인쇄</button>
					<button type="button"
						class="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-100"
						onclick={() => { if (confirm('이 청구서를 삭제할까요?')) { store.removeInvoice(inv.id); viewingInvoiceId = null; } }}>🗑️ 삭제</button>
					<button type="button"
						class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
						onclick={() => (viewingInvoiceId = null)} aria-label="닫기">✕</button>
				</div>
			</div>
			<div class="p-6">
				<div class="mb-5 grid grid-cols-3 gap-3">
					<div class="rounded-xl bg-slate-50 p-3 text-center">
						<p class="text-xs text-slate-400">기간</p>
						<p class="mt-1 text-xs font-bold text-slate-700">{formatDate(inv.periodFrom)}</p>
						<p class="text-xs font-bold text-slate-700">~ {formatDate(inv.periodTo)}</p>
					</div>
					<div class="rounded-xl bg-slate-50 p-3 text-center">
						<p class="text-xs text-slate-400">총 수량</p>
						<p class="mt-1 text-lg font-black text-slate-800">{inv.lines.reduce((s,l)=>s+l.quantity,0).toLocaleString()}개</p>
					</div>
					<div class="rounded-xl bg-indigo-50 p-3 text-center">
						<p class="text-xs text-indigo-400">청구 금액</p>
						<p class="mt-1 text-lg font-black text-indigo-700">{formatMoney(inv.totalAmount)}</p>
					</div>
				</div>
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-100 bg-slate-50">
							<th class="px-4 py-2.5 text-left text-xs font-semibold text-slate-400">품목명</th>
							<th class="w-20 px-4 py-2.5 text-left text-xs font-semibold text-slate-400">카테고리</th>
							<th class="w-16 px-4 py-2.5 text-right text-xs font-semibold text-slate-400">수량</th>
							<th class="w-28 px-4 py-2.5 text-right text-xs font-semibold text-slate-400">단가</th>
							<th class="w-28 px-4 py-2.5 text-right text-xs font-semibold text-slate-400">금액</th>
						</tr>
					</thead>
					<tbody>
						{#each inv.lines as line (line.category + line.itemName)}
							<tr class="border-b border-slate-50 hover:bg-slate-50">
								<td class="px-4 py-2.5 font-medium text-slate-700">{line.itemName}</td>
								<td class="w-20 px-4 py-2.5">
									<span class="rounded-full px-2 py-0.5 text-xs font-semibold {categoryBadge[line.category]}">
										{CATEGORY_LABELS[line.category]}
									</span>
								</td>
								<td class="w-16 whitespace-nowrap px-4 py-2.5 text-right text-slate-600">{line.quantity.toLocaleString()}</td>
								<td class="w-28 whitespace-nowrap px-4 py-2.5 text-right text-slate-500">{formatMoney(line.unitPrice)}</td>
								<td class="w-28 whitespace-nowrap px-4 py-2.5 text-right font-bold text-slate-800">{formatMoney(line.amount)}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="border-t-2 border-slate-200 bg-indigo-50">
							<td colspan="2" class="px-4 py-3 font-extrabold text-slate-700">합계</td>
							<td class="w-16 whitespace-nowrap px-4 py-3 text-right font-extrabold text-slate-700">{inv.lines.reduce((s,l)=>s+l.quantity,0).toLocaleString()}</td>
							<td class="w-28 px-4 py-3"></td>
							<td class="w-28 whitespace-nowrap px-4 py-3 text-right text-base font-black text-indigo-700">{formatMoney(inv.totalAmount)}</td>
						</tr>
					</tfoot>
				</table>
				{#if inv.memo}
					<div class="mt-4 rounded-xl bg-slate-50 p-4">
						<p class="text-xs font-bold text-slate-400">메모</p>
						<p class="mt-1 text-sm text-slate-600">{inv.memo}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* ── 인쇄 전용 전역 스타일 ── */
	@media print {
		/* 화면 UI 전체 숨기기 */
		:global(#billing-screen-ui) { visibility: hidden !important; }

		/* 기본: 두 인쇄 영역 모두 숨김 */
		:global(#billing-invoice-print),
		:global(#billing-statement-print) {
			display: none !important;
			visibility: hidden !important;
		}

		/* 청구서 인쇄 모드 */
		:global(body.print-invoice #billing-screen-ui)    { display: none !important; }
		:global(body.print-invoice #billing-invoice-print) {
			display: block !important;
			visibility: visible !important;
			position: fixed !important;
			top: 0 !important; left: 0 !important;
			width: 100% !important;
			background: white !important;
			padding: 32px !important;
			box-sizing: border-box !important;
			z-index: 99999 !important;
		}

		/* 거래내역서 인쇄 모드 */
		:global(body.print-statement #billing-screen-ui)      { display: none !important; }
		:global(body.print-statement #billing-statement-print) {
			display: block !important;
			visibility: visible !important;
			position: fixed !important;
			top: 0 !important; left: 0 !important;
			width: 100% !important;
			background: white !important;
			padding: 32px !important;
			box-sizing: border-box !important;
			z-index: 99999 !important;
		}

		@page { margin: 10mm; }

		:global(body.print-statement) {
			size: A4 landscape;
		}
	}
</style>