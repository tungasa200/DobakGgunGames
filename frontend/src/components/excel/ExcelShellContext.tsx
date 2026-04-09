import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// ===== 타입 =====
export interface StatusItem {
  label: string;
  value: string | number;
}

export type SheetTab = 'game' | 'ranking' | 'rules';

interface ExcelShellContextValue {
  // 수식바 상태
  formulaCell: string;
  formulaContent: string;
  // 상태바 왼쪽 항목
  statusItems: StatusItem[];
  // 시트 탭
  activeSheet: SheetTab;
  setActiveSheet: (sheet: SheetTab) => void;
  // 업데이트 함수
  setFormula: (cell: string, content: string) => void;
  setStatusItems: (items: StatusItem[]) => void;
}

const noop = () => {};

const defaultValue: ExcelShellContextValue = {
  formulaCell: 'A1',
  formulaContent: '',
  statusItems: [],
  activeSheet: 'game',
  setActiveSheet: noop,
  setFormula: noop,
  setStatusItems: noop,
};

export const ExcelShellContext = createContext<ExcelShellContextValue>(defaultValue);

// ===== Provider =====
export function ExcelShellProvider({ children }: { children: ReactNode }) {
  const [formulaCell, setFormulaCell] = useState('A1');
  const [formulaContent, setFormulaContent] = useState('');
  const [statusItems, setStatusItemsState] = useState<StatusItem[]>([]);
  const [activeSheet, setActiveSheet] = useState<SheetTab>('game');

  // 불필요한 리렌더 방지: 값이 바뀔 때만 갱신
  const prevCell    = useRef('A1');
  const prevContent = useRef('');

  const setFormula = useCallback((cell: string, content: string) => {
    if (cell !== prevCell.current) { prevCell.current = cell; setFormulaCell(cell); }
    if (content !== prevContent.current) { prevContent.current = content; setFormulaContent(content); }
  }, []);

  const setStatusItems = useCallback((items: StatusItem[]) => {
    setStatusItemsState(items);
  }, []);

  return (
    <ExcelShellContext.Provider value={{ formulaCell, formulaContent, statusItems, activeSheet, setActiveSheet, setFormula, setStatusItems }}>
      {children}
    </ExcelShellContext.Provider>
  );
}

// ===== 훅 (게임 컴포넌트에서 사용) =====
export function useExcelShell() {
  return useContext(ExcelShellContext);
}
