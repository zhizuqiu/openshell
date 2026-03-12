import { jsx as _jsx } from "react/jsx-runtime";
/**
 * OpenShell 主应用程序
 */
// 导入dotenv，用于加载环境变量
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// 确定优先级路径
const localEnvPath = join(__dirname, '..', '.env');
const globalEnvPath = join(os.homedir(), '.openshell', '.env');
// 按优先级加载：优先读程序同级目录的 .env (适合本地开发)，否则读家目录 (适合全局安装)
if (fs.existsSync(localEnvPath)) {
    config({ path: localEnvPath, override: true, quiet: true });
}
else if (fs.existsSync(globalEnvPath)) {
    config({ path: globalEnvPath, override: true, quiet: true });
}
// 从ink库导入render函数，用于渲染终端UI
import { render } from 'ink';
// 导入yargs库，用于解析命令行参数
import yargs from 'yargs';
// 导入hideBin函数，用于处理命令行参数
import { hideBin } from 'yargs/helpers';
// 导入主应用容器组件
import { AppContainer } from './ui/AppContainer.js';
// 从核心库导入版本获取函数
import { getVersion } from './core/index.js';
// 主函数，应用程序入口点
export async function main() {
    // 解析命令行参数
    const argv = (await yargs(hideBin(process.argv))
        // 调试模式选项
        .option('debug', {
        alias: 'd',
        type: 'boolean',
        description: '启用调试模式',
        default: false,
    })
        // 自主执行模式选项
        .option('autoExecute', {
        alias: 'a',
        type: 'boolean',
        description: '启用自主执行模式',
        default: false,
    })
        // 查询选项
        .option('query', {
        alias: 'q',
        type: 'string',
        description: '直接执行的查询内容',
    })
        // 设置版本信息
        .version(getVersion())
        // 启用帮助选项
        .help()
        // 设置帮助选项的别名
        .alias('help', 'h')
        // 解析并转换为Arguments类型
        .parse());
    // 处理查询参数：优先使用--query选项，其次使用位置参数
    // 如果是直接执行模式且没有--query，使用位置参数作为查询
    let query = argv.query;
    if (!query && argv._.length > 0) {
        query = argv._.join(' ');
    }
    // 创建应用程序配置对象
    const config = {
        // 调试模式标志
        debug: argv.debug || false,
        // 自主执行模式
        autoExecute: argv.autoExecute || false,
        // 应用程序版本
        version: getVersion(),
        // 用户查询内容
        query: query || undefined,
    };
    // 渲染主应用容器组件
    render(_jsx(AppContainer, { config: config }), {
        // 按Ctrl+C时退出应用
        exitOnCtrlC: true,
    });
}
//# sourceMappingURL=openshell.js.map