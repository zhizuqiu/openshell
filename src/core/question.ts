import { EventEmitter } from "events";

export type QuestionType = "text" | "choice" | "yesno";

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionRequest {
  id: string;
  questions: Array<{
    type: QuestionType;
    question: string;
    header: string;
    options?: QuestionOption[];
    multiple?: boolean;
    placeholder?: string;
  }>;
}

export interface QuestionResponse {
  requestId: string;
  answers: string[][]; // 每个问题的答案列表（支持多选）
}

class QuestionManager extends EventEmitter {
  private currentRequest: QuestionRequest | null = null;
  private resolver: ((answers: string[][]) => void) | null = null;
  private rejecter: ((reason: any) => void) | null = null;

  /**
   * 向 UI 发起提问请求
   */
  async ask(request: QuestionRequest): Promise<string[][]> {
    if (this.currentRequest) {
      throw new Error("Another question is already in progress");
    }

    this.currentRequest = request;
    this.emit("question_requested", request);

    return new Promise((resolve, reject) => {
      this.resolver = resolve;
      this.rejecter = reject;
    });
  }

  /**
   * UI 提交答案
   */
  submit(response: QuestionResponse) {
    if (!this.currentRequest || this.currentRequest.id !== response.requestId) {
      return;
    }

    const resolve = this.resolver;
    this.clear();
    resolve?.(response.answers);
  }

  /**
   * 用户取消提问
   */
  cancel(requestId: string) {
    if (!this.currentRequest || this.currentRequest.id !== requestId) {
      return;
    }

    const reject = this.rejecter;
    this.clear();
    reject?.(new Error("User cancelled the question"));
  }

  private clear() {
    this.currentRequest = null;
    this.resolver = null;
    this.rejecter = null;
  }

  getCurrentRequest() {
    return this.currentRequest;
  }
}

export const questionManager = new QuestionManager();

export class Question {
  static async ask(request: QuestionRequest) {
    return questionManager.ask(request);
  }
}

export class QuestionRejectedError extends Error {
  constructor() {
    super("Question rejected by user");
  }
}
