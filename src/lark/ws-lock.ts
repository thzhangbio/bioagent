import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const LOCK_REL = join("data", ".feishu-ws-subscriber.lock");

/** 防止同一台机器上误开两个 pnpm start，导致飞书把事件随机分给另一个连接 */
export function acquireFeishuWsLock(): void {
  const lockPath = join(process.cwd(), LOCK_REL);
  mkdirSync(join(process.cwd(), "data"), { recursive: true });

  if (existsSync(lockPath)) {
    const raw = readFileSync(lockPath, "utf8").trim();
    const oldPid = Number.parseInt(raw, 10);
    if (!Number.isNaN(oldPid)) {
      try {
        process.kill(oldPid, 0);
        console.error(
          `\n[fatal] 已有进程 PID=${oldPid} 占用飞书事件长连接（锁文件: ${LOCK_REL}）`
        );
        console.error(
          "请先结束该进程后再启动，例如: kill " +
            oldPid +
            "\n或确认没有其它终端在跑 pnpm start / lark-cli event\n"
        );
        process.exit(1);
      } catch {
        try {
          unlinkSync(lockPath);
        } catch {
          /* stale */
        }
      }
    }
  }

  writeFileSync(lockPath, String(process.pid), "utf8");

  const release = () => {
    try {
      unlinkSync(lockPath);
    } catch {
      /* ignore */
    }
  };
  process.on("exit", release);
  process.on("SIGINT", () => {
    release();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    release();
    process.exit(143);
  });
}
