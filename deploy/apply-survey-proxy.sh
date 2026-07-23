#!/usr/bin/env bash
# 一键：在 api.xolome.com 的 nginx server 内写入 /survey/ → Cloudflare Worker
# 在服务器上以 root 执行：
#   curl -fsSL https://raw.githubusercontent.com/HSDCT1230/XOLOme-market-survey/main/deploy/apply-survey-proxy.sh | bash
set -euo pipefail

WORKER_HOST="xolome-market-survey.xueyingwang1230.workers.dev"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请用 root 运行（或: sudo bash $0）"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "未找到 nginx"
  exit 1
fi

FRAG_FILE=$(mktemp)
cat >"$FRAG_FILE" <<EOF
    # --- xolome survey china proxy (managed by apply-survey-proxy.sh) ---
    location /survey/ {
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;
        proxy_set_header Host ${WORKER_HOST};
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
        proxy_pass https://${WORKER_HOST}/;
    }
    # --- end xolome survey china proxy ---
EOF

TARGET=""
for cand in \
  /etc/nginx/sites-enabled/api.xolome.com \
  /etc/nginx/sites-available/api.xolome.com \
  /etc/nginx/conf.d/api.xolome.com.conf \
  /etc/nginx/conf.d/api.conf
do
  if [[ -f "$cand" ]] && grep -q "api.xolome.com" "$cand" 2>/dev/null; then
    TARGET="$cand"
    break
  fi
done

if [[ -z "$TARGET" ]]; then
  TARGET=$(grep -RIl "server_name.*api\.xolome\.com" /etc/nginx 2>/dev/null | head -n1 || true)
fi

if [[ -z "$TARGET" ]]; then
  echo "未找到含 server_name api.xolome.com 的配置。请手动把以下内容贴进对应 server { }："
  cat "$FRAG_FILE"
  rm -f "$FRAG_FILE"
  exit 2
fi

echo "目标配置: $TARGET"
cp -a "$TARGET" "${TARGET}.bak.$(date +%Y%m%d%H%M%S)"

# 去掉旧片段
if grep -q "xolome survey china proxy" "$TARGET"; then
  sed -i '/xolome survey china proxy (managed/,/end xolome survey china proxy/d' "$TARGET"
fi

inject_with_python() {
  python3 - "$TARGET" "$FRAG_FILE" <<'PY'
import sys
path, frag_path = sys.argv[1], sys.argv[2]
frag = open(frag_path, encoding="utf-8").read()
text = open(path, encoding="utf-8").read()
idx = text.find("api.xolome.com")
if idx < 0:
    sys.exit(3)
s = text.rfind("server", 0, idx)
brace = text.find("{", s)
depth = 0
end = None
for i, ch in enumerate(text[brace:], start=brace):
    if ch == "{":
        depth += 1
    elif ch == "}":
        depth -= 1
        if depth == 0:
            end = i
            break
if end is None:
    sys.exit(3)
open(path, "w", encoding="utf-8").write(text[:end] + "\n" + frag + "\n" + text[end:])
print("injected")
PY
}

if command -v python3 >/dev/null 2>&1; then
  inject_with_python
else
  # 无 python：在文件末尾前不够稳，改为写出独立 include 文件并提示
  INC="/etc/nginx/snippets"
  mkdir -p "$INC"
  cp "$FRAG_FILE" "$INC/xolome-survey-proxy.conf"
  if ! grep -q "snippets/xolome-survey-proxy.conf" "$TARGET"; then
    # 在含 api.xolome.com 的那一行之后插入 include（粗糙但常够用）
    sed -i '/server_name.*api\.xolome\.com/a\    include snippets/xolome-survey-proxy.conf;' "$TARGET"
  fi
  echo "已用 include 方式注入（无 python3）"
fi

rm -f "$FRAG_FILE"

nginx -t
if systemctl reload nginx 2>/dev/null; then
  :
elif service nginx reload 2>/dev/null; then
  :
else
  nginx -s reload
fi

echo ""
echo "完成。验证："
echo "  curl -I https://api.xolome.com/survey/"
echo "  curl -s https://api.xolome.com/survey/api/health"
echo "问卷：https://api.xolome.com/survey/"
echo "后台：https://api.xolome.com/survey/admin"
