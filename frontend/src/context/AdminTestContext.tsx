import { createContext, useCallback, useContext, useRef } from 'react';
import type { ReactNode } from 'react';

interface AdminTestContextValue {
  /** 현재 게임 페이지에서 호출할 강제 클리어 함수를 등록 */
  register: (fn: () => void) => void;
  /** 등록된 강제 클리어 함수를 실행 */
  trigger: () => void;
}

const AdminTestContext = createContext<AdminTestContextValue>({
  register: () => {},
  trigger: () => {},
});

export function AdminTestProvider({ children }: { children: ReactNode }) {
  const fnRef = useRef<() => void>(() => {});

  const register = useCallback((fn: () => void) => {
    fnRef.current = fn;
  }, []);

  const trigger = useCallback(() => {
    fnRef.current();
  }, []);

  return (
    <AdminTestContext.Provider value={{ register, trigger }}>
      {children}
    </AdminTestContext.Provider>
  );
}

export function useAdminTest() {
  return useContext(AdminTestContext);
}
