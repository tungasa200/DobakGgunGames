// 이 파일은 sockjs-client + @types/sockjs-client 설치 전 tsc 체크를 위한 타입 선언입니다.
// npm install 완료 후 @types/sockjs-client가 설치되면 이 파일은 자동으로 override됩니다.
// 실제 타입과 충돌하면 이 파일을 삭제하세요.
declare module 'sockjs-client' {
  class SockJS {
    constructor(url: string, _reserved?: unknown, options?: object);
    close(code?: number, reason?: string): void;
    send(data: string): void;
    onopen: ((e: Event) => void) | null;
    onmessage: ((e: MessageEvent) => void) | null;
    onclose: ((e: CloseEvent) => void) | null;
    onerror: ((e: Event) => void) | null;
    readyState: number;
  }
  export default SockJS;
}
