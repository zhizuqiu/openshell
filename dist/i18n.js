/**
 * Internationalization (i18n) support
 * Supports Chinese (zh) and English (en)
 * Default: Chinese
 */
const translations = {
    zh: {
        app: {
            title: 'OpenShell - 自然语言命令行助手',
            version: '版本',
            ready: '就绪！',
            initializing: '初始化 AI Agent',
            welcome: '欢迎使用 OpenShell！🚀 您的全能自然语言命令行助手。',
            agentInitialized: 'AI Agent 已初始化，随时待命！',
            k8sConnected: '系统环境已就绪',
            k8sContext: '主机',
            askAnything: '用自然语言告诉我您想做什么，我会为您执行相应的命令。',
            exitHint: '按 Esc 或 Ctrl+C 退出。',
            agentError: 'Agent 错误',
            k8sNotConfigured: '⚠ 系统配置未就绪。',
            aiNotConfigured: '⚠ AI 模型未配置。请在 .env 文件中设置 OPENAI_API_KEY、OPENAI_BASE_URL 和 OPENAI_API_MODEL。',
            builtInCommands: '您可以使用 /help 查看内置命令。',
            debugMode: '调试模式已启用',
            context: '环境',
            namespace: '用户',
            tipsLabel: '开始使用说明',
            tipInit: '运行 /init 创建配置文件',
            tipNewLine: 'Shift + Enter 添加新行',
            tipReset: '双击 Esc 重置输入框',
            recentActivity: '最近活动',
            footerShortcuts: '? 查看快捷键',
        },
        help: {
            availableCommands: '可用命令：',
            helpCommand: '显示此帮助信息',
            statusCommand: '显示当前配置',
            versionCommand: '显示版本信息',
            clearCommand: '清除消息历史',
            exitCommand: '退出应用程序',
            withAiAgent: '启用 AI Agent 后，您可以：',
            exampleQueries: [
                '"列出当前目录下的所有文件并统计行数"',
                '"查找过去 24 小时内修改过的所有 .js 文件"',
                '"帮我安装 git"',
                '"查看当前的 CPU 和内存使用情况"',
                '"创建一个名为 test.txt 的文件并写入 Hello World"',
            ],
            aiWillUseTools: 'AI 将根据您的意图自动执行命令行操作！',
        },
        status: {
            currentConfig: '当前配置：',
            versionLabel: '版本',
            contextLabel: '环境',
            namespaceLabel: '用户',
            debugLabel: '调试',
            autoExecuteLabel: '自主执行',
            aiAgentLabel: 'AI Agent',
            k8sLabel: '系统',
            expandLabel: '展开',
            processingLabel: 'AI 正在处理中...',
            ready: '就绪',
            notConfigured: '未配置',
            enabled: '已启用',
            disabled: '已禁用',
            connected: '已就绪',
            notSet: '未设置',
        },
        errors: {
            initError: '初始化 agent 时出错',
            agentNotAvailable: 'AI Agent 不可用。请在 .env 文件中配置 OPENAI_API_KEY 和 OPENAI_BASE_URL。\n输入 "help" 查看可用命令。',
        },
        kubernetes: {
            patchSuccess: '操作成功！',
            patchFailure: '操作失败，原因：{reason}',
        },
    },
    en: {
        app: {
            title: 'OpenShell - Natural Language Command-Line Assistant',
            version: 'Version',
            ready: 'Ready!',
            initializing: 'Initializing AI Agent',
            welcome: 'Welcome to OpenShell! 🚀 Your all-in-one natural language shell assistant.',
            agentInitialized: 'AI Agent initialized and ready to go!',
            k8sConnected: 'System environment ready',
            k8sContext: 'host',
            askAnything: 'Tell me what you want to do in natural language, and I will execute the commands for you.',
            exitHint: 'Press Esc or Ctrl+C to exit.',
            agentError: 'Agent error',
            k8sNotConfigured: '⚠ System environment not ready.',
            aiNotConfigured: '⚠ AI Model not configured. Set OPENAI_API_KEY, OPENAI_BASE_URL, and OPENAI_API_MODEL in .env file.',
            builtInCommands: 'You can use /help to see built-in commands.',
            debugMode: 'Debug mode enabled',
            context: 'Env',
            namespace: 'User',
            tipsLabel: 'Tips for getting started',
            tipInit: 'Run /init to create configuration',
            tipNewLine: 'Shift + Enter to add a new line',
            tipReset: 'Press Esc twice to reset input',
            recentActivity: 'Recent activity',
            footerShortcuts: '? for shortcuts',
        },
        help: {
            availableCommands: 'Available commands:',
            helpCommand: 'Show this help message',
            statusCommand: 'Show current configuration',
            versionCommand: 'Show version information',
            clearCommand: 'Clear message history',
            exitCommand: 'Exit the application',
            withAiAgent: 'With AI Agent enabled, you can:',
            exampleQueries: [
                '"list all files in current directory and count lines"',
                '"find all .js files modified in the last 24 hours"',
                '"install git for me"',
                '"show current CPU and memory usage"',
                '"create a file named test.txt with Hello World"',
            ],
            aiWillUseTools: 'The AI will automatically execute shell commands based on your intent!',
        },
        status: {
            currentConfig: 'Current Configuration:',
            versionLabel: 'Version',
            contextLabel: 'Env',
            namespaceLabel: 'User',
            debugLabel: 'Debug',
            autoExecuteLabel: 'Auto',
            aiAgentLabel: 'AI Agent',
            k8sLabel: 'System',
            expandLabel: 'Expand',
            processingLabel: 'AI is processing...',
            ready: 'Ready',
            notConfigured: 'Not configured',
            enabled: 'Enabled',
            disabled: 'Disabled',
            connected: 'Ready',
            notSet: 'Not set',
        },
        errors: {
            initError: 'Error initializing agent',
            agentNotAvailable: 'AI Agent not available. Please configure OPENAI_API_KEY and OPENAI_BASE_URL in .env file.\nType "help" for available commands.',
        },
        kubernetes: {
            patchSuccess: 'Operation successful!',
            patchFailure: 'Operation failed, reason: {reason}',
        },
    },
};
class I18n {
    currentLanguage = 'zh';
    setLanguage(lang) {
        this.currentLanguage = lang;
    }
    getLanguage() {
        return this.currentLanguage;
    }
    t(key) {
        const keys = key.split('.');
        let value = translations[this.currentLanguage];
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            }
            else {
                return key; // Return key if translation not found
            }
        }
        return typeof value === 'string' ? value : key;
    }
    // Get array translations
    tArray(key) {
        const keys = key.split('.');
        let value = translations[this.currentLanguage];
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            }
            else {
                return []; // Return empty array if translation not found
            }
        }
        return Array.isArray(value) ? value : [];
    }
}
export const i18n = new I18n();
// Helper functions for quick translation
export const t = (key) => i18n.t(key);
export const tArray = (key) => i18n.tArray(key);
//# sourceMappingURL=i18n.js.map