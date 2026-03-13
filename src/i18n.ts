/**
 * Internationalization (i18n) support
 * Supports Chinese (zh-CN) and English (en-US)
 * Default: en-US
 */

export type Language = "zh-CN" | "en-US";

interface Translations {
  app: {
    title: string;
    version: string;
    ready: string;
    initializing: string;
    welcome: string;
    agentInitialized: string;
    systemReady: string;
    systemContext: string;
    askAnything: string;
    exitHint: string;
    agentError: string;
    systemNotConfigured: string;
    aiNotConfigured: string;
    builtInCommands: string;
    debugMode: string;
    context: string;
    namespace: string;
    tipsLabel: string;
    tipInit: string;
    tipNewLine: string;
    tipReset: string;
    recentActivity: string;
    footerShortcuts: string;
  };
  help: {
    availableCommands: string;
    helpCommand: string;
    statusCommand: string;
    versionCommand: string;
    clearCommand: string;
    exitCommand: string;
    commandCommand: string;
    withAiAgent: string;
    exampleQueries: string[];
    aiWillUseTools: string;
  };
  status: {
    currentConfig: string;
    versionLabel: string;
    contextLabel: string;
    namespaceLabel: string;
    debugLabel: string;
    autoExecuteLabel: string;
    aiAgentLabel: string;
    systemLabel: string;
    expandLabel: string;
    processingLabel: string;
    ready: string;
    notConfigured: string;
    enabled: string;
    disabled: string;
    connected: string;
    notSet: string;
    runningLabel: string;
  };
  command: {
    backgroundWarning: string;
  };
  hitl: {
    approveLabel: string;
    rejectLabel: string;
  };
  shortcuts: {
    sendLabel: string;
    cancelLabel: string;
    historyLabel: string;
    exitLabel: string;
  };
  errors: {
    initError: string;
    agentNotAvailable: string;
  };
}

const translations: Record<Language, Translations> = {
  "zh-CN": {
    app: {
      title: "OpenShell - 自然语言命令行助手",
      version: "版本",
      ready: "就绪！",
      initializing: "初始化 AI Agent",
      welcome: "欢迎使用 OpenShell！🚀 您的全能自然语言命令行助手。",
      agentInitialized: "AI Agent 已初始化，随时待命！",
      systemReady: "系统环境已就绪",
      systemContext: "主机",
      askAnything: "用自然语言告诉我您想做什么，我会为您执行相应的命令。",
      exitHint: "按 Esc 或 Ctrl+C 退出。",
      agentError: "Agent 错误",
      systemNotConfigured: "⚠ 系统配置未就绪。",
      aiNotConfigured:
        "⚠ AI 模型未配置。请在 ~/.config/openshell/.env 文件中设置 OPENAI_API_KEY、OPENAI_BASE_URL 和 OPENAI_API_MODEL。",
      builtInCommands: "您可以使用 /help 查看内置命令。",
      debugMode: "调试模式已启用",
      context: "环境",
      namespace: "用户",
      tipsLabel: "开始使用说明",
      tipInit: "运行 /init 创建配置文件",
      tipNewLine: "Shift + Enter 添加新行",
      tipReset: "双击 Esc 重置输入框",
      recentActivity: "最近活动",
      footerShortcuts: "? 查看快捷键",
    },
    help: {
      availableCommands: "可用命令：",
      helpCommand: "显示此帮助信息",
      statusCommand: "显示当前配置",
      versionCommand: "显示版本信息",
      clearCommand: "清除消息历史",
      exitCommand: "退出应用程序",
      commandCommand: "查看后台命令列表",
      withAiAgent: "启用 AI Agent 后，您可以：",
      exampleQueries: [
        '"列出当前目录下的所有文件并统计行数"',
        '"查找过去 24 小时内修改过的所有 .js 文件"',
        '"帮我安装 git"',
        '"查看当前的 CPU 和内存使用情况"',
        '"创建一个名为 test.txt 的文件并写入 Hello World"',
      ],
      aiWillUseTools: "AI 将根据您的意图自动执行命令行操作！",
    },
    status: {
      currentConfig: "当前配置：",
      versionLabel: "版本",
      contextLabel: "环境",
      namespaceLabel: "用户",
      debugLabel: "调试",
      autoExecuteLabel: "自主执行",
      aiAgentLabel: "AI Agent",
      systemLabel: "系统",
      expandLabel: "展开",
      processingLabel: "AI 正在处理中...",
      ready: "就绪",
      notConfigured: "未配置",
      enabled: "已启用",
      disabled: "已禁用",
      connected: "已就绪",
      notSet: "未设置",
      runningLabel: "运行中",
    },
    hitl: {
      approveLabel: "批准",
      rejectLabel: "拒绝",
    },
    shortcuts: {
      sendLabel: "发送",
      cancelLabel: "取消",
      historyLabel: "历史",
      exitLabel: "退出",
    },
    command: {
      backgroundWarning: "⚠ 注意：OpenShell 退出时所有后台命令将被终止。",
    },
    errors: {
      initError: "初始化 agent 时出错",
      agentNotAvailable:
        'AI Agent 不可用。请在 ~/.config/openshell/.env 文件中配置 OPENAI_API_KEY 和 OPENAI_BASE_URL。\n输入 "help" 查看可用命令。',
    },
  },
  "en-US": {
    app: {
      title: "OpenShell - Natural Language Command-Line Assistant",
      version: "Version",
      ready: "Ready!",
      initializing: "Initializing AI Agent",
      welcome:
        "Welcome to OpenShell! 🚀 Your all-in-one natural language shell assistant.",
      agentInitialized: "AI Agent initialized and ready to go!",
      systemReady: "System environment ready",
      systemContext: "host",
      askAnything:
        "Tell me what you want to do in natural language, and I will execute the commands for you.",
      exitHint: "Press Esc or Ctrl+C to exit.",
      agentError: "Agent error",
      systemNotConfigured: "⚠ System environment not ready.",
      aiNotConfigured:
        "⚠ AI Model not configured. Set OPENAI_API_KEY, OPENAI_BASE_URL, and OPENAI_API_MODEL in ~/.config/openshell/.env file.",
      builtInCommands: "You can use /help to see built-in commands.",
      debugMode: "Debug mode enabled",
      context: "Env",
      namespace: "User",
      tipsLabel: "Tips for getting started",
      tipInit: "Run /init to create configuration",
      tipNewLine: "Shift + Enter to add a new line",
      tipReset: "Press Esc twice to reset input",
      recentActivity: "Recent activity",
      footerShortcuts: "? for shortcuts",
    },
    help: {
      availableCommands: "Available commands:",
      helpCommand: "Show this help message",
      statusCommand: "Show current configuration",
      versionCommand: "Show version information",
      clearCommand: "Clear message history",
      exitCommand: "Exit the application",
      commandCommand: "List background commands",
      withAiAgent: "With AI Agent enabled, you can:",
      exampleQueries: [
        '"list all files in current directory and count lines"',
        '"find all .js files modified in the last 24 hours"',
        '"install git for me"',
        '"show current CPU and memory usage"',
        '"create a file named test.txt with Hello World"',
      ],
      aiWillUseTools:
        "The AI will automatically execute shell commands based on your intent!",
    },
    status: {
      currentConfig: "Current Configuration:",
      versionLabel: "Version",
      contextLabel: "Env",
      namespaceLabel: "User",
      debugLabel: "Debug",
      autoExecuteLabel: "Auto",
      aiAgentLabel: "AI Agent",
      systemLabel: "System",
      expandLabel: "Expand",
      processingLabel: "AI is processing...",
      ready: "Ready",
      notConfigured: "Not configured",
      enabled: "Enabled",
      disabled: "Disabled",
      connected: "Ready",
      notSet: "Not set",
      runningLabel: "Running",
    },
    hitl: {
      approveLabel: "Approve",
      rejectLabel: "Reject",
    },
    shortcuts: {
      sendLabel: "Send",
      cancelLabel: "Cancel",
      historyLabel: "History",
      exitLabel: "Exit",
    },
    command: {
      backgroundWarning:
        "⚠ Note: All background commands will be terminated when OpenShell exits.",
    },
    errors: {
      initError: "Error initializing agent",
      agentNotAvailable:
        'AI Agent not available. Please configure OPENAI_API_KEY and OPENAI_BASE_URL in ~/.config/openshell/.env file.\nType "help" for available commands.',
    },
  },
};

class I18n {
  private currentLanguage: Language;

  constructor(lang?: Language) {
    if (lang) {
      this.currentLanguage = lang;
    } else {
      // Read from environment variable, default to en-US
      const envLang = process.env["OPENSHHELL_LANG"];
      this.currentLanguage = this.validateLanguage(envLang);
    }
  }

  private validateLanguage(lang: string | undefined): Language {
    if (lang === "zh-CN" || lang === "zh") return "zh-CN";
    if (lang === "en-US" || lang === "en") return "en-US";
    return "en-US"; // Default value
  }

  setLanguage(lang: Language) {
    this.currentLanguage = lang;
  }

  getLanguage(): Language {
    return this.currentLanguage;
  }

  t(key: string): string {
    const keys = key.split(".");
    let value: any = translations[this.currentLanguage];

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    return typeof value === "string" ? value : key;
  }

  // Get array translations
  tArray(key: string): string[] {
    const keys = key.split(".");
    let value: any = translations[this.currentLanguage];

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return []; // Return empty array if translation not found
      }
    }

    return Array.isArray(value) ? value : [];
  }
}

// Lazy initialization - create instance on first use
let i18nInstance: I18n | null = null;

export const getI18n = (): I18n => {
  if (!i18nInstance) {
    i18nInstance = new I18n();
  }
  return i18nInstance;
};

// Helper functions for quick translation
export const t = (key: string) => getI18n().t(key);
export const tArray = (key: string) => getI18n().tArray(key);
