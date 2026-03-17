/**
 * OpenShell 主应用程序
 */

// 从ink库导入render函数，用于渲染终端UI
import { render } from "ink";
// 导入yargs库，用于解析命令行参数
import yargs from "yargs";
// 导入hideBin函数，用于处理命令行参数
import { hideBin } from "yargs/helpers";
// 导入主应用容器组件
import { AppContainer } from "./ui/AppContainer.js";
// 从核心库导入版本获取函数
import { getVersion } from "./core/index.js";

// 命令行参数接口定义
interface Arguments {
  // 调试模式标志
  debug?: boolean;
  // 自主执行模式
  autoExecute?: boolean;
  // 查询参数
  query?: string;
  // 会话 ID
  session?: string;
  // 位置参数数组，包含用户输入的查询内容
  _: (string | number)[];
}

// 主函数，应用程序入口点
export async function main() {
  // 解析命令行参数
  const argv = (await yargs(hideBin(process.argv))
    // 调试模式选项
    .option("debug", {
      alias: "d",
      type: "boolean",
      description: "启用调试模式",
      default: false,
    })
    // 自主执行模式选项
    .option("autoExecute", {
      alias: "a",
      type: "boolean",
      description: "启用自主执行模式",
      default: false,
    })
    // 查询选项
    .option("query", {
      alias: "q",
      type: "string",
      description: "直接执行的查询内容",
    })
    // 会话 ID 选项
    .option("session", {
      alias: "s",
      type: "string",
      description: "指定会话 ID 以恢复之前的对话（不指定则创建新会话）",
    })
    // 设置版本信息
    .version(getVersion())
    // 启用帮助选项
    .help()
    // 设置帮助选项的别名
    .alias("help", "h")
    // 解析并转换为Arguments类型
    .parse()) as Arguments;

  // 处理查询参数：优先使用--query选项，其次使用位置参数
  // 如果是直接执行模式且没有--query，使用位置参数作为查询
  let query = argv.query;
  if (!query && argv._.length > 0) {
    query = argv._.join(" ");
  }

  // 生成或恢复会话 ID
  const sessionId =
    argv.session || "s_" + Math.random().toString(36).substring(2, 8);

  // 创建应用程序配置对象
  const config = {
    // 调试模式标志（命令行 > 环境变量 > 默认值）
    debug: argv.debug || process.env["OPENSHELL_DEBUG"] === "true" || false,
    // 自主执行模式（命令行 > 环境变量 > 默认值）
    autoExecute:
      argv.autoExecute ||
      process.env["OPENSHELL_AUTO_EXECUTE"] === "true" ||
      false,
    // 应用程序版本
    version: getVersion(),
    // 用户查询内容
    query: query || undefined,
    // 语言配置
    lang: (process.env["OPENSHELL_LANG"] as "zh-CN" | "en-US") || "en-US",
    // 是否展示大标题 (默认展示)
    showBanner: process.env["OPENSHELL_SHOW_BANNER"] !== "false",
    // 会话 ID
    sessionId,
  };

  // 渲染主应用容器组件
  render(<AppContainer config={config} />, {
    // 禁用默认的 Ctrl+C 退出，交由 AppContainer 的按键逻辑处理，以实现清空输入框等高级交互
    exitOnCtrlC: false,
  });
}
