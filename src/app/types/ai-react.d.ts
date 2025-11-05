// src/types/ai-react.d.ts
declare module 'ai/react' {
  // minimal types so TS won't error while you build.
  export function useChat(...args: any[]): any;
  export const useCompletion: any;
  export const useSomeOtherExport: any;
  export default any;
}
