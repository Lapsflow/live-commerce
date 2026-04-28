/** Type declarations for solapi SDK (installed when NOTIFICATION_PROVIDER=solapi) */
declare module "solapi" {
  interface SendOptions {
    to: string;
    from: string;
    text?: string;
    type?: string;
    subject?: string;
    kakaoOptions?: {
      pfId: string;
      templateId: string;
      variables?: Record<string, string>;
    };
  }

  interface SendResult {
    groupId?: string;
    messageId?: string;
  }

  class SolapiMessageService {
    constructor(apiKey: string, apiSecret: string);
    send(options: SendOptions): Promise<SendResult>;
  }

  export default SolapiMessageService;
}
