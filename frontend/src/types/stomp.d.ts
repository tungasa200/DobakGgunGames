// 이 파일은 @stomp/stompjs 설치 전 tsc 체크를 위한 최소 타입 선언입니다.
// npm install 완료 후 @stomp/stompjs가 설치되면 이 파일은 자동으로 override됩니다.
// 실제 타입과 충돌하면 이 파일을 삭제하세요.
declare module '@stomp/stompjs' {
  interface IMessage {
    body: string;
    headers: Record<string, string>;
    ack(): void;
    nack(): void;
  }

  interface StompSubscription {
    id: string;
    unsubscribe(): void;
  }

  interface ClientConfig {
    webSocketFactory?: () => WebSocket;
    brokerURL?: string;
    connectHeaders?: Record<string, string>;
    reconnectDelay?: number;
    onConnect?: (frame: IFrame) => void;
    onDisconnect?: (frame: IFrame) => void;
    onStompError?: (frame: IFrame) => void;
    onWebSocketError?: (evt: Event) => void;
  }

  interface IFrame {
    command: string;
    headers: Record<string, string>;
    body: string;
  }

  export class Client {
    constructor(config: ClientConfig);
    connected: boolean;
    activate(): void;
    deactivate(): Promise<void>;
    subscribe(destination: string, callback: (message: IMessage) => void): StompSubscription;
    publish(params: { destination: string; body?: string; headers?: Record<string, string> }): void;
  }
}
