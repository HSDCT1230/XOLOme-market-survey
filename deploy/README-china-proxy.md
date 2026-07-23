# 国内打开问卷：一键反代说明（零基础）

## 为什么要反代？

问卷实际跑在 Cloudflare：  
`https://xolome-market-survey.xueyingwang1230.workers.dev/`

国内很多手机网络打开 `*.workers.dev` **会转圈/超时**。  
`api.xolome.com` 指向阿里云 `120.26.0.177`，国内可打开。  
做法：在这台阿里云 nginx 上加一段，把  
`https://api.xolome.com/survey/` **转发**到上面的 Worker。

> Cloudflare 账号里没有 `xolome.com` 域名（DNS 在万网/阿里云），没法直接绑 Workers 自定义域名。  
> 绑到 Cloudflare 上对中国大陆也不一定更稳；**阿里云本地反代是正解**。

---

## 最终给用户的链接（配好反代后）

| 用途 | 链接 |
|------|------|
| 填问卷（对外分享这个） | https://api.xolome.com/survey/ |
| 管理导出 | https://api.xolome.com/survey/admin |
| 海外/代理备用 | https://xolome-market-survey.xueyingwang1230.workers.dev/ |

生效：**nginx reload 后立刻生效**（不用改 DNS，一般不用等）。

---

## 你只需要做 1 件事（约 2 分钟）

本仓库机器人**没有** `120.26.0.177` 的 SSH 登录权限（本机公钥未授权），所以需要你在阿里云控制台点一次「远程连接」，粘贴下面命令。

### 步骤

1. 打开 [阿里云 ECS 控制台](https://ecs.console.aliyun.com/) → 找到 IP 为 `120.26.0.177` 的实例  
2. 点 **远程连接** → **Workbench**（网页终端即可）  
3. 用 **root** 登录（或可 sudo 的账号）  
4. 粘贴整行回车：

```bash
curl -fsSL https://raw.githubusercontent.com/HSDCT1230/XOLOme-market-survey/main/deploy/apply-survey-proxy.sh | bash
```

若服务器访问 GitHub raw 慢，可改用（把仓库里的脚本内容粘贴到 `apply-survey-proxy.sh` 后执行）：

```bash
# 手动：编辑 api.xolome.com 的 nginx server { }，加入 deploy/nginx-survey-china.conf 里的 location
nginx -t && systemctl reload nginx
```

5. 手机浏览器打开：https://api.xolome.com/survey/  
   应看到问卷页（不是 JSON 404）

### 想让机器人以后自动配？

在 ECS 控制台 → 该实例 → **密钥对 / 登录凭证**，把本机公钥加进 `root` 的 `~/.ssh/authorized_keys`：

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIErQ4kopNKt8YxqyAoDdz5ZA6yRYqfngPkMJS73JXW7Z xueyingwang1230@gmail.com
```

加好后回复「SSH 已开」，即可再跑一键脚本并帮你验证。

---

## 管理后台怎么用

1. 打开 https://api.xolome.com/survey/admin（反代前用 workers.dev/admin）  
2. 输入管理密钥（Cloudflare Worker Secret：`SURVEY_ADMIN_TOKEN`）  
3. 导出 CSV，用 Excel / 飞书做透视  

更细的分析步骤见 [`docs/数据分析与后台指南.md`](../docs/数据分析与后台指南.md)。

---

## 手动片段（不跑脚本时）

见同目录 [`nginx-survey-china.conf`](./nginx-survey-china.conf)。
